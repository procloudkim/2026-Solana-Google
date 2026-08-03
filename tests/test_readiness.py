from __future__ import annotations

import importlib.util
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPOSITORY_ROOT / ".harness" / "workflows" / "06_readiness.py"
SPEC = importlib.util.spec_from_file_location("readiness", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import guard
    raise RuntimeError(f"could not load {SCRIPT_PATH}")
readiness = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(readiness)


def candidate(
    candidate_id: str,
    track: str,
    *,
    official_fit: int,
    payment_proof: int,
    solo_feasibility: int,
    user_value: int,
    demo_clarity: int,
    cost_risk: int,
) -> dict[str, object]:
    return {
        "id": candidate_id,
        "title": f"Candidate {candidate_id}",
        "primary_track": track,
        "persona": "A small-business operator",
        "problem": "A bounded purchase decision needs auditable settlement.",
        "agent_decision": "Choose whether and how much to purchase.",
        "paid_action": "Purchase one paid API result.",
        "solana_transaction": "One USDC-compatible Devnet settlement.",
        "gcp_audit_path": "Gemini decision to Cloud Run structured log.",
        "scores": {
            "official_fit": official_fit,
            "payment_proof": payment_proof,
            "solo_feasibility": solo_feasibility,
            "user_value": user_value,
            "demo_clarity": demo_clarity,
            "cost_risk": cost_risk,
        },
    }


def receipt(kind: str, receipt_id: str | None = None) -> dict[str, object]:
    external_refs = (
        {"approval_id": "approval-test"}
        if kind in {"gemini_trace", "solana_devnet_tx", "gcp_runtime_log"}
        else {}
    )
    return {
        "receipt_id": receipt_id or f"receipt-{kind}",
        "gate_id": "G-test",
        "kind": kind,
        "environment": "local",
        "timestamp": "2026-07-23T00:00:00+00:00",
        "result": "pass",
        "artifact_hashes": {
            "artifact.json": "a" * 64,
        },
        "external_refs": external_refs,
        "verifier": "unittest",
        "redactions": [],
    }


def product_contract() -> dict[str, object]:
    return {
        "id": "contract-a",
        "candidate_id": "a",
        "title": "Bounded Buyer",
        "persona": "A small-business operator",
        "problem": "A paid data purchase needs a bounded autonomous decision.",
        "primary_track": "Agent-Initiated Commerce",
        "agent_decision": "Choose one paid result within a fixed budget.",
        "spending_policy": "Devnet only, one transaction, explicit approval.",
        "payment_protocol": "pay.sh",
        "network": "solana-devnet",
        "gcp_path": "Gemini -> Cloud Run -> structured log",
        "happy_path": "Decide, approve, pay, confirm, and log.",
        "failure_paths": ["insufficient balance", "duplicate request"],
        "acceptance_receipts": [
            "gemini_trace",
            "solana_devnet_tx",
            "gcp_runtime_log",
        ],
        "excluded_features": ["Mainnet", "unbounded spending"],
        "submission_narrative": "The agent chooses and pays with auditable evidence.",
    }


def approval() -> dict[str, object]:
    return {
        "approval_id": "approval-test",
        "actions": [
            "credentialed_external_call",
            "wallet_signature",
            "cloud_deployment",
        ],
        "scope": "Locked product contract runtime proof on Devnet.",
        "approved_by": "test-human",
        "approved_at": "2026-07-23T00:00:00+00:00",
        "expires_at": "2026-08-03T14:59:00+00:00",
    }


class ReadinessTests(unittest.TestCase):
    def test_candidate_scoring_locks_clear_winner(self) -> None:
        candidates = [
            candidate(
                "a",
                "Agent-Initiated Commerce",
                official_fit=95,
                payment_proof=95,
                solo_feasibility=90,
                user_value=80,
                demo_clarity=90,
                cost_risk=90,
            ),
            candidate(
                "b",
                "Autonomous On-chain Settlement",
                official_fit=80,
                payment_proof=80,
                solo_feasibility=70,
                user_value=70,
                demo_clarity=70,
                cost_risk=70,
            ),
            candidate(
                "c",
                "Multi-Agent Commerce",
                official_fit=70,
                payment_proof=60,
                solo_feasibility=50,
                user_value=85,
                demo_clarity=60,
                cost_risk=50,
            ),
        ]

        result = readiness.select_candidate(candidates)

        self.assertEqual("locked", result["status"])
        self.assertEqual("a", result["winner_id"])
        self.assertGreaterEqual(result["ranking"][0]["total_score"], 75)
        self.assertGreaterEqual(result["margin"], 5)

    def test_candidate_scoring_blocks_ambiguous_result(self) -> None:
        candidates = [
            candidate(
                "a",
                "Agent-Initiated Commerce",
                official_fit=80,
                payment_proof=80,
                solo_feasibility=80,
                user_value=80,
                demo_clarity=80,
                cost_risk=80,
            ),
            candidate(
                "b",
                "Autonomous On-chain Settlement",
                official_fit=79,
                payment_proof=79,
                solo_feasibility=79,
                user_value=79,
                demo_clarity=79,
                cost_risk=79,
            ),
            candidate(
                "c",
                "Multi-Agent Commerce",
                official_fit=60,
                payment_proof=60,
                solo_feasibility=60,
                user_value=60,
                demo_clarity=60,
                cost_risk=60,
            ),
        ]

        result = readiness.select_candidate(candidates)

        self.assertEqual("ambiguous", result["status"])
        self.assertIsNone(result["winner_id"])

    def test_receipt_rejects_secret_material(self) -> None:
        value = receipt("solana_devnet_tx")
        value["external_refs"] = {"private_key": "do-not-store"}

        with self.assertRaisesRegex(readiness.ReadinessError, "secret"):
            readiness.validate_receipt(value)

    def test_runtime_receipt_requires_approval_reference(self) -> None:
        value = receipt("solana_devnet_tx")
        value["external_refs"] = {}

        with self.assertRaisesRegex(readiness.ReadinessError, "approval_id"):
            readiness.validate_receipt(value)

    def test_replay_requires_runtime_receipts_instead_of_sandbox(self) -> None:
        events = [
            {"event_id": "1", "type": "knowledge_validated", "payload": {}},
            {
                "event_id": "2",
                "type": "product_locked",
                "payload": {"candidate_id": "a"},
            },
            {"event_id": "3", "type": "product_contract", "payload": {"id": "a"}},
            {
                "event_id": "4",
                "type": "receipt_recorded",
                "payload": receipt("local_agent_test"),
            },
            {
                "event_id": "5",
                "type": "receipt_recorded",
                "payload": receipt("sandbox_payment_test"),
            },
        ]

        local_state = readiness.replay_events(
            events, now=datetime(2026, 7, 28, tzinfo=timezone.utc)
        )
        self.assertEqual("LOCAL_SLICE_PASSED", local_state["state"])
        self.assertIn("gemini_trace", local_state["blockers"])
        self.assertIn("solana_devnet_tx", local_state["blockers"])

        for index, kind in enumerate(
            ("gemini_trace", "solana_devnet_tx", "gcp_runtime_log"), start=6
        ):
            events.append(
                {
                    "event_id": str(index),
                    "type": "receipt_recorded",
                    "payload": receipt(kind),
                }
            )
        unapproved_state = readiness.replay_events(
            events, now=datetime(2026, 7, 28, tzinfo=timezone.utc)
        )
        self.assertEqual("LOCAL_SLICE_PASSED", unapproved_state["state"])
        events.append(
            {
                "event_id": "approval",
                "type": "approval_granted",
                "payload": approval(),
            }
        )
        runtime_state = readiness.replay_events(
            events, now=datetime(2026, 7, 28, tzinfo=timezone.utc)
        )
        self.assertEqual("DEVNET_PROVEN", runtime_state["state"])

    def test_replay_flags_pivot_after_deadline_without_runtime_proof(self) -> None:
        events = [
            {"event_id": "1", "type": "knowledge_validated", "payload": {}},
            {
                "event_id": "2",
                "type": "product_locked",
                "payload": {"candidate_id": "a"},
            },
        ]

        state = readiness.replay_events(
            events,
            now=datetime.fromisoformat("2026-07-31T00:00:00+09:00"),
        )

        self.assertEqual("PIVOT_REQUIRED", state["overlay"])
        self.assertEqual("apply_pivot", state["next_action"])

    def make_workspace(self, root: Path) -> None:
        official = root / "research" / "official-docs-wiki"
        official.mkdir(parents=True)
        (official / "manifest.json").write_text(
            json.dumps(
                {
                    "schema_version": "1.0",
                    "generated_at": "2026-07-23",
                    "official_sources": [
                        {"id": "EVENT-SITE", "url": "https://example.test/event"}
                    ],
                }
            ),
            encoding="utf-8",
        )
        (official / "claim-ledger.json").write_text(
            json.dumps(
                {
                    "schema_version": "1.0",
                    "as_of": "2026-07-23",
                    "claims": [
                        {
                            "id": "event-date",
                            "verdict": "confirmed",
                            "source_ids": ["EVENT-SITE"],
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        wiki = root / ".harness" / "wiki"
        wiki.mkdir(parents=True)
        (wiki / "manifest.json").write_text(
            json.dumps({"schema_version": 1, "entries": []}), encoding="utf-8"
        )

    def test_prepare_builds_state_and_operational_wiki(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self.make_workspace(root)

            state = readiness.prepare_workspace(
                root,
                now=datetime.fromisoformat("2026-07-23T12:00:00+09:00"),
            )

            self.assertEqual("DISCOVERY", state["state"])
            self.assertEqual("passed", state["gates"]["G0"]["status"])
            self.assertTrue((root / ".harness/control/execution_ledger.jsonl").is_file())
            self.assertTrue((root / ".harness/control/state.json").is_file())
            facts = json.loads(
                (root / ".harness/control/facts.json").read_text(encoding="utf-8")
            )
            self.assertEqual("fact:event-date", facts["facts"][0]["fact_id"])
            self.assertEqual("EXTRACTED", facts["facts"][0]["confidence"])
            self.assertTrue((root / ".harness/wiki/operations/00-status.md").is_file())
            self.assertTrue(
                (root / ".harness/wiki/operations/07-submission.md").is_file()
            )

    def test_duplicate_receipt_id_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self.make_workspace(root)
            readiness.prepare_workspace(
                root,
                now=datetime.fromisoformat("2026-07-23T12:00:00+09:00"),
            )
            value = receipt("local_agent_test", "same-id")

            readiness.record_input(
                root,
                kind="receipt",
                payload=value,
                now=datetime.fromisoformat("2026-07-23T12:01:00+09:00"),
            )
            with self.assertRaisesRegex(readiness.ReadinessError, "duplicate"):
                readiness.record_input(
                    root,
                    kind="receipt",
                    payload=value,
                    now=datetime.fromisoformat("2026-07-23T12:02:00+09:00"),
                )

    def test_status_command_is_read_only(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self.make_workspace(root)
            readiness.prepare_workspace(
                root,
                now=datetime.fromisoformat("2026-07-23T12:00:00+09:00"),
            )
            state_path = root / ".harness/control/state.json"
            ledger_path = root / ".harness/control/execution_ledger.jsonl"
            state_before = state_path.read_bytes()
            ledger_before = ledger_path.read_bytes()

            with redirect_stdout(io.StringIO()):
                exit_code = readiness.main(
                    ["--root", str(root), "status", "--json"]
                )

            self.assertEqual(0, exit_code)
            self.assertEqual(state_before, state_path.read_bytes())
            self.assertEqual(ledger_before, ledger_path.read_bytes())

    def test_submission_pack_refuses_before_hardening(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self.make_workspace(root)
            readiness.prepare_workspace(
                root,
                now=datetime.fromisoformat("2026-07-23T12:00:00+09:00"),
            )

            with self.assertRaisesRegex(readiness.ReadinessError, "HARDENED"):
                readiness.build_submission_pack(
                    root,
                    now=datetime.fromisoformat("2026-07-23T12:10:00+09:00"),
                )

    def test_submission_pack_is_generated_but_does_not_fake_validation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self.make_workspace(root)
            now = datetime.fromisoformat("2026-07-23T12:00:00+09:00")
            readiness.prepare_workspace(root, now=now)
            readiness.append_event(
                root, "product_locked", {"candidate_id": "a"}, now=now
            )
            readiness.append_event(
                root, "product_contract", product_contract(), now=now
            )
            readiness.append_event(root, "approval_granted", approval(), now=now)
            for index, kind in enumerate(
                readiness.LOCAL_RECEIPTS
                + readiness.RUNTIME_RECEIPTS
                + readiness.HARDENING_RECEIPTS
            ):
                readiness.append_event(
                    root,
                    "receipt_recorded",
                    receipt(kind, f"receipt-{index}"),
                    now=now,
                )

            state = readiness.build_submission_pack(root, now=now)

            self.assertEqual("HARDENED", state["state"])
            self.assertNotIn("submission_pack", state["blockers"])
            self.assertIn("demo_video_validated", state["blockers"])
            self.assertTrue(
                (root / ".harness/submission/product-introduction.md").is_file()
            )
            self.assertTrue((root / ".harness/submission/demo-script.md").is_file())


if __name__ == "__main__":
    unittest.main()
