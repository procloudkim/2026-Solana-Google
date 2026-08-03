#!/usr/bin/env python3
"""Run one bounded, evidence-producing harness research iteration by default.

Each iteration selects a hypothesis, generates code in an isolated candidate
directory, evaluates it with argv-based subprocess benchmarks, and promotes
only explicitly allowlisted ``src/`` files when the weighted score is strictly
better than the recorded best.  No Git repository is required or modified.
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
import time
from types import ModuleType
from typing import Any, Iterable, Iterator, Mapping, Sequence
import uuid


SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_WORKSPACE = SCRIPT_PATH.parents[2]
DEFAULT_CONFIG = Path(".harness/evaluations/research_config.json")
DEFAULT_BENCHMARKS = Path(".harness/evaluations/benchmarks.json")
MAX_CAPTURE_CHARS = 4000
MAX_PROMOTION_BYTES = 5 * 1024 * 1024


class ResearchError(RuntimeError):
    """Base error for a bounded research iteration."""


class ResearchLockError(ResearchError):
    """Raised when another research process owns the workspace lock."""


class ConfigurationError(ResearchError):
    """Raised when a harness configuration is malformed or unsafe."""


class PromotionError(ResearchError):
    """Raised when an allowlisted promotion cannot complete safely."""


@dataclass(frozen=True)
class RuntimePaths:
    evaluation_root: Path
    candidate_root: Path
    runs_root: Path
    ledger: Path
    state: Path
    lock: Path


@dataclass(frozen=True)
class BenchmarkResult:
    benchmark_id: str
    command: list[str]
    weight: float
    timeout_seconds: float
    returncode: int | None
    timed_out: bool
    score: float
    duration_seconds: float
    stdout: str
    stderr: str


def _utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _run_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    return f"{stamp}-{uuid.uuid4().hex[:10]}"


def _normalise_relative_path(value: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConfigurationError("paths must be non-empty strings")
    path = PurePosixPath(value.replace("\\", "/"))
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ConfigurationError(f"unsafe relative path: {value!r}")
    return path.as_posix()


def _is_inside(path: Path, root: Path) -> bool:
    try:
        path.resolve(strict=False).relative_to(root.resolve(strict=False))
    except ValueError:
        return False
    return True


def _workspace_path(workspace: Path, value: str | Path) -> Path:
    path = Path(value)
    return path.resolve() if path.is_absolute() else (workspace / path).resolve()


def _runtime_path(workspace: Path, value: str, evaluation_root: Path) -> Path:
    path = _workspace_path(workspace, value)
    if not _is_inside(path, evaluation_root):
        raise ConfigurationError(
            f"runtime path must stay under .harness/evaluations: {value!r}"
        )
    return path


def _read_json_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ConfigurationError(f"required JSON file does not exist: {path}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigurationError(f"cannot read JSON object from {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ConfigurationError(f"expected a JSON object in {path}")
    return value


def _atomic_write_json(path: Path, value: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, indent=2, sort_keys=True, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def _append_jsonl(path: Path, value: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(
        value, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(encoded + "\n")
        handle.flush()
        os.fsync(handle.fileno())


def _read_ledger(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    entries: list[dict[str, Any]] = []
    line_number = 0
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line_number, raw in enumerate(handle, start=1):
                if not raw.strip():
                    continue
                value = json.loads(raw)
                if not isinstance(value, dict):
                    raise ValueError("entry is not a JSON object")
                entries.append(value)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ResearchError(
            f"invalid research ledger {path} at line {line_number}: {exc}"
        ) from exc
    return entries


def _runtime_paths(workspace: Path, config: Mapping[str, Any]) -> RuntimePaths:
    evaluation_root = (workspace / ".harness" / "evaluations").resolve()
    raw_paths = config.get("paths", {})
    if not isinstance(raw_paths, Mapping):
        raise ConfigurationError("config.paths must be an object")

    def configured(name: str, default: str) -> Path:
        value = raw_paths.get(name, default)
        if not isinstance(value, str):
            raise ConfigurationError(f"config.paths.{name} must be a string")
        return _runtime_path(workspace, value, evaluation_root)

    return RuntimePaths(
        evaluation_root=evaluation_root,
        candidate_root=configured("candidate_root", ".harness/evaluations/candidates"),
        runs_root=configured("runs_root", ".harness/evaluations/runs"),
        ledger=configured("ledger", ".harness/evaluations/research_ledger.jsonl"),
        state=configured("state", ".harness/evaluations/research_state.json"),
        lock=configured("lock", ".harness/evaluations/research.lock"),
    )


@contextmanager
def exclusive_lock(lock_path: Path) -> Iterator[None]:
    """Own an exclusive create-once lock for the duration of a run."""

    lock_path.parent.mkdir(parents=True, exist_ok=True)
    token = uuid.uuid4().hex
    metadata = {
        "schema_version": 1,
        "token": token,
        "pid": os.getpid(),
        "created_at": _utc_now(),
    }
    try:
        descriptor = os.open(
            lock_path,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o600,
        )
    except FileExistsError as exc:
        raise ResearchLockError(
            f"research lock already exists: {lock_path}; inspect the owning run before removal"
        ) from exc
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(metadata, handle, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        yield
    finally:
        try:
            current = json.loads(lock_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            current = None
        if isinstance(current, dict) and current.get("token") == token:
            lock_path.unlink(missing_ok=True)


def select_hypothesis(
    hypotheses: Sequence[Mapping[str, Any]],
    ledger_entries: Iterable[Mapping[str, Any]],
) -> dict[str, Any]:
    """Select the least-tried enabled hypothesis, then priority and ID."""

    if isinstance(hypotheses, (str, bytes)) or not hypotheses:
        raise ConfigurationError("config.hypotheses must be a non-empty list")
    attempts: dict[str, int] = {}
    for entry in ledger_entries:
        hypothesis_id = entry.get("hypothesis_id")
        if isinstance(hypothesis_id, str):
            attempts[hypothesis_id] = attempts.get(hypothesis_id, 0) + 1

    candidates: list[tuple[int, float, str, dict[str, Any]]] = []
    seen: set[str] = set()
    for raw in hypotheses:
        if not isinstance(raw, Mapping):
            raise ConfigurationError("every hypothesis must be an object")
        hypothesis = dict(raw)
        hypothesis_id = hypothesis.get("id")
        if not isinstance(hypothesis_id, str) or not hypothesis_id.strip():
            raise ConfigurationError("every hypothesis requires a non-empty string id")
        if hypothesis_id in seen:
            raise ConfigurationError(f"duplicate hypothesis id: {hypothesis_id}")
        seen.add(hypothesis_id)
        if hypothesis.get("enabled", True) is False:
            continue
        try:
            priority = float(hypothesis.get("priority", 0.0))
        except (TypeError, ValueError) as exc:
            raise ConfigurationError(
                f"hypothesis priority must be numeric: {hypothesis_id}"
            ) from exc
        trial_count = attempts.get(hypothesis_id, 0)
        maximum = hypothesis.get("max_trials")
        if maximum is not None:
            if not isinstance(maximum, int) or isinstance(maximum, bool) or maximum < 1:
                raise ConfigurationError(
                    f"max_trials must be a positive integer: {hypothesis_id}"
                )
            if trial_count >= maximum:
                continue
        candidates.append((trial_count, -priority, hypothesis_id, hypothesis))
    if not candidates:
        raise ResearchError("no enabled hypothesis remains eligible for evaluation")
    candidates.sort(key=lambda item: (item[0], item[1], item[2]))
    return candidates[0][3]


def _expand_argv(
    argv: Any,
    *,
    candidate_dir: Path,
    workspace: Path,
) -> list[str]:
    if not isinstance(argv, list) or not argv:
        raise ConfigurationError("benchmark command must be a non-empty argv list")
    if not all(isinstance(argument, str) and argument for argument in argv):
        raise ConfigurationError("benchmark argv entries must be non-empty strings")
    replacements = {
        "{python}": sys.executable,
        "{candidate}": str(candidate_dir.resolve()),
        "{workspace}": str(workspace.resolve()),
        "{src}": str((candidate_dir / "src").resolve()),
    }
    expanded: list[str] = []
    for argument in argv:
        value = argument
        for placeholder, replacement in replacements.items():
            value = value.replace(placeholder, replacement)
        if "{" in value or "}" in value:
            raise ConfigurationError(f"unknown benchmark placeholder in {argument!r}")
        expanded.append(value)
    return expanded


def _candidate_cwd(candidate_dir: Path, raw: Any) -> Path:
    if raw in (None, "", "."):
        return candidate_dir.resolve()
    if not isinstance(raw, str):
        raise ConfigurationError("benchmark cwd must be a relative string")
    relative = _normalise_relative_path(raw)
    cwd = candidate_dir.joinpath(*PurePosixPath(relative).parts).resolve()
    if not _is_inside(cwd, candidate_dir):
        raise ConfigurationError(f"benchmark cwd escapes candidate directory: {raw!r}")
    if not cwd.is_dir():
        raise ConfigurationError(f"benchmark cwd does not exist: {raw!r}")
    return cwd


def _bounded_score(value: Any, *, context: str) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError) as exc:
        raise ConfigurationError(f"{context} must be numeric") from exc
    if not 0.0 <= score <= 1.0:
        raise ConfigurationError(f"{context} must be between 0 and 1")
    return score


def evaluate_candidate(
    candidate_dir: Path,
    workspace: Path,
    benchmark_document: Mapping[str, Any],
) -> tuple[float, list[dict[str, Any]]]:
    """Evaluate a staged candidate and return a weighted score in ``[0, 1]``."""

    raw_benchmarks = benchmark_document.get("benchmarks")
    if not isinstance(raw_benchmarks, list) or not raw_benchmarks:
        raise ConfigurationError("benchmarks.json requires a non-empty benchmarks list")
    candidate_dir = candidate_dir.resolve()
    temporary_dir = candidate_dir / ".tmp"
    temporary_dir.mkdir(exist_ok=True)
    environment = os.environ.copy()
    environment.update(
        {
            "HARNESS_CANDIDATE_DIR": str(candidate_dir),
            "TMP": str(temporary_dir),
            "TEMP": str(temporary_dir),
        }
    )
    results: list[BenchmarkResult] = []
    seen: set[str] = set()
    total_weight = 0.0
    weighted_total = 0.0
    for index, raw in enumerate(raw_benchmarks):
        if not isinstance(raw, Mapping):
            raise ConfigurationError(f"benchmark at index {index} must be an object")
        benchmark_id = raw.get("id")
        if not isinstance(benchmark_id, str) or not benchmark_id.strip():
            raise ConfigurationError(f"benchmark at index {index} requires an id")
        if benchmark_id in seen:
            raise ConfigurationError(f"duplicate benchmark id: {benchmark_id}")
        seen.add(benchmark_id)
        try:
            weight = float(raw.get("weight", 1.0))
            timeout_seconds = float(raw.get("timeout_seconds", 30.0))
        except (TypeError, ValueError) as exc:
            raise ConfigurationError(
                f"benchmark weight and timeout must be numeric: {benchmark_id}"
            ) from exc
        if weight <= 0 or timeout_seconds <= 0:
            raise ConfigurationError(
                f"benchmark weight and timeout must be positive: {benchmark_id}"
            )
        command = _expand_argv(
            raw.get("command"),
            candidate_dir=candidate_dir,
            workspace=workspace,
        )
        cwd = _candidate_cwd(candidate_dir, raw.get("cwd"))
        success_score = _bounded_score(
            raw.get("success_score", 1.0), context=f"{benchmark_id}.success_score"
        )
        failure_score = _bounded_score(
            raw.get("failure_score", 0.0), context=f"{benchmark_id}.failure_score"
        )
        started = time.monotonic()
        timed_out = False
        try:
            completed = subprocess.run(
                command,
                cwd=cwd,
                env=environment,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout_seconds,
                check=False,
                shell=False,
            )
            returncode: int | None = completed.returncode
            stdout = completed.stdout or ""
            stderr = completed.stderr or ""
            score = success_score if returncode == 0 else failure_score
            score_key = raw.get("score_json_key")
            if returncode == 0 and score_key is not None:
                if not isinstance(score_key, str) or not score_key:
                    raise ConfigurationError(
                        f"{benchmark_id}.score_json_key must be a non-empty string"
                    )
                try:
                    score_payload = json.loads(stdout)
                    score = _bounded_score(
                        score_payload[score_key],
                        context=f"{benchmark_id} stdout score",
                    )
                except (json.JSONDecodeError, KeyError, TypeError) as exc:
                    returncode = returncode if returncode != 0 else 2
                    score = failure_score
                    stderr = f"invalid JSON score output: {exc}\n{stderr}"
        except subprocess.TimeoutExpired as exc:
            timed_out = True
            returncode = None
            stdout = exc.stdout or ""
            stderr = (
                exc.stderr or ""
            ) + f"\nbenchmark timed out after {timeout_seconds:g}s"
            if isinstance(stdout, bytes):
                stdout = stdout.decode("utf-8", errors="replace")
            if isinstance(stderr, bytes):
                stderr = stderr.decode("utf-8", errors="replace")
            score = failure_score
        except OSError as exc:
            returncode = None
            stdout = ""
            stderr = f"cannot start benchmark: {exc}"
            score = failure_score
        duration = time.monotonic() - started
        result = BenchmarkResult(
            benchmark_id=benchmark_id,
            command=command,
            weight=weight,
            timeout_seconds=timeout_seconds,
            returncode=returncode,
            timed_out=timed_out,
            score=score,
            duration_seconds=round(duration, 6),
            stdout=stdout[-MAX_CAPTURE_CHARS:],
            stderr=stderr[-MAX_CAPTURE_CHARS:],
        )
        results.append(result)
        total_weight += weight
        weighted_total += weight * score
    weighted_score = weighted_total / total_weight
    return round(weighted_score, 6), [asdict(result) for result in results]


def _ensure_no_symlink_components(root: Path, relative: str) -> Path:
    current = root.resolve()
    for part in PurePosixPath(relative).parts:
        current = current / part
        if current.is_symlink():
            raise PromotionError(f"symlink component is not promotable: {relative}")
    if not _is_inside(current, root):
        raise PromotionError(f"promotion path escapes root: {relative}")
    return current


def _copy_to_atomic_temporary(source: Path, destination_dir: Path, name: str) -> Path:
    descriptor, temporary_name = tempfile.mkstemp(
        dir=destination_dir,
        prefix=f".{name}.harness-",
        suffix=".tmp",
    )
    temporary = Path(temporary_name)
    try:
        with source.open("rb") as source_handle, os.fdopen(descriptor, "wb") as target:
            shutil.copyfileobj(source_handle, target)
            target.flush()
            os.fsync(target.fileno())
        return temporary
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def promote_artifacts(
    workspace: Path,
    candidate_dir: Path,
    artifacts: Sequence[str],
    allowlist: Sequence[str],
) -> list[str]:
    """Atomically replace exact allowlisted files, rolling back on failure."""

    if isinstance(artifacts, (str, bytes)) or not artifacts:
        raise PromotionError("there are no generated artifacts to promote")
    try:
        allowed = {_normalise_relative_path(item) for item in allowlist}
        normalised = [_normalise_relative_path(item) for item in artifacts]
    except ConfigurationError as exc:
        raise PromotionError(str(exc)) from exc
    if not allowed:
        raise PromotionError("promotion allowlist cannot be empty")
    if len(normalised) != len(set(normalised)):
        raise PromotionError("generated artifact list contains duplicates")
    for relative in normalised:
        if relative not in allowed:
            raise PromotionError(f"artifact is not allowlisted: {relative}")
        if not relative.startswith("src/"):
            raise PromotionError(
                f"promotion destination must be under src/: {relative}"
            )

    workspace = workspace.resolve()
    candidate_dir = candidate_dir.resolve()
    src_root = (workspace / "src").resolve()
    if not _is_inside(src_root, workspace):
        raise PromotionError("workspace src root is unsafe")

    prepared: list[dict[str, Any]] = []
    replaced: list[dict[str, Any]] = []
    try:
        for relative in sorted(normalised):
            source = _ensure_no_symlink_components(candidate_dir, relative)
            if not source.is_file() or source.is_symlink():
                raise PromotionError(
                    f"candidate artifact is not a regular file: {relative}"
                )
            if source.stat().st_size > MAX_PROMOTION_BYTES:
                raise PromotionError(
                    f"candidate artifact exceeds {MAX_PROMOTION_BYTES} bytes: {relative}"
                )
            destination = _ensure_no_symlink_components(workspace, relative)
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination = _ensure_no_symlink_components(workspace, relative)
            if not _is_inside(destination, src_root):
                raise PromotionError(f"destination escapes workspace src/: {relative}")
            if destination.exists() and (
                destination.is_symlink() or not destination.is_file()
            ):
                raise PromotionError(
                    f"existing destination is not a regular file: {relative}"
                )
            replacement = _copy_to_atomic_temporary(
                source, destination.parent, destination.name
            )
            backup: Path | None = None
            existed = destination.exists()
            if existed:
                backup = _copy_to_atomic_temporary(
                    destination, destination.parent, destination.name + ".backup"
                )
            prepared.append(
                {
                    "relative": relative,
                    "destination": destination,
                    "replacement": replacement,
                    "backup": backup,
                    "existed": existed,
                }
            )

        for item in prepared:
            os.replace(item["replacement"], item["destination"])
            replaced.append(item)
    except BaseException as exc:
        rollback_errors: list[str] = []
        for item in reversed(replaced):
            try:
                backup = item["backup"]
                if backup is not None and backup.exists():
                    os.replace(backup, item["destination"])
                elif not item["existed"]:
                    item["destination"].unlink(missing_ok=True)
            except OSError as rollback_exc:
                rollback_errors.append(str(rollback_exc))
        for item in prepared:
            item["replacement"].unlink(missing_ok=True)
            backup = item["backup"]
            if backup is not None:
                backup.unlink(missing_ok=True)
        detail = f"; rollback errors: {rollback_errors}" if rollback_errors else ""
        if isinstance(exc, PromotionError):
            raise PromotionError(f"{exc}{detail}") from exc
        raise PromotionError(f"atomic promotion failed: {exc}{detail}") from exc

    for item in prepared:
        backup = item["backup"]
        if backup is not None:
            backup.unlink(missing_ok=True)
    return sorted(normalised)


def _candidate_marker(candidate_dir: Path, run_id: str) -> None:
    _atomic_write_json(
        candidate_dir / ".harness-candidate.json",
        {"schema_version": 1, "run_id": run_id, "created_at": _utc_now()},
    )


def safe_cleanup_candidate(
    candidate_dir: Path,
    candidate_root: Path,
    run_id: str,
) -> bool:
    """Delete only the exact marked candidate child; never touch workspace src."""

    if not candidate_dir.exists() and not candidate_dir.is_symlink():
        return False
    if candidate_dir.is_symlink():
        raise ResearchError("refusing to clean a symlinked candidate directory")
    root = candidate_root.resolve()
    if candidate_dir.parent.resolve() != root:
        raise ResearchError("refusing to clean a candidate outside candidate_root")
    marker_path = candidate_dir / ".harness-candidate.json"
    if marker_path.is_symlink() or not marker_path.is_file():
        raise ResearchError("refusing to clean an unmarked candidate directory")
    try:
        marker = json.loads(marker_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ResearchError(
            "refusing to clean a candidate with an invalid marker"
        ) from exc
    if not isinstance(marker, dict) or marker.get("run_id") != run_id:
        raise ResearchError("refusing to clean a candidate with a mismatched marker")
    shutil.rmtree(candidate_dir)
    return True


def _load_agent_builder() -> ModuleType:
    builder_path = SCRIPT_PATH.with_name("04_agent_builder.py")
    module_name = "_harness_agent_builder"
    cached = sys.modules.get(module_name)
    if cached is not None:
        return cached
    spec = importlib.util.spec_from_file_location(module_name, builder_path)
    if spec is None or spec.loader is None:
        raise ResearchError(f"cannot load agent builder: {builder_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _load_state(
    state_path: Path,
    *,
    initial_best_score: float,
    ledger_entries: Iterable[Mapping[str, Any]],
) -> tuple[float, dict[str, Any]]:
    state: dict[str, Any]
    if state_path.exists():
        state = _read_json_object(state_path)
        best = _bounded_score(state.get("best_score"), context="state.best_score")
    else:
        best = initial_best_score
        state = {
            "schema_version": 1,
            "best_score": best,
            "best_run_id": None,
            "updated_at": None,
        }
    # A promoted ledger receipt is also durable best-score evidence if a prior
    # process landed source but failed between the ledger and state writes.
    for entry in ledger_entries:
        if entry.get("promoted") is True:
            try:
                score = _bounded_score(entry.get("score"), context="ledger score")
            except ConfigurationError:
                continue
            best = max(best, score)
    state["best_score"] = best
    return best, state


def _validate_config(config: Mapping[str, Any]) -> tuple[list[str], float]:
    raw_allowlist = config.get("promotion_allowlist")
    if not isinstance(raw_allowlist, list) or not raw_allowlist:
        raise ConfigurationError("promotion_allowlist must be a non-empty list")
    allowlist = [_normalise_relative_path(item) for item in raw_allowlist]
    if len(allowlist) != len(set(allowlist)):
        raise ConfigurationError("promotion_allowlist contains duplicates")
    if any(not item.startswith("src/") for item in allowlist):
        raise ConfigurationError("promotion_allowlist may contain only src/ paths")
    initial = _bounded_score(
        config.get("initial_best_score", 0.0), context="initial_best_score"
    )
    generator = config.get("generator", {"mode": "local-template"})
    if not isinstance(generator, Mapping):
        raise ConfigurationError("generator must be an object")
    return allowlist, initial


def _relative_to_workspace(path: Path, workspace: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(workspace.resolve()).as_posix()
    except ValueError:
        return str(path.resolve(strict=False))


def _source_tree_digest(workspace: Path) -> str:
    """Hash the current source tree so promotion cannot absorb concurrent edits."""

    source_root = workspace.resolve() / "src"
    digest = hashlib.sha256()
    if not source_root.exists():
        digest.update(b"missing-src\0")
        return digest.hexdigest()
    for path in sorted(source_root.rglob("*"), key=lambda item: item.as_posix()):
        relative = path.relative_to(source_root)
        if "__pycache__" in relative.parts or path.is_symlink() or not path.is_file():
            continue
        digest.update(relative.as_posix().encode("utf-8"))
        digest.update(b"\0")
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def _execute_iteration(
    *,
    workspace: Path,
    config: Mapping[str, Any],
    benchmark_document: Mapping[str, Any],
    paths: RuntimePaths,
    ledger_entries: list[dict[str, Any]],
    best_score: float,
    state: dict[str, Any],
    allow_external: bool,
) -> dict[str, Any]:
    run_id = _run_id()
    started_at = _utc_now()
    candidate_dir = paths.candidate_root / run_id
    receipt: dict[str, Any] = {
        "schema_version": 1,
        "run_id": run_id,
        "started_at": started_at,
        "finished_at": None,
        "status": "running",
        "workspace": ".",
        "candidate_dir": _relative_to_workspace(candidate_dir, workspace),
        "hypothesis_id": None,
        "hypothesis": None,
        "generator": None,
        "benchmarks": [],
        "score": None,
        "previous_best_score": best_score,
        "base_src_digest": None,
        "pre_promotion_src_digest": None,
        "strictly_improved": False,
        "promoted": False,
        "promoted_files": [],
        "cleanup": {"attempted": False, "removed": False, "error": None},
        "error": None,
    }
    iteration_error: BaseException | None = None
    try:
        base_src_digest = _source_tree_digest(workspace)
        receipt["base_src_digest"] = base_src_digest
        hypotheses = config.get("hypotheses")
        if not isinstance(hypotheses, list):
            raise ConfigurationError("config.hypotheses must be a list")
        hypothesis = select_hypothesis(hypotheses, ledger_entries)
        receipt["hypothesis_id"] = hypothesis["id"]
        receipt["hypothesis"] = hypothesis
        paths.candidate_root.mkdir(parents=True, exist_ok=True)
        candidate_dir.mkdir(exist_ok=False)
        _candidate_marker(candidate_dir, run_id)

        allowlist, _ = _validate_config(config)
        builder = _load_agent_builder()
        generator_config = config.get("generator", {"mode": "local-template"})
        build_result = builder.build_candidate(
            candidate_dir,
            hypothesis,
            allowlist,
            generator_config,
            allow_external=allow_external,
        )
        receipt["generator"] = build_result
        score, results = evaluate_candidate(
            candidate_dir, workspace, benchmark_document
        )
        receipt["score"] = score
        receipt["benchmarks"] = results
        improved = score > best_score
        receipt["strictly_improved"] = improved
        if improved:
            pre_promotion_digest = _source_tree_digest(workspace)
            receipt["pre_promotion_src_digest"] = pre_promotion_digest
            if pre_promotion_digest != base_src_digest:
                raise PromotionError(
                    "workspace src changed during the experiment; refusing promotion"
                )
            artifacts = build_result.get("artifacts")
            if not isinstance(artifacts, list):
                raise PromotionError("builder did not return an artifact list")
            promoted = promote_artifacts(workspace, candidate_dir, artifacts, allowlist)
            receipt["promoted"] = True
            receipt["promoted_files"] = promoted
            state = {
                "schema_version": 1,
                "best_score": score,
                "best_run_id": run_id,
                "hypothesis_id": hypothesis["id"],
                "promoted_files": promoted,
                "updated_at": _utc_now(),
            }
            _atomic_write_json(paths.state, state)
            receipt["status"] = "promoted"
        else:
            receipt["status"] = "not-improved"
    except BaseException as exc:
        iteration_error = exc
        receipt["status"] = "error"
        receipt["error"] = {"type": type(exc).__name__, "message": str(exc)}
    finally:
        if candidate_dir.exists() or candidate_dir.is_symlink():
            receipt["cleanup"]["attempted"] = True
            try:
                receipt["cleanup"]["removed"] = safe_cleanup_candidate(
                    candidate_dir, paths.candidate_root, run_id
                )
            except BaseException as cleanup_exc:
                receipt["cleanup"]["error"] = {
                    "type": type(cleanup_exc).__name__,
                    "message": str(cleanup_exc),
                }
                if iteration_error is None:
                    iteration_error = cleanup_exc
                    receipt["status"] = "error"
                    receipt["error"] = receipt["cleanup"]["error"]
        receipt["finished_at"] = _utc_now()
        receipt_path = paths.runs_root / f"{run_id}.json"
        receipt["receipt"] = _relative_to_workspace(receipt_path, workspace)
        _atomic_write_json(receipt_path, receipt)
        ledger_entry = {
            "schema_version": 1,
            "run_id": run_id,
            "timestamp": receipt["finished_at"],
            "hypothesis_id": receipt["hypothesis_id"],
            "status": receipt["status"],
            "score": receipt["score"],
            "previous_best_score": receipt["previous_best_score"],
            "strictly_improved": receipt["strictly_improved"],
            "promoted": receipt["promoted"],
            "promoted_files": receipt["promoted_files"],
            "receipt": receipt["receipt"],
            "error": receipt["error"],
        }
        _append_jsonl(paths.ledger, ledger_entry)
    return receipt


def run_research(
    *,
    workspace: Path = DEFAULT_WORKSPACE,
    config_path: Path = DEFAULT_CONFIG,
    benchmarks_path: Path = DEFAULT_BENCHMARKS,
    iterations: int | None = None,
    allow_external: bool = False,
) -> list[dict[str, Any]]:
    """Run bounded iterations under one workspace lock and return receipts."""

    workspace = workspace.resolve()
    config = _read_json_object(_workspace_path(workspace, config_path))
    benchmark_document = _read_json_object(_workspace_path(workspace, benchmarks_path))
    _, initial_best = _validate_config(config)
    if iterations is None:
        iterations = config.get("default_iterations", 1)
    if (
        not isinstance(iterations, int)
        or isinstance(iterations, bool)
        or iterations < 1
    ):
        raise ConfigurationError("iterations must be a positive integer")
    paths = _runtime_paths(workspace, config)
    paths.evaluation_root.mkdir(parents=True, exist_ok=True)
    receipts: list[dict[str, Any]] = []
    with exclusive_lock(paths.lock):
        ledger_entries = _read_ledger(paths.ledger)
        best_score, state = _load_state(
            paths.state,
            initial_best_score=initial_best,
            ledger_entries=ledger_entries,
        )
        for _ in range(iterations):
            receipt = _execute_iteration(
                workspace=workspace,
                config=config,
                benchmark_document=benchmark_document,
                paths=paths,
                ledger_entries=ledger_entries,
                best_score=best_score,
                state=state,
                allow_external=allow_external,
            )
            receipts.append(receipt)
            ledger_entries.append(
                {
                    "hypothesis_id": receipt["hypothesis_id"],
                    "promoted": receipt["promoted"],
                    "score": receipt["score"],
                }
            )
            if receipt["promoted"] is True and receipt["score"] is not None:
                best_score = float(receipt["score"])
            if receipt["status"] == "error":
                break
    return receipts


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=DEFAULT_WORKSPACE)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--benchmarks", type=Path, default=DEFAULT_BENCHMARKS)
    parser.add_argument(
        "--iterations",
        type=int,
        default=None,
        help="bounded iteration count; defaults to config (1 in the repository)",
    )
    parser.add_argument(
        "--allow-external-generator",
        action="store_true",
        help="explicitly permit configured agents-cli execution",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        receipts = run_research(
            workspace=args.workspace,
            config_path=args.config,
            benchmarks_path=args.benchmarks,
            iterations=args.iterations,
            allow_external=args.allow_external_generator,
        )
    except ResearchError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": {"type": type(exc).__name__, "message": str(exc)},
                },
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        return 1
    ok = all(receipt["status"] != "error" for receipt in receipts)
    print(json.dumps({"ok": ok, "runs": receipts}, indent=2, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
