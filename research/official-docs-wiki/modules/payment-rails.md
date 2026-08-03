# 모듈: 결제 레일

근거: [Solana](../sources/solana-core-and-payments.md), [pay.sh](../sources/pay-sh.md), [x402](../sources/x402.md), [MPP](../sources/mpp.md)

## 역할 비교

| 구성 요소 | 주 역할 | 계정·키 관련 정확한 표현 | 해커톤 런타임 증거 |
|---|---|---|---|
| Solana Pay | 결제 URL/QR 및 결제 요청 표준 | 사용자는 지갑으로 서명하며 수취자는 결제를 검증 | Solana tx signature와 검증 결과 |
| x402 v2 | HTTP 402 결제 challenge와 결제 증명 | 프로토콜은 공급자 계정 의존을 줄이지만 wallet/signature가 필요하고 facilitator 인증은 선택지별로 다름 | 402, payment requirement, signature, settlement receipt |
| MPP | charge/session/반복 결제 상호작용 | 결제 수단·processor·session 정책에 따라 다름 | challenge, method, authorization, receipt/session state |
| pay.sh | x402/MPP challenge를 처리하는 지갑·CLI/SDK 도구 | 공급자별 가입을 줄일 수 있지만 로컬 setup, wallet, funding, authorization 필요 | 사용 scheme, account/network, tx/receipt, 승인 로그 |

## sandbox와 실제 결제

`pay --sandbox` 성공은 통합 개발의 유효한 단위·연동 증거다. 그러나 공식 quickstart의 임시 로컬 sandbox 지갑이므로 현재 행사에서 요구하는 네트워크 트랜잭션 증거와 동일하지 않다.

권장 증거 단계:

1. sandbox에서 challenge parsing과 retry를 검증한다.
2. localnet 또는 Devnet에서 실제 서명과 트랜잭션을 검증한다.
3. 애플리케이션 로그에 agent decision, amount, mint, recipient, signature, confirmation을 연결한다.
4. Mainnet은 제품·보안·자금 정책이 필요할 때만 선택한다.

## 명령어 정정

```sh
brew install pay
npx @solana/pay
pay setup
```

OCR에서 복원된 `brew install pay.`는 실행 계약으로 쓰지 않는다.

## 수수료 표현

Solana 수수료는 base fee와 priority fee로 계산된다. 공식 마케팅의 평균 USD 비용은 참고값이지 고정 계약값이 아니다. 테스트와 데모에는 lamports 및 실제 transaction metadata를 기록한다.
