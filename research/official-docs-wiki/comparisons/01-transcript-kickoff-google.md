# 01. 킥오프·Google 세션 전사 대조

원본: [2026-07-21 19-08-24 전사](../../../.harness/enrichment/transcripts/2026-07-21-19-08-24-044ccd9e02.md)

주의: 전사는 48:32 부근에서 문장 중간에 끝나고, speaker identity를 확정하지 않는다. 아래 판정은 고영향 주장만 다룬다.

| 위치 | 로컬 문서의 주장 | 판정 | 현재 공식 근거 | 적용 조치 |
|---|---|---|---|---|
| 01:24~01:36 | 제출 마감 8/3 23:59, 파이널리스트 8/7 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/), [행사 계약 추출](../sources/event-contract.md) | 일정 SSOT로 사용 |
| 01:42~01:52 | Demo Day가 8/20이라고 들림 | **상충** | 현재 [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)와 [Luma](https://luma.com/gcp-solana-tech-session?locale=ko)는 8/21 | 8/21로 정정; 전사 후반 08:42의 8/21과도 일치 |
| 01:52~02:34 | 제출물은 제품 소개, GitHub, 데모 영상 3종 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) | 세 상위 범주를 제출 체크리스트로 사용 |
| 02:31~02:44 | 라이브 배포 URL도 내면 좋음 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 live endpoint를 권장 | 보너스/권장으로 관리; 필수 게이트로 만들지 않음 |
| 03:40~03:50, 08:10~08:18 | Google Cloud USD 300 크레딧 | 부분 일치 | [Google Cloud Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features), [Gemini billing](https://ai.google.dev/gemini-api/docs/billing/) | 자격·90일·Gemini API 제외 조건을 함께 표기 |
| 08:39~08:50 | Demo Day에서 실제 에이전트 결제를 live로 보여줌 | 부분 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 실제 트랜잭션·결제와 로그/이력을 평가 | finalist 시연과 제출 최소 요건을 혼동하지 말고 tx evidence를 준비 |
| 33:09~34:10 | Cloud Run을 데모/배포 인프라로 사용 | 일치 | [Cloud Run](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run), [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) | 권장 baseline으로 사용 가능; 절대 의무는 아님 |
| 전반 | ADK, AP2, A2A, x402 등 소개된 기술을 모두 써야 한다는 인상 | 부분 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 기술 활용을 평가·추천하지만 전체 목록 의무라고 쓰지 않음 | 해결하려는 책임에 맞는 최소 조합을 선택 |

## 결론

일정과 제출물의 큰 틀은 맞지만 Demo Day 날짜는 8/21로 정정해야 한다. USD 300은 Gemini API 예산으로 합산하면 안 되며, 라이브 URL·특정 기술 스택은 현재 공개 계약상 권장/평가 요소이지 모두 필수는 아니다.
