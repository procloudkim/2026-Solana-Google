# Execution Architecture Ledger Projection

> **현재성 경계:** 이 페이지는 `.harness/control/execution_ledger.jsonl`에 기록된 event와 receipt만 반영하는 보조 projection입니다. 저장소의 현재 Mandate Pool 구현·배포 상태를 자동으로 발견하지 않습니다. 현재 상태와 다음 실행은 [실행 런북](../../../research/decision-report/hackathon-environment-codex-runbook.md)을 canonical source로 사용합니다.

Ledger에 product contract가 없어 실행 경로를 projection할 수 없다. 현재 구현 아키텍처는 [제품 README](../../../product/mandate-pool/README.md)를 확인한다.

## 목표 proof chain

아래 순서는 제출 증거가 연결돼야 하는 acceptance target이며, 각 단계의 성공 receipt가 이미 있다는 뜻이 아닙니다.

```text
Gemini decision trace
  -> bounded authorization
  -> Solana Devnet transaction signature
  -> network confirmation
  -> GCP runtime log
```
