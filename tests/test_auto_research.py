from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


REPOSITORY = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


AUTO_RESEARCH = load_module(
    "harness_auto_research_tests",
    REPOSITORY / ".harness" / "workflows" / "03_auto_research.py",
)
AGENT_BUILDER = load_module(
    "harness_agent_builder_tests",
    REPOSITORY / ".harness" / "workflows" / "04_agent_builder.py",
)


class AutoResearchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.workspace = Path(self.temporary.name).resolve()
        self.evaluations = self.workspace / ".harness" / "evaluations"
        self.evaluations.mkdir(parents=True)
        self.config_path = self.evaluations / "research_config.json"
        self.benchmarks_path = self.evaluations / "benchmarks.json"

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def write_json(self, path: Path, value: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(value, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    def base_config(self, *, initial_best_score: float = 0.0) -> dict:
        return {
            "schema_version": 1,
            "default_iterations": 1,
            "initial_best_score": initial_best_score,
            "generator": {"mode": "local-template"},
            "promotion_allowlist": ["src/agents/candidate.py"],
            "hypotheses": [
                {
                    "id": "first",
                    "title": "First",
                    "description": "first bounded hypothesis",
                    "artifact": "src/agents/candidate.py",
                    "priority": 10,
                },
                {
                    "id": "second",
                    "title": "Second",
                    "description": "second bounded hypothesis",
                    "artifact": "src/agents/candidate.py",
                    "priority": 5,
                },
            ],
            "paths": {
                "candidate_root": ".harness/evaluations/candidates",
                "runs_root": ".harness/evaluations/runs",
                "ledger": ".harness/evaluations/research_ledger.jsonl",
                "state": ".harness/evaluations/research_state.json",
                "lock": ".harness/evaluations/research.lock",
            },
        }

    def passing_benchmarks(self) -> dict:
        return {
            "schema_version": 1,
            "benchmarks": [
                {
                    "id": "self-test",
                    "command": [
                        "{python}",
                        "{candidate}/src/agents/candidate.py",
                        "--self-test",
                    ],
                    "weight": 1,
                    "timeout_seconds": 10,
                }
            ],
        }

    def run_once(self, *, initial_best_score: float = 0.0):
        self.write_json(
            self.config_path,
            self.base_config(initial_best_score=initial_best_score),
        )
        self.write_json(self.benchmarks_path, self.passing_benchmarks())
        return AUTO_RESEARCH.run_research(
            workspace=self.workspace,
            config_path=self.config_path,
            benchmarks_path=self.benchmarks_path,
            iterations=1,
        )

    def test_default_local_iteration_promotes_without_git_and_records_evidence(self):
        receipts = self.run_once()

        self.assertEqual(len(receipts), 1)
        receipt = receipts[0]
        self.assertEqual(receipt["status"], "promoted")
        self.assertEqual(receipt["hypothesis_id"], "first")
        self.assertEqual(receipt["score"], 1.0)
        self.assertTrue(receipt["strictly_improved"])
        self.assertTrue(receipt["promoted"])
        self.assertTrue(receipt["cleanup"]["removed"])
        self.assertFalse((self.workspace / ".git").exists())

        promoted = self.workspace / "src" / "agents" / "candidate.py"
        self.assertTrue(promoted.is_file())
        content = promoted.read_text(encoding="utf-8")
        self.assertIn("scaffold-only", content)
        self.assertIn("not evidence that ADK", content)

        run_receipt = self.workspace / receipt["receipt"]
        self.assertTrue(run_receipt.is_file())
        ledger = self.evaluations / "research_ledger.jsonl"
        entries = [
            json.loads(line) for line in ledger.read_text(encoding="utf-8").splitlines()
        ]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["run_id"], receipt["run_id"])
        candidates = self.evaluations / "candidates"
        self.assertEqual(list(candidates.iterdir()), [])

    def test_equal_score_is_regression_safe_and_next_hypothesis_is_selected(self):
        first = self.run_once()[0]
        destination = self.workspace / "src" / "agents" / "candidate.py"
        original = destination.read_bytes()

        second = AUTO_RESEARCH.run_research(
            workspace=self.workspace,
            config_path=self.config_path,
            benchmarks_path=self.benchmarks_path,
            iterations=1,
        )[0]

        self.assertEqual(first["score"], second["score"])
        self.assertEqual(second["hypothesis_id"], "second")
        self.assertEqual(second["status"], "not-improved")
        self.assertFalse(second["strictly_improved"])
        self.assertFalse(second["promoted"])
        self.assertEqual(destination.read_bytes(), original)
        self.assertTrue(second["cleanup"]["removed"])

    def test_weighted_score_and_timeout_are_reported(self):
        candidate = self.workspace / "candidate"
        candidate.mkdir()
        benchmark_document = {
            "benchmarks": [
                {
                    "id": "passes",
                    "command": ["{python}", "-c", "raise SystemExit(0)"],
                    "weight": 3,
                    "timeout_seconds": 5,
                },
                {
                    "id": "times-out",
                    "command": [
                        "{python}",
                        "-c",
                        "import time; time.sleep(2)",
                    ],
                    "weight": 1,
                    "timeout_seconds": 0.05,
                },
            ]
        }

        score, results = AUTO_RESEARCH.evaluate_candidate(
            candidate, self.workspace, benchmark_document
        )

        self.assertEqual(score, 0.75)
        self.assertFalse(results[0]["timed_out"])
        self.assertTrue(results[1]["timed_out"])
        self.assertIsNone(results[1]["returncode"])

    def test_existing_lock_blocks_run_without_overwriting_lock(self):
        self.write_json(self.config_path, self.base_config())
        self.write_json(self.benchmarks_path, self.passing_benchmarks())
        lock = self.evaluations / "research.lock"
        lock.write_text('{"owner":"another-process"}\n', encoding="utf-8")

        with self.assertRaises(AUTO_RESEARCH.ResearchLockError):
            AUTO_RESEARCH.run_research(
                workspace=self.workspace,
                config_path=self.config_path,
                benchmarks_path=self.benchmarks_path,
            )

        self.assertEqual(
            lock.read_text(encoding="utf-8"),
            '{"owner":"another-process"}\n',
        )

    def test_external_adapter_requires_opt_in_and_never_uses_a_shell(self):
        candidate = self.workspace / "external-candidate"
        candidate.mkdir()
        hypothesis = {
            "id": "external",
            "artifact": "src/agents/candidate.py",
        }
        allowlist = ["src/agents/candidate.py"]
        generator = {
            "mode": "agents-cli",
            "external": {
                "argv": [
                    "agents-cli",
                    "generate",
                    "--literal",
                    "safe && still-one-argument",
                    "--request",
                    "{request}",
                    "--output",
                    "{candidate}",
                ],
                "timeout_seconds": 10,
            },
        }

        with self.assertRaises(AGENT_BUILDER.BuilderError):
            AGENT_BUILDER.build_candidate(
                candidate,
                hypothesis,
                allowlist,
                generator,
                allow_external=False,
            )

        def fake_run(command, **kwargs):
            artifact = Path(kwargs["cwd"]) / "src" / "agents" / "candidate.py"
            artifact.parent.mkdir(parents=True)
            artifact.write_text("VALUE = 'external staging only'\n", encoding="utf-8")
            return subprocess.CompletedProcess(command, 0, "generated", "")

        with mock.patch.object(
            AGENT_BUILDER.subprocess, "run", side_effect=fake_run
        ) as runner:
            result = AGENT_BUILDER.build_candidate(
                candidate,
                hypothesis,
                allowlist,
                generator,
                allow_external=True,
            )

        self.assertEqual(result["adapter"], "external-agents-cli")
        self.assertEqual(result["artifacts"], allowlist)
        positional, keyword = runner.call_args
        self.assertIsInstance(positional[0], list)
        self.assertFalse(keyword["shell"])
        self.assertIn("safe && still-one-argument", positional[0])
        self.assertFalse((self.workspace / "src").exists())

    def test_promotion_rejects_non_allowlisted_paths(self):
        candidate = self.workspace / "candidate"
        artifact = candidate / "src" / "agents" / "candidate.py"
        artifact.parent.mkdir(parents=True)
        artifact.write_text("VALUE = 1\n", encoding="utf-8")
        protected = self.workspace / "protected.txt"
        protected.write_text("keep\n", encoding="utf-8")

        with self.assertRaises(AUTO_RESEARCH.PromotionError):
            AUTO_RESEARCH.promote_artifacts(
                self.workspace,
                candidate,
                ["src/agents/candidate.py", "../protected.txt"],
                ["src/agents/candidate.py"],
            )

        self.assertEqual(protected.read_text(encoding="utf-8"), "keep\n")
        self.assertFalse((self.workspace / "src").exists())

    def test_concurrent_source_change_blocks_promotion(self):
        self.write_json(self.config_path, self.base_config())
        mutation = (
            "from pathlib import Path; "
            "p=Path(r'{workspace}')/'src'/'manual.py'; "
            "p.parent.mkdir(parents=True, exist_ok=True); "
            "p.write_text('human change\\n', encoding='utf-8')"
        )
        self.write_json(
            self.benchmarks_path,
            {
                "schema_version": 1,
                "benchmarks": [
                    {
                        "id": "concurrent-change",
                        "command": ["{python}", "-c", mutation],
                        "weight": 1,
                        "timeout_seconds": 10,
                    }
                ],
            },
        )

        receipt = AUTO_RESEARCH.run_research(
            workspace=self.workspace,
            config_path=self.config_path,
            benchmarks_path=self.benchmarks_path,
            iterations=1,
        )[0]

        self.assertEqual("error", receipt["status"])
        self.assertEqual("PromotionError", receipt["error"]["type"])
        self.assertFalse(receipt["promoted"])
        self.assertEqual(
            "human change\n",
            (self.workspace / "src" / "manual.py").read_text(encoding="utf-8"),
        )
        self.assertFalse((self.workspace / "src" / "agents" / "candidate.py").exists())


if __name__ == "__main__":
    unittest.main()
