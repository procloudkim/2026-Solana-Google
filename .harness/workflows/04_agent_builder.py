#!/usr/bin/env python3
"""Candidate builders for the local harness research loop.

The default builder deliberately emits a small, dependency-free Python template.
It does not claim to call Google ADK, Gemini, or ``agents-cli``.  The external
adapter is available only when the caller opts in explicitly and always invokes
an argument vector with ``shell=False``.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
import time
from typing import Any, Mapping, Sequence


class BuilderError(RuntimeError):
    """Raised when a candidate cannot be generated safely."""


def _normalise_relative_path(value: str) -> str:
    """Return a portable relative path and reject traversal or absolute paths."""

    if not isinstance(value, str) or not value.strip():
        raise BuilderError("artifact paths must be non-empty strings")
    portable = value.replace("\\", "/")
    path = PurePosixPath(portable)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise BuilderError(f"unsafe artifact path: {value!r}")
    return path.as_posix()


def _path_inside(root: Path, relative: str) -> Path:
    root = root.resolve()
    target = root.joinpath(*PurePosixPath(relative).parts)
    try:
        target.resolve(strict=False).relative_to(root)
    except ValueError as exc:
        raise BuilderError(f"artifact escapes candidate directory: {relative!r}") from exc
    return target


def _atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def _json_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BuilderError(f"cannot read JSON object from {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise BuilderError(f"expected a JSON object in {path}")
    return value


def _json_string_list(path: Path) -> list[str]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BuilderError(f"cannot read JSON list from {path}: {exc}") from exc
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise BuilderError(f"expected a JSON string list in {path}")
    return value


def _validate_allowlist(values: Sequence[str]) -> tuple[str, ...]:
    if isinstance(values, (str, bytes)):
        raise BuilderError("promotion_allowlist must be a list of paths")
    normalised = tuple(_normalise_relative_path(value) for value in values)
    if not normalised:
        raise BuilderError("promotion_allowlist cannot be empty")
    if len(set(normalised)) != len(normalised):
        raise BuilderError("promotion_allowlist contains duplicate paths")
    for relative in normalised:
        if not relative.startswith("src/"):
            raise BuilderError(f"only src/ artifacts may be generated: {relative!r}")
    return normalised


def _local_template(hypothesis: Mapping[str, Any]) -> str:
    hypothesis_id = str(hypothesis.get("id", "unnamed-hypothesis"))
    title = str(hypothesis.get("title", hypothesis_id))
    description = str(hypothesis.get("description", ""))
    payload = {
        "hypothesis_id": hypothesis_id,
        "title": title,
        "description": description,
        "generator": "local-template",
        "implementation_status": "scaffold-only",
    }
    payload_literal = repr(payload)
    return f'''#!/usr/bin/env python3
"""Local harness candidate.

