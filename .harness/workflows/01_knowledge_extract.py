#!/usr/bin/env python3
"""Build a deterministic, auditable local LLM-Wiki from reference files.

Base extraction stays dependency-light. If the separately generated media
enrichment manifest contains SHA-matched completed artifacts, local MP4
transcripts and PDF OCR/QR results are attached with their provenance.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable

from common import (
    atomic_write_json,
    atomic_write_text,
    ensure_within,
    path_for_display,
    sha256_file,
    slugify,
    stable_id,
)


SCHEMA_VERSION = 1
TEXT_SUFFIXES = {".txt", ".md", ".markdown", ".rst", ".srt", ".vtt"}
HTML_SUFFIXES = {".html", ".htm"}
TRANSCRIPT_SUFFIXES = {".txt", ".md", ".markdown", ".json", ".srt", ".vtt"}

CATEGORIES: dict[str, dict[str, Any]] = {
    "Solana Engine": {
        "slug": "solana-engine",
        "description": "Solana programs, RPCs, transactions, tokens, and runtime design.",
        "keywords": (
            "solana",
            "솔라나",
            "anchor",
            "lamport",
            "spl token",
            "program derived address",
            "rpc",
        ),
    },
    "GCP Infrastructure": {
        "slug": "gcp-infrastructure",
        "description": "Google Cloud deployment, events, data, and managed AI infrastructure.",
        "keywords": (
            "google cloud",
            "gcp",
            "cloud run",
            "eventarc",
            "firestore",
            "vertex ai",
            "pub/sub",
        ),
    },
    "AP2/x402 Payment Protocols": {
        "slug": "payment-protocols",
        "description": "Agentic commerce and payment protocols including AP2, x402, and pay.sh.",
        "keywords": (
            "ap2",
            "x402",
            "pay.sh",
            "agent payments protocol",
            "agentic commerce",
            "payment protocol",
            "결제",
            "mpp",
            "ucp",
            "acp",
            "mcp",
            "model context protocol",
        ),
    },
    "Google ADK": {
        "slug": "google-adk",
        "description": "Google Agent Development Kit, Agents CLI, Gemini, and agent construction.",
        "keywords": (
            "google adk",
            "agent development kit",
            "agents cli",
            "agents-cli",
            "gemini",
            "google agent",
        ),
    },
}


@dataclass(frozen=True)
class Extraction:
    body: str
    status: str
    method: str
    detail: str


class _VisibleHTML(HTMLParser):
    """Small stdlib HTML-to-readable-text converter with no truncation."""

    _BLOCK_TAGS = {
        "address",
        "article",
        "aside",
        "blockquote",
        "div",
        "footer",
        "form",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "hr",
        "main",
        "nav",
        "ol",
        "p",
        "section",
        "table",
        "tr",
        "ul",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.suppressed_depth = 0
        self.links: list[str | None] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.casefold()
        if tag in {"script", "style", "noscript"}:
            self.suppressed_depth += 1
            return
        if self.suppressed_depth:
            return
        if tag in self._BLOCK_TAGS or tag == "br":
            self.parts.append("\n")
        if tag == "li":
            self.parts.append("\n- ")
        if tag == "a":
            self.links.append(dict(attrs).get("href"))

    def handle_endtag(self, tag: str) -> None:
        tag = tag.casefold()
        if tag in {"script", "style", "noscript"}:
            self.suppressed_depth = max(0, self.suppressed_depth - 1)
            return
        if self.suppressed_depth:
            return
        if tag == "a" and self.links:
            link = self.links.pop()
            if link:
                self.parts.append(f" ({link})")
        if tag in self._BLOCK_TAGS or tag == "li":
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.suppressed_depth:
            self.parts.append(data)

    def text(self) -> str:
        lines = []
        previous_blank = True
        for raw_line in "".join(self.parts).splitlines():
            line = re.sub(r"[ \t\f\v]+", " ", raw_line).strip()
            if line:
                lines.append(line)
                previous_blank = False
            elif not previous_blank:
                lines.append("")
                previous_blank = True
        return "\n".join(lines).strip()


def _decode_text(path: Path) -> tuple[str, str]:
    data = path.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "cp949"):
        try:
            return data.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace"), "utf-8-replacement"


def _load_pdf_reader() -> Any | None:
    try:
        from pypdf import PdfReader
    except ImportError:
        return None
    return PdfReader


def _extract_pdf(path: Path) -> Extraction:
    reader_class = _load_pdf_reader()
    if reader_class is None:
        return Extraction(
            body=(
                "## PDF extraction\n\n"
                "PDF text was not extracted because the optional `pypdf` package is not installed.\n"
            ),
            status="metadata_only",
            method="pypdf_unavailable",
            detail="Install pypdf to extract page-marked text.",
        )
    try:
        reader = reader_class(str(path))
        sections: list[str] = []
        extracted_characters = 0
        for page_number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            extracted_characters += len(text)
            if not text:
                text = "_No extractable text on this page._"
            sections.append(f"## Page {page_number}\n\n{text}")
        if not sections:
            sections.append("## PDF extraction\n\n_The PDF contains no pages._")
        detail = (
            f"pages={len(reader.pages)}; extracted_characters={extracted_characters}; "
            "coverage=text_layer_only; ocr=false"
        )
        status = (
            "metadata_only" if extracted_characters == 0 else "extracted_with_warning"
        )
        return Extraction("\n\n".join(sections) + "\n", status, "pypdf", detail)
    except Exception as error:  # pypdf raises several format/encryption-specific errors
        return Extraction(
            body=f"## PDF extraction\n\nExtraction failed: `{type(error).__name__}: {error}`\n",
            status="extraction_error",
            method="pypdf_error",
            detail=f"{type(error).__name__}: {error}",
        )


def _extract_regular(path: Path) -> Extraction:
    suffix = path.suffix.casefold()
    if suffix in TEXT_SUFFIXES:
        text, encoding = _decode_text(path)
        return Extraction(
            text.rstrip() + "\n", "extracted", "text", f"encoding={encoding}"
        )
    if suffix == ".json":
        text, encoding = _decode_text(path)
        try:
            value = json.loads(text)
            normalized = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)
            return Extraction(
                f"```json\n{normalized}\n```\n",
                "extracted",
                "json",
                f"encoding={encoding}; parsed=true",
            )
        except json.JSONDecodeError as error:
            return Extraction(
                f"```json\n{text.rstrip()}\n```\n",
                "extracted_with_warning",
                "json_raw",
                f"encoding={encoding}; parse_error={error}",
            )
    if suffix in HTML_SUFFIXES:
        text, encoding = _decode_text(path)
        parser = _VisibleHTML()
        try:
            parser.feed(text)
            parser.close()
            visible = parser.text()
            return Extraction(
                f"## Extracted visible text\n\n{visible}\n",
                "extracted",
                "html_visible_text",
                f"encoding={encoding}",
            )
        except Exception as error:
            return Extraction(
                f"```html\n{text.rstrip()}\n```\n",
                "extracted_with_warning",
                "html_raw",
                f"encoding={encoding}; parse_error={type(error).__name__}: {error}",
            )
    if suffix == ".pdf":
        return _extract_pdf(path)
    return Extraction(
        "## Extraction boundary\n\nNo content extractor is configured for this file type.\n",
        "unsupported",
        "filesystem_metadata",
        f"unsupported extension: {suffix or '(none)'}",
    )


def _find_transcript(video_path: Path) -> Path | None:
    target_stem = video_path.stem.casefold()
    candidates: list[Path] = []
    for candidate in video_path.parent.iterdir():
        if not candidate.is_file() or candidate == video_path:
            continue
        if candidate.suffix.casefold() not in TRANSCRIPT_SUFFIXES:
            continue
        candidate_stem = candidate.stem.casefold()
        if candidate_stem in {target_stem, f"{target_stem}.transcript"}:
            candidates.append(candidate)
    return (
        min(candidates, key=lambda item: (item.name.casefold(), item.name))
        if candidates
        else None
    )


def _iter_mp4_boxes(
    stream: Any, start: int, end: int
) -> Iterable[tuple[bytes, int, int]]:
    """Yield bounded ISO BMFF boxes without decoding media streams."""

    stream.seek(start)
    while stream.tell() + 8 <= end:
        box_start = stream.tell()
        header = stream.read(8)
        if len(header) != 8:
            return
        size = int.from_bytes(header[:4], "big")
        box_type = header[4:]
        header_size = 8
        if size == 1:
            extended = stream.read(8)
            if len(extended) != 8:
                return
            size = int.from_bytes(extended, "big")
            header_size = 16
        elif size == 0:
            size = end - box_start
        if size < header_size:
            return
        box_end = box_start + size
        if box_end > end:
            return
        yield box_type, box_start + header_size, box_end
        stream.seek(box_end)


def _mp4_duration_seconds(path: Path) -> float | None:
    """Read the movie-header duration only; never decode audio or video."""

    try:
        file_size = path.stat().st_size
        with path.open("rb") as stream:
            for box_type, payload_start, box_end in _iter_mp4_boxes(
                stream, 0, file_size
            ):
                if box_type != b"moov":
                    continue
                for child_type, child_start, child_end in _iter_mp4_boxes(
                    stream, payload_start, box_end
                ):
                    if child_type != b"mvhd":
                        continue
                    stream.seek(child_start)
                    version_bytes = stream.read(4)
                    if len(version_bytes) != 4:
                        return None
                    version = version_bytes[0]
                    if version == 0:
                        values = stream.read(16)
                        if len(values) != 16:
                            return None
                        timescale = int.from_bytes(values[8:12], "big")
                        duration = int.from_bytes(values[12:16], "big")
                    elif version == 1:
                        values = stream.read(28)
                        if len(values) != 28:
                            return None
                        timescale = int.from_bytes(values[16:20], "big")
                        duration = int.from_bytes(values[20:28], "big")
                    else:
                        return None
                    if timescale <= 0:
                        return None
                    return duration / timescale
    except OSError:
        return None
    return None


def _format_duration(seconds: float) -> str:
    rounded = max(0, round(seconds))
    hours, remainder = divmod(rounded, 3600)
    minutes, seconds_part = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds_part:02d}"


def _extract_video(path: Path, repo_root: Path) -> tuple[Extraction, Path | None]:
    sidecar = _find_transcript(path)
    duration = _mp4_duration_seconds(path)
    lines = [
        "## Media metadata",
        "",
        "- Container: MP4",
        "- Extraction mode: metadata only (the video stream was not decoded)",
        f"- Byte size: {path.stat().st_size}",
    ]
    if duration is not None:
        lines.append(
            f"- Container duration: {_format_duration(duration)} ({duration:.3f} seconds)"
        )
    method = "filesystem_metadata"
    detail = "video decoding and automatic transcription are intentionally out of scope"
    if sidecar is not None:
        transcript = _extract_regular(sidecar)
        lines.extend(
            [
                "",
                "## Supplied transcript sidecar",
                "",
                f"Source: `{path_for_display(sidecar, repo_root)}`",
                "",
                transcript.body.rstrip(),
            ]
        )
        method = "filesystem_metadata+transcript_sidecar"
        detail = f"attached transcript via {path_for_display(sidecar, repo_root)}"
    else:
        lines.extend(
            [
                "",
                "No same-stem transcript sidecar was found; content remains `metadata_only`.",
            ]
        )
    return Extraction("\n".join(lines) + "\n", "metadata_only", method, detail), sidecar


def _load_enrichment_index(
    repo_root: Path, enrichment_root: Path
) -> dict[tuple[str, str], dict[str, Any]]:
    manifest_path = enrichment_root / "manifest.json"
    if not manifest_path.is_file():
        return {}
    try:
        value = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    entries = value.get("entries") if isinstance(value, dict) else None
    if not isinstance(entries, list):
        return {}
    index: dict[tuple[str, str], dict[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, dict) or entry.get("status") != "complete":
            continue
        kind = entry.get("kind")
        digest = entry.get("source_sha256")
        artifacts = entry.get("artifacts")
        if not isinstance(kind, str) or not isinstance(digest, str):
            continue
        if not isinstance(artifacts, dict):
            continue
        markdown = artifacts.get("markdown")
        if not isinstance(markdown, str):
            continue
        try:
            artifact_path = ensure_within(repo_root / markdown, repo_root)
        except ValueError:
            continue
        if artifact_path.is_file():
            index[(kind, digest)] = entry
    return index


def _apply_enrichment(
    path: Path,
    digest: str,
    extraction: Extraction,
    enrichment_index: dict[tuple[str, str], dict[str, Any]],
    repo_root: Path,
) -> tuple[Extraction, dict[str, Any] | None]:
    expected_kind = (
        "transcript"
        if path.suffix.casefold() == ".mp4"
        else "pdf_ocr_qr" if path.suffix.casefold() == ".pdf" else None
    )
    if expected_kind is None:
        return extraction, None
    enrichment = enrichment_index.get((expected_kind, digest))
    if enrichment is None:
        return extraction, None
    markdown_path = ensure_within(
        repo_root / enrichment["artifacts"]["markdown"], repo_root
    )
    try:
        enriched_body = markdown_path.read_text(encoding="utf-8").strip()
    except OSError:
        return extraction, None
    adapter = str(enrichment.get("adapter", "local-media-adapter"))
    artifact_summary = {
        "adapter": adapter,
        "artifacts": enrichment["artifacts"],
        "settings_fingerprint": enrichment.get("settings_fingerprint"),
        "source_sha256": digest,
        "status": "complete",
    }
    if expected_kind == "transcript":
        heading = "## SHA-matched local transcript enrichment"
        status = "transcribed"
    else:
        heading = "## SHA-matched local OCR/QR enrichment"
        status = "enriched"
    combined = f"{extraction.body.rstrip()}\n\n{heading}\n\n{enriched_body}\n"
    return (
        Extraction(
            combined,
            status,
            f"{extraction.method}+{adapter}",
            f"{extraction.detail}; enrichment_sha256={digest}",
        ),
        artifact_summary,
    )


def _classify(path_text: str, body: str) -> list[str]:
    haystack = f"{path_text}\n{body}".casefold()
    return [
        name
        for name, config in CATEGORIES.items()
        if any(keyword.casefold() in haystack for keyword in config["keywords"])
    ]


def _frontmatter(entry: dict[str, Any]) -> str:
    categories = entry["categories"]
    category_lines = "\n".join(
        f"  - {json.dumps(item, ensure_ascii=False)}" for item in categories
    )
    if not category_lines:
        category_lines = "  []"
    duplicate = json.dumps(entry["duplicate_of"], ensure_ascii=False)
    transcript = json.dumps(entry["transcript_sidecar"], ensure_ascii=False)
    enrichment = json.dumps(entry["enrichment"], ensure_ascii=False, sort_keys=True)
    return (
        "---\n"
        f"harness_schema: {SCHEMA_VERSION}\n"
        f"source_path: {json.dumps(entry['source_path'], ensure_ascii=False)}\n"
        f"sha256: {json.dumps(entry['sha256'])}\n"
        f"size_bytes: {entry['size_bytes']}\n"
        f"kind: {json.dumps(entry['kind'])}\n"
        f"status: {json.dumps(entry['status'])}\n"
        f"duplicate_of: {duplicate}\n"
        f"transcript_sidecar: {transcript}\n"
        f"enrichment: {enrichment}\n"
        "categories:\n"
        f"{category_lines}\n"
        "---\n"
    )


def _kind_for(path: Path) -> str:
    suffix = path.suffix.casefold()
    if suffix in {".md", ".markdown"}:
        return "markdown"
    if suffix in TEXT_SUFFIXES:
        return "text"
    if suffix == ".json":
        return "json"
    if suffix in HTML_SUFFIXES:
        return "html"
    if suffix == ".pdf":
        return "pdf"
    if suffix == ".mp4":
        return "video"
    return "unsupported"


def _raw_output_path(relative_path: Path, wiki_root: Path) -> Path:
    path_key = relative_path.as_posix()
    readable = slugify(str(relative_path.with_suffix("")))
    name = f"{readable}-{stable_id(path_key, length=10)}.md"
    return ensure_within(wiki_root / "raw_references" / name, wiki_root)


def _relative_link(from_directory: Path, target: Path) -> str:
    try:
        return target.relative_to(from_directory.parent).as_posix()
    except ValueError:
        return target.as_posix()


def _render_index(entries: list[dict[str, Any]], wiki_root: Path) -> str:
    counts = Counter(entry["status"] for entry in entries)
    lines = [
        "# LLM-Wiki Index",
        "",
        "This index is generated deterministically from the complete reference inventory.",
        "",
        "## Inventory",
        "",
        f"- Total source files: {len(entries)}",
    ]
    for status, count in sorted(counts.items()):
        lines.append(f"- `{status}`: {count}")
    lines.extend(
        [
            "",
            "## Execution control",
            "",
            "- [Current readiness](operations/00-status.md)",
            "- [Event contract](operations/01-event-contract.md)",
            "- [Candidate selection](operations/02-candidates.md)",
            "- [Product contract](operations/03-product-contract.md)",
            "- [Execution architecture](operations/04-architecture.md)",
            "- [Security and budget](operations/05-security-budget.md)",
            "- [Evidence](operations/06-evidence.md)",
            "- [Submission readiness](operations/07-submission.md)",
            "- [Official Docs Wiki](../../research/official-docs-wiki/index.md)",
        ]
    )
    lines.extend(["", "## Knowledge modules", ""])
    for category, config in CATEGORIES.items():
        module_path = wiki_root / "modules" / f"{config['slug']}.md"
        related = [entry for entry in entries if category in entry["categories"]]
        lines.extend(
            [
                f"### [{category}]({_relative_link(wiki_root / 'index.md', module_path)})",
                "",
                config["description"],
                "",
            ]
        )
        if related:
            for entry in related:
                output = Path(entry["output_path"])
                wiki_relative = Path(
                    *output.parts[output.parts.index("raw_references") :]
                )
                lines.append(
                    f"- [{entry['relative_path']}]({wiki_relative.as_posix()}) "
                    f"— `{entry['status']}`"
                )
        else:
            lines.append("- _No matching references yet._")
        lines.append("")
    unclassified = [entry for entry in entries if not entry["categories"]]
    if unclassified:
        lines.extend(["## Unclassified inventory", ""])
        for entry in unclassified:
            output = Path(entry["output_path"])
            wiki_relative = Path(*output.parts[output.parts.index("raw_references") :])
            lines.append(
                f"- [{entry['relative_path']}]({wiki_relative.as_posix()}) "
                f"— `{entry['status']}`"
            )
        lines.append("")
    return "\n".join(lines)


def _render_module(category: str, entries: list[dict[str, Any]]) -> str:
    config = CATEGORIES[category]
    lines = [
        f"# {category}",
        "",
        config["description"],
        "",
        "## Related modules",
        "",
    ]
    for other, other_config in CATEGORIES.items():
        if other != category:
            lines.append(f"- [{other}]({other_config['slug']}.md)")
    lines.extend(["", "## References", ""])
    related = [entry for entry in entries if category in entry["categories"]]
    if not related:
        lines.append("_No matching references yet._")
    else:
        for entry in related:
            raw_name = Path(entry["output_path"]).name
            lines.append(
                f"- [{entry['relative_path']}](../raw_references/{raw_name}) "
                f"— `{entry['status']}`; SHA-256 `{entry['sha256']}`"
            )
    lines.append("")
    return "\n".join(lines)


def _inventory_files(source_root: Path) -> Iterable[Path]:
    files = (path for path in source_root.rglob("*") if path.is_file())
    return sorted(
        files,
        key=lambda path: (
            path.relative_to(source_root).as_posix().casefold(),
            path.relative_to(source_root).as_posix(),
        ),
    )


def run_ingestion(
    repo_root: Path,
    source_root: Path,
    wiki_root: Path,
    enrichment_root: Path | None = None,
) -> dict[str, Any]:
    """Ingest *source_root* and return the manifest that was safely written."""

    repo_root = repo_root.resolve()
    source_root = source_root.resolve()
    wiki_root = wiki_root.resolve()
    if not source_root.is_dir():
        raise FileNotFoundError(
            f"reference source directory does not exist: {source_root}"
        )
    raw_root = ensure_within(wiki_root / "raw_references", wiki_root)
    modules_root = ensure_within(wiki_root / "modules", wiki_root)
    raw_root.mkdir(parents=True, exist_ok=True)
    modules_root.mkdir(parents=True, exist_ok=True)
    resolved_enrichment_root = (
        enrichment_root.resolve()
        if enrichment_root is not None
        else (repo_root / ".harness" / "enrichment").resolve()
    )
    enrichment_index = _load_enrichment_index(repo_root, resolved_enrichment_root)

    entries: list[dict[str, Any]] = []
    canonical_by_hash: dict[str, dict[str, Any]] = {}
    for path in _inventory_files(source_root):
        relative_path = path.relative_to(source_root)
        relative_text = relative_path.as_posix()
        source_text = path_for_display(path, repo_root)
        output_path = _raw_output_path(relative_path, wiki_root)
        digest = sha256_file(path)
        canonical = canonical_by_hash.get(digest)
        duplicate_of = canonical["source_path"] if canonical is not None else None
        transcript: Path | None = None
        enrichment: dict[str, Any] | None = None

        if duplicate_of is not None:
            extraction = Extraction(
                body=(
                    "## Duplicate reference\n\n"
                    f"This file is byte-for-byte identical to `{duplicate_of}`. "
                    "Its content was not extracted a second time.\n"
                ),
                status="duplicate",
                method="sha256_duplicate",
                detail=f"canonical_source={duplicate_of}",
            )
        elif path.suffix.casefold() == ".mp4":
            extraction, transcript = _extract_video(path, repo_root)
        else:
            extraction = _extract_regular(path)

        if duplicate_of is None:
            extraction, enrichment = _apply_enrichment(
                path, digest, extraction, enrichment_index, repo_root
            )
        elif canonical is not None:
            enrichment = canonical.get("enrichment")

        categories = (
            list(canonical["categories"])
            if canonical is not None
            else _classify(f"{relative_text}\n{source_text}", extraction.body)
        )
        if canonical is None:
            canonical_by_hash[digest] = {
                "source_path": source_text,
                "categories": list(categories),
                "enrichment": enrichment,
            }
        kind = _kind_for(path)
        entry: dict[str, Any] = {
            "id": f"ref-{stable_id(relative_text)}",
            "source_path": source_text,
            "relative_path": relative_text,
            "output_path": path_for_display(output_path, repo_root),
            "kind": kind,
            "status": extraction.status,
            "sha256": digest,
            "size_bytes": path.stat().st_size,
            "duplicate_of": duplicate_of,
            "transcript_sidecar": (
                path_for_display(transcript, repo_root)
                if transcript is not None
                else None
            ),
            "enrichment": enrichment,
            "categories": categories,
            "extraction": {"method": extraction.method, "detail": extraction.detail},
        }
        document = (
            _frontmatter(entry)
            + "\n"
            + f"# {path.name}\n\n"
            + extraction.body.rstrip()
            + "\n"
        )
        atomic_write_text(output_path, document)
        entries.append(entry)

    status_counts = dict(sorted(Counter(item["status"] for item in entries).items()))
    manifest: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "source_root": path_for_display(source_root, repo_root),
        "wiki_root": path_for_display(wiki_root, repo_root),
        "summary": {
            "total_sources": len(entries),
            "duplicate_sources": sum(item["status"] == "duplicate" for item in entries),
            "status_counts": status_counts,
        },
        "categories": list(CATEGORIES),
        "entries": entries,
    }
    atomic_write_json(ensure_within(wiki_root / "manifest.json", wiki_root), manifest)
    atomic_write_text(
        ensure_within(wiki_root / "index.md", wiki_root),
        _render_index(entries, wiki_root),
    )
    for category, config in CATEGORIES.items():
        atomic_write_text(
            ensure_within(modules_root / f"{config['slug']}.md", wiki_root),
            _render_module(category, entries),
        )
    return manifest


def _resolve_argument(value: Path | None, repo_root: Path, default: str) -> Path:
    path = value if value is not None else Path(default)
    return path.resolve() if path.is_absolute() else (repo_root / path).resolve()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        help="repository root (default: inferred from this script)",
    )
    parser.add_argument(
        "--source",
        type=Path,
        help="reference directory, absolute or relative to the repository root",
    )
    parser.add_argument(
        "--wiki-root",
        type=Path,
        help="wiki output directory, absolute or relative to the repository root",
    )
    parser.add_argument(
        "--enrichment-root",
        type=Path,
        help="media enrichment directory, absolute or relative to the repository root",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    inferred_root = Path(__file__).resolve().parents[2]
    repo_root = (args.repo_root or inferred_root).resolve()
    source_root = _resolve_argument(args.source, repo_root, "참고레퍼런스")
    wiki_root = _resolve_argument(args.wiki_root, repo_root, ".harness/wiki")
    enrichment_root = _resolve_argument(
        args.enrichment_root, repo_root, ".harness/enrichment"
    )
    try:
        manifest = run_ingestion(
            repo_root, source_root, wiki_root, enrichment_root=enrichment_root
        )
    except (FileNotFoundError, OSError, ValueError) as error:
        print(f"harness-sync: ERROR: {error}", file=sys.stderr)
        return 2
    summary = manifest["summary"]
    print(
        "harness-sync: OK "
        f"sources={summary['total_sources']} "
        f"duplicates={summary['duplicate_sources']} "
        f"manifest={path_for_display(wiki_root / 'manifest.json', repo_root)}"
    )
    for status, count in summary["status_counts"].items():
        print(f"  {status}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
