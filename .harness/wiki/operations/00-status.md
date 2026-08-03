# Hackathon Readiness Ledger Projection

> **현재성 경계:** 이 페이지는 `.harness/control/execution_ledger.jsonl`에 기록된 event와 receipt만 반영하는 보조 projection입니다. 저장소의 현재 Mandate Pool 구현·배포 상태를 자동으로 발견하지 않습니다. 현재 상태와 다음 실행은 [실행 런북](../../../research/decision-report/hackathon-environment-codex-runbook.md)을 canonical source로 사용합니다.

이 페이지는 append-only 실행 원장만으로 계산한 gate 상태와 원장 갱신 작업을 보여줍니다. 아래 `다음 작업`은 제품 전체의 다음 행동이 아니라 ledger를 전진시키는 작업입니다.

- Ledger 상태: `DISCOVERY`
- Ledger 오버레이: `PIVOT_REQUIRED`
- Ledger 다음 작업: `apply_pivot`
- Ledger 차단 요소: `candidate_set`
- Projection 생성 시각: `2026-08-03T21:36:59.639926+09:00`

## Ledger gates

| Gate | 책임 | 상태 | 누락 |
|---|---|---|---|
| G0 | Knowledge | passed | - |
| G1 | Candidate | pending | - |

## 운영 페이지

- [행사 계약](01-event-contract.md)
- [후보](02-candidates.md)
- [제품 계약](03-product-contract.md)
- [아키텍처](04-architecture.md)
- [보안·예산](05-security-budget.md)
- [증거](06-evidence.md)
- [제출](07-submission.md)
