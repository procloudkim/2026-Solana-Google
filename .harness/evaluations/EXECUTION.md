# Harness execution receipt

Executed locally on 2026-07-23 KST from the repository root. This receipt
records scaffold behavior only; it is not deployment or live-transaction proof.

## Environment

- Python: 3.14.3
- Isolated media Python: 3.12.10 (`.venv-media`)
- Native Windows GNU Make: unavailable
- Verified native entrypoint: `harness.ps1`
- Makefile order: verified with WSL GNU Make 4.3 dry-run
- PDF text adapter: `pypdf` 6.9.2
- Transcription: faster-whisper 1.2.1, CTranslate2 4.6.0, PyAV 16.0.1,
  `small` model on CPU int8
- OCR/QR: PaddleOCR 3.7.0, PaddlePaddle 3.3.1, PyMuPDF 1.28.0,
  OpenCV 4.10.0; Windows oneDNN disabled

## Phase 1 - reference sync

Command: `.\harness.ps1 sync`

- Exit code: 0
- Sources inventoried: 9, totaling 623,368,264 bytes
- Outputs: 9 raw-reference Markdown files, 4 module pages, index, manifest
- Statuses after media enrichment: 2 `extracted`, 3 `enriched`,
  3 `transcribed`, 1 `duplicate`
- Exact duplicate PDFs: 1
- MP4 inventory: 608,006,068 bytes and 6,076.649 seconds of container
  metadata; SHA-matched transcript enrichment attached
- Wiki manifest SHA-256:
  `7144f9b362ddc4d525360424fefb1bd6d02025889905e8d0e8235a34cb1e4d60`

## Media enrichment remediation

Command: `.\harness.ps1 media`

- Exit code: 0
- MP4: 3 files, 6,076.523 decoded seconds, 2,083 timestamped Korean
  segments, 1,084.319 seconds total CPU processing time
- Transcript artifacts per source: UTF-8 JSONL, SRT, Markdown, and metadata
- PDF: 3 unique files / 60 pages OCR-processed; 1 exact duplicate reused
- OCR output: 1,369 confidence-filtered text lines
- QR output: 3 decoded URL payloads on intro-deck page 11
- Recovery: no partial checkpoints remained after completion
- Repeat execution: all 3 MP4s and 3 unique PDFs skipped on matching
  source SHA/settings; duplicate PDF reused
- Dependency check: `uv pip check -p .venv-media` passed for 73 packages
- Enrichment manifest SHA-256:
  `94a2879fd346f301154bd2362601f19aec9aea2191dd0f09adce259682808f0a`

## Phase 2 - graph and context pack

Command: `.\harness.ps1 graph`

- Exit code: 0
- Nodes: 300
- Edges: 402
- Edge evidence states: 383 observed, 2 derived, 8 declared, 9 proposed
- Python parse errors: 0
- Bounded context-pack nodes: 64
- Graph SHA-256: `2d828d91b4978b27b539d46be08eb2ca4121817d0a6d860b0d65f62efe040502`
- Graph refreshed after media/wiki integration so current sources are indexed
- `.venv-media` is excluded from AST discovery; the regression test confirms
  the dependency environment cannot pollute the repository graph

## Phase 3 - one auto-research iteration

Command: `.\harness.ps1 loop`

- Exit code: 0
- Run: `20260722T182107269246Z-afcac91c40`
- Hypothesis: `explicit-agent-contract`
- Generator: deterministic `local-template` (no external agent runtime)
- Benchmarks: Python syntax 1.0; local contract self-test 1.0
- Weighted score: 1.0, previous best 0.0
- Source digest remained unchanged during evaluation
- Decision: promoted
- Promoted allowlisted file: `src/agents/harness_research_agent.py`
- Candidate staging directory removed after receipt creation

## Phase 4 - CLI and verification

- `python -m unittest discover -s tests -p "test_*.py"`: 25 passed
- Ruff checks: passed
- PowerShell wrapper syntax: passed
- POSIX shell wrapper syntax: passed
- Makefile `harness-all` dry-run order: sync -> graph -> loop -> graph refresh -> test
- JSON/JSONL parsing: passed
- Generated Markdown local links: passed
- Graph endpoint, evidence, count, and parse-error invariants: passed
- Re-running sync and graph produced byte-identical manifest, index, and graph

## Proof boundaries and remaining inputs

- The native AST/architecture graph does not prove external Graphify execution
  or vendor-schema conformance.
- The promoted agent is a dependency-free scaffold, not Google ADK, Gemini, or
  `agents-cli` runtime evidence.
- Transcripts are model output, not human-gold verbatim evidence. Speaker
  diarization was not run, and silent/VAD-filtered spans may have no segment.
- OCR output is machine-read and may contain recognition errors. The QR claim
  is limited to the three successfully decoded payloads; no claim is made that
  every visible or damaged code is decodable.
- No Solana RPC, wallet, payment, credential, Google Cloud, or deployment action
  was performed.
