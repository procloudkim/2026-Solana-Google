# 해커톤 참가 환경 및 실행 런북

> 계정 준비부터 총 1 Devnet 테스트 USDC의 증거 확보와 최종 제출까지, 사람이 결정할 일과 Codex가 실행할 일을 한 순서로 고정한 운영 문서

- 기준일: 2026-08-03 KST
- 대상 행사: Google Cloud × Solana AI Agentic Hackathon
- 대상 제품: [Mandate Pool](../../product/mandate-pool/README.md)
- 현재 상태의 단일 기준: 이 문서의 체크박스와 연결된 evidence receipt

## 이 문서를 사용하는 방법

이 런북은 마감 당일의 운영자와 Codex를 위한 문서입니다. 처음부터 모든 설명을 읽을 필요는 없습니다.

1. [현재 판단](#현재-판단)에서 남은 병목을 확인합니다.
2. [실행 순서](#실행-순서)를 위에서 아래로 진행합니다.
3. 각 단계의 **성공 기준**을 충족한 뒤에만 다음 단계로 이동합니다.
4. 실제 실행 결과는 `evidence/`에 비밀을 제거한 receipt로 남깁니다.
5. 공개 페이지와 로그인 후 제출 폼이 다르면 폼을 우선하고, 이 문서를 즉시 갱신합니다.

표기 원칙:

- `[x]`: 재현 가능한 결과나 receipt가 있는 완료 항목
- `[ ]`: 사람의 확인 또는 실행 증거가 아직 필요한 항목
- `fixture`: 로컬 기능 증거이며 온체인 증거가 아님
- `Live Devnet`: 테스트 네트워크 실행이며 실제 가치 이전이 아님

## 현재 판단

### 지금 닫아야 할 병목

1. Google 계정으로 공식 폼에 로그인해 저장소 공개성, 영상 길이, 입력 필드를 확정합니다.
2. 문서·비밀정보 검사를 통과한 현재 소스를 GitHub에 반영합니다.
3. 총 1 USDC 코드로 private Cloud Run fixture와 live revision을 다시 배포하고 읽기 전용 readiness를 확인합니다.
4. Devnet 키와 분리된 `solana-test-validator` localnet smoke로 세 전송의 submit·finality·잔액 변화를 확인합니다.
5. 사람이 정상 경로 실행을 명시적으로 승인한 뒤 Devnet 거래를 한 번만 실행합니다.
6. 정상 거래와 no-transaction 거부 경로, Gemini/ADK trace, Cloud Run revision을 영상과 소개서에 연결합니다.

### 현재 상태

| 영역 | 마지막으로 확인된 사실 | 남은 행동 |
|---|---|---|
| GitHub | `main`과 `origin/main`이 동기화됐고 저장소는 private입니다. 현재 도달 가능한 이력에서 실제 API key·개인키는 탐지되지 않았습니다. | 문서 변경을 push한 뒤 원격 SHA를 다시 대조하고 심사 접근 방식을 확정합니다. |
| 로컬 제품 | 2026-08-03 최종 문서 변경 뒤 Node 22 typecheck, 87 tests, build와 루트 하네스 37 tests가 모두 통과했습니다. | 소스가 다시 바뀔 때 같은 gate를 반복합니다. |
| GCP | Vertex AI, Firestore, Secret Manager, private Cloud Run fixture/live readiness를 확인했습니다. | 총 1 USDC 소스가 반영된 새 revision을 배포합니다. |
| Solana | transaction build/verify test와 Devnet 지갑 5개, ATA 4개, Sponsor 테스트 SOL, Buyer A/B/C의 테스트 USDC를 준비했습니다. Local validator transaction은 실행하지 않았고 현재 환경에 Solana CLI도 없습니다. | 전용 localnet smoke를 만든 뒤 Devnet 결제 전후 finalized 잔액을 기록합니다. |
| 제품 거래 | 제품 주문의 실제 Devnet 거래는 실행하지 않았습니다. | HITL 승인 뒤 정상 1회, 거부 1회를 증거로 남깁니다. |
| 제출 | 공개 행사 계약은 정리했지만 로그인 뒤 폼 필드는 확인하지 못했습니다. | 폼 확인, 영상·소개서 작성, 최종 제출 확인이 필요합니다. |

기존 `mandate-pool-live-00001-n99`는 private live 의존성 readiness를 증명하지만, 총 1 USDC 변경 전 소스입니다. 새 revision이 배포되기 전까지 이를 현재 결제 데모 증거로 사용하지 않습니다.

## 제품 IDEA와 제출 주장

### Why

여러 사람의 돈을 대신 다루는 에이전트는 상품 추천뿐 아니라 각 사람의 권한과 예산을 보존해야 합니다. 일부 결제, 중복 결제, 승인 이후 거래 변조가 없다는 것을 사람이 이해하고 기계가 검증할 수 있어야 합니다.

### What

Mandate Pool은 세 구매자의 자연어 조건을 구조화하고 역할별 HITL을 거친 뒤, 모든 조건의 교집합을 만족할 때만 총 1 Devnet 테스트 USDC를 공동 결제합니다. 한 명의 한도라도 부족하면 거래를 만들지 않습니다.

### How

Gemini·ADK는 조건 정규화와 후보 제안만 담당합니다. 결정론적 정책 엔진이 승인·예산·상품·분담·만료를 재검증하고, Solana v0 거래 하나의 세 전송과 네 signer를 고정합니다. finalized 거래를 재디코딩하고 buyer debit·merchant credit을 대조한 뒤에만 이용권을 발급합니다.

제출에서 사용할 수 있는 핵심 문장은 다음과 같습니다.

> AI가 결제 권한을 갖는 것이 아니라, 사람이 위임한 mandate 안에서만 제안하고, 결정론적 정책과 원자 거래가 그 권한을 끝까지 보존합니다.

## 공식 참가 계약

2026-08-03 KST에 [공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)와 로컬 보존 자료를 대조한 결과입니다. 로그인 뒤에만 보이는 폼 필드는 아직 확정 사실로 취급하지 않습니다.

| 항목 | 공개 페이지에서 확인한 내용 | 실행 기준 |
|---|---|---|
| 제출 마감 | 2026-08-03 23:59 KST | 제출 완료 화면과 KST 시각을 보존합니다. |
| 팀 | 개인 또는 최대 4명 | 팀원이 있으면 네 명을 넘지 않습니다. |
| 언어 | 제품은 한국어 또는 영어, 발표는 한국어 | UI·소개서·영상은 한국어 중심으로 작성합니다. |
| 필수 제출물 | 프로덕트 소개서, GitHub Repo, 데모 영상 | 세 항목을 하나의 제출 묶음으로 관리합니다. |
| Live URL | 권장 | 가능하면 Cloud Run URL을 제공하되 공개 승인을 먼저 받습니다. |
| 실행 네트워크 | localnet·testnet·devnet live 허용 | Mainnet을 새 필수 범위로 만들지 않습니다. |
| 실행 증거 | Agent가 실제 거래·결제를 발생시키고 로그·이력으로 확인 가능 | Devnet signature, Explorer, decision trace를 연결합니다. |

[공식 참가 폼](https://forms.gle/ay9DyaWhR4JHMjta7)은 비로그인 접근을 Google 로그인으로 보냅니다. 따라서 폼 접근에는 Google 계정이 필요합니다. 영상이 정확히 3분 이내인지, 저장소가 반드시 public인지, 특정 Gmail 유형만 허용되는지는 로그인 후 폼을 보기 전까지 확정하지 않습니다.

안전한 작업 기본값은 영상 3분 이내, 심사자가 접근 가능한 저장소, 한국어 발표입니다. 실제 폼이 다르면 폼을 우선합니다.

운영진 채널에서 전달된 테스트 순서는 [운영진 Devnet 안내](evidence/organizer-devnet-guidance-2026-08-03.md)에 원문과 해석을 분리해 보존합니다.

```text
pay.sh sandbox 또는 Solana localnet에서 먼저 테스트
  -> 실제 동작은 Devnet에서 확인
  -> Faucet 한도로 SOL이 부족하면 운영진에게 DM 후 채널에 언급
```

이 문구의 `혹은`은 제품 경로에 따른 선택으로 해석합니다. pay.sh를 쓰면 pay.sh sandbox를, 직접 Solana transaction을 쓰면 localnet을 먼저 사용합니다. Mandate Pool은 custom Solana settlement이므로 **localnet 권고가 적용됩니다.** `APP_MODE=fixture`와 transaction build/verify test는 선행 E1 증거지만 localnet을 대체하지 않습니다. 현재 localnet 실행은 미완료이며, 최종 공개 온체인 증거는 별도의 Devnet finalized transaction으로 만듭니다.

## 증거 등급

| 등급 | 예시 | 주장할 수 있는 것 | 주장할 수 없는 것 |
|---|---|---|---|
| E0 설계 | PRD, diagram, API contract | 의도와 검증 계획 | 구현·실행 성공 |
| E1 로컬 | typecheck, test, fixture UI, localnet smoke | 코드 계약과 로컬 정상·거부 흐름; localnet을 실행했다면 로컬 transaction | GCP·Devnet 실행 |
| E2 readiness | 인증된 `/readyz`, runtime metadata | Vertex·Firestore·Solana 의존성 접근 | 제품 주문·결제 성공 |
| E3 Devnet | finalized signature, 거래 decode, 잔액 증감 | 테스트 네트워크의 실제 실행 | Mainnet 또는 실제 가치 이전 |
| E4 제출 | 영상, 소개서, 접근 가능한 Repo·URL | 심사자가 재현 가능한 출품 묶음 | 운영 환경의 상용 안정성 |

Fixture 결과, 임의 transaction id, local test 통과를 E3 증거처럼 표현하지 않습니다. Devnet SOL과 USDC는 faucet 테스트 토큰이며 금전 가치가 없고 실제 달러로 담보되지 않습니다. [Circle testnet 안내](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## 사람과 Codex의 책임 경계

| 단계 | 사람이 결정하거나 승인 | Codex가 수행할 수 있는 일 |
|---|---|---|
| 공식 폼 | 로그인, 계정 선택, 필드 확인, 최종 제출 | 공개 규칙 대조, 초안과 체크리스트 작성 |
| GCP | Billing·약관·결제수단·OAuth·MFA | API·IAM·Firestore·Cloud Run 점검과 승인 기반 구성 |
| 지갑 | Devnet 전용 키 범위, 실제 거래 실행 | 키·ATA·mint·잔액의 비밀 제거 검증 |
| 비밀 | 저장 위치와 공개 범위 | Secret Manager binding과 Git redaction 검사 |
| GitHub | public 전환 또는 심사자 초대 | 변경 검증, commit 안내, 원격 SHA 대조 |
| 배포 | public 접근 허용 여부 | private 배포, readiness와 403/200 확인 |
| 거래 | 정상 경로 1회 실행의 최종 승인 | 승인된 Devnet 거래 제출과 receipt 수집 |
| 제출 | 영상·주장 검토와 제출 버튼 | 증거 연결, 소개서·영상 대본 작성 |

Codex는 계정 생성, 결제수단 입력, 약관 동의, OAuth/MFA/CAPTCHA, Mainnet 사용, 저장소 공개, 최종 제출을 대신 결정하지 않습니다.

## 고정 환경과 보안 계약

### 비밀이 아닌 실행값

```text
GCP_PROJECT_ID=project-682bea5f-ac81-4a36-8a1
GCP_REGION=asia-northeast3
GITHUB_REPOSITORY=procloudkim/2026-Solana-Google
CLOUD_RUN_FIXTURE_SERVICE=mandate-pool
CLOUD_RUN_LIVE_SERVICE=mandate-pool-live
RUNTIME_SERVICE_ACCOUNT=mandate-pool-runtime@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

### 필수 Secret Manager binding

```text
mandate-pool-demo-key:1       -> DEMO_KEY
mandate-pool-entitlement:1    -> ENTITLEMENT_SECRET
mandate-pool-fee-sponsor:1    -> SPONSOR_SECRET_KEY
mandate-pool-buyer-a:1        -> BUYER_A_SECRET_KEY
mandate-pool-buyer-b:1        -> BUYER_B_SECRET_KEY
mandate-pool-buyer-c:1        -> BUYER_C_SECRET_KEY
```

비밀 payload는 채팅, 명령 인자, shell history, Git, 로그, 영상에 넣지 않습니다. Cloud Run은 JSON 서비스 계정 키 대신 user-managed service identity의 ADC를 사용합니다. Google도 Cloud Run service identity를 쓸 때 `GOOGLE_APPLICATION_CREDENTIALS`를 서비스에 설정하지 말고 user-managed service account를 연결하도록 안내합니다. [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity)

`roles/secretmanager.secretAccessor`는 프로젝트 전체가 아니라 필요한 각 secret에 부여합니다. secret은 환경 변수로 주입하되 revision이 재현되도록 `latest` 대신 명시적 version 1에 고정합니다. [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets)

### Git 보안 상태와 보강 조건

현재 원격 이력에서 실제 Google·GitHub·OpenAI API key, GCP service-account JSON, PEM private key, Solana 64-byte keypair 배열·Base64 payload는 탐지되지 않았습니다. [.env.example](../../product/mandate-pool/.env.example)은 placeholder와 빈 signer 필드만 포함하고, [공개 지갑 manifest](../../product/mandate-pool/devnet-wallets.public.json)는 owner·ATA·Secret Manager 리소스 이름만 포함합니다.

그러나 GitHub 저장소의 native Secret Scanning은 현재 비활성화 상태이며, ignore 규칙만으로 모든 종류의 credential 파일을 막을 수는 없습니다. public 전환 전 다음 방어를 적용하고 다시 검사합니다.

- [x] `.gitignore`, `.dockerignore`, `.gcloudignore`에 PEM, keypair, service-account, credential 파일 패턴을 추가했습니다.
- [ ] gitleaks 등 독립 scanner로 현재 tree와 전체 Git history를 검사합니다.
- [ ] GitHub 설정에서 사용할 수 있다면 Secret Scanning과 push protection을 활성화합니다.
- [ ] `git status`, staged diff, 원격 SHA를 마지막으로 확인합니다.

실제 secret이 발견되면 단순 삭제 commit으로 끝내지 않습니다. 먼저 키를 폐기·회전하고, 노출 범위와 Git history 제거 필요성을 판단합니다.

## 준비된 GCP와 Solana 자원

### GCP

- 활성 API: Vertex AI, Firestore, Cloud Run, Cloud Build, Artifact Registry, Secret Manager
- Firestore: `(default)`, Native mode, `asia-northeast3`
- Runtime identity: `mandate-pool-runtime@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com`
- 최소 runtime 역할: `roles/aiplatform.user`, `roles/datastore.user`
- secret access: 여섯 runtime secret 리소스에만 개별 binding
- Vertex probe: `gemini-2.5-flash`, `global`, `countTokens` 성공
- private fixture receipt: [GCP fixture 배포](evidence/gcp-private-fixture-deploy-2026-08-03.md)
- private live receipt: [GCP live 배포](evidence/gcp-private-live-deploy-2026-08-03.md)

Cloud Run source deploy는 Cloud Build와 Artifact Registry에서 이미지를 만들므로 로컬 Docker daemon이 필수는 아닙니다. [Cloud Run source deploy](https://docs.cloud.google.com/run/docs/deploying-source-code)

### Solana Devnet

| 역할 | Runtime key | 마지막 검증 자금 또는 용도 |
|---|---|---|
| Sponsor | 필요 | 수수료·ATA 생성용 Devnet SOL |
| Buyer A | 필요 | 정상 분담 `0.333334`, readiness 기준 `0.400000` USDC |
| Buyer B | 필요 | 정상 분담 `0.333333`, readiness 기준 `0.400000` USDC |
| Buyer C | 필요 | 정상 분담 `0.333333`, readiness 기준 `0.400000` USDC |
| Merchant | 불필요 | 공개 owner·수취 ATA만 runtime에 사용 |

2026-08-03에 Sponsor 잔액 `4.991837880` Devnet SOL, Buyer A/B/C 각 `20` Devnet USDC, Merchant `0` USDC를 finalized 상태로 확인했습니다. ATA 네 개의 Token Program, owner, mint, decimals, initialized 상태도 확인했습니다. 최신 공개 주소와 transaction signature는 [Devnet 지갑 receipt](evidence/devnet-wallet-provisioning-2026-08-03.md)를 따릅니다.

## 실행 순서

### P0. 제출 계약 잠금

- [ ] 공식 폼에 Google 계정으로 로그인합니다.
- [ ] Repo 공개성, 영상 제한, 소개서 형식, 필수 URL을 기록합니다.
- [ ] 폼의 실제 필드가 이 런북과 다르면 이 절을 먼저 수정합니다.

**성공 기준:** 제출 필드별 산출물 경로와 담당자가 정해져 있습니다.

### P1. 로컬 검증과 비밀정보 검사

```bash
cd product/mandate-pool
npm ci --omit=peer
npm run typecheck
npm test
npm run build
cd ../..
python3 -m unittest discover -s tests -p 'test_*.py'
git diff --check
git status --short
```

- [x] 제품 typecheck·87 tests·build가 모두 통과했습니다.
- [x] 루트 하네스 37 tests가 통과했습니다.
- [x] 실제 `.env`, keypair, service-account, private key가 tracked/staged 상태가 아님을 확인했습니다.
- [x] 추적 중인 Markdown 70개의 상대 링크·code fence와 현재 코드의 1 USDC 분담 계약이 일치합니다.

이번 검수의 high-confidence credential pattern은 현재 worktree와 도달 가능한 Git history에서 0건이었고, 추적 JSON 44개에서 64-byte Solana keypair 배열도 0건이었습니다. 이는 전용 scanner를 대체하지 않으므로 public 전환 전 gitleaks gate는 계속 남겨 둡니다.

**성공 기준:** 실패 명령이 없고, secret scanner 결과가 0이며, 의도한 파일만 diff에 있습니다.

**중단 조건:** secret-like 값이 하나라도 발견되면 push하지 않고 값의 진위와 회전 필요성을 먼저 판단합니다.

### P2. commit과 원격 검증

Codex 환경에서 `.git` 쓰기가 제한되면 사람이 제시된 명령을 실행합니다. 모든 변경을 무조건 담는 대신 `git status`로 확인한 문서·코드만 stage합니다.

```bash
git status --short
git diff --check
git add <검증한-파일들>
git diff --cached --stat
git commit -m "Clarify hackathon product and execution documentation"
git push
git status --short --branch
git ls-remote --heads origin main
```

**성공 기준:** worktree가 clean이고 로컬 HEAD와 `origin/main` SHA가 같습니다.

### P3. 총 1 USDC private revision 배포

배포 전 현재 Firestore namespace에 정책 version 1의 진행 중 주문이나 예약이 없는지 읽기 전용으로 확인합니다. 있으면 새 namespace 또는 명시적 migration을 선택하고 자동 변환하지 않습니다.

아래 명령에는 공개 설정과 Secret Manager **참조**만 들어갑니다. secret payload를 shell 변수나 명령에 넣지 않습니다. 현재 gcloud는 Windows SDK에 설치되어 있으므로 **Windows PowerShell**에서 저장소의 `product/mandate-pool`로 이동한 뒤 실행합니다.

```powershell
gcloud run deploy mandate-pool-live `
  --source . `
  --project project-682bea5f-ac81-4a36-8a1 `
  --region asia-northeast3 `
  --service-account mandate-pool-runtime@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com `
  --no-allow-unauthenticated `
  --min=0 `
  --max=1 `
  --set-env-vars="APP_MODE=live,GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=project-682bea5f-ac81-4a36-8a1,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash,FIRESTORE_DATABASE_ID=(default),FIRESTORE_NAMESPACE=v0,SOLANA_CLUSTER=devnet,SOLANA_RPC_URL=https://api.devnet.solana.com,SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,MERCHANT_OWNER=9CiapLgCdeYhsxDCcxcAGp9q4PcyfmrzfuaQBj2pTj7p,MERCHANT_USDC_ATA=5UeNvj4JGQrB4fDmJgZ9q9yMgary6Kom8yDwSbs1XgKN" `
  --set-secrets="DEMO_KEY=mandate-pool-demo-key:1,ENTITLEMENT_SECRET=mandate-pool-entitlement:1,SPONSOR_SECRET_KEY=mandate-pool-fee-sponsor:1,BUYER_A_SECRET_KEY=mandate-pool-buyer-a:1,BUYER_B_SECRET_KEY=mandate-pool-buyer-b:1,BUYER_C_SECRET_KEY=mandate-pool-buyer-c:1"
```

같은 소스로 fixture 서비스도 갱신하되 `APP_MODE=fixture`만 사용하고 signer secret을 연결하지 않습니다. 두 서비스 모두 unauthenticated 접근을 계속 차단합니다.

**성공 기준:** 새 revision이 준비 상태이고 traffic 100%를 받지만 public invoker는 없습니다.

**중단 조건:** 예상하지 못한 secret binding, service account, region, namespace 차이가 보이면 배포를 승인하지 않습니다.

### P4. 결제 없는 읽기 전용 배포 검증

Windows PowerShell에서 실행합니다. `$IdToken`은 현재 shell 메모리에만 두고 출력·저장하지 않습니다.

```powershell
$LiveUrl = gcloud run services describe mandate-pool-live `
  --project project-682bea5f-ac81-4a36-8a1 `
  --region asia-northeast3 `
  --format='value(status.url)'
$IdToken = gcloud auth print-identity-token

curl.exe --silent --output NUL --write-out "%{http_code}`n" "$LiveUrl/health"
curl.exe --silent --show-error --header "Authorization: Bearer $IdToken" "$LiveUrl/health"
curl.exe --silent --show-error --header "Authorization: Bearer $IdToken" "$LiveUrl/readyz"
curl.exe --silent --show-error --header "Authorization: Bearer $IdToken" "$LiveUrl/api/v1/runtime"
$IdToken = $null
```

기대값:

- 무인증 `/health`: `403`
- 인증 `/health`: HTTP `200`
- 인증 `/readyz`: Vertex·Firestore·Solana 검사 모두 `true`
- 인증 `/api/v1/runtime`: `mode=live`, `onChain=true`, `SOLANA DEVNET`, `TEST TOKENS`
- catalog의 Team-3 총액: `1000000` atomic unit

이 단계에서는 주문 생성·승인·결제 POST endpoint를 호출하지 않습니다.

### P4.5. Solana localnet smoke

운영진 전달본의 권장 순서를 그대로 적용하는 단계입니다. Solana 공식 문서는 로컬 cluster를 실행하는 CLI binary로 `solana-test-validator`를 안내합니다. [Solana RPC infrastructure](https://solana.com/rpc)

현재 확인된 차단 요소:

- [ ] WSL과 Windows PATH에 `solana`, `solana-test-validator`, `spl-token`이 설치되어 있지 않습니다.
- [ ] 저장소에는 전용 `localnet:smoke` entrypoint가 아직 없습니다.

이 단계에서는 Devnet signer secret, Circle Devnet mint, 기존 Devnet ATA를 복제하거나 사용하지 않습니다. Production live mode의 Devnet genesis·mint lock도 완화하지 않습니다. 구현할 smoke harness는 disposable local signer, local mint, A/B/C source account, Merchant destination을 만든 뒤 동일한 `[333334, 333333, 333333]` 분담 계약만 재사용해야 합니다.

```text
solana-test-validator 시작
  -> disposable local signer·mint·token account 준비
  -> 정상: TransferChecked 3개를 transaction 1개로 submit
  -> local finality와 A/B/C debit·Merchant 1000000 credit 검증
  -> 거부: B cap 300000에서 transaction bytes·signature 0건 검증
  -> validator 종료와 임시 ledger 정리
```

**성공 기준:** validator·CLI version, local genesis, 정상 signature, decoded instruction, 전후 잔액, 거부 reason과 no-transaction 결과를 redacted receipt로 보존합니다.

**중단 조건:** Devnet secret 접근, production guard 완화, 임의 mint를 Circle USDC로 표현, 정상과 거부 중 하나라도 미검증이면 P5로 이동하지 않습니다.

### P5. HITL 뒤 정상·거부 증거 확보

정상 경로는 P4.5 localnet smoke receipt가 있고 사용자가 “총 1 Devnet 테스트 USDC 거래 1회 실행”을 명시적으로 승인한 뒤 진행합니다.

정상 경로에서 보존할 항목:

- 실행 직전 Buyer A/B/C와 Merchant의 finalized USDC 잔액
- A/B/C mandate와 각각의 HITL confirmation
- Gemini/ADK 정규화 trace와 결정론적 policy proof
- quote hash, policy proof hash, message hash
- transaction signature와 Devnet Explorer URL
- A `333334`, B `333333`, C `333333` debit과 Merchant `1000000` credit
- finalized 거래 재디코딩과 entitlement 세 개
- 실행 직후 잔액

거부 경로에서는 B cap을 `300000` atomic unit으로 설정하고 다음을 보존합니다.

- `NO_BUY` reason code
- settlement plan, transaction bytes, signature가 없다는 API 결과
- Buyer와 Merchant 잔액이 변하지 않았다는 확인

**성공 기준:** 정상·거부 결과가 각자 receipt에 연결되고, 정상 거래는 정확히 한 signature만 가집니다.

**중단 조건:** RPC 응답 유실, blockhash 만료, message mismatch, 잔액 불일치, finality 불명확은 자동 재결제 사유가 아닙니다. `RECONCILIATION_REQUIRED`로 멈추고 기존 signature부터 조사합니다.

### P6. 제출 묶음 완성

- [ ] 제품 소개서에 문제, 사용자, IDEA, Agent 역할, HITL, 아키텍처, 증거와 한계를 넣습니다.
- [ ] 3분 이내를 기본값으로 데모 영상을 편집합니다.
- [ ] Repo와 Cloud Run URL에 심사자가 접근할 수 있는지 확인합니다.
- [ ] README의 모든 실행 주장을 receipt와 대조합니다.
- [ ] 폼 제출 완료 화면과 KST 시각을 보존합니다.

**성공 기준:** 소개서·Repo·영상의 핵심 주장이 같은 transaction·revision·trace를 가리킵니다.

## Codex CLI 운용

현재 Codex 공식 매뉴얼 기준으로 `codex exec`는 기본 read-only sandbox에서 실행됩니다. 반복 사전점검에는 session rollout을 남기지 않는 `--ephemeral`을 함께 사용합니다.

```bash
codex exec --ephemeral --sandbox read-only \
  "이 저장소의 제출 준비 상태를 읽기 전용으로 점검하고, 누락된 계정·GCP·Devnet·증거만 보고해"
```

저장소 안의 구현과 문서 변경이 필요할 때만 workspace write와 on-request approval을 사용합니다.

```bash
codex --sandbox workspace-write --ask-for-approval on-request
```

`AGENTS.md`에는 비밀정보 금지, Mainnet 금지, 필수 검증 명령, receipt 경계를 짧고 지속 가능한 규칙으로 둡니다. 상세 절차는 이 런북에 두어 agent context가 불필요하게 커지지 않게 합니다. [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Codex approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)

Cloud Run MCP는 초기 배포의 선행조건을 없애지 않습니다. gcloud·ADC·IAM이 이미 필요하므로 마감 당일 최초 경로는 승인 기반 `gcloud`로 유지하고, 반복 운영이 생길 때만 MCP를 검토합니다. [Cloud Run MCP](https://docs.cloud.google.com/run/docs/use-cloud-run-mcp)

## 완료 정의

다음 항목을 모두 충족해야 `SUBMISSION_READY`로 판단합니다.

```text
로그인 후 공식 폼 필드 확인
  + 심사자가 접근 가능한 GitHub Repo
  + 프로덕트 소개서와 데모 영상
  + 접근 가능한 Cloud Run URL
  + Vertex·Firestore·Solana readiness
  + 전용 signer·mint로 실행한 localnet 정상·거부 smoke receipt
  + 총 1 Devnet 테스트 USDC의 finalized 정상 거래와 Explorer
  + 거부 경로의 no-transaction 증거
  + Gemini/ADK 및 Agent decision trace
  + Cloud Run revision receipt
  + 전체 Git history 비밀정보 검사
```

## 명시적 비범위

마감 전 구현 범위에 포함하지 않습니다.

- Solana Mainnet과 실제 자산
- 별도 Anchor/Rust program 배포
- Phantom 등 브라우저 지갑 연동
- x402 표준 구현 주장
- Google AI Studio API key
- Agent Engine 또는 GKE 별도 배포
- 상용 다자간 승인 체계

이 범위를 넓히려면 데모의 검증 가능성이 실제로 높아지는지 먼저 증명하고 별도 승인을 받습니다.

## 연결된 실행 증거

- [Devnet 지갑·ATA·자금](evidence/devnet-wallet-provisioning-2026-08-03.md)
- [GCP private fixture](evidence/gcp-private-fixture-deploy-2026-08-03.md)
- [GCP private live readiness](evidence/gcp-private-live-deploy-2026-08-03.md)
- [의존성 보안](evidence/dependency-security-audit-2026-08-03.md)
- [운영진 Devnet 안내](evidence/organizer-devnet-guidance-2026-08-03.md)
- [공식 문서 Wiki](../official-docs-wiki/README.md)

이메일, Google credential, API token, Solana private key, secret payload는 이 문서와 채팅에 기록하지 않습니다.
