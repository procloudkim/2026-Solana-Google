# Google Cloud, ADK, 크레딧

상태: 2026-07-23 현재 확인

## 공식 출처

- [Google Cloud Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features)
- [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing/)
- [What is Cloud Run](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run)
- [Agent Development Kit on Google Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/adk)

## 정규화 추출

- Google Cloud Free Trial은 자격을 충족하는 신규 사용자에게 USD 300 크레딧과 90일 기간을 제공한다. 자격, 서비스 범위, 결제 계정 전환 조건이 있다.
- Gemini API 과금은 Google Cloud 일반 Free Trial과 별도로 확인해야 한다. 공식 Gemini 문서는 2026-03-02 이후 시작한 신규 Free Trial의 Welcome 크레딧을 Gemini API/AI Studio 유료 사용에 적용할 수 없다고 안내한다.
- Gemini API에는 선택된 모델과 한도에 대한 Free Tier가 있을 수 있으나, 이것은 Google Cloud USD 300 크레딧과 같은 제도가 아니다.
- Cloud Run은 완전 관리형 실행 환경이다. Pub/Sub push, Eventarc, Workflows 등과 통합할 수 있다.
- ADK는 오픈소스 에이전트 개발 프레임워크다. 로컬, 관리형 런타임, Cloud Run, GKE 등으로 배포 선택지가 있다.

## 오해 방지

- `USD 300`을 `Gemini API에서 쓸 수 있는 USD 300`으로 재표현하면 안 된다.
- Cloud Run과 ADK는 행사 자료에서 강하게 권장되고 평가에 유리할 수 있지만, 현재 공개 행사 페이지가 모든 프로젝트에 ADK 사용을 절대 의무화하지는 않는다.
- Cloud Run 추천은 GKE가 금지된다는 뜻이 아니다.
