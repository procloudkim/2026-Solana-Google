# Candidate Selection Ledger Projection

> **현재성 경계:** 이 페이지는 `.harness/control/execution_ledger.jsonl`에 기록된 event와 receipt만 반영하는 보조 projection입니다. 저장소의 현재 Mandate Pool 구현·배포 상태를 자동으로 발견하지 않습니다. 현재 상태와 다음 실행은 [실행 런북](../../../research/decision-report/hackathon-environment-codex-runbook.md)을 canonical source로 사용합니다.

이 페이지의 내부 점수는 공식 심사 점수가 아니며 ledger에 기록된 세 후보의 비교에만 사용합니다.

Ledger에 `candidates_evaluated` event가 없다. 이는 현재 제품 후보가 없다는 뜻이 아니다. 현재 선택된 Mandate Pool의 맥락은 [제품 README](../../../product/mandate-pool/README.md)와 [실행 런북](../../../research/decision-report/hackathon-environment-codex-runbook.md)에서 확인한다. Ledger도 현재화하려면 검증된 후보 JSON을 준비한 뒤 저장소 루트에서 `./harness.sh ideate --input <path>`를 실행한다.
