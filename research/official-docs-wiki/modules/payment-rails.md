# 결제 레일: 제품 책임에 맞는 경로 선택

이 모듈은 Solana Pay, pay.sh, x402, MPP를 “유행하는 이름”으로 고르는 대신, **누가 무엇을 승인하고 어떤 증거로 정산을 확정할지**에 따라 선택하도록 돕는다. 근거는 [Solana](../sources/solana-core-and-payments.md), [pay.sh](../sources/pay-sh.md), [x402](../sources/x402.md), [MPP](../sources/mpp.md) 공식 문서다.

## 역할 비교

| 구성 요소 | 해결하는 문제 | 남는 책임 | 제출 증거 |
|---|---|---|---|
| Solana transaction | 복수 instruction과 signer를 한 원자적 실행으로 정산 | 메시지 구성·서명·제출·finalized 검증·재시도 안전성 | signature, decoded instructions, balance delta, confirmation |
| Solana Pay | 결제 URL·QR·transaction request를 지갑과 연결 | 사용자의 지갑 서명과 수취인의 결제 검증 | request URL 또는 transaction request, signature, verification |
| x402 v2 | HTTP 402로 결제 요구·증명·정산을 주고받음 | wallet, scheme, network, facilitator, idempotency 선택 | 402 requirement, payment signature, settlement response |
| MPP | charge·session·반복 결제와 결제 수단 협상 | method·processor·session cap·lifecycle 상태 | challenge, authorization, receipt 또는 session state |
| pay.sh | x402/MPP challenge를 감지하고 local wallet 승인 후 요청 재시도 | local setup, account, funding, authorization policy | protocol·scheme·network, approval log, tx/receipt |

## Mandate Pool의 선택

현재 v0는 세 구매자의 서로 다른 한도를 A→B→C 세 전송과 sponsor를 포함한 네 서명으로 **하나의 Solana v0 transaction**에 묶는다. 이 책임은 일반적인 단일 payer HTTP 결제보다 custom atomic settlement에 가깝다.

따라서 제출 표현은 다음과 같이 고정한다.

- `Solana Devnet custom atomic settlement`: 맞음
- `x402 표준 구현`: 아님
- `AP2 호환 mandate`: 아님. 프로젝트 고유 policy/approval proof임
- `pay.sh sandbox 결제 증명`: 제품의 온체인 증거로 사용하지 않음

x402 adapter는 판매 API가 HTTP 402로 quote를 제시하고 단일 payer 결제로 구매하는 별도 책임이 생길 때 후속 범위로 둔다.

## sandbox에서 Devnet까지

1. fixture에서 상태 머신, 정책, 거부 경로를 반복 검증한다.
2. pay.sh를 사용할 경로라면 sandbox에서 challenge parsing과 retry만 확인한다.
3. 직접 Solana transaction을 구성하는 경로라면 `solana-test-validator` localnet에서 실제 submit·finality·잔액 변화를 먼저 확인한다. fixture나 message build test를 localnet 실행으로 표현하지 않는다.
4. Devnet에서 Devnet 전용 signer와 exact transaction bytes를 사용한다.
5. finalized transaction을 다시 decode해 mint, source, destination, amount, authority, memo, signer를 승인 원문과 대조한다.
6. 결과 불명확 시 새 거래를 만들지 않고 수동 reconciliation으로 멈춘다.

Mainnet은 해커톤 수용 기준이 아니다. 실제 자산, Mainnet 지갑, 자동화된 무제한 결제를 저장소나 데모에 도입하지 않는다.

## 설치 명령과 버전 경계

```sh
brew install pay
npx @solana/pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL
pay setup
```

OCR의 `brew install pay.` 또는 줄이 분리된 `npx` / `@solana/pay`를 복사하지 않는다. `pay setup`은 로컬 wallet/account와 agent integration을 준비하므로 단순한 무상 API client 설치로 설명하지 않는다.

x402를 새로 구현한다면 v2의 `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`, CAIP-2 network ID를 사용한다. v1의 `X-PAYMENT` 예제는 현재 구현 계약이 아니다.

## 안전·검증 체크리스트

- 금액은 소수 문자열이 아니라 mint decimals에 따른 정수 base unit으로 계산한다.
- 허용 mint, network, recipient, method, resource, expiry, max amount를 서명 전 고정한다.
- 모델 출력은 결제 권한으로 사용하지 않고 deterministic verifier가 다시 판정한다.
- signed bytes를 저장하기 전 외부 RPC로 보내지 않는다.
- 전송 응답을 잃어도 새 blockhash의 새 결제를 자동 생성하지 않는다.
- 수수료는 고정 USD 문구가 아니라 실제 lamports와 transaction metadata로 기록한다.
- entitlement는 finalized 거래와 예상 balance delta를 독립 검증한 뒤에만 발급한다.

제품 설명의 핵심은 “결제했다”가 아니라 **승인된 의도와 최종 온체인 결과가 동일함을 검증했다**는 것이다.
