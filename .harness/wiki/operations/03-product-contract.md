# Product Contract Ledger Projection

> **현재성 경계:** 이 페이지는 `.harness/control/execution_ledger.jsonl`에 기록된 event와 receipt만 반영하는 보조 projection입니다. 저장소의 현재 Mandate Pool 구현·배포 상태를 자동으로 발견하지 않습니다. 현재 상태와 다음 실행은 [실행 런북](../../../research/decision-report/hackathon-environment-codex-runbook.md)을 canonical source로 사용합니다.

Ledger에 `product_contract` event가 없다. 이는 Mandate Pool 제품 계약이나 구현이 없다는 뜻이 아니다. 현재 제품 계약은 [제품 README](../../../product/mandate-pool/README.md)와 [실행 런북](../../../research/decision-report/hackathon-environment-codex-runbook.md)에서 확인한다. Ledger를 현재화하려면 검증된 contract JSON을 저장소 루트에서 `./harness.sh record --kind product-contract --input <path>`로 기록한다.
