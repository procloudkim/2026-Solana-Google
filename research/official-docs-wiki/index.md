# Official Docs Wiki Index

기준일: 2026-07-23

## 가장 중요한 차이

1. **Demo Day는 8월 21일이다.** 전사에서 들리는 8월 20일은 현재 [공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) 및 [공식 Luma 일정](https://luma.com/gcp-solana-tech-session?locale=ko)과 상충한다.
2. **현재 평가 문구의 실행 환경은 localnet/testnet/devnet이다.** 일부 자료에서 보이는 `Devnet/Mainnet` 필수 표현은 현재 주최 페이지와 다르다. Mainnet을 필수로 간주하지 않는다.
3. **현재 공개된 필수 제출물은 제품 소개, GitHub 저장소, 데모 영상의 상위 범주다.** `3분`, 특정 PPT 항목, 특정 아키텍처 도식은 현재 공식 페이지에서 확인되지 않았다. 라이브 배포 엔드포인트는 권장 사항이다.
4. **pay.sh sandbox는 테스트 도구이지 라이브 네트워크 결제 증명과 동의어가 아니다.** 공식 문서는 sandbox의 임시 로컬 지갑과 실제 결제의 사용자 승인·계정 자금을 구분한다.
5. **“API key/account 불필요”는 프로토콜 수준 또는 공급자 가입에 관한 축약이다.** pay.sh는 로컬 지갑·설정·자금·승인이 필요하고, 일부 x402 facilitator 경로는 CDP 인증을 요구한다.
6. **Google Cloud $300 크레딧과 Gemini API 결제는 분리해야 한다.** Google Cloud Free Trial의 자격·90일 조건이 있고, 현재 Gemini API 청구 문서는 2026-03-02 이후 신규 Free Trial 크레딧을 Gemini API에 사용할 수 없다고 안내한다.
7. **x402는 현재 v2 기준으로 읽어야 한다.** v1의 `X-PAYMENT` 중심 설명은 `PAYMENT-SIGNATURE`와 CAIP-2 기반 v2 문서와 버전 차이가 있다.
8. **A2A, MCP, AP2/UCP/ACP, x402/MPP는 같은 층의 대체재가 아니다.** 에이전트 통신, 도구 연결, 상거래 위임, HTTP 결제·결제 협상이라는 서로 다른 책임을 가진다.

## 문서별 차이표

- [01. 킥오프·Google 세션 전사](comparisons/01-transcript-kickoff-google.md)
- [02. Solana 세션 전사](comparisons/02-transcript-solana.md)
- [03. Q&A 전사](comparisons/03-transcript-qa.md)
- [04. Hackathon Intro Deck OCR](comparisons/04-intro-deck.md)
- [05. Why Solana OCR](comparisons/05-why-solana.md)
- [06. x402 & MPP OCR](comparisons/06-x402-mpp.md)

## 공식 문서 추출본

- [행사 계약과 일정](sources/event-contract.md)
- [Google Cloud·ADK·크레딧](sources/google-cloud-and-adk.md)
- [Solana 코어·결제](sources/solana-core-and-payments.md)
- [pay.sh](sources/pay-sh.md)
- [x402](sources/x402.md)
- [MPP](sources/mpp.md)
- [AP2·A2A·MCP·UCP·ACP](sources/agent-protocols.md)

## 주제 모듈

- [행사 규칙](modules/event-rules.md)
- [인프라와 과금](modules/infrastructure-and-billing.md)
- [결제 레일](modules/payment-rails.md)
- [에이전트 프로토콜 지도](modules/agent-protocol-map.md)
- [검증 보고서](validation-report.md)

## 증거 경계

`일치`는 문서 표현의 일치를 뜻한다. 실제 배포·온체인 트랜잭션·심사 통과는 별도의 런타임 증거가 필요하다. `공식 근거 없음`은 반증이 아니라 현재 1차 문서에서 확인하지 못했다는 뜻이다.
