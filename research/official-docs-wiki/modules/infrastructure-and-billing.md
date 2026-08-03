# 모듈: 인프라와 과금

근거: [Google Cloud·ADK·크레딧 추출본](../sources/google-cloud-and-adk.md), [행사 계약 추출본](../sources/event-contract.md)

## 권장 아키텍처를 의무와 분리하기

현재 행사 페이지는 Cloud Run 중심의 서버리스 구성을 강하게 추천하며 Pub/Sub, Eventarc, Workflows, Firestore, BigQuery 조합 예시를 제공한다. 이것은 짧은 해커톤 기간에 운영 부담을 줄이는 가이드다. 모든 구성 요소를 사용해야 한다는 규칙은 아니다.

```text
pay.sh/AP2/x402 event
  -> Eventarc or Pub/Sub
  -> Workflows / Cloud Run verification
  -> Firestore receipt
  -> optional BigQuery audit
  -> agent response
```

## 과금 경계

| 구분 | 공식 내용 | 위험한 오독 |
|---|---|---|
| Google Cloud Free Trial | 자격이 되는 신규 계정, USD 300, 90일 | 모든 참가자가 자동 수령 |
| Gemini API Free Tier | 선택 모델·rate limit에 따른 별도 무료 구간 | USD 300와 같은 지갑 |
| Gemini API 유료 사용 | 현재 별도 billing 규칙 적용 | 2026-03-02 이후 신규 Cloud Trial 크레딧으로 자동 결제 |

비용 계획에는 Cloud Run/Firestore 등 Google Cloud 소비와 Gemini API 소비를 별도 예산 열로 둔다.

## ADK 경계

ADK는 에이전트 개발과 orchestration에 적합한 공식 Google 프레임워크다. 샘플이나 AP2 데모가 ADK를 쓴다는 사실은 AP2 프로토콜이 ADK 종속이라는 뜻이 아니다. 평가에서는 사용 여부보다 실제 에이전트 행동, Google Cloud AI 활용, 감사 가능한 실행 증거를 함께 보여준다.
