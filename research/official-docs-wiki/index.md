# Official Docs Wiki: 의사결정 인덱스

비교 데이터 기준일은 2026-07-23이며, 행사 규칙·과금·Solana·pay.sh·x402·MPP·에이전트 프로토콜의 고영향 사실은 2026-08-03에 공식 원문으로 다시 확인했다. 이 페이지는 조사 결과를 나열하지 않고 **Mandate Pool을 제출 가능한 제품으로 만드는 결정 순서**로 정리한다.

## 지금 고정할 결정

### 1. 무엇을 제출하는가

- 필수 상위 범주는 제품 소개서, GitHub 저장소, 데모 영상이다.
- 라이브 배포 엔드포인트는 권장 사항이다.
- 제품은 Solana 기반 Agentic Commerce 단일 트랙에 참가한다. Agent-Initiated Commerce, Autonomous On-chain Settlement, Multi-Agent Commerce, Verifiable Distribution at Scale은 아이디어 예시 범주다.
- 공개 행사 페이지에는 정확한 영상 길이, 강제 슬라이드 목차, 개인 Gmail 필수, Mainnet 필수가 적혀 있지 않다. 제출 폼에서 별도 요구가 나오기 전까지 저장소의 하드 게이트로 만들지 않는다.

### 2. 무엇으로 작동을 증명하는가

- 평가 문구는 localnet·testnet·Devnet에서 에이전트가 트랜잭션을 발생시키고 결제를 완료하며, 로그나 이력으로 이를 확인할 수 있어야 한다는 취지다.
- fixture 응답, sandbox 영수증, UI 애니메이션, 임의의 transaction ID는 온체인 증거가 아니다.
- 최소 증거는 `에이전트 판단 → 승인·정책 판정 → 서명된 거래 → Solana signature → finalized 검증 → 애플리케이션 결과`를 같은 주문 ID로 연결해야 한다.

### 3. 어떤 기술만 선택하는가

- ADK는 에이전트 개발 프레임워크, A2A는 에이전트 간 통신, MCP는 도구·컨텍스트 연결, AP2는 결제 권한 위임, UCP/ACP는 상거래 흐름, x402/MPP는 HTTP 결제 상호작용을 담당한다. 같은 층의 대체재가 아니다.
- 이름을 많이 나열하는 것보다 제품 책임에 필요한 최소 조합을 실제 trace로 증명하는 편이 정확하다.
- Mandate Pool의 v0 결제는 세 payer의 전송을 한 거래에 묶는 custom Solana atomic settlement다. x402 `exact`를 구현하지 않았으므로 x402 제품이라고 소개하지 않는다.

## Mandate Pool 적용표

| 공식 요구·사실 | 제품 결정 | 제출할 증거 |
|---|---|---|
| 에이전트가 정해진 한도 안에서 결제를 실행 | Gemini/ADK는 조건 정규화·후보 제안, 순수 정책 엔진은 한도·승인·만료 재검사 | agent trace와 policy proof |
| 실제 트랜잭션과 결제 완료 | Devnet USDC 1개를 A/B/C가 정확한 원자 단위로 한 거래에 분담 | signature, Explorer, mint·수취인·금액·상태 검증 |
| UX와 혁신성 | 세 조건의 교집합이 맞을 때만 공동 구매하고, 한 명이라도 불일치하면 거래를 만들지 않음 | 정상·거부 경로 화면과 로그 |
| Google Cloud AI 활용 | Cloud Run에서 ADK/Gemini 경로를 실행하고 결정론적 정책과 분리 | Cloud Run revision, Gemini 실행 trace |
| 감사 가능한 실행 | 주문·quote·approval·policy proof·settlement·entitlement를 같은 식별자로 연결 | redacted hash chain과 finalized receipt |

## 가장 중요한 보정

1. Demo Day는 2026-08-21이다. 전사에서 들리는 8월 20일은 현재 [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)와 [Luma](https://luma.com/gcp-solana-tech-session?locale=ko)에 맞지 않는다.
2. Mainnet은 제출 필수가 아니다. Mainnet 자산과 키를 데모에 도입하지 않는다.
3. Google Cloud Free Trial의 USD 300·90일 조건과 Gemini API 과금은 분리한다. 2026-03-02 이후 개설 계정의 Welcome credit은 Gemini API·AI Studio 비용에 사용할 수 없다.
4. pay.sh sandbox는 임시 로컬 계정을 사용하는 테스트 경로다. Devnet 거래 증거를 별도로 남긴다.
5. fixture는 localnet이 아니다. 직접 Solana transaction을 쓰는 Mandate Pool에는 `solana-test-validator` smoke가 권장 선행 단계이며, 실행하지 않았다면 그 공백을 명시한다.
6. pay.sh의 간편 결제 메시지는 공급자별 가입을 줄인다는 뜻이다. 로컬 wallet·setup·funding·authorization까지 사라지는 것은 아니다.
7. x402 신규 구현은 v2 header와 CAIP-2 network ID를 사용한다. v1의 `X-PAYMENT` 예제를 복사하지 않는다.
8. 생체 인증이나 wallet approval 하나만으로 prompt injection 전체를 막았다고 주장하지 않는다. 한도, allowlist, 원문 검증, 일회성 권한, 감사 로그가 별도로 필요하다.

## 원본별 대조

- [01. 킥오프·Google 세션 전사](comparisons/01-transcript-kickoff-google.md): 일정, 제출물, GCP·ADK 범위
- [02. Solana 세션 전사](comparisons/02-transcript-solana.md): pay.sh, 네트워크, 수수료
- [03. Q&A 전사](comparisons/03-transcript-qa.md): 구두 안내와 공개 계약의 경계
- [04. Hackathon Intro Deck OCR](comparisons/04-intro-deck.md): 제출 형식, 상금, 실제 실행 기준
- [05. Why Solana OCR](comparisons/05-why-solana.md): 설치 명령, Solana Pay, 클러스터 역할
- [06. x402 & MPP OCR](comparisons/06-x402-mpp.md): 프로토콜 층, x402 v2, MPP session 주장

## 공식 출처별 구현 노트

- [행사 계약과 일정](sources/event-contract.md)
- [Google Cloud·ADK·크레딧](sources/google-cloud-and-adk.md)
- [Solana 코어·결제](sources/solana-core-and-payments.md)
- [pay.sh](sources/pay-sh.md)
- [x402](sources/x402.md)
- [MPP](sources/mpp.md)
- [에이전트·상거래 프로토콜](sources/agent-protocols.md)

## 다음 행동

1. 제출 폼에서 영상 길이와 제품 소개 형식을 최종 확인한다.
2. Devnet 정상 경로 1건과 정책 거부 경로 1건의 redacted receipt를 보존한다.
3. 제품 설명에서 `fixture`, `Devnet`, `custom settlement`, `operator-simulated HITL`을 정확히 표기한다.
4. 구현하지 않은 프로토콜 로고와 호환성 주장을 제거한다.

`일치`는 문서 표현의 일치일 뿐이다. 실제 배포·온체인 거래·심사 통과는 별도 증거로만 주장한다.
