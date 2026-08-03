# 해커톤 참가 환경 및 Codex 실행 런북

- 기준일: 2026-08-03 KST
- 대상 행사: Google Cloud × Solana AI Agentic Hackathon
- 대상 제품: `product/mandate-pool`
- 목적: 계정 준비부터 Devnet 증거 확보와 최종 제출까지의 실행 조건을 하나의 체크리스트로 고정한다.
- 사실 경계: 공개 행사 페이지는 2026-08-03 01:33 KST에 다시 확인했다. 로그인 뒤에만 보이는 Google Form의 세부 필드는 참가자가 당일 직접 확인해야 한다.

현재 고정된 비밀이 아닌 실행값:

```text
GCP_PROJECT_ID=project-682bea5f-ac81-4a36-8a1
```

## 결론

제출 전 닫아야 할 병목은 세 가지다.

1. Google 계정으로 공식 폼에 로그인해 실제 제출 필드를 확인한다.
2. 비공개 GitHub 저장소를 공개하거나 심사위원 접근 방법을 확정한다.
3. 명시적 HITL 뒤 실제 Devnet 정상 결제와 거부 경로를 실행해 Gemini/ADK trace와 receipt를 제출 증거로 남긴다.

Codex CLI는 저장소 초기화, 도구 설치, GCP 구성, 지갑·ATA 준비, 테스트, 배포, 증거 수집을 승인 기반으로 자동화할 수 있다. 계정 생성, 결제수단·약관 동의, OAuth/MFA, CAPTCHA, 공개 배포 승인, 최종 제출 확인은 사람이 담당한다.

## 공식 참가 계약

현재 [공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)에서 확인되는 계약은 다음과 같다.

| 항목 | 확정 내용 | 적용 기준 |
|---|---|---|
| 제출 마감 | 2026-08-03 23:59 KST | 마감 전에 제출 완료 화면과 시각을 보존한다. |
| 팀 | 개인 또는 최대 4명 | 4명을 넘지 않는다. |
| 제품·발표 언어 | 제품은 한국어 또는 영어, 발표는 한국어 | 소개서와 영상은 한국어 중심으로 만든다. |
| 필수 제출물 | 프로덕트 소개서, GitHub Repo, 데모영상 | 세 URL 또는 파일을 최소 제출 묶음으로 관리한다. |
| 라이브 URL | 권장 | Cloud Run URL을 제출해 재현성을 높인다. |
| 실행 네트워크 | localnet/testnet/devnet live | Mainnet을 필수 범위로 추가하지 않는다. |
| 실행 증거 | Agent가 실제 거래·결제를 발생시키고 로그·이력으로 확인 가능 | Devnet signature, Explorer, Agent decision trace를 남긴다. |

