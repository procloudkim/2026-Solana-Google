# Security and Budget Ledger Projection

> **현재성 경계:** 이 페이지는 `.harness/control/execution_ledger.jsonl`에 기록된 event와 receipt만 반영하는 보조 projection입니다. 저장소의 현재 Mandate Pool 구현·배포 상태를 자동으로 발견하지 않습니다. 현재 상태와 다음 실행은 [실행 런북](../../../research/decision-report/hackathon-environment-codex-runbook.md)을 canonical source로 사용합니다.

- 기본 네트워크: `solana-devnet`
- Mainnet 활성화: `False`
- 비밀값은 Wiki·ledger·receipt에 저장하지 않는다.
- credential, 지갑 서명, 배포, 유료 호출, 공개·제출은 사람 승인 대상이다.

## Ledger hardening receipts

`MISSING`은 해당 pass receipt가 ledger에 없다는 뜻이며, 제품 테스트가 존재하지 않거나 실패했다는 뜻이 아닙니다. 현재 검증 결과는 실행 런북과 evidence 문서를 확인하세요.

| 검증 | 상태 |
|---|---|
| idempotency_test | MISSING |
| budget_cap_test | MISSING |
| approval_policy_test | MISSING |
| prompt_injection_test | MISSING |
| retry_timeout_test | MISSING |

## Human approvals

기록된 위험행위 승인이 없다.
