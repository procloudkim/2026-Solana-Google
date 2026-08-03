# 인프라와 과금: 데모를 안전하게 운영하는 최소 구조

이 모듈은 “Google 기술을 얼마나 많이 썼는가”가 아니라, **에이전트 판단부터 Devnet 거래 검증까지 재현 가능한 최소 런타임을 어떻게 운영할지** 정한다. 근거는 [Google Cloud·ADK·크레딧 노트](../sources/google-cloud-and-adk.md)와 [행사 계약](../sources/event-contract.md)이다.

## 현재 제품의 최소 아키텍처

```text
browser/operator
  -> private Cloud Run API
  -> ADK/Gemini: 자연어 조건 정규화·후보 제안
  -> deterministic policy: 승인·한도·상품·만료 검사
  -> Firestore: 상태·idempotency·감사 기록
  -> Solana Devnet RPC: 동일 원문 제출·finalized 재검증
  -> entitlement response

Secret Manager -> Cloud Run runtime identity only
```

Cloud Run은 완전 관리형 application platform이며 소스 또는 컨테이너를 실행할 수 있다. 공식 행사 페이지가 Pub/Sub, Eventarc, Workflows, Firestore, BigQuery 조합을 권장하지만, 모든 구성 요소를 사용해야 한다는 규칙은 아니다.

Mandate Pool v0에서는 동기 결제 경계와 Firestore 상태 무결성이 핵심이다. Pub/Sub·Eventarc·Workflows·BigQuery는 재시도 분리, 비동기 receipt, 분석이라는 명확한 책임이 생길 때만 추가한다. 심사 자료를 풍부하게 보이기 위한 서비스 나열은 장애 면적과 설명 비용만 늘린다.

## 과금 경계

| 비용 영역 | 공식 사실 | 운영 결정 |
|---|---|---|
| Google Cloud Free Trial | 자격을 충족하는 신규 사용자에게 USD 300 Welcome credit, 90일 | 자격·잔액·만료일 확인; 자동 지급으로 가정하지 않음 |
| Google Cloud Free Tier | 선택된 제품의 월별 무료 한도 | 한도를 넘으면 과금될 수 있으므로 budget alert 설정 |
| Gemini API Free Tier | 모델과 rate limit에 따른 별도 무료 구간 | Cloud Trial credit과 같은 예산으로 합산하지 않음 |
| Gemini API 유료 사용 | 2026-03-02 이후 개설 계정의 Welcome credit으로 Gemini API·AI Studio 비용 결제 불가 | 모델·호출량 예산을 별도로 잡고 billing 상태 확인 |

비용표에는 최소 두 개의 열을 둔다: `Cloud Run/Firestore/Logging 등 GCP 사용량`과 `Gemini API 사용량`. 무료라는 가정 대신 현재 billing account와 quota를 기록한다.

## ADK의 역할과 경계

ADK는 agent build·debug·deploy를 위한 Google의 오픈소스 프레임워크이며 로컬, Cloud Run, 관리형 runtime, GKE 등에서 실행할 수 있다. AP2 샘플이 ADK와 Gemini를 사용한다는 사실은 AP2가 둘을 요구한다는 뜻이 아니다.

Mandate Pool에서는 ADK/Gemini가 비결정적 언어 작업만 담당한다. signer, RPC 제출, 예산 차감, 최종 지급 판정은 모델 도구로 노출하지 않는다. 심사자에게는 이 분리가 자율성 부족이 아니라 **권한을 제한한 안전 설계**임을 trace로 보여준다.

## 배포 수용 기준

- Cloud Run service는 전용 service account로 실행하고 unauthenticated access를 열지 않는다.
- 비밀값은 Secret Manager에서 주입하며 저장소·빌드 로그·환경 덤프에 남기지 않는다.
- `/health`는 process liveness, `/readyz`는 Firestore·Vertex·Solana read-only readiness만 검사한다.
- readiness probe는 거래를 만들거나 signer를 호출하지 않는다.
- mutation endpoint에는 인증, idempotency, 상태 전이 검사가 있어야 한다.
- 배포 후 정상 경로 실행 전 unauthenticated 403, authenticated health, runtime label, catalog 금액을 읽기 전용으로 확인한다.
- Cloud Run revision, container digest, commit SHA를 receipt에 묶는다.

## 다음 행동

1. GCP와 Gemini 예산을 분리해 현재 잔액·한도·alert를 확인한다.
2. 배포 revision이 제출 commit을 가리키는지 확인한다.
3. Secret Manager IAM과 Cloud Run service identity를 재검토한다.
4. 실제 Devnet mutation은 명시적 HITL 뒤 한 번만 실행하고, 결과 불명확 시 자동 재결제하지 않는다.

공식 근거가 설명하는 것은 제품 기능과 과금 조건이다. 현재 계정의 잔액, quota, IAM, 배포 성공은 콘솔과 런타임 검사로 별도 증명해야 한다.
