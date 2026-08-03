# Readiness Control Plane 가이드

> 해커톤 준비 과정의 결정·승인·증거를 append-only event로 기록하고, 증거가 없는 상태 승격을 막는 보조 하네스

이 문서는 control plane을 유지하거나 다시 실행할 개발자를 위한 안내입니다. **현재 Mandate Pool 제출 상태의 단일 기준은 [해커톤 실행 런북](../../research/decision-report/hackathon-environment-codex-runbook.md)**입니다. 이 디렉터리의 `state.json`과 `.harness/wiki/operations/`는 execution ledger만 재생한 projection이므로, 이후 수동으로 진행된 제품 구현·GCP 배포를 자동으로 알고 있지 않습니다.

## IDEA: 진행률이 아니라 증거가 상태를 움직인다

해커톤에서는 “구현했다”는 서술과 실제 runtime receipt가 쉽게 섞입니다. 이 control plane은 제품 결정, 사람 승인, redacted runtime evidence를 schema로 분리하고, 필요한 증거가 없으면 gate를 통과시키지 않습니다.

이 도구가 하는 일:

- append-only event를 검증하고 현재 readiness projection을 재생성합니다.
- 후보·제품 계약·승인·runtime receipt 사이의 참조 무결성을 검사합니다.
- 역할별 bounded context와 submission pack을 생성합니다.

이 도구가 하지 않는 일:

- 외부 agent 또는 API를 몰래 호출하지 않습니다.
- credential을 읽거나 지갑을 서명하지 않습니다.
- Cloud Run을 배포하거나 제출 버튼을 누르지 않습니다.
- ledger 밖에서 진행된 작업을 실제보다 낮거나 높게 추론하지 않습니다.

## Source of truth 경계

| 질문 | 기준 자료 |
|---|---|
| 행사의 공개 규칙은 무엇인가? | `research/official-docs-wiki/` |
| 현재 선택한 제품은 무엇인가? | `product/mandate-pool/README.md`와 실행 런북 |
| 코드가 실제로 무엇을 하는가? | 현재 source와 test |
| 외부에서 무엇을 실행했는가? | schema를 통과한 redacted receipt와 `research/decision-report/evidence/` |
| control plane ledger의 상태는 무엇인가? | `execution_ledger.jsonl`에서 재생성한 `state.json` |

`state.json`과 `.harness/wiki/operations/`는 직접 수정하지 않습니다. projection이 현실과 다르면 source event를 추가하거나, 현재 운영 기준이 다른 문서임을 명시합니다. 증거 없이 state만 고치지 않습니다.

## 승인 경계

로컬 문서 생성, 후보 평가, test, graph rebuild는 자동화할 수 있습니다. 다음 작업은 사람의 명시적 승인 없이 실행하지 않습니다.

- credential 접근 또는 credentialed external call
- Devnet/Mainnet 지갑 서명과 transaction
- Cloud Run 배포 또는 public invoker 변경
- 유료 사용
- GitHub 공개 전환, publish, 최종 제출

Mainnet은 기본적으로 비활성화되어 있습니다.

## 최소 실행 흐름

저장소 루트의 PowerShell 기준입니다. POSIX에서는 `./harness.sh <command>`를 사용합니다.

```powershell
./harness.ps1 prepare
./harness.ps1 status --json
./harness.ps1 ideate --input .harness/control/candidates.input.json
./harness.ps1 record --kind product-contract --input product-contract.json
./harness.ps1 record --kind approval --input approval.json
./harness.ps1 record --kind receipt --input receipt.json
./harness.ps1 gate
./harness.ps1 pack
```

실행 순서와 성공 기준:

1. `prepare`가 공식 fact와 초기 gate를 idempotent하게 준비합니다.
2. 승인된 외부 agent가 `ideation-request.json`을 입력으로 정확히 세 후보를 만듭니다.
3. `ideate`가 schema와 hard gate를 통과한 후보만 비교합니다. 내부 점수는 공식 심사 점수가 아닙니다.
4. 사람이 제품을 잠근 뒤 product contract event를 기록합니다.
5. 외부 실행 전 approval event, 실행 후 redacted receipt를 기록합니다.
6. `gate`가 누락된 증거를 보고하고, `pack`은 `HARDENED` 이전에는 제출 묶음 생성을 거부합니다.

현재 ledger는 과거 discovery workflow를 재현하는 보존 자료입니다. 이미 구현된 Mandate Pool을 이 ledger에 소급해 넣으려면 기존 receipt와 현재 제품 계약을 별도 검토해야 하며, 문서 윤문 과정에서 임의 event를 만들지 않습니다.

## Evidence 규칙

Receipt에는 artifact SHA-256, 관찰 시각, 환경, 검증 방법, 비밀이 제거된 external reference, 한계를 기록합니다. private key, seed phrase, API key, access token, credential payload는 schema와 별도 secret scan에서 거부해야 합니다.

Gemini, Solana Devnet, GCP runtime receipt는 원장에 먼저 기록된 유효한 `approval_id`를 참조할 때만 gate 증거로 계산됩니다. Fixture 결과는 local integration 증거일 뿐 Devnet receipt로 승격하지 않습니다.

과거 구현·검증 기록은 [EXECUTION.md](EXECUTION.md)에서 확인합니다.
