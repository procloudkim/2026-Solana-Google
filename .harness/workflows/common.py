"""Shared, dependency-free utilities for the local harness workflows."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
import unicodedata
from pathlib import Path
from typing import Any


def sha256_file(path: Path, *, chunk_size: int = 1024 * 1024) -> str:
    """Return a full-file SHA-256 digest without loading the file into memory."""

    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_id(value: str, *, length: int = 12) -> str:
    """Build a stable, non-secret identifier from a normalized string."""

    normalized = value.replace("\\", "/").encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()[:length]


def slugify(value: str, *, fallback: str = "reference", max_length: int = 72) -> str:
    """Create a readable cross-platform filename component."""

    normalized = unicodedata.normalize("NFKC", value).casefold()
    characters: list[str] = []
    previous_dash = False
    for character in normalized:
        if character.isalnum():
            characters.append(character)
            previous_dash = False
        elif not previous_dash:
            characters.append("-")
            previous_dash = True
    slug = "".join(characters).strip("-")[:max_length].rstrip("-")
    return slug or fallback


def path_for_display(path: Path, repo_root: Path) -> str:
    """Prefer a repository-relative POSIX path, falling back to an absolute one."""

    resolved = path.resolve()
    try:
        return resolved.relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return resolved.as_posix()


def ensure_within(path: Path, parent: Path) -> Path:
    """Resolve *path* and reject writes that escape *parent*."""

    resolved = path.resolve()
    resolved_parent = parent.resolve()
    try:
        resolved.relative_to(resolved_parent)
    except ValueError as error:
        raise ValueError(f"path escapes allowed root: {path}") from error
    return resolved


def atomic_write_text(path: Path, content: str, *, encoding: str = "utf-8") -> None:
    """Atomically replace a text file using a temporary sibling."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding=encoding,
            newline="\n",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_name = temporary.name
            temporary.write(content)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, path)
    finally:
        if temporary_name is not None:
            try:
                Path(temporary_name).unlink(missing_ok=True)
            except OSError:
                pass


def atomic_write_json(path: Path, value: Any) -> None:
    """Serialize stable, human-readable JSON and atomically replace *path*."""

    content = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    atomic_write_text(path, content)
