# Mandate Pool HITL 설계 검증 메모

- 기준일: 2026-08-03 KST
- 검증 대상: [HITL 설계 의사결정](agentic-commerce-hitl-design-decision.md), [제품 README](../../product/mandate-pool/README.md), 현재 코드와 실행 증거.
- 판정: **구현·제출 준비에는 사용 가능, 제품·온체인 검증 완료 주장은 금지.**

## 독자가 알아야 할 판정

HITL 설계는 현재 v0의 코드 경계와 일치한다. 세 역할의 승인이 모두 있어야 실행할 수 있고, Gemini/ADK 출력은 결제 권한이 아니며, 정책과 거래 원문을 결정론적 코드가 다시 검사한다. 결과가 불명확하면 새 결제를 만들지 않는다는 안전 원칙도 상태 머신에 반영돼 있다.

그러나 다음 두 사실 때문에 “실제 다자간 공동구매가 검증됐다”고 말할 수 없다.

1. v0의 A/B/C 승인은 한 명의 데모 운영자가 세 역할을 순서대로 확인하는 simulation이다.
2. 총 1 Devnet 테스트 USDC의 정상 finalized 거래와 거부 receipt는 [실행 런북](hackathon-environment-codex-runbook.md)상 아직 남은 제출 증거다.

## 검증 질문과 결과

| 질문 | 확인 결과 | 판정 |
|---|---|---|
| 사람이 어디에서 필요한가? | A/B/C canonical mandate 확인, 결과 불명 조정, 사후 감사로 구분돼 있다. | 통과 |
| 정상 경로마다 승인 팝업을 요구하는가? | 세 사전 승인 뒤 Agent가 후보를 제안하고 정책·정산을 진행한다. | 통과 |
| LLM이 금액이나 지갑을 통제하는가? | signer/RPC 도구가 없고 서버 allowlist·정책·거래 verifier가 재검사한다. | 통과 |
| 한 사람의 조건이 무시될 수 있는가? | exact buyer set, buyer별 approval, cap·feature·expiry·allocation 검사가 모두 필요하다. | 통과 |
| 부분 결제가 가능한가? | 한 v0 message에 세 `TransferChecked`를 넣고 네 signer가 같은 메시지에 서명한다. | 설계 통과, live 증거 대기 |
| 재시도로 새 결제가 생길 수 있는가? | fully signed bytes를 내구 저장하고 같은 bytes만 재제출하며 불명 결과는 조정 상태로 멈춘다. | 설계 통과, live fault 증거 대기 |
| fulfillment가 거래보다 먼저 가능한가? | finalized 거래 원문과 token 증감을 확인한 뒤에만 이용권 상태로 전이한다. | 통과 |
| 실제 세 사용자의 승인을 증명하는가? | 승인 method가 `demo_operator`이고 buyer별 외부 서명은 없다. | 미통과·공개된 한계 |
| AP2를 구현했는가? | AP2의 mandate·deterministic verification 원칙을 참고했지만 전체 역할/JWT flow는 구현하지 않았다. | 적합성 주장 금지 |
| x402를 구현했는가? | custom multi-signer atomic settlement다. | x402 주장 금지 |

## 코드와 문서의 일치

| 계약 | 구현 위치 | 독자가 확인할 내용 |
|---|---|---|
| A/B/C exact set와 승인 binding | [service](../../product/mandate-pool/src/service/mandate-pool-service.ts), [policy](../../product/mandate-pool/src/domain/policy.ts) | buyer별 mandate hash·approval nonce·만료 |
| 1 USDC canonical split | [atomic split](../../product/mandate-pool/src/domain/atomic.ts), [catalog](../../product/mandate-pool/src/domain/catalog.ts), [policy](../../product/mandate-pool/src/domain/policy.ts) | `333334 + 333333 + 333333 = 1000000` base units |
| transaction 원문 검증 | [Solana intent](../../product/mandate-pool/src/solana/intent.ts), [runtime](../../product/mandate-pool/src/runtime/solana-kit.ts) | instruction, signer, ATA, mint, amount, memo exact match |
| idempotency와 예산 reservation | [state machine](../../product/mandate-pool/src/workflow/state-machine.ts), [persistence](../../product/mandate-pool/src/persistence/index.ts) | CAS, one-time key, consumed/released state |
| 결과 불명 안전 정지 | [state machine](../../product/mandate-pool/src/workflow/state-machine.ts), runtime | `RECONCILIATION_REQUIRED`, 새 결제 금지 |
| finalized 이후 fulfillment | [service](../../product/mandate-pool/src/service/mandate-pool-service.ts) | transaction decode·잔액 변화 검증 뒤 entitlement 발급 |

코드가 source of truth인 구현 세부와 달리, 현재 배포·실행 상태는 [실행 런북](hackathon-environment-codex-runbook.md)을 우선한다.