[공식 참가하기 폼](https://forms.gle/ay9DyaWhR4JHMjta7)은 비로그인 요청을 Google 로그인으로 보낸다. 따라서 Google 계정은 실제 폼 접근에 필요하다. 다만 개인 Gmail만 허용되는지, 영상이 정확히 3분 이내인지, 저장소가 반드시 공개여야 하는지는 현재 공개 페이지에서 확정되지 않았다.

안전한 제출 기본값은 다음과 같다.

- 영상은 3분 이내로 편집한다.
- GitHub 저장소는 심사위원이 로그인 장벽 없이 읽을 수 있게 한다.
- 소개서에는 문제, 사용자, Agent 행동, HITL 경계, 아키텍처, 실제 거래 증거를 넣는다.
- 제출 폼에 로그인한 뒤 보이는 필드가 이 문서와 다르면 폼을 우선한다.

### 운영진 채널의 테스트·Devnet 안내

2026-08-03 사용자가 전달한 [운영진 채널 공지](evidence/organizer-devnet-guidance-2026-08-03.md)는 pay.sh 또는 Solana를 사용할 때 다음 순서를 권장한다.

```text
pay.sh sandbox 또는 Solana localnet에서 먼저 테스트
  -> 실제 동작은 Devnet에서 확인
  -> Faucet 한도 때문에 Devnet SOL이 더 필요하면 운영진에게 DM하고 채널에 언급
```

이 공지는 사용자가 전달한 운영진 채널 메시지이며 공개 행사 페이지의 하드 규칙으로 승격하지 않는다. 다만 현재 제품의 실행 순서에는 그대로 적용한다.

- 로컬 단계는 `APP_MODE=fixture`, 단위·통합 테스트, 거래 build/verify 테스트로 수행한다.
- 현재 Live 구성은 Devnet genesis와 Circle Devnet USDC에 잠겨 있으므로 마감 전에 local validator 지원을 새로 추가하지 않는다.
- 공식 실행 증거는 반드시 Devnet finalized transaction으로 만든다.
- Faucet을 반복 호출해 한도를 소모하지 않는다. 필요한 양을 먼저 계산하고 부족할 때 운영진의 별도 Devnet SOL 지원을 요청한다.
- 운영진 메시지의 local validator 의미는 Solana 공식 실행 파일인 `solana-test-validator` 기준으로 해석한다.
- pay.sh sandbox는 현재 제품 범위가 아니다. fixture 성공을 pay.sh 또는 온체인 결제 증거로 주장하지 않는다.

## 현재 환경 감사

| 구성요소 | 현재 상태 | 판정·조치 |
|---|---|---|
| OS | WSL2, Ubuntu 24.04.4 LTS | 준비됨 |
| Node.js / npm | Node 22.20.0, npm 10.9.3 | 제품의 Node 22 이상 조건 충족 |
| Codex CLI | 0.146.0, ChatGPT 로그인 완료 | 준비됨 |
| GitHub CLI | `procloudkim` 로그인과 `repo` 권한 확인 | private 원격 `procloudkim/2026-Solana-Google` 연결 완료; 심사 접근성 결정 필요 |
| Git | 2.43.0 설치됨 | `main`이 `origin/main`을 추적하며 직전 자금 증거 commit `847baa1`의 원격 반영 확인 |
| Google Cloud SDK | Windows SDK 578.0.0 설치·CLI 로그인 완료 | 기본 프로젝트 `project-682bea5f-ac81-4a36-8a1` 설정 완료. WSL에서는 Windows SDK를 PowerShell로 호출한다. |
| GCP ADC | Windows ADC 생성 및 quota project 연결 완료 | WSL Node 실행 시 Windows ADC 파일을 `GOOGLE_APPLICATION_CREDENTIALS`로 명시한다. credential 파일은 저장소에 복사하거나 커밋하지 않는다. |
| Docker | CLI 29.6.2 설치됨 | 현재 세션에서 daemon 접근 불가. Cloud Run source deploy에는 로컬 daemon 불필요 |
| Solana CLI / SPL Token CLI | 설치되지 않음 | 앱의 기존 Solana Kit로 키 생성·검증 완료. ATA 생성도 같은 SDK로 수행해 전체 toolchain 설치를 피한다. |
| Solana Devnet 지갑 | Sponsor·Buyer A/B/C·Merchant 5개 생성·검증 완료 | 개인키는 Secret Manager version 1에만 보관, 공개 manifest만 저장소에 둠 |
| Devnet 자금·ATA | Sponsor 4.991837880 SOL, Buyer A/B/C 각 20 USDC, Merchant 0 USDC; ATA 4개 finalized | live readiness와 제품 결제 전 잔액 준비 완료 |
| 제품 검증 | lockfile 기준 `npm ci --omit=peer`, typecheck, 87 tests, build 성공 | 루트 하네스 37 tests 및 production audit high/critical gate 통과 |
| Live 환경 파일 | `.env` 없음 | 비밀 미커밋은 정상. 필수 6개 runtime secret을 private live revision에 version 1로 연결 완료 |
| 실제 실행 증거 | Vertex 호출, ATA 생성 tx, 비공개 fixture와 live Cloud Run revision 확보 | 제품 결제 tx, ADK trace, 정상·거부 경로 receipt는 아직 확보해야 한다. |

현재 실행 차단 요소는 `공식 폼 세부 계약 미확인`, `GitHub 심사 접근성 미확정`, `Live 결제·거부 receipt 없음`이다. Git 원격 동기화, GCP, Devnet 지갑·SOL·USDC·ATA, private live readiness는 완료됐다.

## 로컬 개발 환경

제품의 최소 로컬 조건은 [package.json](../../product/mandate-pool/package.json)과 [제품 README](../../product/mandate-pool/README.md)를 따른다.

필수 도구:

- Node.js 22 이상
- npm
- Git 및 GitHub CLI
- Codex CLI
- Google Cloud CLI

준비·검증 명령:

```bash
cd product/mandate-pool
npm ci --omit=peer
npm run typecheck
npm test
npm run build
```

ADK 1.5.0이 자동 설치하려는 미사용 DB peer에는 vulnerable `sqlite3 → node-gyp → tar` 경로가 있다. 제품과 Docker는 peer를 제외하며, 이 설치 트리에서 high/critical audit gate와 전체 테스트를 통과했다. 남은 19개 moderate advisory와 조치 판단은 [의존성 보안 영수증](evidence/dependency-security-audit-2026-08-03.md)에 기록한다.

선택 도구:

- Solana CLI와 `spl-token`: Devnet keypair, SOL, ATA, 잔액 확인을 단순화한다.
- Docker daemon: 로컬 이미지 재현 검증에만 필요하다.

Cloud Run의 `gcloud run deploy --source`는 Cloud Build와 Artifact Registry에서 이미지를 빌드하므로 로컬 Docker daemon이 없어도 된다. [Cloud Run source deploy](https://docs.cloud.google.com/run/docs/deploying-source-code)

## GCP 환경 계약

### 사람이 먼저 해야 하는 일

- [x] Google Cloud 계정에 로그인한다.
- [x] 전용 프로젝트를 생성하거나 선택한다.
- [x] Billing 계정을 연결하고 비용 조건을 확인한다.
- [ ] 작은 예산 알림을 설정한다. 예산 알림은 지출을 자동 차단하지 않는다는 점을 인지한다.
- [x] `gcloud auth login`의 브라우저 인증을 승인하고 기본 프로젝트를 설정한다.
- [x] `gcloud auth application-default login`의 OAuth와 필수 scope를 승인한다.
- [x] Firestore의 영구 location을 `asia-northeast3`로 선택하고 생성한다.
- [ ] 공개 Cloud Run 데모를 허용할지 승인한다.

Google Cloud Free Trial은 자격이 되는 신규 사용자에게 90일·USD 300 Welcome credit을 제공하지만, 과거 사용 이력과 결제수단 검증 조건이 있다. 자동 수령이나 모든 서비스 비용 충당을 전제로 삼지 않는다. [Google Cloud Free Trial](https://docs.cloud.google.com/free/docs/free-cloud-features)

### 활성화할 API

```text
aiplatform.googleapis.com
firestore.googleapis.com
run.googleapis.com
cloudbuild.googleapis.com
artifactregistry.googleapis.com
secretmanager.googleapis.com
```

Vertex AI 공식 quickstart의 선행조건은 Google 계정, 프로젝트, Billing, Vertex AI API, gcloud, ADC다. 현재 제품은 AI Studio API key가 아니라 Vertex AI ADC를 사용한다. [Vertex AI Gemini quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart)

### 2026-08-03 Vertex 검증 영수증

- Billing 연결: `True`
- Vertex AI API: `aiplatform.googleapis.com` 활성화 성공
- ADC quota project: `project-682bea5f-ac81-4a36-8a1`
- 모델·location: `gemini-2.5-flash`, `global`, Vertex API `v1`
- `countTokens("mandate-pool-readiness")`: `totalTokens=7`
- 최소 생성: 응답 `VERTEX_READY`, `finishReason=STOP`
- 제품 로컬 검증: typecheck 성공, 9개 test file의 87개 test 성공, build 성공

첫 호출과 최소 생성은 실제 Vertex endpoint에서 성공했다. 이후 제품과 동일한 5초 `countTokens` timeout으로 반복한 로컬 요청 한 번은 `AbortError`가 발생했다. private live Cloud Run startup과 인증된 `/readyz`에서는 같은 Vertex probe가 다시 성공했다. 이 결과는 연결 준비를 입증하지만 제품 ADK 주문 흐름의 성공 증거를 대신하지 않는다.

### 2026-08-03 서울 리전 인프라 영수증

- 위 6개 API 모두 활성화 확인
- Firestore: `(default)`, Standard, Native mode, `asia-northeast3`, free tier
- Firestore PITR: 비활성화로 생성해 추가 옵션 비용을 피함
- 애플리케이션의 `@google-cloud/firestore`와 ADC로 readiness 문서 1회 읽기 성공: `FIRESTORE_READY`, `exists=false`; 쓰기 없음
- Cloud Run CLI 기본 리전: `asia-northeast3`
- 전용 런타임 identity: `mandate-pool-runtime@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com`
- 런타임 최소 역할: `roles/aiplatform.user`, `roles/datastore.user`
- `roles/secretmanager.secretAccessor`는 runtime identity에 필요한 six runtime secret별로만 부여했다. Merchant 복구용 secret에는 부여하지 않았다.

후속 단계에서 runtime secret 여섯 개와 전용 build identity를 만들고 비공개 fixture와 live 서비스를 분리해 배포했다. fixture 결과는 [GCP 비공개 fixture 배포 영수증](evidence/gcp-private-fixture-deploy-2026-08-03.md), live revision·IAM·readiness·온체인 불변 확인은 [GCP 비공개 live 배포 영수증](evidence/gcp-private-live-deploy-2026-08-03.md)에 고정했다. 공개 접근과 제품 결제 흐름은 아직 실행하지 않았다.

### 런타임 서비스 계정

Cloud Run에는 전용 user-managed service account를 연결하고 최소 권한만 부여한다.

```text
roles/aiplatform.user
roles/datastore.user
roles/secretmanager.secretAccessor
```

`secretAccessor`는 가능하면 프로젝트 전체가 아니라 이 제품의 각 secret에 부여한다. Cloud Run에서는 JSON 서비스 계정 키를 넣지 않고 연결된 service identity의 ADC를 사용한다. [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity), [Firestore IAM](https://docs.cloud.google.com/firestore/docs/security/iam), [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets)

### 소스 배포 권한

배포 주체에는 공식 source deploy 기준으로 다음 역할이 필요하다.

```text
roles/run.sourceDeveloper
roles/serviceusage.serviceUsageConsumer
roles/iam.serviceAccountUser
```

Cloud Build 서비스 계정에는 다음 역할이 필요하다.

```text
roles/run.builder
```

### Firestore

- Native mode의 `(default)` 데이터베이스를 사용한다.
- 2026-08-03 사람의 확인을 받은 뒤 Cloud Run과 같은 서울 `asia-northeast3`에 생성했다.
- Standard edition과 free tier를 확인했고 PITR은 비활성화했다.

[Firestore 데이터베이스 관리](https://cloud.google.com/firestore/docs/manage-databases)

## Solana Devnet 환경 계약

별도 Solana 프로그램이나 Anchor 배포는 필요하지 않다. 제품은 `@solana/kit`과 classic Token Program을 사용해 세 명의 USDC 전송을 한 거래로 묶는다.

### 논리적 지갑

| 역할 | 키 필요 여부 | 자금 |
|---|---|---|
| Fee sponsor | 런타임 개인키 필요 | 수수료와 ATA 생성용 Devnet SOL |
| Buyer A | 런타임 개인키 필요 | 최소 3 Devnet USDC |
| Buyer B | 런타임 개인키 필요 | 최소 3 Devnet USDC |
| Buyer C | 런타임 개인키 필요 | 최소 3 Devnet USDC |
| Merchant | 런타임에는 owner 공개키와 USDC ATA만 필요 | 수취용 ATA |

모든 키는 Mainnet과 분리된 일회성 Devnet 전용 키로 만든다. 앱에 넣는 signer secret은 64-byte JSON 배열 또는 64-byte로 디코딩되는 base64여야 한다.

2026-08-03 지갑 5개를 canonical Base64 64-byte 형식으로 생성하고 Secret Manager에 직접 저장했다. 공개주소, ATA, IAM, 전체 genesis hash 수정, Sponsor 자금과 ATA 생성 상태는 [Devnet 지갑 프로비저닝 영수증](evidence/devnet-wallet-provisioning-2026-08-03.md) 및 [공개 manifest](../../product/mandate-pool/devnet-wallets.public.json)를 따른다.

Devnet 설정:

```text
RPC: https://api.devnet.solana.com
Circle Devnet USDC mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

자금 준비 상태:

- Sponsor는 [Solana Devnet Faucet](https://faucet.solana.com/)으로 최초 5 SOL을 받았고 ATA 생성 뒤 finalized 잔액 `4.991837880 SOL`을 확인했다.
- Sponsor가 Buyer A/B/C와 Merchant의 classic-token ATA 네 개를 하나의 idempotent transaction으로 생성했다.
- ATA transaction은 finalized됐으며 각 account의 classic Token Program, owner, mint, decimals 6, initialized 상태를 검증했다.
- [Circle Faucet](https://faucet.circle.com/)에서 `USDC`와 `Solana Devnet`을 선택하고 Buyer A/B/C의 **owner 주소** 각각에 요청했다. ATA 주소를 입력하지 않았다.
- Circle 공개 Faucet은 계정 없이 사용할 수 있지만 reCAPTCHA가 필요하다. 현재 공식 한도는 주소·체인별 2시간마다 20 USDC 한 번이다.
- Buyer A/B/C의 finalized 잔액은 각각 20 USDC이며 owner, Circle mint, decimals 6, initialized 상태를 검증했다. Merchant는 0 USDC다.
- Buyer의 수수료는 Sponsor가 지불하므로 Buyer의 SOL은 필수가 아니다.

[Solana CLI 설치](https://solana.com/docs/intro/installation), [Circle Solana USDC quickstart](https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana), [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## Live 환경변수와 Secret Manager

실제 강제 조건은 [config.ts](../../product/mandate-pool/src/config.ts)의 `loadConfig`가 소유한다. [.env.example](../../product/mandate-pool/.env.example)은 입력 예시일 뿐이다.

비밀이 아닌 설정:

```text
APP_MODE=live
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=<project-id>
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-2.5-flash
FIRESTORE_DATABASE_ID=(default)
FIRESTORE_NAMESPACE=v0
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
MERCHANT_OWNER=<public-address>
MERCHANT_USDC_ATA=<public-address>
```

필수 Secret Manager 리소스:

```text
DEMO_KEY
ENTITLEMENT_SECRET
SPONSOR_SECRET_KEY
BUYER_A_SECRET_KEY
BUYER_B_SECRET_KEY
BUYER_C_SECRET_KEY
```

강제 길이와 분리 조건:

- Live `DEMO_KEY`: 24자 이상
- Live `ENTITLEMENT_SECRET`: 32자 이상
- 두 값은 서로 달라야 한다.
- 이전 entitlement keyring은 선택이며 각 값이 32자 이상이어야 한다.

`.env.example`은 Live `DEMO_KEY` 24자 조건과 여섯 runtime secret의 명시적 version 1 binding을 코드 계약과 일치시켰다.

비밀값은 채팅, shell history, Git, 로그, 제출 자료에 노출하지 않는다. Codex가 키를 생성할 때도 값을 출력하지 않고 지정한 로컬 비밀 경로에서 Secret Manager로 직접 전달해야 한다.

## HITL와 Codex 자동화 경계

| 단계 | 사람 | Codex CLI |
|---|---|---|
| 공식 폼 | 로그인, 계정 선택, 최종 제출 확인 | 공개 규칙 대조, 제출 콘텐츠 작성 |
| GCP 계정 | Billing·약관·결제수단·MFA·OAuth 승인 | CLI 설치, API·IAM·Firestore·Cloud Run 구성 |
| 지갑 | Devnet 키 생성 범위 승인, Faucet CAPTCHA | keypair·ATA 생성, 자금 분배, 잔액·mint 검증 |
| 비밀 | 저장 위치와 공개 범위 승인 | Secret Manager 생성·binding, redaction 검사 |
| GitHub | 저장소 공개성·최종 제출 승인 | secret·대용량 파일 검사, 논리적 변경 단위 commit과 push, 원격 검증 |
| 배포 | unauthenticated 공개 접근 승인 | 테스트, build, Cloud Run 배포, readiness 점검 |
| 증거 | 영상과 최종 claim 검토 | tx·Explorer·로그·revision receipt 수집 |

Codex가 대신하지 않는 항목:

- Google 또는 GitHub 계정 생성
- 결제수단 입력과 약관 동의
- OAuth/MFA/CAPTCHA
- Mainnet 자산 사용
- 사용자의 최종 제출 의사 확인

## Codex CLI 운용 방식

### 1. 읽기 전용 사전점검

현재 디렉터리는 Git 저장소이므로 저장소 루트에서 읽기 전용 점검을 실행한다.

```bash
codex exec --ephemeral --sandbox read-only \
  "이 저장소의 해커톤 제출 환경을 점검하고 누락된 계정, CLI, GCP, Devnet, 증거만 보고해"
```

`codex exec`는 기본 read-only이며 CI나 반복 preflight에 적합하다. [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

### 2. 승인 기반 구현

```bash
codex --sandbox workspace-write --ask-for-approval on-request
```

시작 prompt:

```text
이 저장소를 해커톤 제출 환경으로 부트스트랩해.

- 비밀값을 출력하거나 커밋하지 말 것
- Git/GitHub 저장소 준비
- WSL 네이티브 gcloud와 Solana CLI 사전점검
- GCP API, 서비스 계정, IAM, Firestore, Secret Manager 구성
- Devnet 지갑·ATA·잔액 검증
- typecheck, test, build
- Cloud Run 배포와 `/health`, `/readyz` 검증 (`/healthz`는 Cloud Run 예약 경로 충돌 때문에 배포 검증에 사용하지 않음)
- 정상 거래와 거부 경로의 receipt 수집
- 외부 변경, 공개 접근, push, deploy 직전에 승인 요청
```

`workspace-write + on-request`는 저장소 안의 편집을 허용하면서 네트워크와 외부 상태 변경을 승인 경계에 둔다. [Codex approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)

### 3. 저장소 지침 고정

저장소 루트의 `AGENTS.md`에 다음 규칙을 고정한다.

- 비밀을 출력·커밋하지 않는다.
- Mainnet 사용을 금지한다.
- 배포 전 `npm run typecheck`, `npm test`, `npm run build`를 모두 통과한다.
- 외부 변경과 공개 접근은 승인을 받는다.
- 성공·거부 경로 모두 receipt를 남긴다.

[Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

### Cloud Run MCP 결정

Google은 Agent가 Cloud Run을 조작할 수 있는 공식 MCP server를 제공한다. Codex CLI도 stdio와 HTTP MCP를 지원한다. 그러나 Cloud Run MCP 역시 gcloud, ADC, OAuth, IAM을 먼저 요구하므로 마감 당일의 첫 경로로 사용하지 않는다.

결정:

- 최초 배포는 Codex가 승인받아 `gcloud`를 실행한다.
- 반복 배포가 필요해진 뒤에만 Cloud Run MCP를 추가한다.
- MCP는 승인과 최소 IAM을 우회하는 수단으로 사용하지 않는다.

[Cloud Run MCP](https://docs.cloud.google.com/run/docs/use-cloud-run-mcp), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp)

## 마감 당일 실행 순서

### P0. 제출 계약 잠금

- [ ] 공식 폼에 Google 계정으로 로그인한다.
- [ ] 세부 필드, 파일 형식, 영상 제한, 저장소 접근 조건을 기록한다.
- [ ] 소개서·Repo·영상·live URL을 넣을 자리를 확인한다.

### P1. 계정과 프로젝트

- [x] GCP 프로젝트 ID와 배포 region을 결정한다.
- [ ] Billing과 예산 알림을 설정한다.
- [x] Windows Google Cloud SDK를 WSL에서 호출하는 실행 경로를 확인한다.
- [x] CLI 로그인, 기본 프로젝트 설정, ADC 로그인을 완료한다.
- [x] `main` Git 저장소를 초기화하고 GitHub 원격 `procloudkim/2026-Solana-Google`을 연결한다.
- [x] 초기 commit을 `main`에 push하고 로컬·원격 SHA 일치를 확인한다.
- [ ] 현재 private 저장소를 공개하거나 심사위원 접근 방법을 확정한다.

### P2. GCP와 비밀

- [x] 필요한 API를 활성화한다.
- [x] Firestore `(default)`를 생성한다.
- [x] 전용 Cloud Run service account와 최소 IAM을 구성한다.
- [x] 6개 필수 runtime secret을 만들고 private live Cloud Run에 version 1로 고정한다.

### P3. Devnet

- [x] Sponsor, Buyer A/B/C, Merchant의 Devnet 키를 만들고 공개주소·ATA 파생·Secret Manager round-trip을 검증한다.
- [x] Sponsor 5 SOL을 확보하고 finalized 잔액을 검증한다.
- [x] Buyer A/B/C 각각 20 Devnet USDC를 확보한다.
- [x] Buyer·Merchant ATA를 생성하고 transaction finality를 확인한다.
- [x] Devnet genesis, mint, owner, decimals, account 상태를 검증한다.
- [x] Buyer A/B/C의 USDC 잔액과 owner, mint, decimals, account 상태를 finalized로 검증한다.

### P4. 검증과 배포

- [x] lockfile 기준 `npm ci --omit=peer`, typecheck, 87 tests, build를 통과한다. 루트 하네스 37 tests와 production audit high/critical gate도 통과했다.
- [x] 비공개 fixture를 전용 service identity로 배포한다.
- [x] 인증된 `/health`가 200이고 무인증 요청이 403인지 확인한다. Cloud Run에서는 일부 `z` 종결 경로가 예약되므로 `/healthz`를 외부 probe로 사용하지 않는다.
- [x] 비공개 `mandate-pool-live-00001-n99` revision을 전용 service identity로 배포한다.
- [x] 인증된 `/readyz`에서 Vertex, Firestore, Solana 검사가 모두 성공하는지 확인한다.
- [x] `/api/v1/runtime`이 `mode: live`, `onChain: true`인지 확인하고 무인증 요청이 403인지 재확인한다.

### P5. 제출 증거

- [ ] 정상 경로에서 finalized Devnet transaction을 만든다.
- [ ] 거부 경로에서 거래가 생성되지 않았음을 보인다.
- [ ] transaction signature와 Explorer URL을 저장한다.
- [ ] Gemini/ADK trace와 Agent decision trace를 저장한다.
- [x] Cloud Run live URL과 revision identifier를 [배포 영수증](evidence/gcp-private-live-deploy-2026-08-03.md)에 저장한다.
- [ ] 데모 영상을 녹화하고 소개서와 README의 claim을 증거와 대조한다.
- [ ] 공식 폼 제출 완료 화면과 시각을 보존한다.

## 완료 정의

다음 조건을 모두 만족해야 `SUBMISSION_READY`로 본다.

```text
공식 폼 필드 확인
  + 심사 가능한 GitHub Repo
  + 소개서와 데모영상
  + Cloud Run live URL
  + Vertex/Firestore/Solana readiness 통과
  + 정상 finalized Devnet tx와 Explorer
  + 거부 경로 no-transaction 증거
  + Agent decision/ADK trace
  + Cloud Run revision receipt
  + 비밀 노출 검사 통과
```

Fixture 화면, 임의 transaction id, sandbox 성공, 로컬 테스트만으로는 Live 제출 증거를 대체하지 않는다.

## 명시적 비범위

마감 전 필수 환경에 포함하지 않는다.

- Solana Mainnet과 실제 자산
- 별도 Anchor/Rust 프로그램 배포
- Phantom 등 브라우저 지갑 연동
- x402 표준 구현 주장
- Google AI Studio API key
- Agent Engine 별도 배포
- GKE
- 로컬 Docker daemon 복구

현재 제품의 x402 경계와 operator-simulated HITL 한계는 [제품 README](../../product/mandate-pool/README.md)에 공개한다.

## 다음 실행 입력

자동화에 필요한 비밀이 아닌 실행값은 다음으로 고정됐다.

```text
GCP_PROJECT_ID=project-682bea5f-ac81-4a36-8a1
GCP_REGION=asia-northeast3
GITHUB_REPOSITORY=procloudkim/2026-Solana-Google
CLOUD_RUN_FIXTURE_SERVICE_NAME=mandate-pool
CLOUD_RUN_LIVE_SERVICE_NAME=mandate-pool-live
```

이메일, Google credential, API token, Solana private key는 채팅으로 전달하지 않는다.
