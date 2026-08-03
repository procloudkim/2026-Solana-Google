# GCP 비공개 fixture 배포 영수증

- 실행일: 2026-08-03 KST
- 프로젝트: `project-682bea5f-ac81-4a36-8a1`
- 리전: `asia-northeast3`
- 서비스: `mandate-pool`
- 최신 준비 revision: `mandate-pool-00002-wwl`
- 비공개 URL: `https://mandate-pool-913618402205.asia-northeast3.run.app`

## 검증 결과

| 검사 | 결과 |
|---|---|
| 6개 API | Vertex AI, Firestore, Cloud Run, Cloud Build, Artifact Registry, Secret Manager 활성화 |
| Firestore | `(default)`, Standard, Native, 서울, free tier, PITR 비활성 |
| Firestore SDK | ADC를 사용한 존재하지 않는 readiness 문서 읽기 성공, 쓰기 없음 |
| 런타임 identity | `mandate-pool-runtime`, `roles/aiplatform.user`와 `roles/datastore.user` |
| 빌드 identity | `mandate-pool-build`, `roles/run.builder` |
| fixture 비밀 | `mandate-pool-demo-key:1`, `mandate-pool-entitlement:1`; 값은 출력·파일 저장하지 않음 |
| 소스 업로드 | 48개 파일, `.env*`·`node_modules`·`dist`·`coverage` 유출 항목 0개 |
| revision | `Ready=True`, `Active=True`, `ContainerHealthy=True` |
| 무인증 `/health` | HTTP 403 |
| 인증된 `/health` | HTTP 200, `{ok:true}` |
| 인증된 `/readyz` | HTTP 200, fixture check 4개 `true` |
| 인증된 `/api/v1/runtime` | HTTP 200, `mode=fixture`, `cluster=fixture`, `onChain=false` |
| 로컬 검증 | typecheck·build 성공, 9개 파일 86개 테스트 통과 |

## 수정된 배포 결함

초기 revision에서 `/healthz`는 앱까지 도달하지 않고 Google Frontend 404를 반환했다. Cloud Run은 일부 `z` 종결 경로를 예약하므로 외부 probe를 `/health`로 변경하고 revision `mandate-pool-00002-wwl`로 재배포했다. 로컬 호환을 위해 앱의 `/healthz` alias는 유지하지만 Cloud Run 검증에는 사용하지 않는다. [Cloud Run known issues](https://docs.cloud.google.com/run/docs/known-issues#reserved_url_paths)

## 증거 경계

- 이 서비스는 IAM으로 보호된 **비공개 fixture**다. `allUsers` IAM binding은 없다.
- fixture는 in-memory repository와 결정론적 agent/settlement만 사용한다.
- `/readyz=200`은 이 revision에서 Vertex, Firestore, Solana readiness 증거가 아니다.
- 이 배포에서 Gemini 제품 흐름, Firestore 쓰기, Solana RPC·서명·거래를 실행하지 않았다.
- 실제 제출 증거에는 별도의 private live revision, `mode=live`, `onChain=true`, Devnet finalized signature, Gemini/ADK trace가 필요하다.

## 후속 상태

지갑·ATA·Devnet 자금·signer secret과 첫 private live readiness는 이후 모두 완료됐다. 현재 상태는 [환경 런북](../hackathon-environment-codex-runbook.md)과 [private live 배포 영수증](gcp-private-live-deploy-2026-08-03.md)을 따른다. 이 fixture revision은 배포 당시 스냅샷이며, 총 1 Devnet 테스트 USDC 가격을 반영한 새 revision으로 교체되기 전까지 현재 제품 데모로 주장하지 않는다.
