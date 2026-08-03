# Readiness Control Plane

이 디렉터리는 해커톤 참전 상태의 설정·schema·append-only 실행 원장을 소유한다.

- [구현·검증 기록](EXECUTION.md)

## Source-of-truth boundaries

- 행사 규칙: `research/official-docs-wiki/`
- 제품 의도: `product_locked` 및 `product_contract` event
- 구현 사실: 현재 source와 test
- 실행 사실: schema 검증된 runtime receipt
- 현재 상태와 운영 Wiki: execution ledger에서 재생성되는 projection

`state.json`과 `.harness/wiki/operations/`는 직접 수정하지 않는다.

## Approval boundary

로컬 문서 생성, 후보 평가, 테스트, graph rebuild는 자동화할 수 있다. 다음 작업은 사람 승인 없이는 실행하지 않는다.

- credential 접근 또는 credentialed external call
- 지갑 서명과 Devnet/Mainnet transaction
- Cloud Run 배포
- 유료 사용
- 공개 publish와 최종 제출

Mainnet은 기본적으로 비활성화되어 있다.

## Minimal workflow

```powershell
.\harness.ps1 prepare
.\harness.ps1 status --json
.\harness.ps1 ideate --input .harness/control/candidates.input.json
.\harness.ps1 record --kind product-contract --input product-contract.json
.\harness.ps1 record --kind approval --input approval.json
.\harness.ps1 record --kind receipt --input receipt.json
.\harness.ps1 gate
.\harness.ps1 pack
```

후보 input은 승인된 외부 agent가 `ideation-request.json`을 사용해 생성한다. agent 실행이나 API 호출 자체는 이 control plane이 몰래 수행하지 않는다.

## Evidence rule

receipt에는 artifact SHA-256과 비밀이 제거된 external reference만 기록한다. private key, seed phrase, API key, access token, credential payload는 schema 검증에서 거부된다.

Gemini, Solana Devnet, GCP runtime receipt는 원장에 먼저 기록된 유효한 `approval_id`를 참조해야 gate 증거로 계산된다.
