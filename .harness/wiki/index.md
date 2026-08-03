# LLM-Wiki Index

이 Wiki는 해커톤 참고자료 전체를 provenance와 함께 찾기 위한 결정론적 색인입니다. 원문 추출 상태와 현재 제품의 구현·배포 상태를 혼동하지 마세요.

> **현재성 경계:** `operations/`는 append-only readiness ledger에 기록된 이벤트만 반영하는 보조 projection입니다. 현재 Mandate Pool 상태와 다음 실행은 [실행 런북](../../research/decision-report/hackathon-environment-codex-runbook.md)을 canonical source로 사용합니다.

## 먼저 읽기

- [현재 실행 상태와 다음 행동](../../research/decision-report/hackathon-environment-codex-runbook.md) — Mandate Pool 실행의 단일 기준
- [현재 제품 설명과 재현 절차](../../product/mandate-pool/README.md)
- [검증된 행사·기술 주장](../../research/official-docs-wiki/index.md)
- [실행 증거와 한계](../../research/decision-report/evidence/)

## 원문 inventory

- 전체 source file: 9
- `duplicate`: 1
- `enriched`: 3
- `extracted`: 2
- `transcribed`: 3

## Ledger projection

아래 페이지의 `MISSING`·`DISCOVERY`는 ledger에 해당 event나 receipt가 없다는 뜻이며, 저장소의 현재 구현이 없다는 뜻이 아닙니다.

- [Ledger readiness](operations/00-status.md)
- [행사 계약 projection](operations/01-event-contract.md)
- [후보 선택 projection](operations/02-candidates.md)
- [제품 계약 projection](operations/03-product-contract.md)
- [실행 아키텍처 projection](operations/04-architecture.md)
- [보안·예산 receipt projection](operations/05-security-budget.md)
- [증거 ledger projection](operations/06-evidence.md)
- [제출 readiness projection](operations/07-submission.md)

## 주제별 source module

### [Solana Engine](modules/solana-engine.md)

Solana program, RPC, transaction, token, runtime 설계 자료를 찾기 위한 주제 색인입니다.

- [2026-07-21 19-08-24.mp4](raw_references/2026-07-21-19-08-24-044ccd9e02.md) — `transcribed`
- [2026-07-21 19-56-58.mp4](raw_references/2026-07-21-19-56-58-c96826ade9.md) — `transcribed`
- [2026-07-21 20-31-25.mp4](raw_references/2026-07-21-20-31-25-495a3baab6.md) — `transcribed`
- [Google X Solana AI Agentic Hackathon Intro Deck (1).pdf](raw_references/google-x-solana-ai-agentic-hackathon-intro-deck-1-e6d4213a04.md) — `enriched`
- [Google X Solana AI Agentic Hackathon Intro Deck.pdf](raw_references/google-x-solana-ai-agentic-hackathon-intro-deck-27c7a978bb.md) — `duplicate`
- [Kickoff & Tech Session - 솔라나 - Why Solana for Agentic Commerce.pdf](raw_references/kickoff-tech-session-솔라나-why-solana-for-agentic-commerce-9037e55496.md) — `enriched`
- [The Agentic Commerce Stack_ x402 & mpp.pdf](raw_references/the-agentic-commerce-stack-x402-mpp-c29a098ada.md) — `enriched`
- [개발 관련 레퍼런스 SoT-2.txt](raw_references/개발-관련-레퍼런스-sot-2-ff5cd18b8e.md) — `extracted`
- [개발 관련 레퍼런스 SoT.txt](raw_references/개발-관련-레퍼런스-sot-95ab2151bd.md) — `extracted`

### [GCP Infrastructure](modules/gcp-infrastructure.md)

Google Cloud 배포, event, data, managed AI infrastructure 자료를 찾기 위한 주제 색인입니다.

