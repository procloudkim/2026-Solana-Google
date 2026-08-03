#!/usr/bin/env python3
"""Operate the hackathon readiness control plane.

The control plane is deliberately local and dependency-free. It turns official
research, explicit product decisions, and redacted runtime receipts into an
append-only execution ledger, a derived state snapshot, and operational
LLM-Wiki pages. It never accesses credentials, signs transactions, deploys
services, spends funds, publishes artifacts, or submits to the hackathon.
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from typing import Any, Iterable, Iterator, Mapping, Sequence
import uuid


SCRIPT_PATH = Path(__file__).resolve()
WORKFLOW_DIR = SCRIPT_PATH.parent
if str(WORKFLOW_DIR) not in sys.path:
    sys.path.insert(0, str(WORKFLOW_DIR))

from common import atomic_write_json, atomic_write_text, ensure_within  # noqa: E402


SCHEMA_VERSION = 1
DEFAULT_ROOT = SCRIPT_PATH.parents[2]
CONTROL_PATH = Path(".harness/control")
CONFIG_PATH = CONTROL_PATH / "config.json"
LEDGER_PATH = CONTROL_PATH / "execution_ledger.jsonl"
STATE_PATH = CONTROL_PATH / "state.json"
FACTS_PATH = CONTROL_PATH / "facts.json"
OPERATIONS_PATH = Path(".harness/wiki/operations")
SUBMISSION_PATH = Path(".harness/submission")
OFFICIAL_PATH = Path("research/official-docs-wiki")

STATE_ORDER = (
    "DISCOVERY",
    "CANDIDATES_READY",
    "PRODUCT_LOCKED",
    "CONTRACT_READY",
    "LOCAL_SLICE_PASSED",
    "DEVNET_PROVEN",
    "HARDENED",
    "SUBMISSION_READY",
    "SUBMITTED",
)

CANDIDATE_WEIGHTS = {
    "official_fit": 0.25,
    "payment_proof": 0.25,
    "solo_feasibility": 0.20,
    "user_value": 0.15,
    "demo_clarity": 0.10,
    "cost_risk": 0.05,
}

CANDIDATE_FIELDS = (
    "id",
    "title",
    "primary_track",
    "persona",
    "problem",
    "agent_decision",
    "paid_action",
    "solana_transaction",
    "gcp_audit_path",
)

PRODUCT_CONTRACT_FIELDS = (
    "id",
    "candidate_id",
    "title",
    "persona",
    "problem",
    "primary_track",
    "agent_decision",
    "spending_policy",
    "payment_protocol",
    "network",
    "gcp_path",
    "happy_path",
    "failure_paths",
    "acceptance_receipts",
    "excluded_features",
    "submission_narrative",
)

LOCAL_RECEIPTS = ("local_agent_test", "sandbox_payment_test")
RUNTIME_RECEIPTS = ("gemini_trace", "solana_devnet_tx", "gcp_runtime_log")
HARDENING_RECEIPTS = (
    "idempotency_test",
    "budget_cap_test",
    "approval_policy_test",
    "prompt_injection_test",
    "retry_timeout_test",
)
SUBMISSION_RECEIPTS = (
    "product_intro_validated",
    "github_repo_validated",
    "demo_video_validated",
    "fresh_clone_test",
)
APPROVAL_REQUIRED_RECEIPTS = frozenset(RUNTIME_RECEIPTS)
APPROVAL_ACTION_BY_RECEIPT = {
    "gemini_trace": "credentialed_external_call",
    "solana_devnet_tx": "wallet_signature",
    "gcp_runtime_log": "credentialed_external_call",
}

SECRET_KEY_PATTERN = re.compile(
    r"(private[_-]?key|secret|api[_-]?key|password|credential|"
    r"seed[_-]?phrase|mnemonic|access[_-]?token|refresh[_-]?token)",
    re.IGNORECASE,
)
SECRET_VALUE_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\b(?:sk|AIza)[-_A-Za-z0-9]{20,}\b"),
)
MARKDOWN_LINK_PATTERN = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")
SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")

DEFAULT_CONFIG: dict[str, Any] = {
    "schema_version": SCHEMA_VERSION,
    "event": {
        "deadline": "2026-08-03T23:59:00+09:00",
        "pivot_deadline": "2026-07-30T23:59:00+09:00",
        "demo_day": "2026-08-21",
        "official_freshness_hours": 24,
    },
    "candidate_selection": {
        "required_count": 3,
        "minimum_score": 75.0,
        "minimum_margin": 5.0,
        "weights": CANDIDATE_WEIGHTS,
    },
    "runtime_policy": {
        "team_size": 1,
        "default_network": "solana-devnet",
        "mainnet_enabled": False,
        "approval_required": [
            "credential_access",
            "credentialed_external_call",
            "wallet_signature",
            "cloud_deployment",
            "paid_usage",
            "public_publish",
            "hackathon_submission",
        ],
    },
    "ideation": {
        "mode": "approved-external-input",
        "default_input": ".harness/control/candidates.input.json",
        "note": (
            "Generate exactly three candidates with an approved agents-cli "
            "session, then pass the schema-validated JSON to `ideate --input`."
        ),
    },
}


class ReadinessError(RuntimeError):
    """Raised when a readiness invariant or gate is violated."""


def _now() -> datetime:
    return datetime.now().astimezone()


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        raise ReadinessError("timestamps must include a timezone")
    return value.isoformat()


def _parse_datetime(value: Any, field_name: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ReadinessError(f"{field_name} must be a non-empty ISO timestamp")
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ReadinessError(f"{field_name} is not a valid ISO timestamp") from exc
    if parsed.tzinfo is None:
        raise ReadinessError(f"{field_name} must include a timezone")
    return parsed


def _parse_date_or_datetime(value: Any, field_name: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ReadinessError(f"{field_name} must be a date or timestamp")
    stripped = value.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", stripped):
        return datetime.fromisoformat(f"{stripped}T00:00:00+09:00")
    return _parse_datetime(stripped, field_name)


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise ReadinessError(f"required JSON file is missing: {path}") from exc
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ReadinessError(f"cannot read JSON file {path}: {exc}") from exc


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _digest_values(*values: Any) -> str:
    digest = hashlib.sha256()
    for value in values:
        digest.update(_canonical_json(value).encode("utf-8"))
        digest.update(b"\0")
    return digest.hexdigest()


def _require_mapping(value: Any, field_name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ReadinessError(f"{field_name} must be an object")
    return value


def _require_sequence(value: Any, field_name: str) -> list[Any]:
    if not isinstance(value, list):
        raise ReadinessError(f"{field_name} must be an array")
    return value


def _require_text(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ReadinessError(f"{field_name} must be non-empty text")
    return value.strip()


def _resolve(root: Path, relative: Path) -> Path:
    return ensure_within(root / relative, root)


def load_config(root: Path | str) -> dict[str, Any]:
    root_path = Path(root).resolve()
    path = _resolve(root_path, CONFIG_PATH)
    if not path.is_file():
        return json.loads(json.dumps(DEFAULT_CONFIG))
    payload = _require_mapping(_read_json(path), "readiness config")
    if payload.get("schema_version") != SCHEMA_VERSION:
        raise ReadinessError("unsupported readiness config schema_version")
    merged = json.loads(json.dumps(DEFAULT_CONFIG))
    for key, value in payload.items():
        if isinstance(value, Mapping) and isinstance(merged.get(key), dict):
            merged[key].update(value)
        else:
            merged[key] = value
    return merged


def _validate_score(value: Any, field_name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ReadinessError(f"{field_name} must be a number from 0 to 100")
    numeric = float(value)
    if numeric < 0 or numeric > 100:
        raise ReadinessError(f"{field_name} must be between 0 and 100")
    return numeric


def validate_candidate(value: Any) -> dict[str, Any]:
    candidate = dict(_require_mapping(value, "candidate"))
    for field in CANDIDATE_FIELDS:
        candidate[field] = _require_text(candidate.get(field), f"candidate.{field}")
    if not SAFE_IDENTIFIER.fullmatch(candidate["id"]):
        raise ReadinessError("candidate.id contains unsupported characters")
    scores = _require_mapping(candidate.get("scores"), "candidate.scores")
    normalized_scores: dict[str, float] = {}
    for score_name in CANDIDATE_WEIGHTS:
        normalized_scores[score_name] = _validate_score(
            scores.get(score_name), f"candidate.scores.{score_name}"
        )
    candidate["scores"] = normalized_scores
    return candidate


def score_candidate(
    value: Any, weights: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    candidate = validate_candidate(value)
    selected_weights = dict(weights or CANDIDATE_WEIGHTS)
    if set(selected_weights) != set(CANDIDATE_WEIGHTS):
        raise ReadinessError("candidate weights must define the six required fields")
    normalized_weights = {
        name: float(selected_weights[name]) for name in CANDIDATE_WEIGHTS
    }
    if any(weight < 0 for weight in normalized_weights.values()):
        raise ReadinessError("candidate weights must be non-negative")
    if abs(sum(normalized_weights.values()) - 1.0) > 0.000001:
        raise ReadinessError("candidate weights must sum to 1.0")
    total = sum(
        candidate["scores"][name] * weight
        for name, weight in normalized_weights.items()
    )
    return {
        "candidate_id": candidate["id"],
        "title": candidate["title"],
        "primary_track": candidate["primary_track"],
        "scores": candidate["scores"],
        "total_score": round(total, 2),
    }


def select_candidate(
    values: Any, selection_config: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    policy = dict(selection_config or {})
    required_count = int(policy.get("required_count", 3))
    minimum_score = float(policy.get("minimum_score", 75.0))
    minimum_margin = float(policy.get("minimum_margin", 5.0))
    weights = policy.get("weights", CANDIDATE_WEIGHTS)
    raw_candidates = _require_sequence(values, "candidates")
    if len(raw_candidates) != required_count:
        raise ReadinessError(f"exactly {required_count} candidates are required")
    candidates = [validate_candidate(item) for item in raw_candidates]
    ids = [item["id"] for item in candidates]
    if len(set(ids)) != len(ids):
        raise ReadinessError("candidate ids must be unique")
    tracks = [item["primary_track"].casefold() for item in candidates]
    if len(set(tracks)) != len(tracks):
        raise ReadinessError("candidate primary tracks must be distinct")

    ranking = sorted(
        (score_candidate(item, weights) for item in candidates),
        key=lambda item: (-item["total_score"], item["candidate_id"]),
    )
    top = ranking[0]
    runner_up = ranking[1]
    margin = round(top["total_score"] - runner_up["total_score"], 2)
    locked = top["total_score"] >= minimum_score and margin >= minimum_margin
    return {
        "status": "locked" if locked else "ambiguous",
        "winner_id": top["candidate_id"] if locked else None,
        "margin": margin,
        "minimum_score": minimum_score,
        "minimum_margin": minimum_margin,
        "ranking": ranking,
        "candidates": candidates,
    }


def _walk_for_secrets(value: Any, path: str = "$") -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            key_text = str(key)
            if SECRET_KEY_PATTERN.search(key_text):
                raise ReadinessError(f"secret-like key is forbidden at {path}.{key_text}")
            _walk_for_secrets(nested, f"{path}.{key_text}")
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            _walk_for_secrets(nested, f"{path}[{index}]")
    elif isinstance(value, str):
        for pattern in SECRET_VALUE_PATTERNS:
            if pattern.search(value):
                raise ReadinessError(f"secret-like value is forbidden at {path}")


def validate_receipt(value: Any) -> dict[str, Any]:
    receipt = dict(_require_mapping(value, "receipt"))
    _walk_for_secrets(receipt)
    for field in ("receipt_id", "gate_id", "kind", "environment", "verifier"):
        receipt[field] = _require_text(receipt.get(field), f"receipt.{field}")
    if not SAFE_IDENTIFIER.fullmatch(receipt["receipt_id"]):
        raise ReadinessError("receipt.receipt_id contains unsupported characters")
    receipt["timestamp"] = _iso(
        _parse_datetime(receipt.get("timestamp"), "receipt.timestamp")
    )
    result = _require_text(receipt.get("result"), "receipt.result").casefold()
    if result not in {"pass", "fail", "blocked"}:
        raise ReadinessError("receipt.result must be pass, fail, or blocked")
    receipt["result"] = result

    hashes = _require_mapping(receipt.get("artifact_hashes"), "receipt.artifact_hashes")
    normalized_hashes: dict[str, str] = {}
    for path, digest in hashes.items():
        path_text = _require_text(path, "receipt artifact path")
        digest_text = _require_text(digest, f"receipt hash for {path_text}").casefold()
        if not HEX_SHA256.fullmatch(digest_text):
            raise ReadinessError(f"receipt hash for {path_text} must be SHA-256")
        normalized_hashes[path_text] = digest_text
    receipt["artifact_hashes"] = normalized_hashes
    receipt["external_refs"] = dict(
        _require_mapping(receipt.get("external_refs"), "receipt.external_refs")
    )
    if receipt["kind"] in APPROVAL_REQUIRED_RECEIPTS:
        _require_text(
            receipt["external_refs"].get("approval_id"),
            f"receipt.external_refs.approval_id for {receipt['kind']}",
        )
    receipt["redactions"] = list(
        _require_sequence(receipt.get("redactions"), "receipt.redactions")
    )
    return receipt


def validate_product_contract(value: Any) -> dict[str, Any]:
    contract = dict(_require_mapping(value, "product contract"))
    scalar_fields = PRODUCT_CONTRACT_FIELDS[:12] + ("submission_narrative",)
    for field in scalar_fields:
        contract[field] = _require_text(contract.get(field), f"product_contract.{field}")
    if not SAFE_IDENTIFIER.fullmatch(contract["id"]):
        raise ReadinessError("product_contract.id contains unsupported characters")
    for field in ("failure_paths", "acceptance_receipts", "excluded_features"):
        items = _require_sequence(contract.get(field), f"product_contract.{field}")
        contract[field] = [
            _require_text(item, f"product_contract.{field} item") for item in items
        ]
        if not contract[field]:
            raise ReadinessError(f"product_contract.{field} must not be empty")
    _walk_for_secrets(contract)
    return contract


def validate_approval(value: Any) -> dict[str, Any]:
    approval = dict(_require_mapping(value, "approval"))
    _walk_for_secrets(approval)
    for field in ("approval_id", "scope", "approved_by"):
        approval[field] = _require_text(approval.get(field), f"approval.{field}")
    if not SAFE_IDENTIFIER.fullmatch(approval["approval_id"]):
        raise ReadinessError("approval.approval_id contains unsupported characters")
    actions = _require_sequence(approval.get("actions"), "approval.actions")
    approval["actions"] = sorted(
        {
            _require_text(action, "approval action")
            for action in actions
        }
    )
    if not approval["actions"]:
        raise ReadinessError("approval.actions must not be empty")
    approval["approved_at"] = _iso(
        _parse_datetime(approval.get("approved_at"), "approval.approved_at")
    )
    expires_at = approval.get("expires_at")
    approval["expires_at"] = (
        _iso(_parse_datetime(expires_at, "approval.expires_at"))
        if expires_at is not None
        else None
    )
    return approval


def read_events(root: Path | str) -> list[dict[str, Any]]:
    root_path = Path(root).resolve()
    path = _resolve(root_path, LEDGER_PATH)
    if not path.is_file():
        return []
    events: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        raise ReadinessError(f"cannot read execution ledger: {exc}") from exc
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ReadinessError(
                f"invalid execution ledger JSON at line {line_number}"
            ) from exc
        event = dict(_require_mapping(value, f"ledger line {line_number}"))
        event_id = _require_text(event.get("event_id"), "event.event_id")
        if event_id in seen_ids:
            raise ReadinessError(f"duplicate event id in ledger: {event_id}")
        seen_ids.add(event_id)
        _require_text(event.get("type"), "event.type")
        _parse_datetime(event.get("timestamp"), "event.timestamp")
        _require_mapping(event.get("payload"), "event.payload")
        events.append(event)
    return events


@contextmanager
def _ledger_lock(root: Path) -> Iterator[None]:
    control = _resolve(root, CONTROL_PATH)
    control.mkdir(parents=True, exist_ok=True)
    lock_path = control / "execution.lock"
    try:
        descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise ReadinessError("readiness ledger is locked by another process") from exc
    try:
        os.write(descriptor, str(os.getpid()).encode("ascii"))
        os.close(descriptor)
        yield
    finally:
        try:
            lock_path.unlink(missing_ok=True)
        except OSError:
            pass


def append_event(
    root: Path | str,
    event_type: str,
    payload: Mapping[str, Any],
    *,
    now: datetime | None = None,
    actor: str = "harness",
) -> dict[str, Any]:
    root_path = Path(root).resolve()
    timestamp = now or _now()
    event = {
        "schema_version": SCHEMA_VERSION,
        "event_id": f"evt-{uuid.uuid4().hex}",
        "type": _require_text(event_type, "event type"),
        "timestamp": _iso(timestamp),
        "actor": _require_text(actor, "event actor"),
        "payload": dict(payload),
    }
    _walk_for_secrets(event)
    ledger = _resolve(root_path, LEDGER_PATH)
    ledger.parent.mkdir(parents=True, exist_ok=True)
    with _ledger_lock(root_path):
        with ledger.open("a", encoding="utf-8", newline="\n") as stream:
            stream.write(_canonical_json(event) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
    return event


def _latest_event(events: Iterable[Mapping[str, Any]], event_type: str) -> Mapping[str, Any] | None:
    latest: Mapping[str, Any] | None = None
    for event in events:
        if event.get("type") == event_type:
            latest = event
    return latest


def _receipt_map(events: Iterable[Mapping[str, Any]]) -> dict[str, dict[str, Any]]:
    receipts: dict[str, dict[str, Any]] = {}
    for event in events:
        if event.get("type") != "receipt_recorded":
            continue
        payload = validate_receipt(event.get("payload"))
        receipts[payload["receipt_id"]] = payload
    return receipts


def _passed_kinds(
    receipts: Mapping[str, Mapping[str, Any]],
    approvals: Mapping[str, Mapping[str, Any]],
) -> set[str]:
    passed: set[str] = set()
    for receipt in receipts.values():
        if receipt.get("result") != "pass":
            continue
        kind = str(receipt.get("kind"))
        expected_action = APPROVAL_ACTION_BY_RECEIPT.get(kind)
        if expected_action:
            approval_id = str(receipt.get("external_refs", {}).get("approval_id", ""))
            approval = approvals.get(approval_id)
            if approval is None or expected_action not in approval.get("actions", []):
                continue
            expires_at = approval.get("expires_at")
            if expires_at is not None:
                receipt_time = _parse_datetime(
                    receipt.get("timestamp"), "receipt.timestamp"
                )
                if receipt_time > _parse_datetime(
                    expires_at, "approval.expires_at"
                ):
                    continue
        passed.add(kind)
    return passed


def _approval_map(events: Iterable[Mapping[str, Any]]) -> dict[str, dict[str, Any]]:
    approvals: dict[str, dict[str, Any]] = {}
    for event in events:
        if event.get("type") != "approval_granted":
            continue
        payload = validate_approval(event.get("payload"))
        approvals[payload["approval_id"]] = payload
    return approvals


def _missing(required: Iterable[str], passed: set[str]) -> list[str]:
    return [item for item in required if item not in passed]


def _state_at_least(state: str, target: str) -> bool:
    return STATE_ORDER.index(state) >= STATE_ORDER.index(target)


def replay_events(
    events: Sequence[Mapping[str, Any]],
    *,
    now: datetime | None = None,
    config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    config_value = dict(config or DEFAULT_CONFIG)
    current_time = now or _now()
    receipts = _receipt_map(events)
    approvals = _approval_map(events)
    passed = _passed_kinds(receipts, approvals)
    knowledge_event = _latest_event(events, "knowledge_validated")
    candidates_event = _latest_event(events, "candidates_evaluated")
    product_event = _latest_event(events, "product_locked")
    contract_event = _latest_event(events, "product_contract")
    pack_event = _latest_event(events, "submission_pack_built")
    submitted_event = _latest_event(events, "submission_recorded")
    pivot_event = _latest_event(events, "pivot_applied")

    gates: dict[str, dict[str, Any]] = {}
    state = "DISCOVERY"
    blockers: list[str] = []
    next_action = "prepare"

    gates["G0"] = {
        "name": "Knowledge",
        "status": "passed" if knowledge_event else "pending",
    }
    if not knowledge_event:
        blockers = ["official_knowledge_validation"]
        next_action = "prepare"
    else:
        gates["G1"] = {
            "name": "Candidate",
            "status": "passed" if product_event else "pending",
        }
        if product_event:
            state = "PRODUCT_LOCKED"
        elif candidates_event:
            state = "CANDIDATES_READY"
            blockers = ["candidate_decision"]
            next_action = "record_product_lock"
        else:
            blockers = ["candidate_set"]
            next_action = "ideate"

    if product_event:
        gates["G2"] = {
            "name": "Contract",
            "status": "passed" if contract_event else "pending",
        }
        if contract_event:
            state = "CONTRACT_READY"
        else:
            blockers = ["product_contract"]
            next_action = "record_product_contract"

    if contract_event:
        local_missing = _missing(LOCAL_RECEIPTS, passed)
        gates["G3"] = {
            "name": "Local slice",
            "status": "passed" if not local_missing else "pending",
            "missing": local_missing,
        }
        if not local_missing:
            state = "LOCAL_SLICE_PASSED"
        else:
            blockers = local_missing
            next_action = "prove_local_slice"

    if _state_at_least(state, "LOCAL_SLICE_PASSED"):
        runtime_missing = _missing(RUNTIME_RECEIPTS, passed)
        gates["G4"] = {
            "name": "Runtime",
            "status": "passed" if not runtime_missing else "pending",
            "missing": runtime_missing,
        }
        if not runtime_missing:
            state = "DEVNET_PROVEN"
        else:
            blockers = runtime_missing
            next_action = "prove_runtime"

    if _state_at_least(state, "DEVNET_PROVEN"):
        hardening_missing = _missing(HARDENING_RECEIPTS, passed)
        gates["G5"] = {
            "name": "Hardening",
            "status": "passed" if not hardening_missing else "pending",
            "missing": hardening_missing,
        }
        if not hardening_missing:
            state = "HARDENED"
        else:
            blockers = hardening_missing
            next_action = "harden"

    if _state_at_least(state, "HARDENED"):
        submission_missing = _missing(SUBMISSION_RECEIPTS, passed)
        if not pack_event:
            submission_missing.insert(0, "submission_pack")

        freshness_hours = float(
            config_value.get("event", {}).get("official_freshness_hours", 24)
        )
        official_fresh = False
        if knowledge_event:
            validated_at = _parse_datetime(
                knowledge_event["timestamp"], "knowledge event timestamp"
            )
            official_fresh = current_time - validated_at <= timedelta(
                hours=freshness_hours
            )
        if not official_fresh:
            submission_missing.append("official_contract_refresh")

        gates["G6"] = {
            "name": "Submission",
            "status": "passed" if not submission_missing else "pending",
            "missing": submission_missing,
        }
        if not submission_missing:
            state = "SUBMISSION_READY"
        else:
            blockers = submission_missing
            next_action = "pack_or_validate_submission"

    if _state_at_least(state, "SUBMISSION_READY"):
        gates["G7"] = {
            "name": "Submit",
            "status": "passed" if submitted_event else "pending",
        }
        if submitted_event:
            state = "SUBMITTED"
            blockers = []
            next_action = "monitor"
        else:
            blockers = ["submission_receipt"]
            next_action = "approve_and_submit"

    overlay: str | None = None
    pivot_deadline = _parse_datetime(
        config_value.get("event", {}).get(
            "pivot_deadline", DEFAULT_CONFIG["event"]["pivot_deadline"]
        ),
        "event.pivot_deadline",
    )
    if (
        current_time >= pivot_deadline
        and not _state_at_least(state, "DEVNET_PROVEN")
        and not pivot_event
    ):
        overlay = "PIVOT_REQUIRED"
        next_action = "apply_pivot"

    latest_candidates = (
        dict(candidates_event["payload"]) if candidates_event else None
    )
    product = dict(product_event["payload"]) if product_event else None
    contract = dict(contract_event["payload"]) if contract_event else None
    if contract is not None and pivot_event is not None:
        contract = dict(contract)
        excluded = list(contract.get("excluded_features", []))
        pivot_exclusion = "all nonessential multi-agent and presentation features"
        if pivot_exclusion not in excluded:
            excluded.append(pivot_exclusion)
        contract["excluded_features"] = excluded
        contract["happy_path"] = (
            "One agent decision -> one bounded payment -> one Solana Devnet "
            "transaction -> one GCP runtime log."
        )
        contract["acceptance_receipts"] = list(RUNTIME_RECEIPTS)
        contract["pivoted"] = True
        contract["base_contract_id"] = contract.get("id")
    return {
        "schema_version": SCHEMA_VERSION,
        "derived_at": _iso(current_time),
        "state": state,
        "overlay": overlay,
        "next_action": next_action,
        "blockers": blockers,
        "gates": gates,
        "candidate_evaluation": latest_candidates,
        "product": product,
        "product_contract": contract,
        "pivot": dict(pivot_event["payload"]) if pivot_event else None,
        "receipts": sorted(
            (
                {
                    "receipt_id": item["receipt_id"],
                    "kind": item["kind"],
                    "result": item["result"],
                    "environment": item["environment"],
                    "timestamp": item["timestamp"],
                    "approval_id": item.get("external_refs", {}).get("approval_id"),
                }
                for item in receipts.values()
            ),
            key=lambda item: (item["timestamp"], item["receipt_id"]),
        ),
        "approvals": sorted(
            (
                {
                    "approval_id": item["approval_id"],
                    "actions": item["actions"],
                    "scope": item["scope"],
                    "approved_by": item["approved_by"],
                    "approved_at": item["approved_at"],
                    "expires_at": item["expires_at"],
                }
                for item in approvals.values()
            ),
            key=lambda item: (item["approved_at"], item["approval_id"]),
        ),
        "event_count": len(events),
    }


def validate_official_research(
    root: Path | str,
    *,
    now: datetime | None = None,
) -> dict[str, Any]:
    root_path = Path(root).resolve()
    manifest_path = _resolve(root_path, OFFICIAL_PATH / "manifest.json")
    ledger_path = _resolve(root_path, OFFICIAL_PATH / "claim-ledger.json")
    main_manifest_path = _resolve(root_path, Path(".harness/wiki/manifest.json"))
    manifest = _require_mapping(_read_json(manifest_path), "official manifest")
    claims_payload = _require_mapping(_read_json(ledger_path), "official claim ledger")
    main_manifest = _require_mapping(_read_json(main_manifest_path), "wiki manifest")

    sources = _require_sequence(
        manifest.get("official_sources"), "official manifest sources"
    )
    source_ids: set[str] = set()
    for source in sources:
        source_value = _require_mapping(source, "official source")
        source_id = _require_text(source_value.get("id"), "official source id")
        url = _require_text(source_value.get("url"), "official source url")
        if not url.startswith("https://"):
            raise ReadinessError(f"official source must use HTTPS: {source_id}")
        if source_id in source_ids:
            raise ReadinessError(f"duplicate official source id: {source_id}")
        source_ids.add(source_id)

    claims = _require_sequence(claims_payload.get("claims"), "official claims")
    unknown_ids: list[str] = []
    for claim in claims:
        claim_value = _require_mapping(claim, "official claim")
        claim_id = _require_text(claim_value.get("id"), "official claim id")
        for source_id in _require_sequence(
            claim_value.get("source_ids"), f"claim {claim_id} source_ids"
        ):
            if source_id not in source_ids:
                unknown_ids.append(f"{claim_id}:{source_id}")
    if unknown_ids:
        raise ReadinessError(
            "official claims reference unknown source ids: " + ", ".join(unknown_ids)
        )

    missing_inputs: list[str] = []
    artifacts = manifest.get("artifacts", [])
    if artifacts is not None:
        for artifact in _require_sequence(artifacts, "official manifest artifacts"):
            artifact_text = _require_text(artifact, "official artifact path")
            artifact_path = ensure_within(root_path / artifact_text, root_path)
            if not artifact_path.is_file():
                missing_inputs.append(artifact_text)
    if missing_inputs:
        raise ReadinessError(
            "official research input artifacts are missing: "
            + ", ".join(sorted(missing_inputs))
        )

    broken_links: list[str] = []
    official_root = _resolve(root_path, OFFICIAL_PATH)
    for markdown_path in sorted(official_root.rglob("*.md")):
        try:
            text = markdown_path.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as exc:
            raise ReadinessError(f"cannot read official Markdown {markdown_path}") from exc
        for match in MARKDOWN_LINK_PATTERN.finditer(text):
            target = match.group(1).strip()
            if target.startswith(("https://", "http://", "mailto:", "#")):
                continue
            relative_target = target.split("#", 1)[0]
            resolved_target = ensure_within(
                markdown_path.parent / relative_target, root_path
            )
            if not resolved_target.exists():
                broken_links.append(
                    f"{markdown_path.relative_to(root_path).as_posix()}->{target}"
                )
    if broken_links:
        raise ReadinessError(
            "official research has broken local links: "
            + ", ".join(sorted(broken_links))
        )

    as_of = _parse_date_or_datetime(
        claims_payload.get("as_of") or manifest.get("generated_at"),
        "official research as_of",
    )
    current_time = now or _now()
    age_hours = max(0.0, (current_time - as_of).total_seconds() / 3600)
    verdict_counts: dict[str, int] = {}
    for claim in claims:
        verdict = str(claim.get("verdict", "unknown"))
        verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1
    digest = _digest_values(manifest, claims_payload, main_manifest)
    return {
        "digest": digest,
        "official_as_of": as_of.isoformat(),
        "validated_at": _iso(current_time),
        "official_source_count": len(sources),
        "claim_count": len(claims),
        "unknown_source_ids": 0,
        "broken_local_links": 0,
        "missing_input_artifacts": 0,
        "verdict_counts": verdict_counts,
        "main_wiki_entry_count": len(
            main_manifest.get("entries", [])
            if isinstance(main_manifest.get("entries"), list)
            else []
        ),
        "age_hours": round(age_hours, 2),
        "unresolved_high_impact": [],
    }


def _fact_domain(claim: Mapping[str, Any]) -> str:
    searchable = _canonical_json(claim).casefold()
    if any(term in searchable for term in ("deadline", "demo day", "submission", "team")):
        return "event"
    if any(term in searchable for term in ("gemini", "cloud run", "gcp", "google cloud")):
        return "gcp"
    if any(term in searchable for term in ("x402", "pay.sh", "mpp", "payment")):
        return "payment"
    if any(term in searchable for term in ("solana", "devnet", "mainnet", "transaction")):
        return "solana"
    if any(term in searchable for term in ("a2a", "mcp", "ap2", "ucp", "acp")):
        return "agent_protocol"
    return "general"


def build_fact_catalog(root: Path | str) -> dict[str, Any]:
    root_path = Path(root).resolve()
    manifest = _require_mapping(
        _read_json(_resolve(root_path, OFFICIAL_PATH / "manifest.json")),
        "official manifest",
    )
    claim_ledger = _require_mapping(
        _read_json(_resolve(root_path, OFFICIAL_PATH / "claim-ledger.json")),
        "official claim ledger",
    )
    source_ids = {
        str(source.get("id"))
        for source in manifest.get("official_sources", [])
        if isinstance(source, Mapping) and source.get("id")
    }
    facts: list[dict[str, Any]] = []
    for claim in claim_ledger.get("claims", []):
        if not isinstance(claim, Mapping):
            continue
        claim_id = _require_text(claim.get("id"), "claim id")
        verdict = str(claim.get("verdict", "not_found"))
        refs = [
            str(source_id)
            for source_id in claim.get("source_ids", [])
            if str(source_id) in source_ids
        ]
        correction = claim.get("correction")
        statement = correction or claim.get("claim") or claim_id
        facts.append(
            {
                "fact_id": f"fact:{claim_id}",
                "domain": _fact_domain(claim),
                "statement": str(statement),
                "original_statement": claim.get("claim"),
                "authority": (
                    "official" if refs and verdict != "not_found" else "reference-only"
                ),
                "source_ref": refs,
                "as_of": claim_ledger.get("as_of") or manifest.get("generated_at"),
                "confidence": "AMBIGUOUS" if verdict == "not_found" else "EXTRACTED",
                "status": verdict,
                "supersedes": (
                    [
                        f"{claim.get('document', 'unknown')}#{claim.get('locator', 'unknown')}"
                    ]
                    if correction
                    else []
                ),
            }
        )
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_from": [
            (OFFICIAL_PATH / "manifest.json").as_posix(),
            (OFFICIAL_PATH / "claim-ledger.json").as_posix(),
        ],
        "facts": sorted(facts, key=lambda item: item["fact_id"]),
    }


def _markdown_table(headers: Sequence[str], rows: Iterable[Sequence[Any]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "|" + "|".join("---" for _ in headers) + "|",
    ]
    for row in rows:
        cells = [str(cell).replace("|", "\\|").replace("\n", " ") for cell in row]
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def _render_status(state: Mapping[str, Any]) -> str:
    gate_rows = []
    for gate_id, gate in state.get("gates", {}).items():
        gate_rows.append(
            (
                gate_id,
                gate.get("name", ""),
                gate.get("status", ""),
                ", ".join(gate.get("missing", [])) or "-",
            )
        )
    return (
        "# Hackathon Readiness Status\n\n"
        "이 문서는 append-only 실행 원장에서 결정적으로 생성된다.\n\n"
        f"- 상태: `{state.get('state')}`\n"
        f"- 오버레이: `{state.get('overlay') or 'none'}`\n"
        f"- 다음 작업: `{state.get('next_action')}`\n"
        f"- 차단 요소: `{', '.join(state.get('blockers', [])) or 'none'}`\n"
        f"- 생성 시각: `{state.get('derived_at')}`\n\n"
        "## Gates\n\n"
        + _markdown_table(("Gate", "책임", "상태", "누락"), gate_rows)
        + "\n\n## 운영 페이지\n\n"
        "- [행사 계약](01-event-contract.md)\n"
        "- [후보](02-candidates.md)\n"
        "- [제품 계약](03-product-contract.md)\n"
        "- [아키텍처](04-architecture.md)\n"
        "- [보안·예산](05-security-budget.md)\n"
        "- [증거](06-evidence.md)\n"
        "- [제출](07-submission.md)\n"
    )


def _render_event_contract(
    state: Mapping[str, Any], knowledge: Mapping[str, Any] | None
) -> str:
    if knowledge is None:
        details = "공식 지식 검증 receipt가 아직 없다."
    else:
        details = (
            f"- 공식 기준일: `{knowledge.get('official_as_of')}`\n"
            f"- 공식 출처: `{knowledge.get('official_source_count')}`\n"
            f"- 구조화 claim: `{knowledge.get('claim_count')}`\n"
            f"- 미등록 source ID: `{knowledge.get('unknown_source_ids')}`\n"
            f"- 검증 digest: `{knowledge.get('digest')}`"
        )
    return (
        "# Event Contract\n\n"
        "공식 행사 계약은 로컬 전사·OCR보다 우선한다.\n\n"
        f"{details}\n\n"
        "## Canonical research\n\n"
        "- [Official Docs Wiki](../../../research/official-docs-wiki/index.md)\n"
        "- [행사 계약 추출](../../../research/official-docs-wiki/sources/event-contract.md)\n"
        "- [Claim ledger](../../../research/official-docs-wiki/claim-ledger.json)\n\n"
        "Mainnet은 기본 gate가 아니다. sandbox는 live Solana proof가 아니다.\n"
    )


def _render_candidates(state: Mapping[str, Any]) -> str:
    evaluation = state.get("candidate_evaluation")
    if not isinstance(evaluation, Mapping):
        body = (
            "후보가 없다. 승인된 agent가 정확히 세 후보를 JSON으로 생성한 뒤 "
            "`harness ideate --input <path>`를 실행한다."
        )
    else:
        rows = [
            (
                item.get("candidate_id"),
                item.get("primary_track"),
                item.get("total_score"),
            )
            for item in evaluation.get("ranking", [])
        ]
        body = (
            f"- 판정: `{evaluation.get('status')}`\n"
            f"- 승자: `{evaluation.get('winner_id') or 'none'}`\n"
            f"- 점수 차: `{evaluation.get('margin')}`\n\n"
            + _markdown_table(("후보", "주 트랙", "내부 점수"), rows)
        )
    return (
        "# Candidate Selection\n\n"
        "내부 점수는 공식 심사 점수가 아니며 세 후보 비교에만 사용한다.\n\n"
        f"{body}\n"
    )


def _render_product_contract(state: Mapping[str, Any]) -> str:
    contract = state.get("product_contract")
    if not isinstance(contract, Mapping):
        return (
            "# Product Contract\n\n"
            "제품 계약이 잠기지 않았다. 후보가 잠긴 후 명시적 계약 JSON을 기록한다.\n"
        )
    rows = [
        ("제품", contract.get("title")),
        ("사용자", contract.get("persona")),
        ("문제", contract.get("problem")),
        ("주 트랙", contract.get("primary_track")),
        ("Agent 결정", contract.get("agent_decision")),
        ("예산 정책", contract.get("spending_policy")),
        ("결제", f"{contract.get('payment_protocol')} / {contract.get('network')}"),
        ("GCP 경로", contract.get("gcp_path")),
    ]
    return (
        "# Product Contract\n\n"
        + _markdown_table(("항목", "잠긴 값"), rows)
        + "\n\n## 제외 기능\n\n"
        + "\n".join(f"- {item}" for item in contract.get("excluded_features", []))
        + "\n"
    )


def _render_architecture(state: Mapping[str, Any]) -> str:
    contract = state.get("product_contract")
    if not isinstance(contract, Mapping):
        path = "제품 계약 이후 생성된다."
    else:
        path = (
            f"`{contract.get('agent_decision')}` → "
            f"`{contract.get('payment_protocol')}` → "
            f"`{contract.get('network')}` → `{contract.get('gcp_path')}`"
        )
    return (
        "# Execution Architecture\n\n"
        f"{path}\n\n"
        "## Required proof chain\n\n"
        "```text\n"
        "Gemini decision trace\n"
        "  -> bounded authorization\n"
        "  -> Solana Devnet transaction signature\n"
        "  -> network confirmation\n"
        "  -> GCP runtime log\n"
        "```\n"
    )


def _render_security(state: Mapping[str, Any], config: Mapping[str, Any]) -> str:
    passed = {
        item.get("kind")
        for item in state.get("receipts", [])
        if item.get("result") == "pass"
    }
    rows = [
        (kind, "PASS" if kind in passed else "MISSING") for kind in HARDENING_RECEIPTS
    ]
    policy = config.get("runtime_policy", {})
    approvals = state.get("approvals", [])
    approval_rows = [
        (
            item.get("approval_id"),
            ", ".join(item.get("actions", [])),
            item.get("scope"),
            item.get("approved_by"),
            item.get("expires_at") or "-",
        )
        for item in approvals
    ]
    approval_table = (
        _markdown_table(
            ("승인", "행위", "범위", "승인자", "만료"), approval_rows
        )
        if approval_rows
        else "기록된 위험행위 승인이 없다."
    )
    return (
        "# Security and Budget\n\n"
        f"- 기본 네트워크: `{policy.get('default_network')}`\n"
        f"- Mainnet 활성화: `{policy.get('mainnet_enabled')}`\n"
        "- 비밀값은 Wiki·ledger·receipt에 저장하지 않는다.\n"
        "- credential, 지갑 서명, 배포, 유료 호출, 공개·제출은 사람 승인 대상이다.\n\n"
        "## Hardening evidence\n\n"
        + _markdown_table(("검증", "상태"), rows)
        + "\n\n## Human approvals\n\n"
        + approval_table
        + "\n"
    )


def _render_evidence(state: Mapping[str, Any]) -> str:
    rows = [
        (
            item.get("receipt_id"),
            item.get("kind"),
            item.get("environment"),
            item.get("result"),
            item.get("timestamp"),
        )
        for item in state.get("receipts", [])
    ]
    table = (
        _markdown_table(("Receipt", "종류", "환경", "결과", "시각"), rows)
        if rows
        else "아직 기록된 실행 receipt가 없다."
    )
    return (
        "# Evidence Ledger Projection\n\n"
        "이 페이지는 receipt 요약만 표시한다. credential이나 private key는 기록하지 않는다.\n\n"
        f"{table}\n"
    )


def _render_submission(state: Mapping[str, Any]) -> str:
    passed = {
        item.get("kind")
        for item in state.get("receipts", [])
        if item.get("result") == "pass"
    }
    rows = [
        ("제품 소개", "PASS" if "product_intro_validated" in passed else "MISSING"),
        ("GitHub 저장소", "PASS" if "github_repo_validated" in passed else "MISSING"),
        ("데모 영상", "PASS" if "demo_video_validated" in passed else "MISSING"),
        ("Fresh-clone 재현", "PASS" if "fresh_clone_test" in passed else "MISSING"),
        ("외부 제출", "PASS" if state.get("state") == "SUBMITTED" else "NOT SUBMITTED"),
    ]
    return (
        "# Submission Readiness\n\n"
        + _markdown_table(("제출 요소", "상태"), rows)
        + "\n\n"
        "라이브 URL은 권장 사항이며 제출 당시 공식 계약을 다시 확인한다.\n"
    )


def write_state_and_wiki(
    root: Path | str,
    state: Mapping[str, Any],
    events: Sequence[Mapping[str, Any]],
    config: Mapping[str, Any],
) -> None:
    root_path = Path(root).resolve()
    atomic_write_json(_resolve(root_path, STATE_PATH), dict(state))
    operations = _resolve(root_path, OPERATIONS_PATH)
    operations.mkdir(parents=True, exist_ok=True)
    knowledge_event = _latest_event(events, "knowledge_validated")
    knowledge_payload = (
        dict(knowledge_event["payload"]) if knowledge_event is not None else None
    )
    pages = {
        "00-status.md": _render_status(state),
        "01-event-contract.md": _render_event_contract(state, knowledge_payload),
        "02-candidates.md": _render_candidates(state),
        "03-product-contract.md": _render_product_contract(state),
        "04-architecture.md": _render_architecture(state),
        "05-security-budget.md": _render_security(state, config),
        "06-evidence.md": _render_evidence(state),
        "07-submission.md": _render_submission(state),
    }
    for name, content in pages.items():
        atomic_write_text(operations / name, content)


def refresh_state(
    root: Path | str, *, now: datetime | None = None
) -> dict[str, Any]:
    root_path = Path(root).resolve()
    config = load_config(root_path)
    events = read_events(root_path)
    state = replay_events(events, now=now, config=config)
    write_state_and_wiki(root_path, state, events, config)
    return state


def prepare_workspace(
    root: Path | str, *, now: datetime | None = None
) -> dict[str, Any]:
    root_path = Path(root).resolve()
    current_time = now or _now()
    config = load_config(root_path)
    config_path = _resolve(root_path, CONFIG_PATH)
    if not config_path.is_file():
        atomic_write_json(config_path, config)
    _write_ideation_request(root_path, config)

    validation = validate_official_research(root_path, now=current_time)
    atomic_write_json(_resolve(root_path, FACTS_PATH), build_fact_catalog(root_path))
    events = read_events(root_path)
    latest = _latest_event(events, "knowledge_validated")
    if latest is None or latest.get("payload", {}).get("digest") != validation["digest"]:
        append_event(
            root_path,
            "knowledge_validated",
            validation,
            now=current_time,
        )
        events = read_events(root_path)
    state = replay_events(events, now=current_time, config=config)
    write_state_and_wiki(root_path, state, events, config)
    return state


def record_input(
    root: Path | str,
    *,
    kind: str,
    payload: Any,
    now: datetime | None = None,
) -> dict[str, Any]:
    root_path = Path(root).resolve()
    current_time = now or _now()
    events = read_events(root_path)
    state = replay_events(events, now=current_time, config=load_config(root_path))
    normalized_kind = kind.casefold().replace("_", "-")

    if normalized_kind == "receipt":
        value = validate_receipt(payload)
        known_ids = {
            receipt_item["receipt_id"] for receipt_item in _receipt_map(events).values()
        }
        if value["receipt_id"] in known_ids:
            raise ReadinessError(f"duplicate receipt id: {value['receipt_id']}")
        expected_action = APPROVAL_ACTION_BY_RECEIPT.get(value["kind"])
        if expected_action:
            approval_id = value["external_refs"]["approval_id"]
            approval = _approval_map(events).get(approval_id)
            if approval is None:
                raise ReadinessError(
                    f"runtime receipt references unknown approval: {approval_id}"
                )
            if expected_action not in approval["actions"]:
                raise ReadinessError(
                    f"approval {approval_id} does not allow {expected_action}"
                )
            expires_at = approval.get("expires_at")
            if expires_at is not None and current_time > _parse_datetime(
                expires_at, "approval.expires_at"
            ):
                raise ReadinessError(f"approval {approval_id} has expired")
        append_event(root_path, "receipt_recorded", value, now=current_time)
    elif normalized_kind == "approval":
        if state["product_contract"] is None:
            raise ReadinessError(
                "a locked product contract is required before granting approval"
            )
        approval = validate_approval(payload)
        if approval["approval_id"] in _approval_map(events):
            raise ReadinessError(
                f"duplicate approval id: {approval['approval_id']}"
            )
        if current_time < _parse_datetime(
            approval["approved_at"], "approval.approved_at"
        ):
            raise ReadinessError("approval.approved_at cannot be in the future")
        append_event(
            root_path,
            "approval_granted",
            approval,
            now=current_time,
            actor="human",
        )
    elif normalized_kind == "candidates":
        if state["product"] is not None:
            raise ReadinessError("the product is already locked")
        body = _require_mapping(payload, "candidate input")
        result = select_candidate(
            body.get("candidates"),
            load_config(root_path).get("candidate_selection", {}),
        )
        append_event(root_path, "candidates_evaluated", result, now=current_time)
        if result["status"] == "locked":
            append_event(
                root_path,
                "product_locked",
                {
                    "candidate_id": result["winner_id"],
                    "selection": "automatic-threshold",
                    "score": result["ranking"][0]["total_score"],
                    "margin": result["margin"],
                },
                now=current_time,
            )
    elif normalized_kind == "product-lock":
        if state["product"] is not None:
            raise ReadinessError("the product is already locked")
        body = _require_mapping(payload, "product lock")
        candidate_id = _require_text(body.get("candidate_id"), "candidate_id")
        evaluated = _latest_event(events, "candidates_evaluated")
        if evaluated is None:
            raise ReadinessError("candidate evaluation must exist before a product lock")
        candidate_ids = {
            item["id"] for item in evaluated["payload"].get("candidates", [])
        }
        if candidate_id not in candidate_ids:
            raise ReadinessError("product lock references an unknown candidate")
        append_event(
            root_path,
            "product_locked",
            {
                "candidate_id": candidate_id,
                "selection": "explicit-human-decision",
                "reason": _require_text(body.get("reason"), "product lock reason"),
            },
            now=current_time,
            actor="human",
        )
    elif normalized_kind == "product-contract":
        if state["product"] is None:
            raise ReadinessError("product must be locked before recording its contract")
        if state["product_contract"] is not None:
            raise ReadinessError("the product contract is already locked")
        contract = validate_product_contract(payload)
        if contract["candidate_id"] != state["product"]["candidate_id"]:
            raise ReadinessError("product contract does not match the locked candidate")
        append_event(root_path, "product_contract", contract, now=current_time)
    elif normalized_kind == "submission":
        if state["state"] != "SUBMISSION_READY":
            raise ReadinessError("submission can be recorded only from SUBMISSION_READY")
        body = dict(_require_mapping(payload, "submission receipt"))
        _walk_for_secrets(body)
        append_event(
            root_path,
            "submission_recorded",
            {
                "submission_id": _require_text(
                    body.get("submission_id"), "submission_id"
                ),
                "submitted_at": _iso(
                    _parse_datetime(body.get("submitted_at"), "submitted_at")
                ),
                "submitted_by": _require_text(
                    body.get("submitted_by"), "submitted_by"
                ),
            },
            now=current_time,
            actor="human",
        )
    else:
        raise ReadinessError(
            "record kind must be receipt, approval, candidates, product-lock, "
            "product-contract, or submission"
        )
    return refresh_state(root_path, now=current_time)


def apply_pivot(
    root: Path | str, *, now: datetime | None = None
) -> dict[str, Any]:
    root_path = Path(root).resolve()
    current_time = now or _now()
    state = replay_events(
        read_events(root_path), now=current_time, config=load_config(root_path)
    )
    if state["overlay"] != "PIVOT_REQUIRED":
        raise ReadinessError("pivot is allowed only when PIVOT_REQUIRED")
    append_event(
        root_path,
        "pivot_applied",
        {
            "strategy": "single-payment-vertical-slice",
            "kept": [
                "one agent decision",
                "one bounded payment",
                "one Solana Devnet transaction",
                "one GCP runtime log",
            ],
            "removed": ["all nonessential multi-agent and presentation features"],
        },
        now=current_time,
    )
    return refresh_state(root_path, now=current_time)


def _artifact_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_submission_pack(
    root: Path | str, *, now: datetime | None = None
) -> dict[str, Any]:
    root_path = Path(root).resolve()
    current_time = now or _now()
    config = load_config(root_path)
    events = read_events(root_path)
    state = replay_events(events, now=current_time, config=config)
    if not _state_at_least(state["state"], "HARDENED"):
        raise ReadinessError("submission pack requires HARDENED readiness")
    contract = state.get("product_contract")
    if not isinstance(contract, Mapping):
        raise ReadinessError("submission pack requires a product contract")

    output = _resolve(root_path, SUBMISSION_PATH)
    output.mkdir(parents=True, exist_ok=True)
    product_intro = (
        f"# {contract['title']}\n\n"
        f"## 문제와 사용자\n\n{contract['persona']}가 겪는 문제: {contract['problem']}\n\n"
        f"## Agentic necessity\n\n{contract['agent_decision']}\n\n"
        f"## Payment and infrastructure\n\n"
        f"{contract['payment_protocol']} on {contract['network']}; "
        f"GCP path: {contract['gcp_path']}.\n\n"
        f"## Submission narrative\n\n{contract['submission_narrative']}\n"
    )
    demo_script = (
        "# Demo Script\n\n"
        "1. 사용자 문제와 예산 정책을 보여준다.\n"
        f"2. Agent 판단을 실행한다: {contract['agent_decision']}\n"
        f"3. 결제를 승인하고 {contract['network']} transaction signature를 표시한다.\n"
        "4. confirmation과 GCP runtime log를 연결한다.\n"
        "5. 같은 요청을 재실행해 중복결제가 차단됨을 보여준다.\n"
    )
    checklist = {
        "schema_version": SCHEMA_VERSION,
        "required": {
            "product_introduction": False,
            "github_repository": False,
            "demo_video": False,
            "fresh_clone_reproduction": False,
        },
        "recommended": {"live_endpoint": False},
        "approval_required": True,
    }
    evidence_index = {
        "schema_version": SCHEMA_VERSION,
        "state": state["state"],
        "receipts": state["receipts"],
        "proof_boundary": (
            "Only credentialed runtime receipts prove Gemini, Solana, or GCP execution."
        ),
    }
    atomic_write_text(output / "product-introduction.md", product_intro)
    atomic_write_text(output / "demo-script.md", demo_script)
    atomic_write_json(output / "checklist.json", checklist)
    atomic_write_json(output / "evidence-index.json", evidence_index)
    files = [
        output / "product-introduction.md",
        output / "demo-script.md",
        output / "checklist.json",
        output / "evidence-index.json",
    ]
    hashes = {
        path.relative_to(root_path).as_posix(): _artifact_digest(path) for path in files
    }
    existing = _latest_event(events, "submission_pack_built")
    if existing is None or existing.get("payload", {}).get("artifact_hashes") != hashes:
        append_event(
            root_path,
            "submission_pack_built",
            {
                "artifact_hashes": hashes,
                "status": "draft",
                "note": (
                    "Pack generation does not validate the repository, video, "
                    "public endpoint, or external submission."
                ),
            },
            now=current_time,
        )
    return refresh_state(root_path, now=current_time)


def _load_input(path: Path) -> Any:
    return _read_json(path.resolve())


def _write_ideation_request(root: Path, config: Mapping[str, Any]) -> Path:
    path = _resolve(root, CONTROL_PATH / "ideation-request.json")
    request = {
        "schema_version": SCHEMA_VERSION,
        "task": "Generate exactly three distinct hackathon product candidates.",
        "constraints": {
            "team_size": 1,
            "network": "solana-devnet",
            "each_candidate_must_include": list(CANDIDATE_FIELDS[1:]),
            "score_fields": list(CANDIDATE_WEIGHTS),
            "score_range": [0, 100],
        },
        "source_contexts": [
            ".harness/wiki/operations/01-event-contract.md",
            "research/official-docs-wiki/modules/event-rules.md",
            "research/official-docs-wiki/modules/payment-rails.md",
            "research/official-docs-wiki/modules/agent-protocol-map.md",
        ],
        "output": {
            "type": "object",
            "required": ["candidates"],
            "candidate_count": 3,
        },
        "generator_policy": config.get("ideation"),
    }
    atomic_write_json(path, request)
    return path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("prepare")
    ideate = subparsers.add_parser("ideate")
    ideate.add_argument("--input", type=Path)
    status = subparsers.add_parser("status")
    status.add_argument("--json", action="store_true", dest="as_json")
    record = subparsers.add_parser("record")
    record.add_argument(
        "--kind",
        required=True,
        choices=(
            "receipt",
            "approval",
            "candidates",
            "product-lock",
            "product-contract",
            "submission",
        ),
    )
    record.add_argument("--input", required=True, type=Path)
    gate = subparsers.add_parser("gate")
    gate.add_argument("--advance", action="store_true")
    subparsers.add_parser("pack")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    root = args.root.resolve()
    try:
        if args.command == "prepare":
            state = prepare_workspace(root)
        elif args.command == "ideate":
            config = load_config(root)
            if args.input is None:
                request_path = _write_ideation_request(root, config)
                default_input = _resolve(
                    root, Path(config["ideation"]["default_input"])
                )
                if not default_input.is_file():
                    raise ReadinessError(
                        "candidate input is missing; generate it with the approved "
                        f"external agent using {request_path}, then run ideate --input"
                    )
                input_path = default_input
            else:
                input_path = args.input
                if not input_path.is_absolute():
                    input_path = root / input_path
            state = record_input(
                root, kind="candidates", payload=_load_input(input_path)
            )
        elif args.command == "status":
            state = replay_events(
                read_events(root), now=_now(), config=load_config(root)
            )
            if args.as_json:
                print(json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True))
                return 0
            print(
                f"{state['state']} overlay={state['overlay'] or 'none'} "
                f"next={state['next_action']} "
                f"blockers={','.join(state['blockers']) or 'none'}"
            )
            return 0
        elif args.command == "record":
            input_path = args.input
            if not input_path.is_absolute():
                input_path = root / input_path
            state = record_input(
                root, kind=args.kind, payload=_load_input(input_path)
            )
        elif args.command == "gate":
            state = replay_events(
                read_events(root), now=_now(), config=load_config(root)
            )
            if args.advance and state["overlay"] == "PIVOT_REQUIRED":
                state = apply_pivot(root)
            elif args.advance:
                raise ReadinessError(
                    "state is derived from evidence; record missing evidence "
                    "instead of forcing a gate"
                )
        elif args.command == "pack":
            state = build_submission_pack(root)
        else:  # pragma: no cover - argparse guarantees a known command
            raise ReadinessError(f"unsupported command: {args.command}")
    except ReadinessError as exc:
        print(f"readiness: ERROR: {exc}", file=sys.stderr)
        return 2
    print(
        json.dumps(
            {
                "status": "ok",
                "state": state["state"],
                "overlay": state["overlay"],
                "next_action": state["next_action"],
                "blockers": state["blockers"],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
