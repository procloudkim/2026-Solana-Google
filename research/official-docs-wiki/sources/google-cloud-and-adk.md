# Google Cloud, ADK, 크레딧: 런타임과 비용 경계

확인일: 2026-08-03

이 문서는 Cloud Run·ADK를 왜 쓰는지와 Google Cloud Welcome credit·Gemini API 과금을 어떻게 분리할지 정한다. 현재 계정의 실제 잔액·quota·IAM은 공식 일반 문서가 아니라 콘솔과 배포 probe로 확인해야 한다.

## 공식 출처

- [Google Cloud Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features)
- [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing/)
- [What is Cloud Run](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run)
- [Agent Development Kit on Google Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/adk)

## 핵심 사실

### Google Cloud 비용

- Free Trial은 자격을 충족하는 신규 사용자에게 USD 300 Welcome credit을 90일 동안 제공한다.
- 자격은 Google Cloud·Google Maps Platform·Firebase의 기존 유료 사용 및 이전 Free Trial 가입 이력 등에 따라 달라진다.
- 결제 수단 확인이 필요할 수 있으며, trial 종료·credit 소진·유료 계정 전환에 따른 서비스 지속 조건이 있다.
- Free Tier는 선택 제품별 월간 한도다. Free Trial과 같은 제도가 아니며, 한도 초과 비용은 billing account 상태에 따라 달라진다.

### Gemini API 비용

- Gemini API에는 선택 모델과 rate limit에 따른 Free Tier가 있을 수 있다.
- Google은 2026-03-02 이후 개설한 계정의 USD 300 Welcome credit을 Gemini API와 AI Studio 사용료에 적용할 수 없다고 안내한다.
- Gemini API billing은 Cloud Billing과 연결되더라도 credit 적격성, prepay/postpay, tier, quota를 별도로 확인해야 한다.

따라서 `Google Cloud USD 300 = Gemini API USD 300`으로 설명하면 안 된다.

### Cloud Run과 ADK

- Cloud Run은 Google 인프라에서 code·function·container를 실행하는 완전 관리형 application platform이다.
- ADK는 agent를 build·debug·deploy하기 위한 오픈소스 프레임워크다.
- ADK는 workflow orchestration과 multi-agent 구성을 지원하며 로컬, 관리형 runtime, Cloud Run, GKE에서 실행할 수 있다.
- AP2 sample이 ADK·Gemini를 사용해도 AP2 protocol 자체가 이를 요구하지는 않는다.

## Mandate Pool에 미치는 의미

| 결정 | 이유 | 검증 방법 |
|---|---|---|
| Cloud Run을 private runtime으로 사용 | 짧은 해커톤에서 container 운영 부담을 줄이고 revision을 증거로 남길 수 있음 | unauthenticated 403, authenticated health, revision/digest 기록 |
| ADK/Gemini는 언어 작업에만 사용 | 비결정적 제안과 결제 권한을 분리 | trace에서 model output과 policy proof 비교 |
| Firestore는 상태·idempotency에 사용 | multi-step settlement의 durable state 필요 | CAS·duplicate/retry tests |
| Secret Manager로 signer·HMAC 주입 | 저장소와 build artifact에 secret을 두지 않음 | IAM review와 secret pattern scan |
| GCP와 Gemini 예산 분리 | credit 제도와 과금 경로가 다름 | billing account·quota·budget alert 확인 |

## 실행 체크리스트

1. 프로젝트의 billing account, Free Trial 잔액·만료, Gemini tier를 각각 확인한다.
2. Cloud Run runtime identity에 필요한 최소 IAM만 부여한다.
3. source deploy 또는 image digest가 제출 commit과 일치하는지 기록한다.
4. readiness는 Firestore·Vertex·Solana의 read-only probe만 수행하게 한다.
5. 로그에 API key, wallet key, service-account JSON, `.env` 값을 출력하지 않는다.

공식 문서가 보장하는 것은 서비스의 일반 동작과 과금 규칙이다. 특정 계정의 무료 사용 가능 여부나 해커톤 크레딧 발급은 확인 결과를 별도 evidence로 남겨야 한다.
