# GCP 비공개 live 의존성 검증 기록

## 검증 목적

이 문서는 Mandate Pool의 `live` 구성이 private Cloud Run에서 기동되고 Vertex AI, Firestore, Solana Devnet의 **읽기 전용 readiness**를 통과했는지 검증한다. 이 단계에서는 주문 생성·승인·실행 POST를 호출하지 않았으므로 제품 결제 성공을 증명하지 않는다.

`live`는 실제 외부 의존성을 사용한다는 실행 모드 이름이다. `SOLANA_CLUSTER=devnet`이므로 Mainnet이나 실자산을 뜻하지 않는다. Circle 공식 문서에 따르면 Devnet USDC는 금전 가치가 없고 실제 미국 달러로 담보되지 않는 테스트 토큰이다. [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## 검증 대상

| 항목 | 검증값 |
|---|---|
| 실행 시각 | 2026-08-03 20:23 KST |
| 프로젝트·리전 | `project-682bea5f-ac81-4a36-8a1` · `asia-northeast3` |
| 서비스·revision | `mandate-pool-live` · `mandate-pool-live-00001-n99` |
| 비공개 URL | `https://mandate-pool-live-913618402205.asia-northeast3.run.app` |
| Cloud Build | `15a02e3b-c3a5-44d1-aa66-a3e8d5699451` |
| 이미지 digest | `sha256:68d6dee85ea67da7c0befe5dec4ae80fe167493e2f51fdb5444bb4e6cd19952d` |

## 배포 계약

| 항목 | 검증값 |
|---|---|
| 실행 모드 | `APP_MODE=live`, `SOLANA_CLUSTER=devnet` |
| Google AI | Vertex AI, `global`, `gemini-2.5-flash` |
| 상태 저장 | Firestore `(default)`, namespace `v0` |
| Solana | 공식 Devnet RPC와 Circle Devnet USDC mint |
| runtime identity | `mandate-pool-runtime@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com` |
| build identity | `mandate-pool-build@project-682bea5f-ac81-4a36-8a1.iam.gserviceaccount.com` |
| secret 참조 | Demo key, entitlement, Sponsor, Buyer A/B/C의 여섯 secret을 모두 version `1`로 고정 |
| 자원 상한 | CPU 1, memory 512 MiB, timeout 60초, revision max instances 1 |
| 공개 IAM | service-level IAM binding 없음, `allUsers` 없음 |

민감한 payload는 출력하거나 파일에 쓰지 않았다. Cloud Run 환경에는 Secret Manager 리소스명과 version 참조만 저장했다. Google은 secret을 환경변수로 주입할 때 `latest` 대신 특정 version에 고정하도록 권고한다. [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets)

runtime에는 default identity 대신 필요한 권한만 부여한 user-managed service account를 연결했다. 이는 Google이 설명하는 Cloud Run service identity 모델과 일치한다. [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity)

## 검증 방법

1. revision condition에서 준비·활성·컨테이너 health를 확인했다.
2. 같은 `/health` 경로를 무인증과 Google-signed ID token 인증 상태에서 각각 호출해 IAM 경계를 양방향으로 확인했다. private Cloud Run에 audience가 맞는 ID token을 전달하는 방식은 공식 인증 계약과 일치한다. [Cloud Run service-to-service authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)
3. `/readyz`로 네 구성 영역의 읽기 전용 probe 결과를 확인했다.
4. `/api/v1/runtime`으로 live mode, Devnet cluster, on-chain settlement adapter 활성화를 확인했다.
5. 배포 전후 finalized 잔액을 비교해 readiness가 transaction을 만들지 않았는지 확인했다.

## 관찰 결과

| 검사 | 관찰값 |
|---|---|
| revision condition | `Ready=True`, `Active=True`, `ContainerHealthy=True` |
| 무인증 `/health` | HTTP 403 |
| Google ID token `/health` | HTTP 200, `{"ok":true}` |
| Google ID token `/readyz` | HTTP 200, `domain`, `stateRepository`, `settlement`, `agentConfiguration` 모두 `true` |
| Google ID token `/api/v1/runtime` | HTTP 200, `mode=live`, `cluster=solana-devnet`, `onChain=true` |

`onChain=true`는 on-chain settlement 구현이 구성됐다는 label이지 transaction 성공 영수증이 아니다.

## 읽기 전용 경로 확인

[Live composition](../../../product/mandate-pool/src/main.ts)은 HTTP listen 전에 Secret Manager가 주입한 Sponsor와 Buyer A/B/C signer 네 개를 메모리에 복원하고 다음 상태만 읽어 검증한다.

- Solana Devnet genesis, Circle mint, Buyer·Merchant ATA와 잔액, Sponsor SOL
- Firestore collection query 1회
- Vertex `countTokens` readiness probe

[HTTP routes](../../../product/mandate-pool/src/http/app.ts)의 `/readyz`도 Firestore document `get`, Solana `getBlockHeight`, Vertex `countTokens`만 수행한다. `/health`와 `/api/v1/runtime`은 프로세스 상태와 구성 label만 반환한다. 이 세 GET 경로에는 Firestore write, transaction 서명 또는 `sendTransaction`이 없다.

온체인 서명·전송 경로는 `X-Demo-Key`와 `Idempotency-Key`가 모두 필요한 `POST /api/v1/orders/:orderId/run`이다. 이번 검증에서는 주문 생성·승인·실행 POST를 모두 호출하지 않았다.

## 배포 후 온체인 불변 확인

배포와 readiness 뒤 finalized slot `480905073`에서 Buyer A/B/C는 각각 20 Devnet USDC, Merchant는 0 Devnet USDC였다. mint, owner, initialized 상태도 배포 전과 같았다. Sponsor는 finalized slot `480905074`에서 `4,991,837,880` lamports로 유지됐다.

이 전후 불변 결과는 readiness GET이 자금을 이동시키지 않았다는 코드 검토와 일치한다. 다만 다른 시점의 제3자 transaction 부재까지 보증하지는 않는다.

## 주장별 판정

| 검증하려는 주장 | 판정 | 근거와 의미 |
|---|---|---|
| 서비스가 공개되지 않았다 | 통과 | IAM binding에 `allUsers`가 없었고 같은 경로에서 무인증 403·인증 200을 함께 관찰했다. |
| runtime이 전용 identity로 Google API를 호출한다 | 통과 | revision service account 설정이 user-managed service identity 계약과 일치했다. |
| secret version이 고정됐다 | 통과 | 여섯 참조가 모두 version `1`이었고 값은 기록하지 않았다. |
| readiness가 결제를 만들지 않았다 | 통과 | GET 코드 경로가 read-only였고 배포 전후 finalized 잔액이 같았다. |
| 외부 live 의존성이 기동 가능하다 | 통과 | 네 `/readyz` 영역이 true였고 runtime label이 live·Devnet 구성을 반환했다. |
| Devnet USDC가 실제 돈이다 | 실패 | Circle은 testnet token에 금전 가치와 실제 달러 담보가 없다고 명시한다. |
| 제품 결제가 성공했다 | 아직 주장 불가 | 실행 POST, 제품 transaction signature, finalized receipt를 만들지 않았다. |

## 한계와 다음 행동

이 기록이 확보한 것은 `mandate-pool-live-00001-n99`의 **private live dependency readiness**다. Gemini/ADK 의사결정 trace, 정상·거부 경로 receipt, 제품이 만든 Devnet 결제 transaction은 아직 이 문서의 증거가 아니다.

또한 이 revision은 총 1 Devnet 테스트 USDC 가격 변경 이전 이미지다. 현재 소스를 새 private revision으로 배포하고 무인증 403, 인증 GET 세 경로, finalized 잔액 불변을 다시 확인하기 전에는 1 USDC 데모의 현재 배포라고 주장하지 않는다. 실제 실행은 별도 HITL 승인 뒤에만 진행하고, signature·finalized transaction·정확한 전후 잔액·Gemini/ADK trace를 새 정상 경로 receipt에 함께 보존한다.
