from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPOSITORY_ROOT / ".harness" / "workflows" / "02_graphify_code.py"
SPEC = importlib.util.spec_from_file_location("graphify_code", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import environment guard
    raise RuntimeError(f"could not load {SCRIPT_PATH}")
graphify_code = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(graphify_code)


class GraphifyCodeTests(unittest.TestCase):
    def test_repository_local_media_environment_is_excluded(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "src" / "kept.py"
            dependency = root / ".venv-media" / "Lib" / "site-packages" / "noise.py"
            source.parent.mkdir(parents=True)
            dependency.parent.mkdir(parents=True)
            source.write_text("VALUE = 1\n", encoding="utf-8")
            dependency.write_text("NOISE = 1\n", encoding="utf-8")

            files = graphify_code._python_files(root)

            self.assertEqual([source], files)

    def make_repository(self, root: Path) -> Path:
        package = root / "src" / "demo"
        package.mkdir(parents=True)
        (package / "__init__.py").write_text("", encoding="utf-8")
        (package / "payments.py").write_text(
            "from __future__ import annotations\n"
            "import json\n"
            "from demo import worker\n\n"
            "class PaymentAgent:\n"
            "    async def settle(self) -> None:\n"
            "        return None\n",
            encoding="utf-8",
        )
        (package / "worker.py").write_text(
            "def execute() -> str:\n    return 'ok'\n", encoding="utf-8"
        )

        wiki = root / ".harness" / "wiki"
        raw = wiki / "raw_references"
        raw.mkdir(parents=True)
        source = root / "references" / "x402.txt"
        source.parent.mkdir()
        source.write_text("x402 reference", encoding="utf-8")
        output = raw / "x402.md"
        output.write_text("# x402\n", encoding="utf-8")
        manifest = {
            "schema_version": 1,
            "source_root": "references",
            "entries": [
                {
                    "id": "ref-x402",
                    "source_path": "references/x402.txt",
                    "relative_path": "x402.txt",
                    "output_path": ".harness/wiki/raw_references/x402.md",
                    "kind": "text",
                    "status": "converted",
                    "sha256": "abc123",
                    "size_bytes": 14,
                    "duplicate_of": None,
                    "transcript_sidecar": None,
                    "categories": ["AP2/x402 Payment Protocols"],
                    "extraction": {"method": "text_decode", "detail": "utf-8"},
                }
            ],
        }
        manifest_path = wiki / "manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
        )
        return manifest_path

    def test_builds_stable_ast_import_wiki_and_design_graph(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            manifest_path = self.make_repository(root)

            first = graphify_code.build_graph(root, manifest_path)
            second = graphify_code.build_graph(root, manifest_path)

            self.assertEqual(first, second)
            node_ids = {node["id"] for node in first["nodes"]}
            node_labels = {node["label"] for node in first["nodes"]}
            self.assertIn("file:src/demo/payments.py", node_ids)
            self.assertTrue(
                any(
                    node_id.startswith(
                        "symbol:src/demo/payments.py::PaymentAgent.settle@"
                    )
                    for node_id in node_ids
                )
            )
            self.assertIn("module:json", node_ids)
            self.assertIn("wiki-manifest:.harness/wiki/manifest.json", node_ids)
            self.assertIn("wiki-source:ref-x402", node_ids)
            self.assertIn("wiki-category:ap2-x402-payment-protocols", node_ids)
            for expected in (
                "Solana Contracts",
                "Solana RPCs",
                "GCP Eventarc",
                "GCP Cloud Run",
                "AP2",
                "x402",
                "MCP",
                "Google ADK",
            ):
                self.assertIn(expected, node_labels)

            self.assertTrue(first["edges"])
            for edge in first["edges"]:
                self.assertIn(
                    edge["status"], {"observed", "derived", "declared", "proposed"}
                )
                self.assertTrue(edge["evidence"])

            proposed = [edge for edge in first["edges"] if edge["status"] == "proposed"]
            self.assertTrue(proposed)
            self.assertTrue(
                any(
                    edge["source"] == "domain:protocol-x402"
                    and edge["target"] == "domain:solana-rpcs"
                    for edge in proposed
                )
            )
            observed = [edge for edge in first["edges"] if edge["status"] == "observed"]
            self.assertTrue(
                any(edge["relationship"] == "imports" for edge in observed)
            )
            self.assertTrue(
                any(edge["relationship"] == "categorizes" for edge in observed)
            )

    def test_cli_writes_json_dot_and_bounded_query_context(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self.make_repository(root)
            graph_path = root / "artifacts" / "knowledge.json"
            dot_path = root / "artifacts" / "knowledge.dot"
            context_path = root / "artifacts" / "context.json"

            exit_code = graphify_code.main(
                [
                    "--root",
                    str(root),
                    "--output-json",
                    str(graph_path),
                    "--output-dot",
                    str(dot_path),
                    "--context-output",
                    str(context_path),
                    "--query",
                    "x402 settlement",
                    "--max-nodes",
                    "4",
                ]
            )

            self.assertEqual(0, exit_code)
            graph = json.loads(graph_path.read_text(encoding="utf-8"))
            context = json.loads(context_path.read_text(encoding="utf-8"))
            dot = dot_path.read_text(encoding="utf-8")
            self.assertEqual(graph["stats"]["node_count"], len(graph["nodes"]))
            self.assertLessEqual(context["selected_node_count"], 4)
            self.assertEqual(context["selected_node_count"], len(context["nodes"]))
            self.assertTrue(context["matched_query"])
            self.assertIn("domain:protocol-x402", {node["id"] for node in context["nodes"]})
            self.assertIn("digraph harness_knowledge", dot)
            self.assertIn("[proposed]", dot)
            for role in graphify_code.ROLE_CONTEXT_QUERIES:
                role_path = (
                    root / ".harness" / "wiki" / "contexts" / f"{role}.json"
                )
                self.assertTrue(role_path.is_file())
                role_context = json.loads(role_path.read_text(encoding="utf-8"))
                role_types = {node["type"] for node in role_context["nodes"]}
                self.assertIn("official_manifest", role_types)
                self.assertIn("readiness_state", role_types)

    def test_integrates_official_claims_and_readiness_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self.make_repository(root)
            official = root / "research" / "official-docs-wiki"
            official.mkdir(parents=True)
            (official / "manifest.json").write_text(
                json.dumps(
                    {
                        "generated_at": "2026-07-23",
                        "official_sources": [
                            {
                                "id": "EVENT-SITE",
                                "publisher": "Organizer",
                                "url": "https://example.test/event",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            (official / "claim-ledger.json").write_text(
                json.dumps(
                    {
                        "as_of": "2026-07-23",
                        "claims": [
                            {
                                "id": "event-date",
                                "claim": "Solana Devnet transaction is accepted.",
                                "verdict": "confirmed",
                                "source_ids": ["EVENT-SITE"],
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            control = root / ".harness" / "control"
            control.mkdir(parents=True)
            (control / "state.json").write_text(
                json.dumps(
                    {
                        "state": "DEVNET_PROVEN",
                        "overlay": None,
                        "next_action": "harden",
                        "blockers": ["idempotency_test"],
                        "derived_at": "2026-07-23T12:00:00+09:00",
                        "event_count": 8,
                        "gates": {
                            "G4": {"name": "Runtime", "status": "passed", "missing": []}
                        },
                        "receipts": [
                            {
                                "receipt_id": "tx-1",
                                "kind": "solana_devnet_tx",
                                "result": "pass",
                                "environment": "solana-devnet",
                                "timestamp": "2026-07-23T12:00:00+09:00",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            graph = graphify_code.build_graph(root)
            node_ids = {node["id"] for node in graph["nodes"]}

            self.assertIn("official-source:event-site", node_ids)
            self.assertIn("official-claim:event-date", node_ids)
            self.assertIn("readiness-state:current", node_ids)
            self.assertIn("evidence-receipt:tx-1", node_ids)
            self.assertTrue(
                any(
                    edge["source"] == "evidence-receipt:tx-1"
                    and edge["relationship"] == "satisfies"
                    and edge["target"] == "readiness-gate:g4"
                    and edge["status"] == "extracted"
                    for edge in graph["edges"]
                )
            )

    def test_missing_manifest_is_explicit_and_not_an_error(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            graph = graphify_code.build_graph(root)
            manifest_node = next(
                node for node in graph["nodes"] if node["type"] == "wiki_manifest"
            )
            self.assertEqual("missing", manifest_node["availability"])
            context = graphify_code.build_context_pack(graph, "no-such-term", 2)
            self.assertFalse(context["matched_query"])
            self.assertLessEqual(len(context["nodes"]), 2)


if __name__ == "__main__":
    unittest.main()
