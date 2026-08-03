# 04. Hackathon Intro Deck OCR 대조

원본: [Hackathon Intro Deck OCR](../../../.harness/enrichment/pdfs/google-x-solana-ai-agentic-hackathon-intro-deck-1-e6d4213a04.md)

주의: PDF OCR에는 `$30O`, 시간의 `O`, 텍스트 열 순서 손실이 있다. 페이지 이미지를 보지 않고 OCR 문자열을 정확한 계약 문구로 사용하면 안 된다.

| 페이지 | 로컬 문서의 주장 | 판정 | 현재 공식 근거 | 적용 조치 |
|---|---|---|---|---|
| 1, 4 | Demo Day 2026-08-21 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/), [Luma](https://luma.com/gcp-solana-tech-session?locale=ko) | 8/21을 SSOT로 사용 |
| 4 | 7/17~8/3 빌드, 8/7 발표, 8/10~20 멘토링 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) | 현재 일정과 동일 |
| 5 | PPT·GitHub·3분 이내 데모 영상 | 부분 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 제품 소개·GitHub·데모 영상을 요구하지만 현재 `3분`과 PPT 형식을 명시하지 않음 | 세 상위 제출물은 유지; 3분 제한은 제출 폼에서 재확인 |
| 5 | 실제 온체인 결제 전 과정은 BONUS, live URL은 가산점 | **버전 드리프트** | 현재 [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 실제 transaction/payment와 로그를 평가 기준에 포함하고 live endpoint는 권장 | 온체인 실행 증거를 단순 보너스로 취급하지 않음 |
| 5 | mock-up은 심사 제외, Demo Day 당일 실제 결제 | 부분 일치 | 현재 [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 실제 작동·로그를 요구하지만 공개 페이지에서 동일한 `mock-up 제외` 문구는 확인되지 않음 | 실제 tx를 준비하되 정확한 실격 규칙은 제출 계약 재확인 |
| 2, 9 | 총 USD 5,000, 3,000/1,500/500, 절반은 글로벌 해커톤 참여 시 지급 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) FAQ | 상금 수령 조건을 팀 계획에 포함 |
| 10 | 개인 가능, 팀 최대 4명 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) | 팀 규칙으로 사용 |
| 10 | 개인 Gmail로 USD 300 발급, 참가에 개인 Gmail 필요 | 부분 일치 | [Google Cloud Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features)은 Google 계정·자격을 설명하지만 현재 행사 페이지는 개인 Gmail을 참가 필수로 명시하지 않음 | 크레딧 계정 지침과 참가 자격을 분리 |
| 10 | Google Cloud USD 300은 Gemini API에 사용 불가 | 일치 | 현재 [Gemini billing](https://ai.google.dev/gemini-api/docs/billing/)은 2026-03-02 이후 신규 Free Trial credit의 Gemini API 사용 제외를 안내 | GCP와 Gemini API 예산을 분리 |

## 결론

일정·팀·상금의 큰 틀은 현재 공식 페이지와 맞는다. 반면 3분 제한, Gmail 참가 필수, 상세 PPT 목차는 현재 공개 계약에서 재확인되지 않는다. 가장 중요한 변화는 실제 트랜잭션 증거가 현재 평가 기준의 중심이라는 점이다.
