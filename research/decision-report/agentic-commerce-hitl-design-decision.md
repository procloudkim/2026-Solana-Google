# Mandate Pool HITL 설계 의사결정

- 최초 결정일: 2026-08-03 KST
- 현재화: 2026-08-04 KST
- 독자: 제품을 처음 보는 심사자, 구현자, 보안 검토자.
- 결정: **Agent 계획은 주문 생성 때 먼저 만들고, 사람은 각 구매자의 mandate를 확인하며, BUY 후보의 정책·거래 검증은 결정론적 코드가 수행한다.**
- 현재 범위: 한 명의 데모 운영자가 구매자 A/B/C 역할을 순서대로 확인하는 v0. 실제 세 사용자의 독립 신원 확인은 구현하지 않았다.

## 결론부터

Mandate Pool은 세 구매자 Agent가 공동 상품을 살 때 어느 한 명의 조건도 잃지 않도록 만든 해커톤 프로토타입이다.

- **Why:** 여러 Agent의 돈을 함께 움직이면 추천 품질보다 권한 보존, 전부 성공 또는 전부 실패, 중복 결제 방지가 먼저다.
- **What:** 세 자연어 구매 조건을 구조화하고 역할별 HITL 확인을 받은 뒤, 공통 조건을 만족하는 SignalDesk 7일 이용권만 공동 구매한다.
- **How:** Gemini/ADK는 조건 정규화와 후보 제안만 한다. 결정론적 정책, Solana 거래 원문 verifier, 네 signer, finalized 결과 verifier가 실제 결제 권한과 fulfillment를 통제한다.

