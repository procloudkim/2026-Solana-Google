# GCP 비공개 fixture 배포 검증 기록

## 검증 목적

이 문서는 결정론적 fixture 모드의 Mandate Pool이 Google Cloud Run에 비공개로 배포되고, 인증된 요청에서 기본 제품 흐름을 제공할 수 있었는지 검증한 **시점 스냅샷**이다. Vertex AI, Firestore 쓰기 또는 Solana 온체인 실행을 증명하는 문서가 아니다.

## 검증 대상

| 항목 | 검증값 |
|---|---|
| 실행일 | 2026-08-03 KST |
| GCP 프로젝트 | `project-682bea5f-ac81-4a36-8a1` |
| 리전 | `asia-northeast3` |
| 서비스 | `mandate-pool` |
| 검증 revision | `mandate-pool-00002-wwl` |
| 비공개 URL | `https://mandate-pool-913618402205.asia-northeast3.run.app` |

이 revision은 in-memory repository와 결정론적 agent·settlement를 사용하는 `fixture` 구성이다. 따라서 외부 의존성 실패와 관계없이 UI·API·정책 상태 전이를 검증하는 용도로만 해석한다.

## 방법과 전제

1. 필요한 Google API와 Firestore 데이터베이스, 전용 runtime·build identity를 구성했다.
2. fixture에 필요한 secret은 Secret Manager version 참조로만 주입하고 값은 출력하거나 파일에 저장하지 않았다.
3. 소스 업로드 manifest에서 `.env*`, `node_modules`, `dist`, `coverage`가 제외됐는지 확인했다.
4. Cloud Run revision condition을 확인하고, 같은 URL을 무인증과 Google ID token 인증 상태에서 각각 호출했다.
5. fixture mode·cluster·on-chain 여부를 `/api/v1/runtime` 응답으로 확인했다.
6. 배포 당시 소스에 대해 typecheck, 테스트, build를 실행했다.

## 관찰 결과

| 검사 | 관찰값 |
|---|---|
| 6개 API | Vertex AI, Firestore, Cloud Run, Cloud Build, Artifact Registry, Secret Manager 활성화 |
| Firestore | `(default)`, Standard, Native, 서울, free tier, PITR 비활성 |
| Firestore SDK | ADC를 사용해 존재하지 않는 readiness 문서 읽기 성공, 쓰기 없음 |
| runtime identity | `mandate-pool-runtime`, `roles/aiplatform.user`와 `roles/datastore.user` |
| build identity | `mandate-pool-build`, `roles/run.builder` |
| fixture secret 참조 | `mandate-pool-demo-key:1`, `mandate-pool-entitlement:1`; 값은 출력·파일 저장하지 않음 |
| 소스 업로드 | 48개 파일, `.env*`·`node_modules`·`dist`·`coverage` 유출 항목 0개 |
| revision condition | `Ready=True`, `Active=True`, `ContainerHealthy=True` |
| 무인증 `/health` | HTTP 403 |
| 인증된 `/health` | HTTP 200, `{ok:true}` |
| 인증된 `/readyz` | HTTP 200, fixture check 4개 `true` |
| 인증된 `/api/v1/runtime` | HTTP 200, `mode=fixture`, `cluster=fixture`, `onChain=false` |
| 배포 당시 로컬 gate | typecheck·build 성공, 9개 파일 86개 테스트 통과 |

무인증 403과 인증 200을 함께 관찰했으므로 이 시점에 호출 권한이 없는 사용자가 서비스에 직접 접근할 수 없었다. 단, 이 관찰은 revision의 전체 IAM 정책을 영구 보증하지 않으므로 재배포 후 같은 양방향 검사를 반복해야 한다.

## 발견한 배포 결함과 수정

초기 revision에서 `/healthz`는 애플리케이션까지 도달하지 않고 Google Frontend 404를 반환했다. Cloud Run은 일부 `z` 종결 경로를 예약하므로 외부 probe를 `/health`로 변경한 뒤 `mandate-pool-00002-wwl`을 배포했다. 로컬 호환을 위한 앱의 `/healthz` alias는 유지하지만 Cloud Run 검증에는 사용하지 않는다. [Cloud Run reserved URL paths](https://docs.cloud.google.com/run/docs/known-issues#reserved_url_paths)

## 판정과 증거 경계

**비공개 fixture 배포와 인증된 기본 응답은 검증됐다.** 그러나 아래 주장은 이 기록으로 할 수 없다.

- `/readyz=200`은 fixture 내부 check만 통과했다는 뜻이다. Vertex AI, Firestore, Solana readiness를 증명하지 않는다.
- `/api/v1/runtime`의 `onChain=false`가 명시하듯, 이 배포에서는 Solana RPC·서명·transaction을 실행하지 않았다.
- Gemini 제품 흐름과 Firestore 쓰기도 실행하지 않았다.
- fixture 결과는 결정론적 테스트 증거이며 온체인 proof, 실제 결제 또는 실자산 이동 증거가 아니다.

## 현재 사용 여부와 다음 행동

지갑·ATA·Devnet 테스트 자금·signer secret과 최초 private live readiness는 이후 별도 단계에서 검증됐다. 현재 실행 상태는 [환경 런북](../hackathon-environment-codex-runbook.md)과 [private live 배포 검증 기록](gcp-private-live-deploy-2026-08-03.md)을 따른다.

이 revision은 당시 배포를 재현하기 위한 역사적 영수증이다. 총 1 Devnet 테스트 USDC 가격을 반영한 새 revision으로 교체하고 동일한 IAM·health·runtime 검사를 통과하기 전에는 현재 제품 데모라고 주장하지 않는다. 재검증 시에는 무인증 403, 인증된 `/health`·`/readyz`·`/api/v1/runtime` 응답, revision condition을 한 묶음으로 보존한다.
