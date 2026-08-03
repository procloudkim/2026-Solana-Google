# pay.sh: HTTP 402 결제를 다루는 wallet-aware 도구

확인일: 2026-08-03

이 문서는 pay.sh를 “계정·키가 전혀 없는 자동 결제”로 오해하지 않고, 어떤 테스트와 승인 책임을 대신하고 어떤 책임은 남기는지 설명한다.

## 공식 출처

- [pay.sh documentation](https://pay.sh/docs)
- [Install pay.sh](https://pay.sh/docs/get-started/install)
- [Client quickstart and sandbox](https://pay.sh/docs/get-started/client-quickstart)
- [Accounts and wallets](https://pay.sh/docs/pay-for-apis/accounts)
- [Pass-through commands](https://pay.sh/docs/toolchain/commands/pass-through)
- [MPP support](https://pay.sh/docs/protocol/mpp)
- [Payment schemes](https://pay.sh/docs/sdk/typescript/schemes)

## 무엇을 하는가

pay.sh는 `curl`, `wget`, `http`, agent command 등을 감싸고 HTTP 402 challenge를 감지한다. 활성 local wallet이 결제를 승인하면 proof를 붙여 요청을 다시 보낸다. 현재 공식 문서는 MPP와 x402 challenge를 다루는 흐름을 설명한다.

공급자별 계정 개설이나 API key 발급을 줄일 수 있지만 다음 책임은 남는다.

- pay 설치와 local account/wallet setup
- 안전한 key storage
- network와 funding
- 사용자 또는 명시적 automation policy의 authorization
- challenge·가격·수취인 검증
- settlement와 application result 확인

## sandbox와 실제 결제의 경계

`--sandbox`는 real funds 대신 자동 생성·충전되는 임시 local account를 사용한다. challenge parsing, proof 생성, retry를 빠르게 검증하기에 적합하지만 Devnet이나 Mainnet의 on-chain transaction proof는 아니다.

공식 문서는 실제 결제에 local user authorization이 필요하며, provider response·header·challenge·문서를 untrusted external content로 취급하라고 안내한다. 작은 유료 호출부터 시작하고 여러 호출 또는 가격이 불명확한 탐색은 먼저 확인하는 것이 안전 방향이다.

## 정확한 설치·실행

```sh
brew install pay
pay --version

npx @solana/pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL

pay setup
pay account list
```

`pay setup`은 가능한 경우 OS secure store에 wallet key를 만들고 감지된 agent의 MCP 설정을 준비한다. sandbox example만 실행할 때는 mainnet wallet funding이 필요하지 않다. OCR의 `brew install pay.`와 줄이 잘못 분리된 `npx @solana/pay`는 사용하지 않는다.

## scheme 선택

현재 pay-kit 문서는 fixed charge, metered usage, subscription, session을 구분하고 이를 MPP 또는 x402 sub-form에 매핑한다. protocol과 scheme의 지원 조합이 다르므로 `pay.sh가 둘을 지원한다`는 사실만으로 같은 메시지·비용 모델이라고 가정하지 않는다.

## Mandate Pool에 미치는 의미

Mandate Pool v0는 pay.sh를 settlement runtime으로 사용하지 않는다. 세 payer의 atomic transaction이 핵심이므로 custom Solana 경로를 유지하고, pay.sh 이름이나 sandbox 영수증을 제출 증거에 추가하지 않는다.

향후 유료 HTTP resource를 구매하는 adapter를 만들 때만 다음 순서로 검토한다.

1. sandbox에서 한 번의 challenge와 retry를 확인한다.
2. price·scheme·network·recipient·resource cap을 deterministic policy에 묶는다.
3. explicit HITL 또는 제한된 mandate 없이는 자동 결제를 열지 않는다.
4. protocol receipt와 Solana transaction, 실제 API result를 같은 trace로 연결한다.

`no accounts, no keys` 같은 마케팅 축약은 local wallet custody와 authorization을 숨기므로 제품 설명에 그대로 사용하지 않는다.
