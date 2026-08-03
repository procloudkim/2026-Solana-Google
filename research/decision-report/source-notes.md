# Agentic Commerce 의사결정 근거 장부

- 기준일: 2026-08-03 KST
- 독자: 제출 자료의 주장을 검증하는 팀원·심사자·후속 구현자.
- 목적: 외부 사실, 로컬 관측, 제품 판단, 미검증 가설을 한 문서에서 구분한다.
- 현재 제품: **Mandate Pool**. 이전 RPC·Query 후보의 자료는 역사적 의사결정 근거다.

## 이 장부를 쓰는 방법

주장은 다음 네 등급 중 하나로 표시한다.

| 등급 | 의미 | 허용되는 표현 |
|---|---|---|
| 공식 확인 | 운영 주체·프로토콜 작성자의 현재 문서로 확인 | “공식 문서는 …라고 명시한다.” |
| 로컬 직접 확인 | 이 저장소의 코드·명령·응답·transaction으로 확인 | “이 프로젝트는 …를 관측/검증했다.” |
| 추론 | 공식 사실과 로컬 증거에서 내린 제품 판단 | “현재 증거에서는 …로 판단했다.” |
| 미검증 | 사용자·시장·외부 서비스·미실행 경로의 가설 | “확인해야 한다.” |

외부 서비스의 과거 응답은 현재 가용성으로 승격하지 않는다. fixture 결과는 온체인 proof로 승격하지 않는다. Devnet 테스트 토큰은 실제 자산으로 표현하지 않는다.

## 현재 결정 질문과 답

**질문:** 공식 심사 계약을 만족하면서, LLM의 제안과 돈을 움직이는 권한을 분리하고, 짧은 데모에서 정상·거부·복구 경계를 증명할 수 있는 제품은 무엇인가?

**답:** Mandate Pool을 제출 제품으로 구현한다. 세 구매자의 자연어 조건을 Gemini/ADK로 구조화하고 역할별 HITL 확인과 결정론적 정책을 거친 뒤, 총 1 Devnet 테스트 USDC의 A/B/C 전송을 하나의 Solana v0 거래에 묶는다. finalized 거래와 예상 token 증감을 확인한 뒤에만 이용권 세 개를 발급한다.

RPC Rescue와 Query-to-Act는 사용자 필요와 결제 후 외부 fulfillment를 닫지 못해 보류한다. 이 처분은 장기 사업성 평가가 아니라 현재 해커톤 증거 경계에 대한 판단이다.

## 공식·1차 출처 장부