- [2026-07-21 19-56-58.mp4](raw_references/2026-07-21-19-56-58-c96826ade9.md) — `transcribed`
- [Google X Solana AI Agentic Hackathon Intro Deck (1).pdf](raw_references/google-x-solana-ai-agentic-hackathon-intro-deck-1-e6d4213a04.md) — `enriched`
- [Google X Solana AI Agentic Hackathon Intro Deck.pdf](raw_references/google-x-solana-ai-agentic-hackathon-intro-deck-27c7a978bb.md) — `duplicate`
- [Kickoff & Tech Session - 솔라나 - Why Solana for Agentic Commerce.pdf](raw_references/kickoff-tech-session-솔라나-why-solana-for-agentic-commerce-9037e55496.md) — `enriched`
- [The Agentic Commerce Stack_ x402 & mpp.pdf](raw_references/the-agentic-commerce-stack-x402-mpp-c29a098ada.md) — `enriched`
- [개발 관련 레퍼런스 SoT-2.txt](raw_references/개발-관련-레퍼런스-sot-2-ff5cd18b8e.md) — `extracted`
- [개발 관련 레퍼런스 SoT.txt](raw_references/개발-관련-레퍼런스-sot-95ab2151bd.md) — `extracted`

### [AP2/x402 Payment Protocols](modules/payment-protocols.md)

AP2, x402, pay.sh 등 Agentic Commerce 결제 protocol 자료를 찾기 위한 주제 색인입니다.

- [2026-07-21 19-08-24.mp4](raw_references/2026-07-21-19-08-24-044ccd9e02.md) — `transcribed`
- [2026-07-21 19-56-58.mp4](raw_references/2026-07-21-19-56-58-c96826ade9.md) — `transcribed`
- [2026-07-21 20-31-25.mp4](raw_references/2026-07-21-20-31-25-495a3baab6.md) — `transcribed`
- [Google X Solana AI Agentic Hackathon Intro Deck (1).pdf](raw_references/google-x-solana-ai-agentic-hackathon-intro-deck-1-e6d4213a04.md) — `enriched`
- [Google X Solana AI Agentic Hackathon Intro Deck.pdf](raw_references/google-x-solana-ai-agentic-hackathon-intro-deck-27c7a978bb.md) — `duplicate`
- [Kickoff & Tech Session - 솔라나 - Why Solana for Agentic Commerce.pdf](raw_references/kickoff-tech-session-솔라나-why-solana-for-agentic-commerce-9037e55496.md) — `enriched`
- [The Agentic Commerce Stack_ x402 & mpp.pdf](raw_references/the-agentic-commerce-stack-x402-mpp-c29a098ada.md) — `enriched`
- [개발 관련 레퍼런스 SoT-2.txt](raw_references/개발-관련-레퍼런스-sot-2-ff5cd18b8e.md) — `extracted`
- [개발 관련 레퍼런스 SoT.txt](raw_references/개발-관련-레퍼런스-sot-95ab2151bd.md) — `extracted`

### [Google ADK](modules/google-adk.md)

Google ADK, Agents CLI, Gemini, agent 구성 자료를 찾기 위한 주제 색인입니다.

- [Google X Solana AI Agentic Hackathon Intro Deck (1).pdf](raw_references/google-x-solana-ai-agentic-hackathon-intro-deck-1-e6d4213a04.md) — `enriched`
- [Google X Solana AI Agentic Hackathon Intro Deck.pdf](raw_references/google-x-solana-ai-agentic-hackathon-intro-deck-27c7a978bb.md) — `duplicate`
- [The Agentic Commerce Stack_ x402 & mpp.pdf](raw_references/the-agentic-commerce-stack-x402-mpp-c29a098ada.md) — `enriched`
- [개발 관련 레퍼런스 SoT-2.txt](raw_references/개발-관련-레퍼런스-sot-2-ff5cd18b8e.md) — `extracted`
- [개발 관련 레퍼런스 SoT.txt](raw_references/개발-관련-레퍼런스-sot-95ab2151bd.md) — `extracted`
