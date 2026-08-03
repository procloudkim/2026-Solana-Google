#!/usr/bin/env python3
"""Enrich local MP4/PDF references with transcript, OCR, and QR evidence.

Heavy adapters are imported lazily so the regular harness and its tests stay
dependency-light. Source files are never modified. File/page checkpoints make
long CPU runs recoverable, and completed artifacts are reused only when both
the source SHA-256 and settings fingerprint still match.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
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
DEFAULT_PROMPT = (
    "Solana, Google Cloud, Cloud Run, Eventarc, Firestore, Gemini, Google ADK, "
    "AP2, x402, pay.sh, MCP, UCP, MPP, Agentic Commerce"
)


@dataclass(frozen=True)
class MediaSettings:
    whisper_model: str = "small"
    compute_type: str = "int8"
    language: str = "ko"
    cpu_threads: int = max(1, (os.cpu_count() or 2) // 2)
    ocr_scale: float = 2.0
    qr_scale: float = 4.0
    ocr_score_threshold: float = 0.45

    def transcript_dict(self) -> dict[str, Any]:
        return {
            "adapter": "faster-whisper",
            "beam_size": 5,
            "compute_type": self.compute_type,
            "cpu_threads": self.cpu_threads,
            "language": self.language,
            "model": self.whisper_model,
            "vad_filter": True,
        }

    def pdf_dict(self) -> dict[str, Any]:
        return {
            "adapter": "pymupdf+paddleocr+opencv-qrcode",
            "ocr_detection_model": "PP-OCRv5_mobile_det",
            "ocr_recognition_model": "korean_PP-OCRv5_mobile_rec",
            "ocr_scale": self.ocr_scale,
            "ocr_score_threshold": self.ocr_score_threshold,
            "onednn": False,
            "qr_scale": self.qr_scale,
        }


def _settings_fingerprint(settings: dict[str, Any]) -> str:
    serialized = json.dumps(
        settings, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    return stable_id(serialized, length=16)


def _artifact_stem(path: Path, source_root: Path) -> str:
    relative = path.relative_to(source_root).as_posix()
    return f"{slugify(path.stem)}-{stable_id(relative, length=10)}"


def _jsonl_rows(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as stream:
        for line in stream:
            line = line.strip()
            if not line:
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                break
            if isinstance(value, dict):
                rows.append(value)
    return rows


def _checkpoint_rows(
    path: Path, source_sha256: str, settings_fingerprint: str
) -> list[dict[str, Any]]:
    rows = _jsonl_rows(path)
    if not rows:
        return []
    header = rows[0].get("_checkpoint")
    if not isinstance(header, dict):
        return []
    if header.get("source_sha256") != source_sha256:
        return []
    if header.get("settings_fingerprint") != settings_fingerprint:
        return []
    return rows[1:]


def _open_checkpoint(
    path: Path,
    source_sha256: str,
    settings_fingerprint: str,
    existing_rows: list[dict[str, Any]],
) -> Any:
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if existing_rows else "w"
    stream = path.open(mode, encoding="utf-8", newline="\n")
    if not existing_rows:
        header = {
            "_checkpoint": {
                "settings_fingerprint": settings_fingerprint,
                "source_sha256": source_sha256,
            }
        }
        stream.write(json.dumps(header, ensure_ascii=False, sort_keys=True) + "\n")
        stream.flush()
    return stream


def _write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    content = "".join(
        json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows
    )
    atomic_write_text(path, content)


def _srt_timestamp(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds_part, milliseconds_part = divmod(remainder, 1000)
    return (
        f"{hours:02d}:{minutes:02d}:{seconds_part:02d},"
        f"{milliseconds_part:03d}"
    )


def _render_srt(segments: list[dict[str, Any]]) -> str:
    blocks = []
    for index, segment in enumerate(segments, start=1):
        blocks.append(
            f"{index}\n{_srt_timestamp(float(segment['start']))} --> "
            f"{_srt_timestamp(float(segment['end']))}\n{segment['text']}"
        )
    return "\n\n".join(blocks) + ("\n" if blocks else "")


def _render_transcript_markdown(
    source_name: str, segments: list[dict[str, Any]], metadata: dict[str, Any]
) -> str:
    lines = [
        f"# Transcript: {source_name}",
        "",
        "Generated locally with faster-whisper. Timestamps are model output; ",
        "speaker identity and verbatim accuracy are not claimed.",
        "",
        "## Transcript",
        "",
    ]
    for segment in segments:
        start = _srt_timestamp(float(segment["start"])).replace(",", ".")
        end = _srt_timestamp(float(segment["end"])).replace(",", ".")
        lines.append(f"- `{start} - {end}` {segment['text']}")
    lines.extend(
        [
            "",
            "## Provenance",
            "",
            f"- Source SHA-256: `{metadata['source_sha256']}`",
            f"- Model: `{metadata['model']}`",
            f"- Compute: `cpu/{metadata['compute_type']}`",
            f"- Segment count: {metadata['segment_count']}",
            "",
        ]
    )
    return "\n".join(lines)


def _artifacts_exist(entry: dict[str, Any], repo_root: Path) -> bool:
    artifacts = entry.get("artifacts")
    if not isinstance(artifacts, dict) or not artifacts:
        return False
    for value in artifacts.values():
        if not isinstance(value, str):
            return False
        try:
            artifact = ensure_within(repo_root / value, repo_root)
        except ValueError:
            return False
        if not artifact.is_file():
            return False
    return True


def _completed_entry_matches(
    entry: dict[str, Any] | None,
    source_sha256: str,
    settings_fingerprint: str,
    repo_root: Path,
) -> bool:
    return bool(
        entry
        and entry.get("status") == "complete"
        and entry.get("source_sha256") == source_sha256
        and entry.get("settings_fingerprint") == settings_fingerprint
        and _artifacts_exist(entry, repo_root)
    )


class TranscriptAdapter:
    def __init__(self, settings: MediaSettings) -> None:
        from faster_whisper import WhisperModel

        self.settings = settings
        self.model = WhisperModel(
            settings.whisper_model,
            device="cpu",
            compute_type=settings.compute_type,
            cpu_threads=settings.cpu_threads,
        )

    def transcribe(
        self, path: Path, *, start_seconds: float = 0.0
    ) -> tuple[Iterable[Any], Any]:
        clips: str | list[float] = "0"
        if start_seconds > 0:
            clips = [start_seconds]
        return self.model.transcribe(
            str(path),
            language=self.settings.language,
            beam_size=5,
            vad_filter=True,
            clip_timestamps=clips,
            initial_prompt=DEFAULT_PROMPT,
            word_timestamps=False,
        )


def _transcribe_one(
    path: Path,
    repo_root: Path,
    source_root: Path,
    output_root: Path,
    source_sha256: str,
    settings: MediaSettings,
    adapter: TranscriptAdapter,
) -> dict[str, Any]:
    started = perf_counter()
    settings_dict = settings.transcript_dict()
    fingerprint = _settings_fingerprint(settings_dict)
    stem = _artifact_stem(path, source_root)
    transcript_root = ensure_within(output_root / "transcripts", output_root)
    transcript_root.mkdir(parents=True, exist_ok=True)
    partial_path = transcript_root / f"{stem}.partial.jsonl"
    segments = _checkpoint_rows(partial_path, source_sha256, fingerprint)
    resume_at = max((float(row.get("end", 0.0)) for row in segments), default=0.0)
    stream = _open_checkpoint(
        partial_path, source_sha256, fingerprint, segments
    )
    try:
        generated, info = adapter.transcribe(path, start_seconds=resume_at)
        for segment in generated:
            text = segment.text.strip()
            if not text:
                continue
            row = {
                "end": round(float(segment.end), 3),
                "start": round(float(segment.start), 3),
                "text": text,
            }
            if segments and row["end"] <= float(segments[-1]["end"]):
                continue
            segments.append(row)
            stream.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
            stream.flush()
    finally:
        stream.close()

    jsonl_path = transcript_root / f"{stem}.jsonl"
    srt_path = transcript_root / f"{stem}.srt"
    markdown_path = transcript_root / f"{stem}.md"
    metadata_path = transcript_root / f"{stem}.metadata.json"
    metadata = {
        "adapter": "faster-whisper",
        "compute_type": settings.compute_type,
        "detected_language": info.language,
        "detected_language_probability": round(float(info.language_probability), 6),
        "duration_seconds": round(float(info.duration), 3),
        "model": settings.whisper_model,
        "processing_seconds": round(perf_counter() - started, 3),
        "segment_count": len(segments),
        "settings": settings_dict,
        "settings_fingerprint": fingerprint,
        "source_path": path_for_display(path, repo_root),
        "source_sha256": source_sha256,
    }
    _write_jsonl(jsonl_path, segments)
    atomic_write_text(srt_path, _render_srt(segments))
    atomic_write_json(metadata_path, metadata)
    atomic_write_text(
        markdown_path, _render_transcript_markdown(path.name, segments, metadata)
    )
    partial_path.unlink(missing_ok=True)
    artifacts = {
        "jsonl": path_for_display(jsonl_path, repo_root),
        "markdown": path_for_display(markdown_path, repo_root),
        "metadata": path_for_display(metadata_path, repo_root),
        "srt": path_for_display(srt_path, repo_root),
    }
    return {
        "adapter": "faster-whisper",
        "artifacts": artifacts,
        "kind": "transcript",
        "metrics": {
            "duration_seconds": metadata["duration_seconds"],
            "processing_seconds": metadata["processing_seconds"],
            "segment_count": len(segments),
        },
        "settings_fingerprint": fingerprint,
        "source_path": path_for_display(path, repo_root),
        "source_sha256": source_sha256,
        "status": "complete",
    }


class PdfAdapter:
    def __init__(self, settings: MediaSettings) -> None:
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        import cv2
        import fitz
        import numpy as np
        from paddleocr import PaddleOCR

        self.cv2 = cv2
        self.fitz = fitz
        self.np = np
        self.settings = settings
        self.ocr = PaddleOCR(
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="korean_PP-OCRv5_mobile_rec",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            device="cpu",
            enable_mkldnn=False,
        )
        self.qr = cv2.QRCodeDetector()

    def open(self, path: Path) -> Any:
        return self.fitz.open(path)

    def render(self, page: Any, scale: float) -> Any:
        pixmap = page.get_pixmap(
            matrix=self.fitz.Matrix(scale, scale), alpha=False
        )
        return self.np.frombuffer(pixmap.samples, dtype=self.np.uint8).reshape(
            pixmap.height, pixmap.width, pixmap.n
        )

    def recognize(self, image: Any) -> list[dict[str, Any]]:
        results = list(self.ocr.predict(image))
        if not results:
            return []
        value = results[0].json if hasattr(results[0], "json") else results[0]
        payload = value.get("res", value)
        texts = payload.get("rec_texts", [])
        scores = payload.get("rec_scores", [])
        boxes = payload.get("rec_boxes", [])
        lines = []
        for text, score, box in zip(texts, scores, boxes):
            normalized = str(text).strip()
            numeric_score = float(score)
            if not normalized or numeric_score < self.settings.ocr_score_threshold:
                continue
            lines.append(
                {
                    "bbox": [int(value) for value in box],
                    "score": round(numeric_score, 6),
                    "text": normalized,
                }
            )
        return sorted(lines, key=lambda row: (row["bbox"][1], row["bbox"][0]))

    def decode_qr(self, image: Any) -> list[dict[str, Any]]:
        decoded: list[dict[str, Any]] = []
        try:
            ok, values, points, _ = self.qr.detectAndDecodeMulti(image)
        except Exception:
            ok, values, points = False, (), None
        if ok and values:
            for index, value in enumerate(values):
                if not value:
                    continue
                coordinates = None
                if points is not None and index < len(points):
                    coordinates = [
                        [round(float(x), 2), round(float(y), 2)]
                        for x, y in points[index]
                    ]
                decoded.append({"payload": str(value), "points": coordinates})
        if not decoded:
            try:
                value, points, _ = self.qr.detectAndDecode(image)
            except Exception:
                value, points = "", None
            if value:
                coordinates = None
                if points is not None:
                    coordinates = [
                        [round(float(x), 2), round(float(y), 2)]
                        for x, y in points.reshape(-1, 2)
                    ]
                decoded.append({"payload": str(value), "points": coordinates})
        unique: dict[str, dict[str, Any]] = {}
        for item in decoded:
            unique.setdefault(item["payload"], item)
        return list(unique.values())


def _render_pdf_markdown(
    source_name: str, pages: list[dict[str, Any]], metadata: dict[str, Any]
) -> str:
    lines = [
        f"# OCR and QR enrichment: {source_name}",
        "",
        "Generated locally from rendered PDF pages. OCR text is machine-read ",
        "and may contain recognition errors; QR values are decoded payloads.",
        "",
    ]
    for page in pages:
        lines.extend([f"## Page {page['page']}", ""])
        if page["ocr_lines"]:
            lines.extend(line["text"] for line in page["ocr_lines"])
        else:
            lines.append("_No OCR text above the configured confidence threshold._")
        if page["qr_codes"]:
            lines.extend(["", "QR payloads:", ""])
            for code in page["qr_codes"]:
                lines.append(
                    f"- {json.dumps(code['payload'], ensure_ascii=False)}"
                )
        lines.append("")
    lines.extend(
        [
            "## Provenance",
            "",
            f"- Source SHA-256: `{metadata['source_sha256']}`",
            f"- Pages: {metadata['page_count']}",
            f"- OCR lines: {metadata['ocr_line_count']}",
            f"- Decoded QR payloads: {metadata['qr_payload_count']}",
            "",
        ]
    )
    return "\n".join(lines)


def _pdf_page(
    page_number: int, page: Any, adapter: PdfAdapter, settings: MediaSettings
) -> dict[str, Any]:
    ocr_image = adapter.render(page, settings.ocr_scale)
    ocr_lines = adapter.recognize(ocr_image)
    if settings.qr_scale == settings.ocr_scale:
        qr_image = ocr_image
    else:
        qr_image = adapter.render(page, settings.qr_scale)
    qr_codes = adapter.decode_qr(qr_image)
    return {
        "ocr_lines": ocr_lines,
        "page": page_number,
        "qr_codes": qr_codes,
    }


def _enrich_pdf_one(
    path: Path,
    repo_root: Path,
    source_root: Path,
    output_root: Path,
    source_sha256: str,
    settings: MediaSettings,
    adapter: PdfAdapter,
) -> dict[str, Any]:
    started = perf_counter()
    settings_dict = settings.pdf_dict()
    fingerprint = _settings_fingerprint(settings_dict)
    stem = _artifact_stem(path, source_root)
    pdf_root = ensure_within(output_root / "pdfs", output_root)
    pdf_root.mkdir(parents=True, exist_ok=True)
    partial_path = pdf_root / f"{stem}.partial.jsonl"
    pages = _checkpoint_rows(partial_path, source_sha256, fingerprint)
    completed_pages = {int(page["page"]) for page in pages if "page" in page}
    stream = _open_checkpoint(partial_path, source_sha256, fingerprint, pages)
    document = adapter.open(path)
    try:
        page_count = len(document)
        for page_number, page in enumerate(document, start=1):
            if page_number in completed_pages:
                continue
            result = _pdf_page(page_number, page, adapter, settings)
            pages.append(result)
            stream.write(
                json.dumps(result, ensure_ascii=False, sort_keys=True) + "\n"
            )
            stream.flush()
    finally:
        document.close()
        stream.close()
    pages.sort(key=lambda item: int(item["page"]))

    ocr_path = pdf_root / f"{stem}.ocr.json"
    qr_path = pdf_root / f"{stem}.qr.json"
    markdown_path = pdf_root / f"{stem}.md"
    metadata_path = pdf_root / f"{stem}.metadata.json"
    qr_pages = [
        {"page": page["page"], "qr_codes": page["qr_codes"]}
        for page in pages
        if page["qr_codes"]
    ]
    line_count = sum(len(page["ocr_lines"]) for page in pages)
    qr_count = sum(len(page["qr_codes"]) for page in pages)
    metadata = {
        "adapter": "pymupdf+paddleocr+opencv-qrcode",
        "ocr_line_count": line_count,
        "page_count": page_count,
        "processing_seconds": round(perf_counter() - started, 3),
        "qr_payload_count": qr_count,
        "settings": settings_dict,
        "settings_fingerprint": fingerprint,
        "source_path": path_for_display(path, repo_root),
        "source_sha256": source_sha256,
    }
    atomic_write_json(ocr_path, {"pages": pages})
    atomic_write_json(qr_path, {"pages": qr_pages})
    atomic_write_json(metadata_path, metadata)
    atomic_write_text(
        markdown_path, _render_pdf_markdown(path.name, pages, metadata)
    )
    partial_path.unlink(missing_ok=True)
    artifacts = {
        "markdown": path_for_display(markdown_path, repo_root),
        "metadata": path_for_display(metadata_path, repo_root),
        "ocr_json": path_for_display(ocr_path, repo_root),
        "qr_json": path_for_display(qr_path, repo_root),
    }
    return {
        "adapter": "pymupdf+paddleocr+opencv-qrcode",
        "artifacts": artifacts,
        "kind": "pdf_ocr_qr",
        "metrics": {
            "ocr_line_count": line_count,
            "page_count": page_count,
            "processing_seconds": metadata["processing_seconds"],
            "qr_payload_count": qr_count,
        },
        "settings_fingerprint": fingerprint,
        "source_path": path_for_display(path, repo_root),
        "source_sha256": source_sha256,
        "status": "complete",
    }


def _load_manifest(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"schema_version": SCHEMA_VERSION, "entries": []}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"schema_version": SCHEMA_VERSION, "entries": []}
    if not isinstance(value, dict) or not isinstance(value.get("entries"), list):
        return {"schema_version": SCHEMA_VERSION, "entries": []}
    return value


def _save_manifest(
    path: Path,
    repo_root: Path,
    source_root: Path,
    entries_by_source: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    entries = sorted(entries_by_source.values(), key=lambda item: item["source_path"])
    manifest = {
        "entries": entries,
        "schema_version": SCHEMA_VERSION,
        "source_root": path_for_display(source_root, repo_root),
        "summary": {
            "complete": sum(entry.get("status") == "complete" for entry in entries),
            "errors": sum(entry.get("status") == "error" for entry in entries),
            "pdf_ocr_qr": sum(entry.get("kind") == "pdf_ocr_qr" for entry in entries),
            "transcripts": sum(entry.get("kind") == "transcript" for entry in entries),
        },
    }
    atomic_write_json(path, manifest)
    return manifest


def run_enrichment(
    repo_root: Path,
    source_root: Path,
    output_root: Path,
    mode: str,
    settings: MediaSettings,
    *,
    force: bool = False,
) -> dict[str, Any]:
    repo_root = repo_root.resolve()
    source_root = source_root.resolve()
    output_root = ensure_within(output_root.resolve(), repo_root)
    if not source_root.is_dir():
        raise FileNotFoundError(f"reference directory does not exist: {source_root}")
    output_root.mkdir(parents=True, exist_ok=True)
    manifest_path = ensure_within(output_root / "manifest.json", output_root)
    previous = _load_manifest(manifest_path)
    entries_by_source = {
        entry["source_path"]: entry
        for entry in previous["entries"]
        if isinstance(entry, dict) and isinstance(entry.get("source_path"), str)
    }
    suffixes = {".mp4"} if mode == "transcribe" else {".pdf"}
    if mode == "all":
        suffixes = {".mp4", ".pdf"}
    inputs = sorted(
        (
            path
            for path in source_root.rglob("*")
            if path.is_file() and path.suffix.casefold() in suffixes
        ),
        key=lambda item: item.relative_to(source_root).as_posix().casefold(),
    )
    transcript_adapter: TranscriptAdapter | None = None
    pdf_adapter: PdfAdapter | None = None
    canonical_pdf_by_sha: dict[str, dict[str, Any]] = {}
    for path in inputs:
        source_path = path_for_display(path, repo_root)
        digest = sha256_file(path)
        if path.suffix.casefold() == ".mp4":
            settings_dict = settings.transcript_dict()
            fingerprint = _settings_fingerprint(settings_dict)
            current = entries_by_source.get(source_path)
            if not force and _completed_entry_matches(
                current, digest, fingerprint, repo_root
            ):
                print(f"media-enrich: SKIP complete transcript {source_path}")
                continue
            try:
                if transcript_adapter is None:
                    transcript_adapter = TranscriptAdapter(settings)
                entry = _transcribe_one(
                    path,
                    repo_root,
                    source_root,
                    output_root,
                    digest,
                    settings,
                    transcript_adapter,
                )
                print(
                    "media-enrich: OK transcript "
                    f"{source_path} segments={entry['metrics']['segment_count']} "
                    f"seconds={entry['metrics']['processing_seconds']}"
                )
            except Exception as error:
                entry = {
                    "adapter": "faster-whisper",
                    "artifacts": {},
                    "error": f"{type(error).__name__}: {error}",
                    "kind": "transcript",
                    "settings_fingerprint": fingerprint,
                    "source_path": source_path,
                    "source_sha256": digest,
                    "status": "error",
                }
                print(f"media-enrich: ERROR transcript {source_path}: {error}")
        else:
            settings_dict = settings.pdf_dict()
            fingerprint = _settings_fingerprint(settings_dict)
            duplicate = canonical_pdf_by_sha.get(digest)
            if duplicate is not None:
                entry = dict(duplicate)
                entry["source_path"] = source_path
                entry["duplicate_of"] = duplicate["source_path"]
                entries_by_source[source_path] = entry
                _save_manifest(
                    manifest_path, repo_root, source_root, entries_by_source
                )
                print(f"media-enrich: SKIP duplicate PDF {source_path}")
                continue
            current = entries_by_source.get(source_path)
            if not force and _completed_entry_matches(
                current, digest, fingerprint, repo_root
            ):
                entry = current
                print(f"media-enrich: SKIP complete PDF {source_path}")
            else:
                try:
                    if pdf_adapter is None:
                        pdf_adapter = PdfAdapter(settings)
                    entry = _enrich_pdf_one(
                        path,
                        repo_root,
                        source_root,
                        output_root,
                        digest,
                        settings,
                        pdf_adapter,
                    )
                    print(
                        "media-enrich: OK PDF "
                        f"{source_path} pages={entry['metrics']['page_count']} "
                        f"ocr_lines={entry['metrics']['ocr_line_count']} "
                        f"qr={entry['metrics']['qr_payload_count']}"
                    )
                except Exception as error:
                    entry = {
                        "adapter": "pymupdf+paddleocr+opencv-qrcode",
                        "artifacts": {},
                        "error": f"{type(error).__name__}: {error}",
                        "kind": "pdf_ocr_qr",
                        "settings_fingerprint": fingerprint,
                        "source_path": source_path,
                        "source_sha256": digest,
                        "status": "error",
                    }
                    print(f"media-enrich: ERROR PDF {source_path}: {error}")
            canonical_pdf_by_sha[digest] = entry
        entries_by_source[source_path] = entry
        _save_manifest(manifest_path, repo_root, source_root, entries_by_source)
    return _save_manifest(
        manifest_path, repo_root, source_root, entries_by_source
    )


def _resolve_argument(value: Path | None, repo_root: Path, default: str) -> Path:
    path = value if value is not None else Path(default)
    return path.resolve() if path.is_absolute() else (repo_root / path).resolve()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "mode", choices=("all", "transcribe", "pdf"), nargs="?", default="all"
    )
    parser.add_argument("--repo-root", type=Path)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output-root", type=Path)
    parser.add_argument("--whisper-model", default="small")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language", default="ko")
    parser.add_argument("--cpu-threads", type=int, default=MediaSettings.cpu_threads)
    parser.add_argument("--ocr-scale", type=float, default=2.0)
    parser.add_argument("--qr-scale", type=float, default=4.0)
    parser.add_argument("--ocr-score-threshold", type=float, default=0.45)
    parser.add_argument("--force", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    inferred_root = Path(__file__).resolve().parents[2]
    repo_root = (args.repo_root or inferred_root).resolve()
    source_root = _resolve_argument(args.source, repo_root, "참고레퍼런스")
    output_root = _resolve_argument(
        args.output_root, repo_root, ".harness/enrichment"
    )
    settings = MediaSettings(
        whisper_model=args.whisper_model,
        compute_type=args.compute_type,
        language=args.language,
        cpu_threads=args.cpu_threads,
        ocr_scale=args.ocr_scale,
        qr_scale=args.qr_scale,
        ocr_score_threshold=args.ocr_score_threshold,
    )
    try:
        manifest = run_enrichment(
            repo_root,
            source_root,
            output_root,
            args.mode,
            settings,
            force=args.force,
        )
    except (FileNotFoundError, OSError, ValueError) as error:
        print(f"media-enrich: ERROR: {error}", file=sys.stderr)
        return 2
    summary = manifest["summary"]
    print(
        "media-enrich: DONE "
        f"complete={summary['complete']} errors={summary['errors']} "
        f"manifest={path_for_display(output_root / 'manifest.json', repo_root)}"
    )
    return 1 if summary["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