| 주장 | 판정 | 1차 출처 | 적용 경계 |
|---|---|---|---|
| 행사는 `Solana 기반 Agentic Commerce` 단일 트랙이며, 추천만 하는 챗봇보다 판단·결제·정산을 실행하는 Agent를 요구한다. | 공식 확인 | [행사 홈페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) | 홈페이지 문구는 제출 직전에 다시 확인한다. |
| 심사는 혁신·UX, Gemini/Google Cloud AI, Solana·인프라·프로토콜 연동, localnet/testnet/devnet live 거래·로그를 본다. | 공식 확인 | [행사 홈페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) | 네 항목의 공개 가중치는 확인되지 않았다. 우승 확률 점수로 바꾸지 않는다. |
| 필수 제출물은 제품 소개서, GitHub Repo, 데모영상이며 live endpoint는 권장이다. | 공식 확인 | [행사 홈페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/) | 로그인 뒤 폼의 세부 계약이 다르면 폼을 우선한다. |
| AP2는 human-present와 autonomous mode, Checkout/Payment Mandate와 receipt를 정의한다. | 공식 확인 | [AP2 v0.2](https://ap2-protocol.org/ap2/specification/) | Mandate Pool은 원칙을 참고할 뿐 AP2 전체 적합성을 주장하지 않는다. |
| AP2의 validation/processing은 결정론적 코드에서 수행해야 한다. | 공식 확인 | [AP2 v0.2](https://ap2-protocol.org/ap2/specification/) | LLM은 intent 구조화·후보 제안에 사용하고 signer authority와 분리한다. |
| x402는 HTTP 402를 바탕으로 API·디지털 자원을 결제한 뒤 제공하는 프로토콜 흐름이다. | 공식 확인 | [Solana x402](https://solana.com/x402/what-is-x402), [Kora x402 guide](https://solana.com/docs/tools/kora/guides/x402) | 프로토콜 가능성이 merchant의 현재 uptime·품질·가격을 증명하지 않는다. |
| Solana 재서명 전 최초 transaction의 blockhash 만료를 확인하지 않으면 두 거래가 모두 수락될 수 있다. | 공식 확인 | [Solana 재시도 가이드](https://solana.com/developers/cookbook/transactions/retry) | RPC 보류안의 문제 타당성 근거다. 유료 조회 수요의 근거는 아니다. |
| Solana Devnet USDC mint는 `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`이며 testnet 토큰은 금전 가치나 실제 달러 담보가 없다. | 공식 확인 | [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) | “1 USDC”는 데모 단위이지 실제 1달러가 아니다. |
| Cloud Run은 request/event로 호출되는 container를 실행하는 managed serverless platform이다. | 공식 확인 | [Cloud Run 문서](https://docs.cloud.google.com/run/docs) | 현재 배포 성공은 별도 로컬 영수증으로 증명한다. |

## 로컬 사실 장부

| 주장 | 판정 | 저장소 근거 | 현재 표현 |
|---|---|---|---|
| 현재 제출 제품은 Mandate Pool이다. | 로컬 직접 확인 | [제품 README](../../product/mandate-pool/README.md), [실행 런북](hackathon-environment-codex-runbook.md) | “현재 제품” |
| 정상 가격은 총 1 Devnet 테스트 USDC이고 canonical split은 `333334/333333/333333` base units다. | 로컬 직접 확인 | [catalog](../../product/mandate-pool/src/domain/catalog.ts), [atomic split](../../product/mandate-pool/src/domain/atomic.ts), 정책·테스트 | “구현 계약”; 실제 거래 성공과 구분 |
| v0 HITL은 한 운영자가 A/B/C 역할을 순서대로 확인한다. | 로컬 직접 확인 | [`demo_operator` 승인 계약](../../product/mandate-pool/src/domain/types.ts), [서비스 승인 경로](../../product/mandate-pool/src/service/mandate-pool-service.ts) | “operator simulation”; 실제 세 사용자 승인이라고 하지 않음 |
| LLM에 signer·RPC 권한이 없다. | 로컬 직접 확인 | [agent runtime](../../product/mandate-pool/src/agents/adk-runtime.ts), [service/runtime 경계](../../product/mandate-pool/src/service/mandate-pool-service.ts) | “제안과 권한 분리” |
| live runtime은 private Cloud Run readiness까지 확보했다. | 로컬 직접 확인 | [private live 배포 영수증](evidence/gcp-private-live-deploy-2026-08-03.md) | read-only readiness와 실제 결제를 구분 |
| 전용 Devnet wallet과 ATA가 준비됐다. | 로컬 직접 확인 | [지갑 프로비저닝 영수증](evidence/devnet-wallet-provisioning-2026-08-03.md), 공개 manifest | 공개주소·ATA만 문서화; 개인키는 제외 |
| 총 1 Devnet 테스트 USDC 제품 거래와 정상·거부 receipt는 남은 작업이다. | 로컬 직접 확인 | [실행 런북](hackathon-environment-codex-runbook.md) | 완료 전 “온체인 검증 완료” 금지 |
| QuickNode exact Devnet 요청은 2026-08-02 unsigned HTTP 402를 반환했다. | 과거 로컬 직접 확인 | [QuickNode probe](evidence/quicknode-x402-probe.md) | 당시 offer 관측만 주장; 현재 가용성·결제 성공은 주장하지 않음 |

## 아이디어 계보와 처분

| 계보 | 당시 검토 이유 | 현재 처분 | 다시 열 조건 |
|---|---|---|---|
| `#45 Threshold Cart` + mandate 통제 패턴 → **Mandate Pool** | 여러 buyer의 조건 보존과 atomic settlement를 한 trace에서 증명 가능 | 현재 구현·제출 제품 | 정상 1 Devnet 테스트 USDC, 거부 0 tx, linked trace 확보 |
| `#13 RPC Lifeboat` → Just-Enough RPC Rescue → Duplicate Payout Guard | 유료 RPC 결과가 중복 payout 생성을 막는 좁은 인과관계 | 보류 | 실제 운영자 사건 + payment→valid result→job refusal |
| `#01 NeedlePass + #04 Onchain Risk Buyer` → Query-to-Act | 유료 이력 query가 payout allow/block을 바꾸는 구조 | 보류 | exact claim, 유료 result, 달라진 downstream action |
| `#08 OCR Escalator + #26 Three-Way Match Pay` → Invoice Line Rescue | 한 송장 필드만 재처리해 지급 판단을 갱신 | 보류 | 동작하는 endpoint, 실제 문서·supplier·지급 authority |
| ClipLicense·ExpiryDeal·ReproPay·SLA Refund | 시각성·멀티 Agent·성과 지급의 장점 | 이번 제출 제외 | 권리자·재고·verifier·refund authority 확보 |

상세 아이디어 지도는 [50개 아이디어](../agentic-commerce-50-ideas.md), 선택 논리는 [MECE 보고서](mece-hackathon-idea-selection.md), RPC 보류안은 [RPC PRD](rpc-rescue-core-prd.md)에 있다.

## 현재 제품의 증거 계약

```text
natural-language conditions A/B/C
  → Gemini/ADK normalized mandate proposals
  → operator-simulated approval × 3
  → deterministic policy proof
  → exact quote and canonical allocation
  → one Solana v0 message and four signatures
  → finalized transaction and token-delta verification
  → entitlement × 3
  → one order trace
```

반드시 함께 보여 줄 대조 경로는 B cap `0.3`으로 거래가 0건인 거부 시나리오다. fixture 결과에는 `NOT ON-CHAIN`을 표시하고, live proof에는 transaction signature와 Explorer를 붙인다.

## 문구 사용 규칙

| 피해야 할 문구 | 이유 | 대신 쓸 문구 |
|---|---|---|
| “실제 1달러 결제” | Devnet USDC는 금전 가치가 없음 | “총 1 Devnet 테스트 USDC 거래” |
| “세 사용자가 승인” | 현재는 한 운영자의 역할 simulation | “A/B/C 역할별 조건을 운영자가 확인” |
| “AP2/x402 구현” | 전체 표준을 구현하지 않음 | “AP2 원칙을 참고한 custom Solana atomic settlement” |
| “fixture 온체인 성공” | fixture signature는 Solana 거래가 아님 | “fixture 기능 검증”과 “live Devnet 증거”를 분리 |
| “검증된 시장 수요” | 사용자 인터뷰·지불의사 없음 | “해커톤 제품 가설” |
| “RPC 상품 이용 가능” | 과거 402만 관측 | “2026-08-02 unsigned 402 관측” |

## 남은 불확실성

- 실제 공동구매 사용자의 반복 문제와 지불의사를 검증하지 않았다.
- merchant와 SignalDesk entitlement는 데모 경계다.
- buyer별 실제 신원·wallet approval을 구현하지 않았다.
- 총 1 Devnet 테스트 USDC live transaction과 거부 receipt는 아직 제출 증거로 확보해야 한다.
- 공식 페이지, 제출 폼, 외부 endpoint는 바뀔 수 있다. 제출 직전에 다시 확인한다.
- 이 의사결정은 해커톤 증거와 마감에 최적화한 것이며 장기 사업의 우열을 증명하지 않는다.
