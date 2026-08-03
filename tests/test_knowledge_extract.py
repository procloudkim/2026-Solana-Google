from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = REPO_ROOT / ".harness" / "workflows"
sys.path.insert(0, str(WORKFLOWS))
SPEC = importlib.util.spec_from_file_location(
    "knowledge_extract", WORKFLOWS / "01_knowledge_extract.py"
)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import guard
    raise RuntimeError("could not load the knowledge extraction workflow")
knowledge_extract = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = knowledge_extract
SPEC.loader.exec_module(knowledge_extract)


class _FakePage:
    def __init__(self, text: str | None) -> None:
        self._text = text

    def extract_text(self) -> str | None:
        return self._text


class _FakeReader:
    def __init__(self, _: str) -> None:
        self.pages = [_FakePage("Solana transaction page"), _FakePage(None)]


class KnowledgeExtractTests(unittest.TestCase):
    def make_reference_tree(self, root: Path) -> tuple[Path, Path, Path]:
        repo = root / "repo"
        source = repo / "참고레퍼런스"
        wiki = repo / ".harness" / "wiki"
        nested = source / "nested"
        nested.mkdir(parents=True)

        canonical = "Solana RPC and transaction notes\n"
        (source / "a-solana.txt").write_text(canonical, encoding="utf-8")
        (source / "z-solana-copy.txt").write_text(canonical, encoding="utf-8")
        (source / "cloud.json").write_text(
            json.dumps({"service": "Cloud Run", "event": "Eventarc"}),
            encoding="utf-8",
        )
        (nested / "adk.html").write_text(
            "<html><head><style>hidden</style></head><body>"
            "<h1>Google ADK</h1><p>Gemini agent.</p><script>ignored()</script>"
            "</body></html>",
            encoding="utf-8",
        )
        (source / "payments.md").write_text("# AP2 and x402\npay.sh", encoding="utf-8")
        (source / "deck.pdf").write_bytes(b"fake-pdf-for-injected-reader")
        (source / "talk.mp4").write_bytes(b"not-decoded-video-bytes")
        (source / "talk.transcript.txt").write_text(
            "Full supplied agentic commerce transcript.", encoding="utf-8"
        )
        (source / "orphan.mp4").write_bytes(b"video-without-sidecar")
        (source / "opaque.bin").write_bytes(b"unsupported-data")
        return repo, source, wiki

    def test_ingestion_inventories_extracts_and_builds_modules(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repo, source, wiki = self.make_reference_tree(Path(temporary_directory))
            with mock.patch.object(
                knowledge_extract, "_load_pdf_reader", return_value=_FakeReader
            ):
                manifest = knowledge_extract.run_ingestion(repo, source, wiki)

            self.assertEqual(1, manifest["schema_version"])
            self.assertEqual(10, manifest["summary"]["total_sources"])
            self.assertEqual(1, manifest["summary"]["duplicate_sources"])
            entries = {entry["relative_path"]: entry for entry in manifest["entries"]}
            self.assertEqual(list(entries), sorted(entries, key=str.casefold))
            self.assertTrue(
                all(len(entry["sha256"]) == 64 for entry in entries.values())
            )
            self.assertTrue(
                all(
                    (repo / entry["output_path"]).is_file()
                    for entry in entries.values()
                )
            )

            duplicate = entries["z-solana-copy.txt"]
            self.assertEqual("duplicate", duplicate["status"])
            self.assertEqual("참고레퍼런스/a-solana.txt", duplicate["duplicate_of"])
            self.assertEqual(
                entries["a-solana.txt"]["categories"], duplicate["categories"]
            )

            pdf_markdown = (repo / entries["deck.pdf"]["output_path"]).read_text(
                encoding="utf-8"
            )
            self.assertEqual("extracted_with_warning", entries["deck.pdf"]["status"])
            self.assertIn("## Page 1", pdf_markdown)
            self.assertIn("## Page 2", pdf_markdown)
            self.assertIn("_No extractable text on this page._", pdf_markdown)

            video = entries["talk.mp4"]
            self.assertEqual("metadata_only", video["status"])
            self.assertEqual(
                "참고레퍼런스/talk.transcript.txt", video["transcript_sidecar"]
            )
            video_markdown = (repo / video["output_path"]).read_text(encoding="utf-8")
            self.assertIn("the video stream was not decoded", video_markdown)
            self.assertIn("Full supplied agentic commerce transcript.", video_markdown)

            orphan = entries["orphan.mp4"]
            self.assertEqual("metadata_only", orphan["status"])
            self.assertIsNone(orphan["transcript_sidecar"])
            orphan_markdown = (repo / orphan["output_path"]).read_text(encoding="utf-8")
            self.assertIn("No same-stem transcript sidecar was found", orphan_markdown)

            html_markdown = (
                repo / entries["nested/adk.html"]["output_path"]
            ).read_text(encoding="utf-8")
            self.assertIn("Google ADK", html_markdown)
            self.assertNotIn("hidden", html_markdown)
            self.assertNotIn("ignored()", html_markdown)
            self.assertEqual("unsupported", entries["opaque.bin"]["status"])

            expected_modules = {
                "solana-engine.md",
                "gcp-infrastructure.md",
                "payment-protocols.md",
                "google-adk.md",
            }
            self.assertEqual(
                expected_modules,
                {path.name for path in (wiki / "modules").glob("*.md")},
            )
            index = (wiki / "index.md").read_text(encoding="utf-8")
            for category in knowledge_extract.CATEGORIES:
                self.assertIn(category, index)

    def test_manifest_and_generated_paths_are_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repo, source, wiki = self.make_reference_tree(Path(temporary_directory))
            with mock.patch.object(
                knowledge_extract, "_load_pdf_reader", return_value=_FakeReader
            ):
                first = knowledge_extract.run_ingestion(repo, source, wiki)
                first_manifest_bytes = (wiki / "manifest.json").read_bytes()
                first_outputs = [entry["output_path"] for entry in first["entries"]]
                second = knowledge_extract.run_ingestion(repo, source, wiki)

            self.assertEqual(first, second)
            self.assertEqual(
                first_manifest_bytes, (wiki / "manifest.json").read_bytes()
            )
            self.assertEqual(
                first_outputs, [entry["output_path"] for entry in second["entries"]]
            )
            self.assertFalse(list(wiki.rglob("*.tmp")))

    def test_pdf_without_optional_dependency_is_auditable_metadata_only(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repo = Path(temporary_directory) / "repo"
            source = repo / "참고레퍼런스"
            source.mkdir(parents=True)
            (source / "deck.pdf").write_bytes(b"pdf-placeholder")
            wiki = repo / ".harness" / "wiki"
            with mock.patch.object(
                knowledge_extract, "_load_pdf_reader", return_value=None
            ):
                manifest = knowledge_extract.run_ingestion(repo, source, wiki)

            entry = manifest["entries"][0]
            self.assertEqual("metadata_only", entry["status"])
            self.assertEqual("pypdf_unavailable", entry["extraction"]["method"])
            output = (repo / entry["output_path"]).read_text(encoding="utf-8")
            self.assertIn("optional `pypdf` package is not installed", output)

    def test_mp4_duration_metadata_is_read_without_decoding_streams(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            video = root / "sample.mp4"
            mvhd_payload = (
                b"\x00\x00\x00\x00"
                + (0).to_bytes(4, "big")
                + (0).to_bytes(4, "big")
                + (1_000).to_bytes(4, "big")
                + (5_000).to_bytes(4, "big")
            )
            mvhd = (8 + len(mvhd_payload)).to_bytes(4, "big") + b"mvhd" + mvhd_payload
            moov = (8 + len(mvhd)).to_bytes(4, "big") + b"moov" + mvhd
            video.write_bytes(moov)

            self.assertEqual(5.0, knowledge_extract._mp4_duration_seconds(video))
            extraction, sidecar = knowledge_extract._extract_video(video, root)
            self.assertIsNone(sidecar)
            self.assertIn("00:00:05 (5.000 seconds)", extraction.body)

    def test_sha_matched_media_enrichment_is_attached_and_stale_data_is_ignored(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repo = Path(temporary_directory) / "repo"
            source = repo / "참고레퍼런스"
            enrichment = repo / ".harness" / "enrichment"
            artifact = enrichment / "transcripts" / "talk.md"
            source.mkdir(parents=True)
            artifact.parent.mkdir(parents=True)
            video = source / "talk.mp4"
            video.write_bytes(b"video-source")
            digest = knowledge_extract.sha256_file(video)
            artifact.write_text("# Transcript\n\nSolana 전사 본문", encoding="utf-8")
            manifest = {
                "entries": [
                    {
                        "adapter": "faster-whisper",
                        "artifacts": {
                            "markdown": ".harness/enrichment/transcripts/talk.md"
                        },
                        "kind": "transcript",
                        "settings_fingerprint": "settings",
                        "source_path": "참고레퍼런스/talk.mp4",
                        "source_sha256": digest,
                        "status": "complete",
                    }
                ]
            }
            (enrichment / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
            )

            wiki = repo / ".harness" / "wiki"
            result = knowledge_extract.run_ingestion(repo, source, wiki)
            entry = result["entries"][0]
            output = (repo / entry["output_path"]).read_text(encoding="utf-8")
            self.assertEqual("transcribed", entry["status"])
            self.assertEqual("complete", entry["enrichment"]["status"])
            self.assertIn("Solana 전사 본문", output)

            manifest["entries"][0]["source_sha256"] = "0" * 64
            (enrichment / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
            )
            stale = knowledge_extract.run_ingestion(
                repo, source, repo / ".harness" / "wiki-stale"
            )
            self.assertEqual("metadata_only", stale["entries"][0]["status"])
            self.assertIsNone(stale["entries"][0]["enrichment"])


if __name__ == "__main__":
    unittest.main()