## 필수 acceptance matrix

| 경로 | 기대 결과 | 제출 증거 |
|---|---|---|
| 정상 | 총 1 Devnet 테스트 USDC, A/B/C `333334/333333/333333`, finalized, entitlement 3개 | transaction signature, Explorer, quote/policy/message hash, agent trace, fulfillment receipt |
| cap 거부 | B cap `300000`, transaction 0건, entitlement 0개 | `NO_BUY` 또는 policy rejection trace |
| 승인 누락 | 실행 거부, transaction 0건 | API error와 order timeline |
| 무결성 변조 | 서명 전 차단 | 실패한 policy/verifier check와 transaction 0건 |
| 응답 유실·재시도 | 새 transaction 생성 없이 동일 bytes만 재제출 | predicted signature, submission history, payment count |
| 결과 불명 | `RECONCILIATION_REQUIRED`, entitlement 0개 | 상태·원장 조회·수동 조정 기록 |

fixture 시나리오는 기능 검증에 유용하지만 온체인 proof 열에 넣지 않는다. `fixture · NOT ON-CHAIN` 라벨과 live Devnet 증거를 분리한다.

## 외부 사실 검증

| 주장 | 판정 | 공식 근거와 경계 |
|---|---|---|
| 해커톤은 Solana 기반 Agentic Commerce 단일 트랙이며 Gemini/GCP, Solana 연동, live 거래·로그를 본다. | 확인 | [공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/). 공개 criterion 간 가중치는 확인되지 않았다. |
| AP2 autonomous mode는 사용자 제약 승인 뒤 Agent가 closed mandate를 구성할 수 있다. | 확인 | [AP2 v0.2](https://ap2-protocol.org/ap2/specification/). Mandate Pool의 AP2 적합성을 뜻하지 않는다. |
| 검증·처리를 LLM에 맡겨도 AP2 원칙에 맞는다. | 반증 | AP2는 validation/processing을 결정론적 코드에서 수행하도록 명시한다. |
| Solana Devnet USDC는 실제 1달러 가치의 자산이다. | 반증 | [Circle](https://developers.circle.com/stablecoins/usdc-contract-addresses)은 testnet 토큰에 금전 가치가 없고 실제 달러 담보가 없다고 명시한다. |
| x402가 이 제품의 필수 rail이다. | 미확인·설계상 제외 | [Solana x402](https://solana.com/x402/what-is-x402)는 API·디지털 자원의 HTTP 402 결제 흐름을 설명한다. 현재 제품의 다중 payer·단일 원자 거래 요구와 동일하지 않다. |

## 과거 산출물의 상태

동일 이름의 `.artifact.json`과 `.html`은 RPC Rescue가 선두였던 2026-08-02 시점의 렌더링 snapshot이다. 현재 제품 결정의 source of truth로 사용하지 않는다. 새 독자는 이 Markdown, 제품 README, 실행 런북 순서로 읽는다. 역사적 RPC 계약은 [보류된 RPC PRD](rpc-rescue-core-prd.md)에 보존한다.

## 출시 전 gate

- [ ] 최신 code revision으로 private live Cloud Run을 배포한다.
- [ ] A/B/C 세 operator-simulated approval을 명시적으로 수행한다.
- [ ] 총 1 Devnet 테스트 USDC 정상 거래를 finalized까지 확인한다.
- [ ] 같은 revision에서 B cap 0.3 거부 경로가 transaction을 만들지 않았음을 확인한다.
- [ ] transaction, policy, message, ADK trace, entitlement receipt를 같은 order ID로 연결한다.
- [ ] 화면·영상·문서에서 fixture, live Devnet, 실제 자산을 혼동하지 않는다.
- [ ] private key, Secret Manager payload, `.env`, credential 파일이 Git과 로그에 없음을 재검사한다.

체크박스의 현재 상태와 실행 명령은 이 메모에 중복 기록하지 않고 [실행 런북](hackathon-environment-codex-runbook.md)에서 갱신한다.

## 공유 문구

안전한 설명은 다음과 같다.

> Mandate Pool은 세 자연어 구매 조건을 Gemini/ADK로 구조화하고 역할별 HITL 확인과 결정론적 정책을 거친 뒤, 총 1 Devnet 테스트 USDC의 세 전송을 한 Solana 거래로 묶도록 설계한 프로토타입입니다. 현재 v0의 HITL은 한 운영자의 역할 simulation이며, Devnet 토큰은 금전 가치가 없습니다. 최종 온체인 성공은 공개 transaction과 연결된 receipt로만 주장합니다.

“실제 세 사용자가 승인했다”, “실제 1달러가 결제됐다”, “AP2/x402 표준을 구현했다”, “Mainnet 안전성이 검증됐다”는 표현은 현재 증거를 넘는다.
