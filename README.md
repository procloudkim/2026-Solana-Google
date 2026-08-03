# Solana x Google Cloud Agentic Harness

This repository is a local, evidence-producing harness for the 2026 Solana x
Google Cloud Agentic Hackathon. The harness turns the material in
`참고레퍼런스/` into a bounded wiki, builds a structural code/architecture
graph, and runs one scored local research iteration. Generated application
code lives under `src/`; orchestration and evidence live under `.harness/`.
The readiness control plane additionally reconciles official requirements,
product decisions, runtime receipts, gates, and submission artifacts.

## Prerequisites

- Python 3.11 or newer
- GNU Make for the `make` entrypoints (optional on Windows)

Install the one optional document-extraction dependency before the first sync:

```text
python -m pip install -r requirements-harness.txt
```

For local MP4 transcription plus PDF OCR/QR extraction, create the isolated
Python 3.12 environment once (the ambient harness Python remains unchanged):

```powershell
uv venv .venv-media --python 3.12
uv pip install -p .venv-media -r requirements-media.txt
.\harness.ps1 media
```

The media command writes SHA-matched derived evidence under
`.harness/enrichment/`, then refreshes the wiki and graph. Interrupted files
resume from JSONL checkpoints; completed files are skipped unless their source
hash or adapter settings change.

## Three harness commands

Run these commands from the repository root, in order:

```text
make harness-sync
make harness-graph
make harness-loop
```

On Windows without GNU Make, the exact PowerShell equivalents are:

```powershell
.\harness.ps1 sync
.\harness.ps1 graph
.\harness.ps1 loop
```

Use `.\harness.ps1 media` (or `make harness-media`) for the intentionally
separate, CPU-intensive media pass.

On POSIX shells, `./harness.sh sync`, `./harness.sh graph`, and
`./harness.sh loop` provide the same entrypoints. Use `make test` (or
`.\harness.ps1 test`) for focused tests and `make all` (or
`.\harness.ps1 all`) for sync, graph, one loop iteration, and tests.

## Hackathon readiness commands

Prepare the source-governed execution Wiki and inspect the single next action:

```powershell
.\harness.ps1 prepare
.\harness.ps1 status --json
```

Candidate generation is an explicit, credential-gated handoff. Give an
approved external agent `.harness/control/ideation-request.json`, save its
three-candidate JSON locally, then evaluate it deterministically:

```powershell
.\harness.ps1 ideate --input .harness/control/candidates.input.json
```

Record a locked product contract or redacted evidence receipt without
executing the external action:

```powershell
.\harness.ps1 record --kind product-contract --input product-contract.json
.\harness.ps1 record --kind approval --input approval.json
.\harness.ps1 record --kind receipt --input receipt.json
.\harness.ps1 gate
.\harness.ps1 pack
```

Templates and the approval policy are documented in
`.harness/control/README.md`; concrete implementation receipts are in
`.harness/control/EXECUTION.md`. The append-only execution ledger owns history;
`state.json` and `.harness/wiki/operations/` are derived projections and must
not be edited by hand.

For the deadline-day account, GCP, Solana Devnet, Codex automation, and
submission-evidence checklist, see the
[hackathon environment and Codex runbook](research/decision-report/hackathon-environment-codex-runbook.md).

## Architecture

```text
.harness/
  workflows/       deterministic ingestion, graph, research, and generation
  enrichment/      SHA-matched transcripts, OCR, QR payloads, and provenance
  control/          readiness policy, schemas, append-only events, state
  wiki/             derived Markdown, graph, role contexts, readiness views
  evaluations/      research run ledgers, candidates, and scorecards
  submission/       generated submission drafts and evidence index
research/
  agentic-commerce-50-ideas.md 50 product hypotheses and hard-gate flow
  decision-report/    seven-candidate strategic decision report and evidence
  official-docs-wiki/ current official sources and claim-level verdicts
src/
  agents/           generated agent templates
  protocols/        typed, non-executing payment contracts
  cloud/            typed, non-executing cloud event contracts
참고레퍼런스/        immutable local source material
```

