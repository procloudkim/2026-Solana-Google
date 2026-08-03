# 01. 킥오프·Google 세션 전사 대조

이 문서는 킥오프에서 들은 일정·제출물·Google Cloud 안내를 실제 제출 계약으로 사용할 수 있는지 판정한다. 결론부터 말하면 큰 방향은 맞지만 Demo Day 날짜, USD 300 credit의 범위, 권장 기술과 필수 기술의 구분을 보정해야 한다.

- 원본: [2026-07-21 19-08-24 전사](../../../.harness/enrichment/transcripts/2026-07-21-19-08-24-044ccd9e02.md)
- 비교 데이터: 2026-07-23
- 고영향 공식 사실 재확인: 2026-08-03

전사는 48:32 부근에서 문장 중간에 끝나며 speaker identity를 확정하지 않는다. 아래 표는 제품·제출 결정을 바꾸는 주장만 다룬다.

## 판정과 조치

| 위치 | 전사에서 읽힌 주장 | 판정 | 공식 근거와 보정 | Mandate Pool 조치 |
|---|---|---|---|---|
| 01:24~01:36 | 제출 마감 8/3 23:59, 파이널리스트 8/7 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) | 마감 시각과 제출 완료 증거를 runbook의 기준으로 사용 |
| 01:42~01:52 | Demo Day 8/20 | **상충** | 행사 페이지와 [Luma](https://luma.com/gcp-solana-tech-session?locale=ko)는 8/21 | 모든 문서·발표에서 8/21로 통일 |
| 01:52~02:34 | 제품 소개, GitHub, 데모 영상 제출 | 일치 | 행사 페이지의 필수 상위 범주와 같음 | 세 산출물을 같은 commit/revision 기준으로 묶음 |
| 02:31~02:44 | live 배포 URL을 내면 좋음 | 일치 | 행사 페이지는 endpoint 제출을 권장 | 제공하되 필수 또는 가점 보장으로 표현하지 않음 |
| 03:40~03:50, 08:10~08:18 | Google Cloud USD 300 credit 사용 | 부분 일치 | [Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features)은 자격·90일 조건을 둠. [Gemini billing](https://ai.google.dev/gemini-api/docs/billing/)은 2026-03-02 이후 계정의 Welcome credit을 Gemini API·AI Studio에 쓸 수 없다고 명시 | GCP runtime 비용과 Gemini API 비용을 분리 |
| 08:39~08:50 | Demo Day에서 실제 agent 결제를 live로 보여줌 | 부분 일치 | 행사 페이지는 actual transaction/payment와 로그·이력을 평가하지만 이 문구만으로 모든 제출자가 Demo Day live payment를 해야 한다고 확정할 수 없음 | 제출에는 Devnet receipt를 포함하고, 결선 시연 계획은 별도로 준비 |
| 33:09~34:10 | Cloud Run을 배포 인프라로 사용 | 일치 | [Cloud Run](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run)과 행사 페이지의 권장 architecture에 부합 | private Cloud Run revision과 digest를 증거로 남김 |
| 전반 | ADK·AP2·A2A·x402 등 소개 기술을 모두 사용해야 함 | 부분 일치 | 행사 페이지는 AI·Solana·protocol integration을 평가하지만 전체 목록을 의무화하지 않음 | 실제 구현한 ADK/Gemini·custom Solana settlement만 주장 |

## 제품에 미치는 의미

Mandate Pool은 Cloud Run과 ADK/Gemini를 실제로 쓰되, 결제 권한은 결정론적 policy와 signer boundary에 둔다. live endpoint 자체보다 `조건 → agent proposal → HITL → policy → Devnet transaction → finalized entitlement`의 인과 trace가 심사 근거다.

## 실행 항목

1. 제출물 3종의 commit SHA와 Cloud Run revision을 일치시킨다.
2. GCP·Gemini 비용을 별도 예산으로 확인한다.
3. 발표 자료에서 8/20, 모든 protocol 의무, Gemini에 쓸 수 있는 USD 300이라는 표현을 제거한다.
4. live endpoint가 private이면 심사자 접근 절차를 제품 소개에 적는다.

남은 불확실성은 데모 영상의 정확한 길이와 제품 소개서 형식이다. 공식 공개 페이지가 정하지 않았으므로 제출 폼에서 확인한다.
