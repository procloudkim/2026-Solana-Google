from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = REPO_ROOT / ".harness" / "workflows"
sys.path.insert(0, str(WORKFLOWS))
SPEC = importlib.util.spec_from_file_location(
    "media_enrich", WORKFLOWS / "05_media_enrich.py"
)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import guard
    raise RuntimeError("could not load the media enrichment workflow")
media_enrich = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = media_enrich
SPEC.loader.exec_module(media_enrich)


class MediaEnrichTests(unittest.TestCase):
    def test_srt_rendering_is_stable_and_uses_millisecond_timestamps(self) -> None:
        value = media_enrich._render_srt(
            [
                {"start": 0.0, "end": 1.2345, "text": "첫 문장"},
                {"start": 3661.001, "end": 3662.0, "text": "second"},
            ]
        )

        self.assertIn("00:00:00,000 --> 00:00:01,234", value)
        self.assertIn("01:01:01,001 --> 01:01:02,000", value)
        self.assertTrue(value.endswith("\n"))

    def test_checkpoint_is_reused_only_for_matching_source_and_settings(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "work.partial.jsonl"
            header = {
                "_checkpoint": {
                    "source_sha256": "source-a",
                    "settings_fingerprint": "settings-a",
                }
            }
            segment = {"start": 0.0, "end": 1.0, "text": "text"}
            path.write_text(
                json.dumps(header) + "\n" + json.dumps(segment) + "\n",
                encoding="utf-8",
            )

            self.assertEqual(
                [segment],
                media_enrich._checkpoint_rows(path, "source-a", "settings-a"),
            )
            self.assertEqual(
                [], media_enrich._checkpoint_rows(path, "source-b", "settings-a")
            )
            self.assertEqual(
                [], media_enrich._checkpoint_rows(path, "source-a", "settings-b")
            )

    def test_completed_entry_requires_all_declared_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            repo = Path(temporary_directory)
            artifact = repo / ".harness" / "enrichment" / "result.md"
            artifact.parent.mkdir(parents=True)
            artifact.write_text("result", encoding="utf-8")
            entry = {
                "status": "complete",
                "source_sha256": "digest",
                "settings_fingerprint": "settings",
                "artifacts": {
                    "markdown": ".harness/enrichment/result.md",
                },
            }

            self.assertTrue(
                media_enrich._completed_entry_matches(
                    entry, "digest", "settings", repo
                )
            )
            artifact.unlink()
            self.assertFalse(
                media_enrich._completed_entry_matches(
                    entry, "digest", "settings", repo
                )
            )

    def test_settings_fingerprint_is_order_independent(self) -> None:
        first = media_enrich._settings_fingerprint({"a": 1, "b": 2})
        second = media_enrich._settings_fingerprint({"b": 2, "a": 1})
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
