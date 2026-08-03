# QuickNode x402 RPC offer 읽기 전용 검증 기록

## 검증 목적

이 문서는 QuickNode x402 endpoint가 Mandate Pool의 RPC 요청에 대해 machine-readable payment challenge를 제공하는지 확인한다. 확인 대상은 **offer의 존재와 요청 경로**이며, 결제 정산·session 발급·유료 RPC 품질은 이 단계에서 검증하지 않는다.

Solana는 x402를 HTTP 402 응답으로 결제 조건을 제시하고, 결제 검증·정산 뒤 보호된 resource를 제공하는 흐름으로 설명한다. 이 문서의 402 관찰은 그 첫 단계에만 해당한다. [Solana x402 개요](https://solana.com/x402/what-is-x402)

## 안전 전제

- 모든 요청은 인증 없이 실행했다.
- wallet signature, payment, facilitator settlement, resource unlock은 수행하지 않았다.
- raw `payment-required` header는 nonce와 expiry를 포함한 크고 단기적인 값이므로 저장소에 복사하지 않았다.
- 관찰된 Solana Devnet USDC는 금전 가치가 없고 실제 달러로 담보되지 않는 테스트 토큰이다. [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## Probe 1: offer 구조 확인

### 방법

| 항목 | 값 |
|---|---|
| 관찰 시각 | 2026-08-01 16:27 KST |
| 요청 | 인증 없는 `POST https://x402.quicknode.com/solana-mainnet` |
| JSON-RPC method | `getHealth` |
| 상태 변경 | 없음 |

### 관찰 결과

- 응답은 `HTTP/2 402`였다.
- resource description은 요청별 결제, nanopayment 또는 credit drawdown 방식의 QuickNode RPC access를 설명했다.
- `x402Version`은 `2`였다.
- network `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`에 대한 Solana Devnet exact-payment option이 있었다.
- Devnet option에는 USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`와 `amount: "1000"` base units가 포함됐다.
- 성공적으로 settle한 뒤 발급된다는 `quicknode-session` token과 1시간 expiry가 표시됐다.

### 판정

검사 시점에 endpoint는 도달 가능했고 Solana Devnet settlement option을 포함한 x402 payment requirement를 반환했다. 이는 **실재하는 외부 유료 resource offer의 관찰 증거**다. 프로젝트가 그 resource를 결제하거나 사용했다는 증거는 아니다.

## Probe 2: PRD의 정확한 Devnet method 경로 확인

### 방법

| 항목 | 값 |
|---|---|
| 관찰 시각 | 2026-08-02 14:56 KST |
| 요청 | 인증 없는 `POST https://x402.quicknode.com/solana-devnet` |
| JSON-RPC method | `getSignatureStatuses` |
| params | placeholder signature 1개, `searchTransactionHistory: true` |
| 증거 보존 | status만 기록, response body와 payment header는 미보존 |
| 상태 변경 | 없음 |

### 관찰 결과와 의미

응답은 `HTTP 402`였다. 따라서 PRD가 지정한 Solana Devnet resource path와 method가 payment challenge 단계에 도달한다는 점은 확인했다. placeholder signature를 사용했기 때문에 paid response의 결과 정확성이나 실제 transaction 조회 가능성은 검증하지 않았다.

## 아직 증명하지 못한 항목

- 프로젝트 전용 wallet에서의 non-zero Solana Devnet 결제
- facilitator verification과 settlement 성공
- 결제 뒤 `quicknode-session` token 발급과 실제 사용
- 유효한 signature에 대한 Solana JSON-RPC 응답
- 무료 endpoint 대비 latency, freshness, availability 개선
- 결제 실패·중복 요청·만료 challenge에 대한 환불 또는 idempotency 동작

## 다음 검증 절차

후속 실험은 다음 gate를 순서대로 통과할 때만 실행한다.

1. 새 challenge를 읽고 network, mint, recipient, amount, nonce, expiry가 정책과 일치하는지 검증한다.
2. Mainnet 또는 실자산 option은 거부하고 Devnet test-token option만 선택한다.
3. user mandate와 per-request cap 안인지 deterministic policy로 재검증한다.
4. 명시적인 HITL 승인을 받은 뒤 한 번만 settle한다.
5. payment signature, facilitator receipt, session token 발급 여부, 실제 `getSignatureStatuses` 응답을 서로 연결하되 token 원문은 저장하지 않는다.
6. 동일 요청의 무료 RPC 결과와 비교해 유료 resource가 제품 가치에 기여했는지 판단한다.

현재 기록만으로는 “x402 결제가 성공했다”, “QuickNode 세션을 받았다”, “유료 RPC가 더 낫다”라고 주장하지 않는다.
