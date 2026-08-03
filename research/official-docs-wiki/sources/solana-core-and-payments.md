# Solana 코어와 결제: 네트워크·수수료·검증 기준

확인일: 2026-08-03

이 문서는 해커톤 데모가 어느 cluster에서 실행돼야 하는지, 수수료를 어떻게 표현할지, 결제 완료를 무엇으로 검증할지 정한다.

## 공식 출처

- [Solana core concepts and clusters](https://solana.com/docs/core)
- [Solana fee structure](https://solana.com/docs/core/fees/fee-structure)
- [Solana Pay](https://solana.com/docs/tools/solana-pay)
- [Accept payments](https://solana.com/docs/payments/accept-payments)
- [Solana CLI basics](https://solana.com/docs/intro/installation/solana-cli-basics)

## cluster 선택

| cluster | Solana 공식 용도 | 해커톤 적용 |
|---|---|---|
| Local validator | 로컬 반복 개발 | 빠른 테스트와 failure injection |
| Devnet | developer experimentation | Mandate Pool의 제출용 온체인 실행 |
| Testnet | validator testing | 앱 데모 기본 경로로 선택할 이유가 없으면 사용하지 않음 |
| Mainnet | production | 해커톤 필수 아님; 실제 자산·키를 도입하지 않음 |

행사 페이지는 localnet·testnet·Devnet live 실행을 허용한다. Solana의 일반 cluster 역할과 해커톤의 제출 조건을 섞지 않는다.

## 수수료와 성능 표현

Solana 공식 fee 문서는 총 수수료를 base fee와 선택적 prioritization fee의 합으로 정의한다. 현재 문서는 base fee를 signature당 5,000 lamports로 설명하지만 network 설정과 transaction 구성은 바뀔 수 있으므로, 제품 계약을 고정 USD 값으로 두지 않는다.

Solana Pay 페이지는 1초 미만 확인과 평균 USD 0.0005 비용을 장점으로 제시한다. 이는 공식 제품 설명의 평균값이며 특정 Mandate Pool transaction의 보장이 아니다. 제출 증거에는 실제 signature 수, compute budget, fee lamports, confirmation status를 기록한다.

## Solana Pay와 결제 완료

Solana Pay는 payment URL·QR·transaction request와 reference implementation을 제공하는 표준이다. URL을 만들거나 wallet이 서명한 것만으로 주문 완료가 되지는 않는다.

수취 측은 최소한 다음을 검증해야 한다.

- 올바른 cluster와 transaction signature
- expected recipient와 token account
- mint와 decimals
- exact integer amount
- reference 또는 order binding
- confirmation/finalization 상태

Mandate Pool은 Solana Pay URL이 아니라 custom v0 transaction을 사용하지만, **수취 후 독립 검증**이라는 원칙은 동일하다. finalized transaction을 다시 decode해 세 `TransferChecked`, signer, memo, balance delta를 quote와 대조한 뒤 이용권을 발급한다.

## 실행 기준

1. 모든 금액을 base unit integer로 계산한다.
2. Devnet RPC endpoint와 genesis/cluster를 시작 시 확인한다.
3. signed message가 승인된 instruction set과 byte-for-byte 일치하는지 제출 전에 검증한다.
4. RPC 응답을 잃어도 새 payment를 만들지 않고 기존 signature를 조회한다.
5. finalized 실패 또는 결과 불명확 상태를 성공으로 승격하지 않는다.

슬라이드의 TPS·시가총액·기관·국가별 채택 수치는 날짜와 재현 가능한 공식 원출처가 없으면 제품 근거로 사용하지 않는다.
