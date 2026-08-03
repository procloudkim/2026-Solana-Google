# GCP 비공개 live 배포 영수증

- 실행 시각: 2026-08-03 20:23 KST
- 프로젝트·리전: `project-682bea5f-ac81-4a36-8a1` · `asia-northeast3`
- 서비스·revision: `mandate-pool-live` · `mandate-pool-live-00001-n99`
- 비공개 URL: `https://mandate-pool-live-913618402205.asia-northeast3.run.app`
- Cloud Build: `15a02e3b-c3a5-44d1-aa66-a3e8d5699451`
- 이미지 digest: `sha256:68d6dee85ea67da7c0befe5dec4ae80fe167493e2f51fdb5444bb4e6cd19952d`

## 배포 계약

| 항목 | 검증된 값 |
|---|---|
| 실행 모드 | `APP_MODE=live`, `SOLANA_CLUSTER=devnet` |
| Google AI | Vertex AI, `global`, `gemini-2.5-flash` |
| 상태 저장 | Firestore `(default)`, namespace `v0` |
| Solana | 공식 Devnet RPC와 Circle Devnet USDC mint |
| 런타임 identity | `mandate-pool-runtime@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com` |
| 빌드 identity | `mandate-pool-build@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com` |
| 비밀 | Demo key, entitlement, Sponsor, Buyer A/B/C의 여섯 secret을 모두 version `1`로 고정 |
| 자원 상한 | CPU 1, memory 512 MiB, timeout 60초, revision max instances 1 |
| 공개 IAM | service-level IAM binding 없음, `allUsers` 없음 |

민감한 payload는 출력하거나 파일에 쓰지 않았다. Cloud Run 환경에는 Secret Manager 참조 이름과 version만 저장된다. 환경변수로 주입하는 secret은 특정 version에 고정하라는 Google의 권고와 일치한다. [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets)

## 실제 검증 결과

| 검사 | 결과 |
|---|---|
| revision 조건 | `Ready=True`, `Active=True`, `ContainerHealthy=True` |
| 무인증 `/health` | HTTP 403 |
| Google ID token `/health` | HTTP 200, `{"ok":true}` |
| Google ID token `/readyz` | HTTP 200, `domain`, `stateRepository`, `settlement`, `agentConfiguration` 모두 `true` |
| Google ID token `/api/v1/runtime` | HTTP 200, `mode=live`, `cluster=solana-devnet`, `onChain=true` |

비공개 Cloud Run 호출에 Google-signed ID token을 사용하는 방식은 공식 인증 계약과 일치한다. [Cloud Run service-to-service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service) 런타임에는 default identity가 아니라 최소 권한의 user-managed service account를 연결했다. [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity)

## 읽기 전용 경계

[Live composition](../../../product/mandate-pool/src/main.ts)은 HTTP listen 전에 Secret Manager가 주입한 네 signer를 메모리에 복원하고 다음 항목만 읽어 검증한다.

- Solana Devnet genesis, Circle mint, Buyer·Merchant ATA와 잔액, Sponsor SOL
- Firestore collection query 1회
- Vertex `countTokens` readiness probe

[HTTP routes](../../../product/mandate-pool/src/http/app.ts)의 `/readyz`도 Firestore document `get`, Solana `getBlockHeight`, Vertex `countTokens`만 수행한다. `/health`와 `/api/v1/runtime`은 프로세스 상태와 구성 label만 반환한다. 이 세 GET 경로에는 Firestore write, transaction 서명, `sendTransaction`이 없다.

실제 결제·서명 경로는 `X-Demo-Key`와 `Idempotency-Key`가 모두 필요한 `POST /api/v1/orders/:orderId/run`이다. 이번 배포 검증에서는 주문 생성·승인·실행 POST를 모두 호출하지 않았다.

## 배포 후 온체인 불변 확인

배포와 readiness 뒤 finalized slot `480905073`에서 Buyer A/B/C는 각각 20 USDC, Merchant는 0 USDC였다. mint, owner, initialized 상태도 배포 전과 같았다. Sponsor는 finalized slot `480905074`에서 `4,991,837,880` lamports로 유지됐다.

따라서 이 단계가 확보한 것은 **실제 live 의존성의 준비 완료 증거**다. 아직 확보하지 않은 것은 제품이 만든 결제 transaction, Gemini/ADK 의사결정 trace, 정상·거부 경로 receipt다.

## `$factchk` 판정

| claim | 판정 | 근거 |
|---|---|---|
| 서비스가 공개되지 않았다 | 통과 | IAM binding 없음과 실제 무인증 403, 인증 200을 함께 관찰 |
| 런타임이 전용 identity로 Google API를 호출한다 | 통과 | revision의 service account 설정과 공식 service identity 계약 일치 |
| secret version이 고정됐다 | 통과 | 여섯 참조 모두 `key=1`; 공식 문서는 env secret의 특정 version 고정을 권고 |
| readiness가 결제를 만들지 않았다 | 통과 | 코드 경로의 read-only probe와 배포 전후 finalized 잔액 불변을 양방향 확인 |
| 제품 결제가 성공했다 | 아직 주장 불가 | 결제 실행 POST와 finalized 제품 transaction을 아직 만들지 않음 |
