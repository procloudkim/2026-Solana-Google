# Mandate Pool 검증·운영 런북

> 제출 후 저장소·공개 데모·고정 증거를 안전하게 점검하는 운영 문서입니다. 이 런북은 추가 결제나 재배포를 지시하지 않습니다.

- 대상: Google Cloud × Solana AI Agentic Hackathon 출품작 [Mandate Pool](../../README.md)
- 기준일: 2026-08-04 KST
- 배포 source: `2ac7eac17ea803b4537b630234ac6507523e5325`
- Evidence release: `submission-v2`
- 온체인 범위: Solana Devnet 테스트 토큰만 사용; Mainnet·실제 자산 없음

## 현재 상태

| 영역 | 현재 사실 | 운영 판단 |
|---|---|---|
| GitHub | 공개 저장소 `procloudkim/2026-Solana-Google`; `main`은 문서 개선을 계속할 수 있음 | 배포 source와 문서 HEAD를 혼동하지 않음 |
| 영상 | [YouTube](https://youtu.be/of3GMQq8Qv8)와 [고정 GCS MP4](https://storage.googleapis.com/project-682bea5f-ac81-4a36-8a1-mandate-pool-video/mandate-pool-demo.mp4?generation=1785769358677446) 링크 접근 확인 | 정상 결제를 영상 때문에 다시 실행하지 않음 |
| 공개 데모 | [Cloud Run fixture](https://mandate-pool-judge-x7id33dnyq-du.a.run.app) 공개; `mode=fixture`, `onChain=false` | 심사용 조작 환경이며 온체인 증거로 사용하지 않음 |
| 비공개 live | 2026-08-03 deployment receipt가 revision `mandate-pool-live-00005-4tb`, readiness와 정상·거부 실행을 기록 | IAM을 유지하고 심사 재현용으로 공개하지 않음 |
| 정상 Devnet | `FULFILLED`; signature `2JMW…2ZAW`; slot `480936920`; exact delta 검증 | 추가 transaction 없이 저장된 receipt를 제시 |
| 거부 경로 | `NO_BUY`; settlement·signature 없음; entitlement 0; 잔액 변화 0 | 저장된 receipt를 제시 |
| 제출 폼 | 사용자가 폼 수정 불가와 Cloud Run URL 미기재를 보고함 | 저장소 첫 화면에 공개 데모 링크를 보완; 폼 내용을 추정하지 않음 |

현재 증거의 정확한 식별자는 [Submission manifest](../../submission/manifest.md)가 관리합니다. 이 런북은 가변 운영 상태와 점검 절차만 관리합니다.

## 지금 해야 할 일

평상시에는 다음 읽기 전용 점검만 수행합니다.

1. 공개 링크가 익명 브라우저에서 열리는지 확인합니다.
2. 현재 소스의 typecheck·test·build와 루트 하네스 test를 실행합니다.
3. 변경 diff에 비밀정보와 오래된 제출 상태가 없는지 확인합니다.
4. 문서만 바뀌었다면 기존 transaction·revision을 새 실행처럼 표현하지 않습니다.
5. 제품 코드·runtime·증거가 바뀌면 새 release를 설계하고 사람 승인을 받습니다.

**하지 않는 일:** 기존 증거를 새로 보이게 만들기 위한 결제 반복, `submission-v2` tag 이동, 비공개 live의 임의 공개, Mainnet 전환, secret payload 출력.

## 문서별 단일 책임

| 문서 | 책임 |
|---|---|
| [루트 README](../../README.md) | 심사자용 제품 설명과 가장 짧은 접근 경로 |
| [제품 README](../../product/mandate-pool/README.md) | 구현·실행·무결성 계약 |
| [Submission manifest](../../submission/manifest.md) | 고정 release와 evidence 식별자 |
| 이 런북 | 현재 운영 상태, 읽기 전용 점검, 변경 시 중단 조건 |
| [Official Docs Wiki](../official-docs-wiki/README.md) | 행사·기술 외부 사실과 1차 출처 |

한 사실을 여러 문서에 복사해야 할 때는 manifest의 고정 식별자를 링크하고, 가변 상태는 이 런북에서만 갱신합니다.

## 1. 공개 접근 점검

다음 명령은 주문을 만들거나 결제를 실행하지 않습니다.

```bash
curl -L --fail --silent --show-error \
  https://mandate-pool-judge-x7id33dnyq-du.a.run.app/api/v1/runtime

curl -L --fail --silent --show-error \
  https://mandate-pool-judge-x7id33dnyq-du.a.run.app/readyz

curl -L --fail --silent --show-error --output /dev/null \
  https://youtu.be/of3GMQq8Qv8

curl -L --fail --silent --show-error --output /dev/null \
  'https://explorer.solana.com/tx/2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW?cluster=devnet'
```

기대 결과:

- runtime: `{"mode":"fixture","cluster":"fixture","onChain":false,"label":"FIXTURE · NOT ON-CHAIN"}`
- readiness: 네 check가 모두 `true`; fixture adapter의 준비 상태이며 live 주문 증거는 아님
- YouTube·Explorer: HTTP 성공

공개 fixture의 데모 키는 `judge-fixture-key-v1`입니다. 이 값은 공개 시연용 access key이며 runtime credential이 아닙니다.

## 2. 현재 소스 검증

### 제품

```bash
cd product/mandate-pool
npm ci --omit=peer
npm run typecheck
npm test
npm run build
```

현재 기준은 Vitest `11` files, `96/96` tests 통과입니다. 테스트 수가 바뀌는 것은 실패가 아니지만, 실패 test가 하나라도 있으면 문서 변경을 포함해 push하지 않습니다.

### 루트 하네스

```bash
cd ../..
python3 -m unittest discover -s tests -p 'test_*.py'
git diff --check
git status --short --branch
```

루트 하네스의 고정 release 기준은 `37/37`입니다. 현재 tree의 실제 결과를 우선합니다.

### 문서 상태 검색

```bash
rg -n --glob '*.md' --glob '!**/hackathon-environment-codex-runbook.md' \
  'SUBMISSION_ASSETS_READY|최종 제출 폼 전송은 아직|Devnet 거래.*남은|localnet.*미완료' \
  README.md product submission research

rg -n '\{\{[A-Z0-9_]+\}\}' submission
```

첫 명령은 historical evidence 문서의 당시 관측을 제외하고 현재형 문서에서 출력이 없어야 합니다. 두 번째 명령은 placeholder가 없어야 합니다.

## 3. 비밀정보 경계

저장소에 둘 수 있는 값:

- GCP project·region·service·revision 이름
- Secret Manager **리소스 이름**
- Solana Devnet owner·ATA·mint·transaction signature
- redacted hash·order ID·slot·잔액 변화

저장소와 출력에 둘 수 없는 값:

- Solana private key 또는 64-byte keypair payload
- Google service-account JSON, OAuth·ID token, API key
- `.env`, PEM, seed phrase, entitlement token
- Secret Manager payload

검사기는 오탐과 미탐이 있으므로 패턴 검색만으로 “비밀정보가 없다”고 단정하지 않습니다. staged diff를 사람이 함께 읽습니다.

```bash
git status --short
git diff --cached --stat
git diff --cached -- . ':!package-lock.json'
```

실제 credential을 발견하면 push 전에 해당 값을 폐기·회전하고, Git history 노출 범위를 판단합니다. 단순 삭제 commit만으로 해결됐다고 보지 않습니다.

## 4. 고정 인프라 계약

### 공개 설정

```text
GCP_PROJECT_ID=project-682bea5f-ac81-4a36-8a1
GCP_REGION=asia-northeast3
PUBLIC_FIXTURE_SERVICE=mandate-pool-judge
PRIVATE_LIVE_SERVICE=mandate-pool-live
RUNTIME_SERVICE_ACCOUNT=mandate-pool-runtime@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com
SOLANA_CLUSTER=devnet
SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

### Secret Manager 참조

```text
mandate-pool-demo-key:1       -> DEMO_KEY
mandate-pool-entitlement:1    -> ENTITLEMENT_SECRET
mandate-pool-fee-sponsor:1    -> SPONSOR_SECRET_KEY
mandate-pool-buyer-a:1        -> BUYER_A_SECRET_KEY
mandate-pool-buyer-b:1        -> BUYER_B_SECRET_KEY
mandate-pool-buyer-c:1        -> BUYER_C_SECRET_KEY
```

위 목록은 이름과 version 계약만 기록합니다. payload를 shell 변수·문서·로그로 복사하지 않습니다. Runtime은 user-managed service account의 ADC를 사용하며 `GOOGLE_APPLICATION_CREDENTIALS` JSON 파일을 배포하지 않습니다.

## 5. 증거 등급

| 등급 | 자료 | 주장할 수 있는 것 | 주장할 수 없는 것 |
|---|---|---|---|
| E0 설계 | PRD, diagram, contract | 의도·수용 기준 | 구현 성공 |
| E1 로컬 | typecheck, tests, fixture, localnet | 코드 계약·로컬 정상/거부 흐름 | GCP·Devnet 주문 성공 |
| E2 readiness | 인증된 live `/readyz`, deployment metadata | Vertex·Firestore·Solana 의존성 접근 | 제품 결제 성공 |
| E3 Devnet | finalized signature, decoded 원문, 잔액 변화 | 테스트 네트워크 실행 | Mainnet·실제 가치 이전 |
| E4 심사 묶음 | Repo, 덱, 영상, 공개 fixture | 심사자가 접근 가능한 설명·재현 경로 | 상용 운영 안정성 |

Fixture UI, localnet signature, readiness, Devnet transaction을 서로 대체하지 않습니다.

## 6. Localnet을 다시 실행해야 할 때

문서 검수만을 위해 localnet을 반복하지 않습니다. Solana transaction builder·verifier·정책이 바뀐 경우에만 일회용 validator와 새 임시 출력 경로로 실행합니다.

```bash
cd product/mandate-pool
MANDATE_SMOKE_DIR="$(mktemp -d)"
SOLANA_TEST_VALIDATOR_BIN=/absolute/path/to/solana-test-validator \
  npm run localnet:smoke -- \
  --output="$MANDATE_SMOKE_DIR/localnet-smoke.json"
```

기존 `submission/evidence/localnet-smoke-2026-08-03.json`은 덮어쓰지 않습니다. 새 결과를 release evidence로 승격하려면 validator version·local genesis·정상 signature·decoded instruction·전후 잔액·거부 no-transaction 판정을 검토합니다.

## 7. 제품·배포 변경 시 중단 조건

다음 중 하나가 바뀌면 기존 `submission-v2`를 현재 실행 증거로 재사용하지 않습니다.

- Agent prompt·model·catalog·정책·atomic split
- signer set·source ATA·merchant·mint·transaction instruction
- state machine·idempotency·reconciliation·finalized verifier
- Cloud Run image digest·runtime identity·Secret Manager binding
- 정상·거부 order ID, signature, token delta

이 경우 필요한 순서는 `로컬 test → localnet → private live readiness → 사람의 별도 Devnet 실행 승인 → 정상·거부 receipt → 새 evidence tag`입니다. 기존 tag는 이동하지 않습니다.

다음 상황에서는 자동 재결제를 금지합니다.

- send 응답 유실
- blockhash 만료와 기존 결과 불명확
- message·instruction·잔액 불일치
- finality 확인 실패

새 transaction을 만들지 말고 `RECONCILIATION_REQUIRED`에서 기존 signature와 저장된 signed bytes부터 조사합니다.

## 8. Git 변경·배포 원칙

문서 변경은 현재 사실을 교체하고 중복 progress note를 추가하지 않습니다. 검증 후 다음 순서로 반영합니다.

```bash
git status --short
git diff --check
git diff --stat
git add <검증한 파일>
git diff --cached --stat
git commit -m "Polish judge-facing technical documentation"
git push origin main
git status --short --branch
```

제품·배포 변경은 위 명령만으로 충분하지 않습니다. 새 runtime evidence와 사람의 실행 승인이 필요합니다. 비공개 live 공개 전환, Mainnet, 실제 자산, 추가 Devnet 결제, 제출 폼 변경은 자동화 범위가 아닙니다.

## 연결된 실행 증거

- [Devnet 지갑·ATA·자금](evidence/devnet-wallet-provisioning-2026-08-03.md)
- [GCP private fixture](evidence/gcp-private-fixture-deploy-2026-08-03.md)
- [GCP private live readiness](evidence/gcp-private-live-deploy-2026-08-03.md)
- [의존성 보안](evidence/dependency-security-audit-2026-08-03.md)
- [운영진 Devnet 안내](evidence/organizer-devnet-guidance-2026-08-03.md)
- [Submission evidence](../../submission/evidence/)
