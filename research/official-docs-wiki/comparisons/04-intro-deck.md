# 04. Hackathon Intro Deck OCR 대조

이 문서는 intro deck OCR에서 복원된 일정·제출 형식·상금 문구를 현재 공개 계약과 대조한다. 독자가 가져갈 결론은 단순하다. 일정·팀·상금은 대체로 유지되지만, OCR의 `3분`, Gmail 필수, 온체인 실행은 단지 bonus라는 표현을 현재 규칙처럼 사용하면 안 된다.

- 원본: [Hackathon Intro Deck OCR](../../../.harness/enrichment/pdfs/google-x-solana-ai-agentic-hackathon-intro-deck-1-e6d4213a04.md)
- 비교 데이터: 2026-07-23
- 고영향 공식 사실 재확인: 2026-08-03

OCR에는 `$30O`, 숫자 `0`과 문자 `O`, 열 순서 손실이 있다. page image나 원본 PDF를 확인하지 않은 OCR 문자열은 정확한 계약 문구가 아니다.

## 판정과 조치

| page | OCR에서 읽힌 주장 | 판정 | 공식 근거와 보정 | 제출 조치 |
|---|---|---|---|---|
| 1, 4 | Demo Day 2026-08-21 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/), [Luma](https://luma.com/gcp-solana-tech-session?locale=ko) | 일정 SSOT에 8/21 사용 |
| 4 | 7/17~8/3 build, 8/7 발표, 8/10~20 mentoring | 일치 | 행사 페이지의 현재 일정과 같음 | runbook 일정과 일치 유지 |
| 5 | PPT·GitHub·3분 이내 demo video | 부분 일치 | 행사 페이지는 product intro·GitHub·demo video를 요구하지만 `3분`과 PPT format은 공개하지 않음 | 세 상위 범주는 고정, 길이·형식은 제출 form에서 확인 |
| 5 | full on-chain payment는 bonus, live URL은 가산점 | **버전 드리프트** | 현재 행사 페이지는 actual transaction/payment와 log를 심사 기준으로 두고 live endpoint는 권장 | 온체인 proof를 optional decoration으로 취급하지 않음; 가산점 보장 표현 제거 |
| 5 | mock-up은 심사 제외, Demo Day 당일 실제 결제 | 부분 일치 | 현재 페이지는 MVP/PoC·온체인 실행 증빙과 live 작동을 요구하지만 같은 실격 문구는 없음 | 작동 product를 제출하되 정확한 실격 규칙은 form에서 확인 |
| 2, 9 | 총 USD 5,000, 3,000/1,500/500, 절반은 global hackathon 참여 시 지급 | 일치 | 행사 페이지 FAQ | 수령 조건을 team plan에 별도 기록 |
| 10 | 개인 가능, team 최대 4명 | 일치 | 행사 페이지 | team metadata 일치 확인 |
| 10 | 개인 Gmail로 USD 300 발급, 참가에 개인 Gmail 필요 | 부분 일치 | [Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features)은 Google account와 credit 자격을 설명하지만 행사 페이지는 개인 Gmail을 참가 요건으로 적지 않음 | credit account 지침과 참가 자격을 분리 |
| 10 | Google Cloud USD 300은 Gemini API에 사용 불가 | 일치 | [Gemini billing](https://ai.google.dev/gemini-api/docs/billing/)은 2026-03-02 이후 account의 Welcome credit 제외를 명시 | GCP runtime과 Gemini 예산 분리 |

## Mandate Pool에 미치는 의미

제품은 live Devnet transaction과 거부 path를 이미 acceptance target으로 삼아야 한다. “온체인은 bonus”라는 옛 framing으로 fixture demo만 제출하면 현재 심사 기준의 actual execution을 충족했다고 보기 어렵다. 반대로 live URL을 제공한다고 점수가 자동으로 오른다고 주장하지 않는다.

## 실행 항목

1. 제출 form을 열어 video length, file type, link permission을 실제로 확인한다.
2. product intro, GitHub, video에 같은 Why·What·How와 증거 경계를 사용한다.
3. Devnet signature를 영상·README·receipt에서 같은 order로 연결한다.
4. 상금 조건은 제품 가치나 기술 architecture 설명에서 분리한다.

OCR은 초기 요구를 복원하는 단서다. 현재 공개 페이지와 제출 form이 최종 실행 계약이다.