정상 데모는 총 **1 Devnet 테스트 USDC**를 A `0.333334`, B/C 각 `0.333333`으로 나눈다. B의 cap을 `0.3`으로 낮춘 거부 데모에서는 거래를 만들지 않는다. Circle은 testnet USDC가 금전 가치가 없고 실제 달러로 뒷받침되지 않는다고 명시한다. [Circle testnet 안내](https://developers.circle.com/stablecoins/usdc-contract-addresses)

이 문서는 **왜 이 HITL 구조를 선택했는지** 보존하는 설계 결정 기록이다. 실행 결과와 공개 링크의 현재 기준은 [제출 manifest](../../submission/manifest.md), 남은 운영 행동은 [환경·실행 런북](hackathon-environment-codex-runbook.md)을 따른다.

## 문제를 어떻게 좁혔나

초기 탐색은 유료 데이터, RPC, 정산, 콘텐츠 권리, 공동구매 등 50개 가설에서 시작했다. 후속 분석에서 RPC Rescue와 Query-to-Act를 검토했지만, 사용자 사건과 외부 유료 fulfillment를 해커톤 안에서 닫지 못했다. 그 결과 외부 merchant의 가용성을 핵심 증거로 삼는 대신, 여러 구매 권한의 교집합과 원자적 정산을 저장소 안에서 검증할 수 있는 Mandate Pool로 전환했다.

Mandate Pool은 원래 목록의 `#45 Threshold Cart`와 다음 공통 통제 패턴을 결합한 후속 아이디어다.

- mandate hash에 묶인 사전 승인
- LLM과 지갑 권한의 분리
- deterministic policy와 signer guard
- idempotent state transition과 예산 reservation
- finalized 이후에만 fulfillment

따라서 “50개 중 점수가 가장 높았다”가 아니라, **현재 접근 가능한 증거로 가장 짧고 정직한 폐쇄루프를 만들 수 있었다**는 것이 선택 근거다. 아이디어 계보와 탈락 경계는 [MECE 선택 보고서](mece-hackathon-idea-selection.md)에 정리한다.

## 디자인씽킹 적용과 증거 경계

Stanford d.school 자료는 디자인씽킹을 한 번씩 통과하는 선형 체크리스트가 아니라 문제를 탐색하고 시제품으로 학습하기 위한 모드와 도구로 소개한다. 이 프로젝트도 점수표 대신 사용자 관점, 좁은 문제 정의, 반증 가능한 프로토타입, 실제 행동 검증을 사용했다. [Stanford d.school Design Thinking Bootleg](https://dschool.stanford.edu/tools/design-thinking-bootleg)

| 모드 | 이번 프로젝트에서 한 일 | 아직 하지 못한 일 |
|---|---|---|
| Empathize | “Agent가 돈을 쓰면 오송금·부분 결제·중복 결제가 의미를 없앤다”는 사용자 우려를 문제 출발점으로 삼음 | 독립된 실제 공동구매 사용자 인터뷰 |
| Define | 한 상품, 세 구매자, 서로 다른 cap·기능·만료, 하나의 원자적 거래로 범위를 고정 | 장기 시장 규모·반복 구매 빈도 |
| Ideate | 50개 가설, HITL 통제 패턴, RPC/Query 후보를 비교 | 전 세계 신규성 주장 |
| Prototype | fixture와 live runtime, 세 SKU, 정상·거부 경로, operator-simulated approval 구현 | buyer별 외부 wallet approval |
| Test | 정책 mutation·idempotency·Solana Kit 메시지 검증, localnet smoke, 정상 1 Devnet 테스트 USDC와 cap 거부 receipt 확보 | 실제 공동구매 사용자 행동, buyer별 독립 승인, live 장애 주입 |

이 표는 디자인씽킹을 “완료했다”는 선언이 아니다. 현재 무엇을 배웠고 무엇이 비어 있는지 독자가 구분하도록 만든 증거 경계다.

## HITL의 정확한 위치

이 제품에서 HITL은 Agent가 고른 거래를 매번 승인하는 버튼이 아니다. 주문 생성 때 Agent가 자연어 조건을 canonical mandate와 SKU 또는 `NO_BUY` 계획으로 먼저 구조화하고, 운영자는 각 역할의 mandate가 맞는지 확인한다. 세 승인이 모두 있어야 저장된 결과를 확정할 수 있다. SKU 후보만 이후 결정론적 정책과 정산으로 진행하며, `NO_BUY` 후보는 policy check 없이 `NO_BUY`로 끝난다.

```mermaid
flowchart TD
    A["A/B/C가 자연어 조건 제시"] --> G["주문 생성: Gemini/ADK가<br/>typed mandate와 SKU/NO_BUY 계획 생성"]
    G --> H{"데모 운영자가 A/B/C 역할별<br/>mandate hash를 각각 확인했나?"}
    H -->|아니오| X["거래 생성 금지"]
    H -->|예| S{"저장된 Agent 결과"}
    S -->|NO_BUY| N["NO_BUY 확정<br/>policy checks 없음"]
    S -->|SKU 후보| P{"결정론적 정책 재검사"]
    P -->|조건 불일치·만료| X
    P -->|통과| V["Solana 메시지 원문 독립 검증"]
    V -->|불일치| X
    V -->|통과| T["Sponsor+A+B+C가 동일 메시지 서명"]
    T --> F{"finalized 거래·토큰 증감 재검증"}
    F -->|성공| E["A/B/C 이용권 발급"]
    F -->|실패 확정| R["예약 해제·발급 금지"]
    F -->|결과 불명| M["RECONCILIATION_REQUIRED<br/>자동 재결제 금지"]
```

### 역할 구분

| 모드 | 누가 결정하는가 | 제품 행동 |
|---|---|---|
| `A-PLAN` 후보 제안 | Gemini/ADK Agent | 주문 생성 때 자연어를 구조화하고 catalog에서 SKU 후보 또는 `NO_BUY`를 제안한다. 서명 권한은 없다. |
| `H-PRE` 조건 확인 | 데모 운영자가 A/B/C 역할별로 수행 | 저장된 canonical mandate hash와 일회성 nonce를 확인한다. 세 건이 모두 있어야 Agent 결과를 확정한다. |
| `D-POLICY` 권한 판정 | 결정론적 코드 | buyer set, approval, quote, catalog, cap, feature, merchant, mint, expiry를 검사한다. |
| `D-SIGN` 거래 경계 | 거래 verifier와 signer | 승인된 quote와 정확히 같은 v0 message만 네 signer가 서명한다. |
| `D-FULFILL` 결과 판정 | finalized verifier | 거래 원문과 token 증감을 다시 확인한 뒤에만 이용권을 발급한다. |
| `H-RECON` 결과 불명 | 운영자 | 이미 만든 동일 거래의 원장 상태를 확인한다. 새 결제를 승인하지 않는다. |
| `H-POST` 감사 | 운영자·심사자 | mandate, policy proof, tx, receipt, entitlement의 연결을 검토한다. |

### 사람이 승인으로 우회할 수 없는 실패

다음은 runtime HITL로 올리지 않는다.

- mandate hash·approval nonce 불일치
- 승인·quote 만료
- buyer, mint, merchant, source ATA, amount, feature 불일치
- 허용되지 않은 instruction, signer, address lookup table
- 같은 idempotency key를 다른 요청에 재사용
- fully signed transaction 제출 뒤 결과 불명

무결성 실패에 `approve anyway`를 제공하면 HITL이 안전장치가 아니라 정책 우회로가 된다.

## Agent와 결정론적 코드의 경계

AP2 v0.2는 human-present와 autonomous mode를 구분하고, autonomous mode에서는 사용자가 제약을 승인한 뒤 Agent가 그 범위 안에서 closed mandate를 만들 수 있다고 설명한다. 또한 검증·처리는 LLM이 아니라 결정론적 코드에서 수행하도록 요구한다. [AP2 v0.2](https://ap2-protocol.org/ap2/specification/)

Mandate Pool은 이 두 원칙을 참고했지만 AP2의 Checkout/Payment Mandate JWT, Trusted Surface, Credential Provider 전체를 구현하지 않았다. 따라서 **AP2-inspired local mandate**라고만 설명한다.

| 입력·행동 | Gemini/ADK | 결정론적 코드 |
|---|---:|---:|
| 자연어에서 cap·기능·만료 후보 추출 | 담당 | 서버 allowlist로 결과 제한 |
| SKU 후보와 설명 제안 | 담당 | canonical catalog와 정책으로 재검사 |
| 결제 승인 여부 | 권한 없음 | 담당 |
| atomic amount 계산과 remainder 배분 | 권한 없음 | 담당 |
| 거래 instruction·signer·memo 검증 | 권한 없음 | 담당 |
| 지갑 서명·RPC 제출 | 도구 없음 | 담당 |
| finalized·잔액 증감·entitlement 발급 | 권한 없음 | 담당 |

## 제품 불변조건

1. 구매자 A/B/C가 정확히 한 번씩 존재한다.
2. 각 승인은 현재 canonical mandate hash와 만료에 묶인다.
3. 총액은 atomic base unit으로 계산하고 정확히 합산된다.
4. 총 1,000,000 base unit은 A/B/C 순서로 `333334/333333/333333`이 된다.
5. 각 allocation은 해당 구매자의 cap, source ATA, signer와 일치한다.
6. 세 승인 또는 한 정책 조건이라도 빠지면 거래를 만들지 않는다.
7. 거래에는 `TransferChecked` 세 개와 memo 하나만 존재하고 필수 signer는 sponsor+A+B+C다.
8. 동일 주문과 실행 idempotency key는 같은 의미에만 재사용한다.
9. finalized 성공과 예상 token 증감을 모두 확인한 뒤에만 이용권을 발급한다.
10. 결과가 불명확하면 새 blockhash의 새 결제를 자동 생성하지 않는다.

## 검증 가능한 시나리오

| ID | 입력 | 기대 결과 | 보여 주는 원칙 |
|---|---|---|---|
| `HAPPY-1USDC` | A cap 0.4, B 0.34, C 0.4; 세 승인 완료 | Team-3 선택, `333334/333333/333333`, 거래 한 건, 이용권 세 개 | 교집합과 원자적 정산 |
| `NO-BUY-CAP` | B cap 0.3 | 세 승인 뒤 `NO_BUY`, policy check 0건, 거래 0건 | 한 명의 조건도 희생하지 않음 |
| `APPROVAL-MISSING` | 승인 한 건 누락 | 실행 409, 거래 0건 | HITL 선행 조건 |
| `STALE-APPROVAL` | mandate hash 또는 nonce 불일치 | 승인 거부 | 승인 binding |
| `POLICY-MUTATION` | 금액·merchant·mint·feature·expiry 변조 | 정책 거부 | LLM 제안과 결제 권한 분리 |
| `MESSAGE-MUTATION` | instruction·signer·memo 변조 | 서명 전 중단 | 거래 원문 검증 |
| `RETRY-SAME-BYTES` | 제출 응답 유실 | 저장한 동일 bytes만 재제출 | 중복 거래 방지 |
| `UNKNOWN-RESULT` | blockhash 만료 뒤 결과 불명 | entitlement 0, 수동 조정 | fail-closed fulfillment |

fixture 결과는 온체인 증거가 아니다. live 성공은 Devnet transaction signature, Explorer, policy/agent trace, finalized verifier와 entitlement receipt가 같은 order로 연결될 때만 주장한다.

## v0의 정직한 한계

- 한 명의 운영자가 세 역할을 순서대로 확인한다. 실제 A/B/C가 각자 승인했다는 신원 증거가 아니다.
- buyer Devnet key는 Cloud Run이 Secret Manager에서 받아 서버 측에서 사용한다. 사용자 wallet UX가 아니다.
- merchant와 SignalDesk entitlement는 데모용 제품 경계다. 외부 상점·실재 유료 수요를 증명하지 않는다.
- 현재 rail은 custom Solana atomic settlement다. x402 구현이라고 주장하지 않는다.
- 사용자 인터뷰, 반복 구매, 지불의사, 시장 신규성은 검증되지 않았다.
- Devnet 토큰은 금전 가치가 없으므로 Mainnet 안전성이나 실제 자산 수탁을 증명하지 않는다.

실제 다자간 제품으로 확장하려면 buyer별 domain-separated approval signature, 외부 wallet/co-signer, merchant-signed catalog·fulfillment, 분쟁·revocation 정책이 필요하다.

## 이 결정을 검증한 실행 순서

1. [제품 README](../../product/mandate-pool/README.md)의 로컬 검증 명령으로 typecheck·test·build를 통과했다.
2. fixture에서 정상·거부·승인 누락 경로를 실행하고 `NOT ON-CHAIN` 경계를 유지했다.
3. [localnet smoke](../../submission/evidence/localnet-smoke-2026-08-03.json)로 세 전송의 원문·finality·잔액과 거래 생성 전 거부를 확인했다.
4. 비공개 live revision의 [readiness](../../submission/evidence/live-preflight-2ac7eac.json)를 확인했다.
5. A/B/C 역할의 mandate를 확인한 뒤 [정상 주문](../../submission/evidence/normal-order-2ac7eac.json)에서 총 1 Devnet 테스트 USDC의 finalized 거래와 이용권 세 개를 검증했다.
6. 같은 source revision의 [cap 거부 주문](../../submission/evidence/reject-order-2ac7eac.json)에서 transaction·signature·이용권이 없음을 검증했다.
7. 공개 주소와 transaction signature만 문서화하고 개인키·secret·`.env`는 저장소와 로그에서 제외했다.

위 결과는 source commit `2ac7eac17ea803b4537b630234ac6507523e5325`와 evidence tag `submission-v2`에 고정돼 있다. 이는 한 번의 제한된 Devnet 시나리오를 검증한 것이며 실제 다자간 동의나 상용 안전성을 증명하지 않는다.

## 참고 자료

- [공식 해커톤 홈페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/): 단일 Agentic Commerce 트랙과 AI·Solana·live 실행 심사 기준.
- [AP2 v0.2](https://ap2-protocol.org/ap2/specification/): mandate, human-present/autonomous mode, deterministic verification.
- [Circle testnet USDC 안내](https://developers.circle.com/stablecoins/usdc-contract-addresses): Devnet USDC mint와 금전 가치 없음.
- [제품 README](../../product/mandate-pool/README.md): 구현 계약과 x402 경계.
- [검증 메모](agentic-commerce-hitl-design-validation.md): 이 결정에서 검증된 범위와 남은 한계.