`harness-sync` extracts supported text references into
`.harness/wiki/raw_references/`, records provenance in `manifest.json`, and
rebuilds `index.md` plus the four concept modules. PDF text extraction uses
`pypdf`; when it is unavailable, the manifest explicitly records the reduced
metadata-only result rather than pretending that extraction succeeded.
When a completed media enrichment artifact has the same SHA-256 as its source,
the sync attaches it and records the adapter/settings provenance.

`harness-graph` rebuilds `.harness/wiki/graph.json`, `graph.dot`, and the
bounded `context_pack.json` from native Python AST facts, local and official
wiki manifests, readiness gates, product contracts, and evidence receipts.
It also emits role-specific packs for ideation, architecture, implementation,
security, demo, and submission. `harness-loop` performs exactly one bounded
hypothesis, candidate-generation, test, scoring, and keep/reject iteration by
default, then refreshes the graph after any promotion.

The readiness state machine is:

```text
DISCOVERY -> CANDIDATES_READY -> PRODUCT_LOCKED -> CONTRACT_READY
-> LOCAL_SLICE_PASSED -> DEVNET_PROVEN -> HARDENED
-> SUBMISSION_READY -> SUBMITTED
```

Sandbox evidence can satisfy the local integration gate but never the Devnet
runtime gate. The runtime gate requires separate Gemini, Solana Devnet, and GCP
runtime receipts. If that gate remains incomplete after 2026-07-30 23:59 KST,
the control plane reports `PIVOT_REQUIRED`.

## Verification and proof boundaries

- The graph output is native generic graph/context JSON plus DOT in a
  Graphify-style workflow. No external Graphify schema compatibility is
  claimed, and a successful graph run does not prove that an external
  Graphify runtime was invoked.
- The default agent builder is a deterministic local template generator. Its
  output is not proof of Gemini, Google ADK, or `agents-cli` runtime execution.
  Any external generator path requires explicit opt-in and separate runtime
  evidence. Its argv is intentionally unconfigured until matched to a current
  installed `agents-cli` contract.
- Without `harness-media`, MP4 inputs remain metadata-only and PDFs use their
  embedded text layer. A successful media pass adds faster-whisper transcripts
  and PaddleOCR/OpenCV QR evidence; it does not prove verbatim transcription,
  speaker diarization, or perfect OCR.
- Candidate directories provide cooperative write isolation, not an operating
  system security sandbox. External generators must be treated as trusted code.
- `src/protocols/payment.py` and `src/cloud/events.py` define serializable
  contracts and dispatch plans only. They perform no payment, RPC, HTTP, cloud,
  credential, or other network action.
- Passing local tests proves deterministic scaffold behavior only. It does not
  prove deployed Cloud Run/Eventarc infrastructure, live Solana transactions,
  or end-to-end ADK behavior.
- The readiness workflow records and validates already-produced receipts. It
  never reads secrets, signs transactions, deploys, spends, publishes, or
  submits. Those actions require explicit human approval and separate evidence.
- Candidate scores are internal prioritization heuristics, not official judging
  scores. Ambiguous results are blocked rather than auto-promoted.

The original material under `참고레퍼런스/` remains the source evidence. Wiki,
graph, and evaluation outputs are derived artifacts and should retain their
manifest/run provenance when used in a claim.

### Repository evidence policy

Reference PDFs and text files, derived transcripts/OCR, claim ledgers, and
redacted runtime receipts are versioned. The three raw MP4 recordings remain
local because each exceeds GitHub's regular 100 MiB file limit; their
SHA-matched derived evidence remains under `.harness/enrichment/`. The duplicate
`Google X Solana AI Agentic Hackathon Intro Deck (1).pdf` is also local-only;
the byte-identical canonical copy without ` (1)` is versioned. Credentials,
wallet private keys, `.env` files, dependency directories, and build outputs
must never be committed.

## Implemented product prototype

The selected prototype now lives in [`product/mandate-pool/`](product/mandate-pool/README.md).
It implements a three-buyer HITL mandate flow, a deterministic payment policy,
one atomic Solana transaction, Firestore-backed workflow state, Google ADK
normalization, and a Cloud Run-ready demo. Its default fixture is explicitly
not on-chain; the product README documents the separate Devnet proof boundary.
