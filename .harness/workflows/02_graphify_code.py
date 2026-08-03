#!/usr/bin/env python3
"""Build a deterministic, dependency-free repository knowledge graph.

The workflow intentionally uses only the Python standard library.  It combines
three kinds of context:

* Python files, AST declarations, and imports observed in the repository;
* wiki sources and categories declared by ``01_knowledge_extract.py``;
* official source claims and the derived readiness control state; and
* explicitly labelled *proposed* architecture mappings from the hackathon
  brief.  Proposed mappings must not be mistaken for implemented integrations.

The JSON graph is the source artifact.  DOT is a human-readable projection and
the context pack is a query-bounded projection suitable for an LLM prompt.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import sys
import tempfile
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


SCHEMA_VERSION = "1.0"
DEFAULT_MAX_NODES = 64
EDGE_STATUSES = {
    "observed",
    "derived",
    "declared",
    "proposed",
    "extracted",
    "inferred",
    "ambiguous",
}
EXCLUDED_DIRECTORY_NAMES = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    ".venv-media",
    "__pycache__",
    "node_modules",
    "tmp",
    "venv",
}

CATEGORY_NAMES = (
    "Solana Engine",
    "GCP Infrastructure",
    "AP2/x402 Payment Protocols",
    "Google ADK",
)

DOMAIN_NODES: tuple[dict[str, str], ...] = (
    {
        "id": "domain:solana-contracts",
        "label": "Solana Contracts",
        "layer": "solana",
    },
    {
        "id": "domain:solana-rpcs",
        "label": "Solana RPCs",
        "layer": "solana",
    },
    {
        "id": "domain:gcp-eventarc",
        "label": "GCP Eventarc",
        "layer": "gcp",
    },
    {
        "id": "domain:gcp-cloud-run",
        "label": "GCP Cloud Run",
        "layer": "gcp",
    },
    {
        "id": "domain:protocol-ap2",
        "label": "AP2",
        "layer": "agent_protocol",
    },
    {
        "id": "domain:protocol-x402",
        "label": "x402",
        "layer": "agent_protocol",
    },
    {
        "id": "domain:protocol-mcp",
        "label": "MCP",
        "layer": "agent_protocol",
    },
    {
        "id": "domain:google-adk",
        "label": "Google ADK",
        "layer": "agent_runtime",
    },
)

CATEGORY_DOMAIN_MAP: Mapping[str, tuple[str, ...]] = {
    "Solana Engine": ("domain:solana-contracts", "domain:solana-rpcs"),
    "GCP Infrastructure": ("domain:gcp-eventarc", "domain:gcp-cloud-run"),
    "AP2/x402 Payment Protocols": (
        "domain:protocol-ap2",
        "domain:protocol-x402",
        "domain:protocol-mcp",
    ),
    "Google ADK": ("domain:google-adk",),
}

# These are architecture hypotheses from the requested design, not proof that
# any integration exists or that a protocol supports a particular production
# path.  Keeping them centralized makes the status boundary auditable.
PROPOSED_DESIGN_EDGES: tuple[tuple[str, str, str], ...] = (
    (
        "domain:solana-contracts",
        "candidate_access_path",
        "domain:solana-rpcs",
    ),
    (
        "domain:solana-rpcs",
        "candidate_event_bridge",
        "domain:gcp-eventarc",
    ),
    (
        "domain:gcp-eventarc",
        "candidate_trigger_path",
        "domain:gcp-cloud-run",
    ),
    (
        "domain:gcp-cloud-run",
        "candidate_agent_host",
        "domain:google-adk",
    ),
    (
        "domain:google-adk",
        "candidate_protocol_adapter",
        "domain:protocol-ap2",
    ),
    (
        "domain:google-adk",
        "candidate_protocol_adapter",
        "domain:protocol-x402",
    ),
    (
        "domain:google-adk",
        "candidate_protocol_adapter",
        "domain:protocol-mcp",
    ),
    (
        "domain:protocol-ap2",
        "candidate_payment_bridge",
        "domain:protocol-x402",
    ),
    (
        "domain:protocol-x402",
        "candidate_settlement_path",
        "domain:solana-rpcs",
    ),
)

ROLE_CONTEXT_QUERIES: Mapping[str, str] = {
    "ideation": (
        "official event track candidate user problem agent payment "
        "submission criteria"
    ),
    "architecture": (
        "product contract architecture Solana Devnet GCP Cloud Run Eventarc "
        "Gemini ADK x402 pay.sh"
    ),
    "implementation": (
        "product contract implementation Python agent payment cloud event "
        "runtime receipt"
    ),
    "security": (
        "security budget approval idempotency prompt injection retry timeout "
        "wallet authorization"
    ),
    "demo": (
        "demo agent decision Solana transaction confirmation GCP runtime log "
        "evidence"
    ),
    "submission": (
        "official submission product introduction GitHub demo video "
        "fresh clone status gate"
    ),
}


class GraphifyError(RuntimeError):
    """Raised when an input contract is present but invalid."""


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    if slug:
        return slug
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _stable_digest(value: str, length: int = 16) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def _display_path(path: Path, root: Path) -> str:
    """Return a stable path without embedding a machine-specific root."""

    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.name


def _normalise_manifest_path(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().replace("\\", "/")
    while text.startswith("./"):
        text = text[2:]
    return text or None


def _as_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, Sequence) and not isinstance(value, (bytes, bytearray)):
        return sorted({str(item).strip() for item in value if str(item).strip()})
    return [str(value).strip()] if str(value).strip() else []


class GraphBuilder:
    """Collect graph records while de-duplicating evidence deterministically."""

    def __init__(self) -> None:
        self.nodes: dict[str, dict[str, Any]] = {}
        self._edges: dict[tuple[str, str, str, str], dict[str, Any]] = {}

    def add_node(
        self, node_id: str, node_type: str, label: str, **attributes: Any
    ) -> str:
        node = {"id": node_id, "type": node_type, "label": label}
        node.update(
            {key: value for key, value in attributes.items() if value is not None}
        )
        existing = self.nodes.get(node_id)
        if existing is None:
            self.nodes[node_id] = node
        elif existing != node:
            raise GraphifyError(f"conflicting node records for stable id {node_id!r}")
        return node_id

    def add_edge(
        self,
        source: str,
        relationship: str,
        target: str,
        *,
        status: str,
        evidence: Mapping[str, Any],
    ) -> None:
        if status not in EDGE_STATUSES:
            raise GraphifyError(f"unsupported edge status: {status}")
        if source not in self.nodes or target not in self.nodes:
            raise GraphifyError(f"edge endpoint missing: {source!r} -> {target!r}")
        if not evidence:
            raise GraphifyError("every graph edge requires non-empty evidence")

        key = (source, relationship, target, status)
        record = self._edges.setdefault(
            key,
            {
                "id": f"edge:{_stable_digest('|'.join(key))}",
                "source": source,
                "target": target,
                "relationship": relationship,
                "status": status,
                "evidence": {},
            },
        )
        evidence_record = dict(evidence)
        record["evidence"][_canonical_json(evidence_record)] = evidence_record

    def serialise_edges(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for record in self._edges.values():
            output = dict(record)
            output["evidence"] = [
                record["evidence"][key] for key in sorted(record["evidence"])
            ]
            records.append(output)
        return sorted(
            records,
            key=lambda item: (
                item["source"],
                item["relationship"],
                item["target"],
                item["status"],
            ),
        )


def _python_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*.py"):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_DIRECTORY_NAMES for part in relative.parts[:-1]):
            continue
        if relative.parts[:2] == (".harness", "evaluations"):
            continue
        files.append(path)
    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def _module_candidates(relative: Path) -> tuple[str, ...]:
    parts = list(relative.with_suffix("").parts)
    is_package = bool(parts and parts[-1] == "__init__")
    if is_package:
        parts.pop()

    candidates: set[str] = set()

    def add(candidate_parts: Iterable[str]) -> None:
        candidate = ".".join(
            part for part in candidate_parts if part and not part.startswith(".")
        )
        if candidate:
            candidates.add(candidate)

    add(parts)
    if parts and parts[0] in {"src", "tests", ".harness"}:
        add(parts[1:])
    return tuple(sorted(candidates))


class _SymbolVisitor(ast.NodeVisitor):
    def __init__(self, graph: GraphBuilder, file_id: str, relative_path: str) -> None:
        self.graph = graph
        self.file_id = file_id
        self.relative_path = relative_path
        self.stack: list[tuple[str, str]] = []

    def _visit_declaration(self, node: ast.AST, name: str, kind: str) -> None:
        qualified_name = ".".join([*(item[0] for item in self.stack), name])
        line = int(getattr(node, "lineno", 0))
        node_id = f"symbol:{self.relative_path}::{qualified_name}@{line}"
        self.graph.add_node(
            node_id,
            "python_symbol",
            qualified_name,
            symbol_kind=kind,
            path=self.relative_path,
            qualified_name=qualified_name,
            line=line,
        )
        parent_id = self.stack[-1][1] if self.stack else self.file_id
        self.graph.add_edge(
            parent_id,
            "declares",
            node_id,
            status="observed",
            evidence={"kind": "python_ast", "path": self.relative_path, "line": line},
        )
        self.stack.append((name, node_id))
        self.generic_visit(node)
        self.stack.pop()

    def visit_ClassDef(self, node: ast.ClassDef) -> None:  # noqa: N802 - AST API
        self._visit_declaration(node, node.name, "class")

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:  # noqa: N802 - AST API
        self._visit_declaration(node, node.name, "function")

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:  # noqa: N802
        self._visit_declaration(node, node.name, "async_function")


def _resolve_relative_module(
    candidates: tuple[str, ...], level: int, imported_module: str | None
) -> str:
    if not candidates:
        return f"{'.' * level}{imported_module or ''}"
    current = candidates[0].split(".")
    package = current[:-1]
    drop_count = max(level - 1, 0)
    if drop_count:
        package = package[:-drop_count] if drop_count <= len(package) else []
    if imported_module:
        package.extend(imported_module.split("."))
    return ".".join(package) or f"{'.' * level}{imported_module or ''}"


def _add_import(
    graph: GraphBuilder,
    *,
    file_id: str,
    relative_path: str,
    module_name: str,
    line: int,
    names: Sequence[str],
    internal_modules: Mapping[str, tuple[str, ...]],
) -> None:
    resolved_files = internal_modules.get(module_name, ())
    module_id = f"module:{module_name}"
    graph.add_node(
        module_id,
        "python_module",
        module_name,
        resolution="internal" if resolved_files else "external_or_unresolved",
    )
    graph.add_edge(
        file_id,
        "imports",
        module_id,
        status="observed",
        evidence={
            "kind": "python_ast_import",
            "path": relative_path,
            "line": line,
            "names": sorted(names),
        },
    )
    for target_file_id in resolved_files:
        graph.add_edge(
            module_id,
            "resolves_to",
            target_file_id,
            status="derived",
            evidence={
                "kind": "repository_module_resolution",
                "module": module_name,
                "path": graph.nodes[target_file_id]["path"],
            },
        )


def _add_python_graph(graph: GraphBuilder, root: Path) -> list[dict[str, Any]]:
    files = _python_files(root)
    file_details: dict[Path, tuple[str, str, tuple[str, ...]]] = {}
    internal_modules_mutable: dict[str, list[str]] = defaultdict(list)

    for path in files:
        relative_path = path.relative_to(root).as_posix()
        file_id = f"file:{relative_path}"
        candidates = _module_candidates(path.relative_to(root))
        graph.add_node(
            file_id,
            "python_file",
            path.name,
            path=relative_path,
            module_candidates=list(candidates),
        )
        file_details[path] = (file_id, relative_path, candidates)
        for candidate in candidates:
            internal_modules_mutable[candidate].append(file_id)

    internal_modules = {
        name: tuple(sorted(file_ids))
        for name, file_ids in sorted(internal_modules_mutable.items())
    }
    parse_errors: list[dict[str, Any]] = []

    for path in files:
        file_id, relative_path, candidates = file_details[path]
        try:
            source = path.read_text(encoding="utf-8-sig")
            tree = ast.parse(source, filename=relative_path)
        except (OSError, UnicodeError, SyntaxError) as exc:
            parse_errors.append(
                {
                    "path": relative_path,
                    "line": getattr(exc, "lineno", None),
                    "column": getattr(exc, "offset", None),
                    "message": str(exc),
                }
            )
            graph.nodes[file_id]["parse_status"] = "error"
            continue

        graph.nodes[file_id]["parse_status"] = "parsed"
        _SymbolVisitor(graph, file_id, relative_path).visit(tree)

        import_nodes = sorted(
            (
                node
                for node in ast.walk(tree)
                if isinstance(node, (ast.Import, ast.ImportFrom))
            ),
            key=lambda node: (
                getattr(node, "lineno", 0),
                getattr(node, "col_offset", 0),
            ),
        )
        for node in import_nodes:
            if isinstance(node, ast.Import):
                for alias in sorted(node.names, key=lambda item: item.name):
                    _add_import(
                        graph,
                        file_id=file_id,
                        relative_path=relative_path,
                        module_name=alias.name,
                        line=node.lineno,
                        names=[alias.name],
                        internal_modules=internal_modules,
                    )
            else:
                module_name = (
                    _resolve_relative_module(candidates, node.level, node.module)
                    if node.level
                    else (node.module or "")
                )
                if not module_name:
                    module_name = "." * max(node.level, 1)
                _add_import(
                    graph,
                    file_id=file_id,
                    relative_path=relative_path,
                    module_name=module_name,
                    line=node.lineno,
                    names=[alias.name for alias in node.names],
                    internal_modules=internal_modules,
                )

    return sorted(parse_errors, key=lambda item: item["path"])


def _manifest_entries(payload: Any) -> list[Mapping[str, Any]]:
    if isinstance(payload, list):
        raw_entries = payload
    elif isinstance(payload, Mapping):
        raw_entries = None
        for key in ("entries", "sources", "documents", "files", "items"):
            if key in payload:
                raw_entries = payload[key]
                break
        if raw_entries is None:
            raw_entries = []
    else:
        raise GraphifyError("wiki manifest must be a JSON object or list")
    if not isinstance(raw_entries, list) or not all(
        isinstance(entry, Mapping) for entry in raw_entries
    ):
        raise GraphifyError("wiki manifest entries must be a list of objects")
    return list(raw_entries)


def _add_architecture_seed(graph: GraphBuilder) -> None:
    design_evidence = {
        "kind": "requested_design_mapping",
        "reference": "hackathon_harness_architecture_brief",
        "note": "Architecture seed only; validate against source specs and implementation evidence.",
    }
    taxonomy_evidence = {
        "kind": "requested_taxonomy",
        "reference": "hackathon_harness_architecture_brief",
    }

    for domain in DOMAIN_NODES:
        graph.add_node(
            domain["id"],
            "architecture_domain",
            domain["label"],
            layer=domain["layer"],
            implementation_status="unverified",
        )

    for category_name in CATEGORY_NAMES:
        category_id = f"wiki-category:{_slug(category_name)}"
        graph.add_node(
            category_id, "wiki_category", category_name, category=category_name
        )
        for domain_id in CATEGORY_DOMAIN_MAP[category_name]:
            graph.add_edge(
                category_id,
                "covers",
                domain_id,
                status="declared",
                evidence=taxonomy_evidence,
            )

    for source, relationship, target in PROPOSED_DESIGN_EDGES:
        graph.add_edge(
            source,
            relationship,
            target,
            status="proposed",
            evidence=design_evidence,
        )


def _add_wiki_manifest(graph: GraphBuilder, root: Path, manifest_path: Path) -> None:
    manifest_display = _display_path(manifest_path, root)
    manifest_id = f"wiki-manifest:{manifest_display}"
    if not manifest_path.is_file():
        graph.add_node(
            manifest_id,
            "wiki_manifest",
            manifest_path.name,
            path=manifest_display,
            availability="missing",
        )
        return

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise GraphifyError(
            f"cannot read wiki manifest {manifest_display}: {exc}"
        ) from exc

    entries = _manifest_entries(payload)
    graph.add_node(
        manifest_id,
        "wiki_manifest",
        manifest_path.name,
        path=manifest_display,
        availability="present",
        schema_version=(
            payload.get("schema_version") if isinstance(payload, Mapping) else None
        ),
        entry_count=len(entries),
    )

    sorted_entries = sorted(
        entries,
        key=lambda entry: (
            str(entry.get("id", "")),
            str(entry.get("source_path", entry.get("path", ""))),
        ),
    )
    for position, entry in enumerate(sorted_entries):
        source_path = _normalise_manifest_path(
            entry.get("source_path")
            or entry.get("source")
            or entry.get("original_path")
            or entry.get("path")
            or entry.get("relative_path")
        )
        output_path = _normalise_manifest_path(
            entry.get("output_path")
            or entry.get("markdown_path")
            or entry.get("destination")
        )
        entry_key = str(entry.get("id") or source_path or output_path or position)
        safe_entry_id = re.sub(r"[^A-Za-z0-9._-]+", "-", entry_key).strip("-")
        if not safe_entry_id:
            safe_entry_id = _stable_digest(entry_key)
        source_id = f"wiki-source:{safe_entry_id}"
        label_path = source_path or output_path or entry_key
        source_label = label_path.rsplit("/", 1)[-1]

        source_exists = bool(source_path and (root / Path(source_path)).is_file())
        output_exists = bool(output_path and (root / Path(output_path)).is_file())
        graph.add_node(
            source_id,
            "wiki_source",
            source_label,
            manifest_entry_id=entry_key,
            source_path=source_path,
            output_path=output_path,
            relative_path=_normalise_manifest_path(entry.get("relative_path")),
            source_kind=entry.get("kind") or entry.get("type"),
            manifest_status=entry.get("status"),
            sha256=entry.get("sha256"),
            size_bytes=entry.get("size_bytes"),
            duplicate_of=_normalise_manifest_path(entry.get("duplicate_of")),
            transcript_sidecar=_normalise_manifest_path(
                entry.get("transcript_sidecar")
            ),
            extraction=entry.get("extraction"),
            source_exists=source_exists,
            output_exists=output_exists,
        )
        manifest_evidence = {
            "kind": "wiki_manifest_entry",
            "path": manifest_display,
            "entry_id": entry_key,
        }
        graph.add_edge(
            manifest_id,
            "indexes",
            source_id,
            status="observed",
            evidence=manifest_evidence,
        )

        categories = _as_string_list(entry.get("categories") or entry.get("category"))
        for category_name in categories:
            category_id = f"wiki-category:{_slug(category_name)}"
            graph.add_node(
                category_id,
                "wiki_category",
                category_name,
                category=category_name,
            )
            graph.add_edge(
                category_id,
                "categorizes",
                source_id,
                status="observed",
                evidence=manifest_evidence,
            )


def _read_json_mapping(path: Path, display_path: str) -> Mapping[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise GraphifyError(f"cannot read JSON {display_path}: {exc}") from exc
    if not isinstance(payload, Mapping):
        raise GraphifyError(f"JSON root must be an object: {display_path}")
    return payload


def _claim_domain_ids(claim: Mapping[str, Any]) -> list[str]:
    searchable = _canonical_json(claim).casefold()
    mappings = (
        (("solana", "devnet", "mainnet", "transaction"), "domain:solana-rpcs"),
        (("cloud run", "eventarc", "gcp"), "domain:gcp-cloud-run"),
        (("gemini", "google adk", " adk"), "domain:google-adk"),
        (("ap2",), "domain:protocol-ap2"),
        (("x402", "pay.sh", "pay-sh"), "domain:protocol-x402"),
        (("mcp",), "domain:protocol-mcp"),
    )
    return sorted(
        {
            domain_id
            for terms, domain_id in mappings
            if any(term in searchable for term in terms)
        }
    )


def _add_official_research(
    graph: GraphBuilder,
    root: Path,
    manifest_path: Path,
    claim_ledger_path: Path,
) -> None:
    manifest_display = _display_path(manifest_path, root)
    claims_display = _display_path(claim_ledger_path, root)
    manifest_id = f"official-manifest:{manifest_display}"
    claims_id = f"official-claims:{claims_display}"
    if not manifest_path.is_file() or not claim_ledger_path.is_file():
        graph.add_node(
            manifest_id,
            "official_manifest",
            manifest_path.name,
            path=manifest_display,
            availability="missing",
        )
        return

    manifest = _read_json_mapping(manifest_path, manifest_display)
    claim_ledger = _read_json_mapping(claim_ledger_path, claims_display)
    sources = manifest.get("official_sources", [])
    claims = claim_ledger.get("claims", [])
    if not isinstance(sources, list) or not isinstance(claims, list):
        raise GraphifyError("official manifest sources and claims must be arrays")

    graph.add_node(
        manifest_id,
        "official_manifest",
        manifest_path.name,
        path=manifest_display,
        availability="present",
        generated_at=manifest.get("generated_at"),
        source_count=len(sources),
    )
    graph.add_node(
        claims_id,
        "official_claim_ledger",
        claim_ledger_path.name,
        path=claims_display,
        availability="present",
        as_of=claim_ledger.get("as_of"),
        claim_count=len(claims),
    )
    graph.add_edge(
        manifest_id,
        "governs",
        claims_id,
        status="extracted",
        evidence={"kind": "official_research_manifest", "path": manifest_display},
    )

    source_node_ids: dict[str, str] = {}
    for position, source in enumerate(sources):
        if not isinstance(source, Mapping):
            raise GraphifyError(f"official source at position {position} is invalid")
        source_key = str(source.get("id") or position)
        node_id = f"official-source:{_slug(source_key)}"
        source_node_ids[source_key] = node_id
        graph.add_node(
            node_id,
            "official_source",
            source_key,
            publisher=source.get("publisher"),
            url=source.get("url"),
            authority="official",
            as_of=manifest.get("generated_at"),
        )
        graph.add_edge(
            manifest_id,
            "indexes",
            node_id,
            status="extracted",
            evidence={
                "kind": "official_source_entry",
                "path": manifest_display,
                "source_id": source_key,
            },
        )

    for position, claim in enumerate(claims):
        if not isinstance(claim, Mapping):
            raise GraphifyError(f"official claim at position {position} is invalid")
        claim_key = str(claim.get("id") or position)
        claim_node_id = f"official-claim:{_slug(claim_key)}"
        verdict = str(claim.get("verdict", "unknown"))
        confidence = "AMBIGUOUS" if verdict == "not_found" else "EXTRACTED"
        graph.add_node(
            claim_node_id,
            "official_claim",
            str(claim.get("claim") or claim_key),
            claim_id=claim_key,
            document=claim.get("document"),
            locator=claim.get("locator"),
            verdict=verdict,
            confidence=confidence,
            correction=claim.get("correction"),
            note=claim.get("note"),
            as_of=claim_ledger.get("as_of"),
        )
        graph.add_edge(
            claims_id,
            "indexes",
            claim_node_id,
            status="extracted" if confidence == "EXTRACTED" else "ambiguous",
            evidence={
                "kind": "official_claim_entry",
                "path": claims_display,
                "claim_id": claim_key,
            },
        )
        source_ids = claim.get("source_ids", [])
        if not isinstance(source_ids, list):
            raise GraphifyError(f"official claim {claim_key} source_ids must be an array")
        for source_key in source_ids:
            source_node_id = source_node_ids.get(str(source_key))
            if source_node_id is None:
                raise GraphifyError(
                    f"official claim {claim_key} references unknown source {source_key}"
                )
            graph.add_edge(
                claim_node_id,
                "grounded_by",
                source_node_id,
                status="extracted",
                evidence={
                    "kind": "official_claim_source",
                    "path": claims_display,
                    "claim_id": claim_key,
                    "source_id": source_key,
                },
            )
        for domain_id in _claim_domain_ids(claim):
            graph.add_edge(
                claim_node_id,
                "concerns",
                domain_id,
                status="inferred",
                evidence={
                    "kind": "keyword_domain_mapping",
                    "path": claims_display,
                    "claim_id": claim_key,
                },
            )


def _receipt_gate(kind: str) -> str | None:
    if kind in {"local_agent_test", "sandbox_payment_test"}:
        return "G3"
    if kind in {"gemini_trace", "solana_devnet_tx", "gcp_runtime_log"}:
        return "G4"
    if kind in {
        "idempotency_test",
        "budget_cap_test",
        "approval_policy_test",
        "prompt_injection_test",
        "retry_timeout_test",
    }:
        return "G5"
    if kind in {
        "product_intro_validated",
        "github_repo_validated",
        "demo_video_validated",
        "fresh_clone_test",
    }:
        return "G6"
    return None


def _add_readiness_state(
    graph: GraphBuilder, root: Path, state_path: Path, ledger_path: Path
) -> None:
    state_display = _display_path(state_path, root)
    state_id = "readiness-state:current"
    if not state_path.is_file():
        graph.add_node(
            state_id,
            "readiness_state",
            "Hackathon readiness",
            path=state_display,
            availability="missing",
        )
        return
    state = _read_json_mapping(state_path, state_display)
    graph.add_node(
        state_id,
        "readiness_state",
        "Hackathon readiness",
        path=state_display,
        availability="present",
        state=state.get("state"),
        overlay=state.get("overlay"),
        next_action=state.get("next_action"),
        blockers=state.get("blockers"),
        derived_at=state.get("derived_at"),
        event_count=state.get("event_count"),
    )
    state_evidence = {"kind": "readiness_state", "path": state_display}
    operations_root = root / ".harness" / "wiki" / "operations"
    if operations_root.is_dir():
        for operation_path in sorted(operations_root.glob("*.md")):
            operation_display = _display_path(operation_path, root)
            operation_id = f"operational-wiki:{_slug(operation_display)}"
            graph.add_node(
                operation_id,
                "operational_wiki",
                operation_path.stem,
                path=operation_display,
            )
            graph.add_edge(
                state_id,
                "projects_to",
                operation_id,
                status="derived",
                evidence={
                    "kind": "readiness_wiki_projection",
                    "state_path": state_display,
                    "page_path": operation_display,
                },
            )
    approval_node_ids: dict[str, str] = {}
    approvals = state.get("approvals", [])
    if isinstance(approvals, list):
        for approval in approvals:
            if not isinstance(approval, Mapping):
                continue
            approval_key = str(approval.get("approval_id") or "unknown")
            approval_id = f"human-approval:{_slug(approval_key)}"
            approval_node_ids[approval_key] = approval_id
            graph.add_node(
                approval_id,
                "human_approval",
                approval_key,
                actions=approval.get("actions"),
                scope=approval.get("scope"),
                approved_by=approval.get("approved_by"),
                approved_at=approval.get("approved_at"),
                expires_at=approval.get("expires_at"),
            )
            graph.add_edge(
                state_id,
                "has_approval",
                approval_id,
                status="derived",
                evidence=state_evidence,
            )

    gates = state.get("gates", {})
    if isinstance(gates, Mapping):
        for gate_key in sorted(gates):
            gate = gates[gate_key]
            if not isinstance(gate, Mapping):
                continue
            gate_id = f"readiness-gate:{_slug(str(gate_key))}"
            graph.add_node(
                gate_id,
                "readiness_gate",
                str(gate.get("name") or gate_key),
                gate_id=gate_key,
                gate_status=gate.get("status"),
                missing=gate.get("missing"),
            )
            graph.add_edge(
                state_id,
                "has_gate",
                gate_id,
                status="derived",
                evidence=state_evidence,
            )

    evaluation = state.get("candidate_evaluation")
    if isinstance(evaluation, Mapping):
        evaluation_id = "candidate-evaluation:latest"
        graph.add_node(
            evaluation_id,
            "candidate_evaluation",
            "Latest candidate evaluation",
            selection_status=evaluation.get("status"),
            winner_id=evaluation.get("winner_id"),
            margin=evaluation.get("margin"),
        )
        graph.add_edge(
            state_id,
            "derived_from",
            evaluation_id,
            status="derived",
            evidence=state_evidence,
        )
        ranking = evaluation.get("ranking", [])
        if isinstance(ranking, list):
            for item in ranking:
                if not isinstance(item, Mapping):
                    continue
                candidate_key = str(item.get("candidate_id", "unknown"))
                candidate_id = f"product-candidate:{_slug(candidate_key)}"
                graph.add_node(
                    candidate_id,
                    "product_candidate",
                    str(item.get("title") or candidate_key),
                    candidate_id=candidate_key,
                    primary_track=item.get("primary_track"),
                    total_score=item.get("total_score"),
                )
                graph.add_edge(
                    evaluation_id,
                    "ranks",
                    candidate_id,
                    status="derived",
                    evidence=state_evidence,
                )

    contract = state.get("product_contract")
    if isinstance(contract, Mapping):
        contract_key = str(contract.get("id") or "current")
        contract_id = f"product-contract:{_slug(contract_key)}"
        graph.add_node(
            contract_id,
            "product_contract",
            str(contract.get("title") or contract_key),
            **{
                key: contract.get(key)
                for key in (
                    "candidate_id",
                    "persona",
                    "problem",
                    "primary_track",
                    "agent_decision",
                    "spending_policy",
                    "payment_protocol",
                    "network",
                    "gcp_path",
                    "excluded_features",
                )
            },
        )
        graph.add_edge(
            state_id,
            "governed_by",
            contract_id,
            status="derived",
            evidence=state_evidence,
        )

    receipts = state.get("receipts", [])
    if isinstance(receipts, list):
        for receipt in receipts:
            if not isinstance(receipt, Mapping):
                continue
            receipt_key = str(receipt.get("receipt_id") or "unknown")
            receipt_id = f"evidence-receipt:{_slug(receipt_key)}"
            kind = str(receipt.get("kind") or "unknown")
            graph.add_node(
                receipt_id,
                "evidence_receipt",
                receipt_key,
                receipt_kind=kind,
                result=receipt.get("result"),
                environment=receipt.get("environment"),
                timestamp=receipt.get("timestamp"),
            )
            graph.add_edge(
                state_id,
                "includes_evidence",
                receipt_id,
                status="derived",
                evidence=state_evidence,
            )
            approval_key = receipt.get("approval_id")
            if approval_key in approval_node_ids:
                graph.add_edge(
                    receipt_id,
                    "authorized_by",
                    approval_node_ids[str(approval_key)],
                    status="extracted",
                    evidence={
                        "kind": "readiness_approval_projection",
                        "path": state_display,
                        "receipt_id": receipt_key,
                        "approval_id": approval_key,
                    },
                )
            gate_key = _receipt_gate(kind)
            gate_id = f"readiness-gate:{_slug(gate_key)}" if gate_key else None
            if gate_id and gate_id in graph.nodes:
                graph.add_edge(
                    receipt_id,
                    "satisfies",
                    gate_id,
                    status="extracted",
                    evidence={
                        "kind": "readiness_receipt_projection",
                        "path": state_display,
                        "receipt_id": receipt_key,
                    },
                )

    ledger_display = _display_path(ledger_path, root)
    ledger_id = "execution-ledger:readiness"
    graph.add_node(
        ledger_id,
        "execution_ledger",
        "Readiness execution ledger",
        path=ledger_display,
        availability="present" if ledger_path.is_file() else "missing",
        append_only=True,
    )
    graph.add_edge(
        ledger_id,
        "projects",
        state_id,
        status="derived",
        evidence={
            "kind": "ledger_projection",
            "ledger_path": ledger_display,
            "state_path": state_display,
        },
    )


def build_graph(
    root: Path | str,
    manifest_path: Path | str | None = None,
    official_manifest_path: Path | str | None = None,
    official_claims_path: Path | str | None = None,
    readiness_state_path: Path | str | None = None,
    execution_ledger_path: Path | str | None = None,
) -> dict[str, Any]:
    """Build a stable graph payload without writing artifacts."""

    root_path = Path(root).resolve()
    if not root_path.is_dir():
        raise GraphifyError(f"repository root is not a directory: {root_path}")
    if manifest_path is None:
        manifest = root_path / ".harness" / "wiki" / "manifest.json"
    else:
        manifest = Path(manifest_path)
        if not manifest.is_absolute():
            manifest = root_path / manifest
    official_manifest = Path(
        official_manifest_path or "research/official-docs-wiki/manifest.json"
    )
    if not official_manifest.is_absolute():
        official_manifest = root_path / official_manifest
    official_claims = Path(
        official_claims_path or "research/official-docs-wiki/claim-ledger.json"
    )
    if not official_claims.is_absolute():
        official_claims = root_path / official_claims
    readiness_state = Path(readiness_state_path or ".harness/control/state.json")
    if not readiness_state.is_absolute():
        readiness_state = root_path / readiness_state
    execution_ledger = Path(
        execution_ledger_path or ".harness/control/execution_ledger.jsonl"
    )
    if not execution_ledger.is_absolute():
        execution_ledger = root_path / execution_ledger

    graph = GraphBuilder()
    _add_architecture_seed(graph)
    _add_wiki_manifest(graph, root_path, manifest)
    _add_official_research(
        graph, root_path, official_manifest, official_claims
    )
    _add_readiness_state(
        graph, root_path, readiness_state, execution_ledger
    )
    parse_errors = _add_python_graph(graph, root_path)

    nodes = sorted(graph.nodes.values(), key=lambda item: item["id"])
    edges = graph.serialise_edges()
    node_types = Counter(node["type"] for node in nodes)
    edge_statuses = Counter(edge["status"] for edge in edges)
    return {
        "schema_version": SCHEMA_VERSION,
        "generator": "02_graphify_code.py",
        "root": ".",
        "nodes": nodes,
        "edges": edges,
        "diagnostics": {"python_parse_errors": parse_errors},
        "stats": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "node_types": dict(sorted(node_types.items())),
            "edge_statuses": dict(sorted(edge_statuses.items())),
        },
    }


def _query_terms(query: str) -> tuple[str, ...]:
    return tuple(sorted(set(re.findall(r"[\w.:-]+", query.casefold()))))


def _node_score(node: Mapping[str, Any], terms: Sequence[str]) -> int:
    if not terms:
        priorities = {
            "readiness_state": 80,
            "readiness_gate": 70,
            "product_contract": 65,
            "official_claim": 60,
            "official_source": 55,
            "human_approval": 55,
            "evidence_receipt": 50,
            "operational_wiki": 45,
            "architecture_domain": 40,
            "wiki_category": 30,
            "wiki_manifest": 20,
            "wiki_source": 10,
            "python_file": 5,
        }
        return priorities.get(str(node.get("type")), 1)
    label = str(node.get("label", "")).casefold()
    node_id = str(node.get("id", "")).casefold()
    searchable = _canonical_json(node).casefold()
    score = 0
    for term in terms:
        if term == label or term == node_id:
            score += 100
        elif term in label:
            score += 30
        elif term in node_id:
            score += 20
        elif term in searchable:
            score += 5
    return score


def build_context_pack(
    graph: Mapping[str, Any], query: str = "", max_nodes: int = DEFAULT_MAX_NODES
) -> dict[str, Any]:
    """Return a deterministic, query-relevant graph projection bounded by nodes."""

    if max_nodes < 1:
        raise GraphifyError("max_nodes must be at least 1")
    nodes = list(graph.get("nodes", []))
    edges = list(graph.get("edges", []))
    nodes_by_id = {node["id"]: node for node in nodes}
    terms = _query_terms(query)
    ranked = sorted(
        (
            (_node_score(node, terms), node["id"])
            for node in nodes
            if not terms or _node_score(node, terms) > 0
        ),
        key=lambda item: (-item[0], item[1]),
    )
    matched_query = bool(ranked) if terms else True
    if not ranked:
        ranked = sorted(
            ((_node_score(node, ()), node["id"]) for node in nodes),
            key=lambda item: (-item[0], item[1]),
        )

    adjacency: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        adjacency[edge["source"]].add(edge["target"])
        adjacency[edge["target"]].add(edge["source"])

    seed_count = min(len(ranked), max_nodes, 5)
    selected: list[str] = [node_id for _, node_id in ranked[:seed_count]]
    selected_set = set(selected)
    frontier = deque(selected)
    while frontier and len(selected) < max_nodes:
        current = frontier.popleft()
        for neighbour in sorted(adjacency.get(current, ())):
            if neighbour in selected_set or neighbour not in nodes_by_id:
                continue
            selected.append(neighbour)
            selected_set.add(neighbour)
            frontier.append(neighbour)
            if len(selected) >= max_nodes:
                break
    if len(selected) < max_nodes:
        for _, node_id in ranked[seed_count:]:
            if node_id not in selected_set:
                selected.append(node_id)
                selected_set.add(node_id)
            if len(selected) >= max_nodes:
                break

    selected_nodes = sorted(
        (nodes_by_id[node_id] for node_id in selected), key=lambda n: n["id"]
    )
    selected_edges = sorted(
        (
            edge
            for edge in edges
            if edge["source"] in selected_set and edge["target"] in selected_set
        ),
        key=lambda edge: (
            edge["source"],
            edge["relationship"],
            edge["target"],
            edge["status"],
        ),
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "source_generator": graph.get("generator"),
        "query": query,
        "query_terms": list(terms),
        "matched_query": matched_query,
        "max_nodes": max_nodes,
        "available_node_count": len(nodes),
        "selected_node_count": len(selected_nodes),
        "truncated": len(selected_nodes) < len(nodes),
        "nodes": selected_nodes,
        "edges": selected_edges,
    }


def build_role_context_pack(
    graph: Mapping[str, Any], role: str, max_nodes: int = DEFAULT_MAX_NODES
) -> dict[str, Any]:
    """Build a role pack while pinning authority and current-control nodes."""

    if role not in ROLE_CONTEXT_QUERIES:
        raise GraphifyError(f"unsupported context role: {role}")
    base = build_context_pack(graph, ROLE_CONTEXT_QUERIES[role], max_nodes)
    all_nodes = {
        str(node["id"]): node
        for node in graph.get("nodes", [])
        if isinstance(node, Mapping) and node.get("id")
    }
    pinned_types = {
        "official_manifest",
        "official_claim_ledger",
        "product_contract",
        "readiness_state",
    }
    pinned_ids = sorted(
        node_id
        for node_id, node in all_nodes.items()
        if node.get("type") in pinned_types
    )
    selected_ids: list[str] = []
    for node_id in pinned_ids + [str(node["id"]) for node in base["nodes"]]:
        if node_id in all_nodes and node_id not in selected_ids:
            selected_ids.append(node_id)
        if len(selected_ids) >= max_nodes:
            break
    selected_set = set(selected_ids)
    selected_nodes = sorted(
        (all_nodes[node_id] for node_id in selected_ids), key=lambda node: node["id"]
    )
    selected_edges = sorted(
        (
            edge
            for edge in graph.get("edges", [])
            if edge.get("source") in selected_set and edge.get("target") in selected_set
        ),
        key=lambda edge: (
            edge["source"],
            edge["relationship"],
            edge["target"],
            edge["status"],
        ),
    )
    base.update(
        {
            "role": role,
            "pinned_node_ids": pinned_ids,
            "selected_node_count": len(selected_nodes),
            "truncated": len(selected_nodes) < len(all_nodes),
            "nodes": selected_nodes,
            "edges": selected_edges,
        }
    )
    return base


def _dot_escape(value: Any) -> str:
    return str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def render_dot(graph: Mapping[str, Any]) -> str:
    """Render a deterministic Graphviz DOT projection without invoking Graphviz."""

    shapes = {
        "architecture_domain": "hexagon",
        "candidate_evaluation": "diamond",
        "evidence_receipt": "note",
        "execution_ledger": "cylinder",
        "human_approval": "diamond",
        "official_claim": "note",
        "official_claim_ledger": "cylinder",
        "official_manifest": "cylinder",
        "official_source": "note",
        "operational_wiki": "note",
        "product_candidate": "box",
        "product_contract": "component",
        "python_file": "folder",
        "python_module": "component",
        "python_symbol": "box",
        "readiness_gate": "diamond",
        "readiness_state": "octagon",
        "wiki_category": "tab",
        "wiki_manifest": "note",
        "wiki_source": "note",
    }
    lines = [
        "digraph harness_knowledge {",
        '  graph [rankdir="LR"];',
        '  node [fontname="Arial"];',
        '  edge [fontname="Arial"];',
    ]
    for node in sorted(graph.get("nodes", []), key=lambda item: item["id"]):
        shape = shapes.get(node.get("type"), "ellipse")
        label = f"{node.get('label', node['id'])}\\n[{node.get('type', 'node')}]"
        lines.append(
            f'  "{_dot_escape(node["id"])}" '
            f'[label="{_dot_escape(label)}", shape="{shape}"];'
        )
    for edge in sorted(
        graph.get("edges", []),
        key=lambda item: (
            item["source"],
            item["relationship"],
            item["target"],
            item["status"],
        ),
    ):
        status = edge["status"]
        style = (
            "dashed"
            if status == "proposed"
            else "dotted"
            if status == "derived"
            else "solid"
        )
        color = "gray50" if status == "proposed" else "black"
        label = f"{edge['relationship']} [{status}]"
        lines.append(
            f'  "{_dot_escape(edge["source"])}" -> "{_dot_escape(edge["target"])}" '
            f'[label="{_dot_escape(label)}", style="{style}", color="{color}"];'
        )
    lines.append("}")
    return "\n".join(lines) + "\n"


def _atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def _json_text(payload: Mapping[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def _resolve_cli_path(root: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else root / path


def _positive_integer(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    script_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(script_root), help="repository root")
    parser.add_argument(
        "--manifest",
        default=".harness/wiki/manifest.json",
        help="wiki manifest path, relative to --root by default",
    )
    parser.add_argument(
        "--output-json",
        default=".harness/wiki/graph.json",
        help="full graph JSON output",
    )
    parser.add_argument(
        "--output-dot",
        default=".harness/wiki/graph.dot",
        help="Graphviz DOT output",
    )
    parser.add_argument(
        "--context-output",
        default=".harness/wiki/context_pack.json",
        help="bounded context-pack JSON output",
    )
    parser.add_argument(
        "--role-context-dir",
        default=".harness/wiki/contexts",
        help="directory for deterministic role-specific context packs",
    )
    parser.add_argument("--query", default="", help="context-pack relevance query")
    parser.add_argument(
        "--max-nodes",
        type=_positive_integer,
        default=DEFAULT_MAX_NODES,
        help=f"maximum context-pack nodes (default: {DEFAULT_MAX_NODES})",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = Path(args.root).resolve()
    manifest = _resolve_cli_path(root, args.manifest)
    graph_path = _resolve_cli_path(root, args.output_json)
    dot_path = _resolve_cli_path(root, args.output_dot)
    context_path = _resolve_cli_path(root, args.context_output)
    role_context_dir = _resolve_cli_path(root, args.role_context_dir)

    try:
        graph = build_graph(root, manifest)
        context_pack = build_context_pack(graph, args.query, args.max_nodes)
        _atomic_write_text(graph_path, _json_text(graph))
        _atomic_write_text(dot_path, render_dot(graph))
        _atomic_write_text(context_path, _json_text(context_pack))
        for role, query in sorted(ROLE_CONTEXT_QUERIES.items()):
            role_pack = build_role_context_pack(graph, role, args.max_nodes)
            _atomic_write_text(
                role_context_dir / f"{role}.json", _json_text(role_pack)
            )
    except (GraphifyError, OSError) as exc:
        print(f"graphify failed: {exc}", file=sys.stderr)
        return 2

    receipt = {
        "status": "ok",
        "graph": _display_path(graph_path, root),
        "dot": _display_path(dot_path, root),
        "context_pack": _display_path(context_path, root),
        "role_context_dir": _display_path(role_context_dir, root),
        "role_context_count": len(ROLE_CONTEXT_QUERIES),
        "node_count": graph["stats"]["node_count"],
        "edge_count": graph["stats"]["edge_count"],
        "context_node_count": context_pack["selected_node_count"],
    }
    print(json.dumps(receipt, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