This file is a dependency-free scaffold generated for an isolated experiment.
It is not evidence that ADK, Gemini, Solana, or an external agent CLI ran.
"""

from __future__ import annotations

import argparse
import json
from typing import Any


CANDIDATE_METADATA: dict[str, str] = {payload_literal}


def build_agent_spec() -> dict[str, Any]:
    """Return the explicit starter contract for this candidate."""

    return {{
        "name": "harness-research-candidate",
        "status": CANDIDATE_METADATA["implementation_status"],
        "hypothesis": CANDIDATE_METADATA["hypothesis_id"],
        "capabilities": [],
    }}


def self_test() -> bool:
    spec = build_agent_spec()
    return (
        spec["status"] == "scaffold-only"
        and spec["hypothesis"] == CANDIDATE_METADATA["hypothesis_id"]
        and spec["capabilities"] == []
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        print(json.dumps({{"ok": self_test()}}, sort_keys=True))
        return 0 if self_test() else 1
    print(json.dumps(build_agent_spec(), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


def _verify_artifacts(
    candidate_dir: Path,
    allowlist: Sequence[str],
) -> list[str]:
    """Return existing allowlisted regular files, refusing links and escapes."""

    candidate_root = candidate_dir.resolve()
    artifacts: list[str] = []
    for relative in _validate_allowlist(allowlist):
        path = _path_inside(candidate_root, relative)
        if not path.exists():
            continue
        if path.is_symlink() or not path.is_file():
            raise BuilderError(f"generated artifact is not a regular file: {relative}")
        try:
            path.resolve(strict=True).relative_to(candidate_root)
        except ValueError as exc:
            raise BuilderError(f"generated artifact escapes candidate directory: {relative}") from exc
        artifacts.append(relative)
    if not artifacts:
        raise BuilderError("builder produced no allowlisted artifacts")
    return artifacts


def build_local_template(
    candidate_dir: Path,
    hypothesis: Mapping[str, Any],
    allowlist: Sequence[str],
) -> dict[str, Any]:
    """Generate one honest local scaffold inside ``candidate_dir``."""

    allowed = _validate_allowlist(allowlist)
    artifact = _normalise_relative_path(
        str(hypothesis.get("artifact", allowed[0]))
    )
    if artifact not in allowed:
        raise BuilderError(f"hypothesis artifact is not allowlisted: {artifact}")
    destination = _path_inside(candidate_dir, artifact)
    _atomic_write_text(destination, _local_template(hypothesis))
    return {
        "adapter": "local-template",
        "artifacts": _verify_artifacts(candidate_dir, [artifact]),
        "command": None,
        "duration_seconds": 0.0,
        "stdout": "generated dependency-free local scaffold",
        "stderr": "",
    }


def _argv_with_placeholders(
    argv: Sequence[str],
    *,
    candidate_dir: Path,
    request_path: Path,
    hypothesis_id: str,
) -> list[str]:
    if isinstance(argv, (str, bytes)) or not argv:
        raise BuilderError("external generator argv must be a non-empty string list")
    if not all(isinstance(argument, str) and argument for argument in argv):
        raise BuilderError("external generator argv must contain only non-empty strings")
    replacements = {
        "{candidate}": str(candidate_dir.resolve()),
        "{request}": str(request_path.resolve()),
        "{hypothesis_id}": hypothesis_id,
        "{python}": sys.executable,
    }
    command: list[str] = []
    for argument in argv:
        expanded = argument
        for placeholder, replacement in replacements.items():
            expanded = expanded.replace(placeholder, replacement)
        if "{" in expanded or "}" in expanded:
            raise BuilderError(f"unknown external argv placeholder in {argument!r}")
        command.append(expanded)
    return command


def build_with_agents_cli(
    candidate_dir: Path,
    hypothesis: Mapping[str, Any],
    allowlist: Sequence[str],
    external_config: Mapping[str, Any],
    *,
    allow_external: bool,
) -> dict[str, Any]:
    """Run an explicitly opted-in external generator in the staging directory."""

    if not allow_external:
        raise BuilderError(
            "external agents-cli generation requires --allow-external-generator"
        )
    argv = external_config.get("argv")
    if not isinstance(argv, list):
        raise BuilderError("generator.external.argv must be a JSON string list")
    try:
        timeout_seconds = float(external_config.get("timeout_seconds", 120.0))
    except (TypeError, ValueError) as exc:
        raise BuilderError("external generator timeout_seconds must be numeric") from exc
    if timeout_seconds <= 0:
        raise BuilderError("external generator timeout_seconds must be positive")

    candidate_dir = candidate_dir.resolve()
    candidate_dir.mkdir(parents=True, exist_ok=True)
    request_path = candidate_dir / ".harness-builder-request.json"
    request = {
        "schema_version": 1,
        "hypothesis": dict(hypothesis),
        "output_root": str(candidate_dir),
        "allowed_artifacts": list(_validate_allowlist(allowlist)),
        "boundary": (
            "Write generated files only beneath output_root. Only allowed_artifacts "
            "are eligible for promotion."
        ),
    }
    _atomic_write_text(
        request_path,
        json.dumps(request, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
    )
    command = _argv_with_placeholders(
        argv,
        candidate_dir=candidate_dir,
        request_path=request_path,
        hypothesis_id=str(hypothesis.get("id", "unnamed-hypothesis")),
    )
    temporary_dir = candidate_dir / ".tmp"
    temporary_dir.mkdir(exist_ok=True)
    environment = os.environ.copy()
    environment.update(
        {
            "HARNESS_CANDIDATE_DIR": str(candidate_dir),
            "HARNESS_BUILDER_REQUEST": str(request_path),
            "TMP": str(temporary_dir),
            "TEMP": str(temporary_dir),
        }
    )
    started = time.monotonic()
    try:
        completed = subprocess.run(
            command,
            cwd=candidate_dir,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_seconds,
            check=False,
            shell=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise BuilderError(
            f"external agents-cli timed out after {timeout_seconds:g} seconds"
        ) from exc
    except OSError as exc:
        raise BuilderError(f"cannot start external agents-cli: {exc}") from exc
    duration = time.monotonic() - started
    if completed.returncode != 0:
        stderr = (completed.stderr or "")[-4000:]
        raise BuilderError(
            f"external agents-cli exited with {completed.returncode}: {stderr}"
        )
    return {
        "adapter": "external-agents-cli",
        "artifacts": _verify_artifacts(candidate_dir, allowlist),
        "command": command,
        "duration_seconds": round(duration, 6),
        "stdout": (completed.stdout or "")[-4000:],
        "stderr": (completed.stderr or "")[-4000:],
    }


def build_candidate(
    candidate_dir: Path,
    hypothesis: Mapping[str, Any],
    allowlist: Sequence[str],
    generator_config: Mapping[str, Any] | None = None,
    *,
    allow_external: bool = False,
) -> dict[str, Any]:
    """Build a candidate using the configured adapter.

    Missing configuration resolves to ``local-template``.  Merely selecting the
    external mode in JSON is insufficient; the caller must also pass
    ``allow_external=True``.
    """

    if not isinstance(hypothesis, Mapping):
        raise BuilderError("hypothesis must be an object")
    config = dict(generator_config or {})
    mode = str(config.get("mode", "local-template"))
    if mode == "local-template":
        return build_local_template(candidate_dir, hypothesis, allowlist)
    if mode == "agents-cli":
        external = config.get("external", {})
        if not isinstance(external, Mapping):
            raise BuilderError("generator.external must be an object")
        return build_with_agents_cli(
            candidate_dir,
            hypothesis,
            allowlist,
            external,
            allow_external=allow_external,
        )
    raise BuilderError(f"unknown generator mode: {mode!r}")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate-dir", required=True, type=Path)
    parser.add_argument("--hypothesis-json", required=True, type=Path)
    parser.add_argument("--allowlist-json", required=True, type=Path)
    parser.add_argument("--generator-config-json", type=Path)
    parser.add_argument("--allow-external-generator", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        generator_config = (
            _json_object(args.generator_config_json)
            if args.generator_config_json
            else {"mode": "local-template"}
        )
        result = build_candidate(
            args.candidate_dir,
            _json_object(args.hypothesis_json),
            _json_string_list(args.allowlist_json),
            generator_config,
            allow_external=args.allow_external_generator,
        )
    except BuilderError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, **result}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
