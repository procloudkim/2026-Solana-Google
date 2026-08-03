# pay.sh

상태: 2026-07-23 현재 확인

## 공식 출처

- [pay.sh documentation](https://pay.sh/docs)
- [Install pay.sh](https://pay.sh/docs/get-started/install)
- [Client quickstart and sandbox](https://pay.sh/docs/get-started/client-quickstart)
- [Accounts](https://pay.sh/docs/pay-for-apis/accounts)
- [Pass-through commands](https://pay.sh/docs/toolchain/commands/pass-through)
- [MPP support](https://pay.sh/docs/protocol/mpp)
- [Payment schemes](https://pay.sh/docs/sdk/typescript/schemes)

## 정규화 추출

- 정확한 Homebrew 명령은 `brew install pay`다. OCR의 `brew install pay.`는 오류다.
- 대체 실행 경로는 `npx @solana/pay`다.
- pay.sh는 명령을 감싸서 MPP 또는 x402 결제 challenge를 감지하고, 지갑 승인을 거쳐 결제 증명을 붙여 재시도한다.
- `pay setup`은 로컬 계정·지갑과 MCP 설정을 준비한다. 실제 결제에는 자금과 사용자 승인 정책이 필요하다.
- sandbox는 임시 로컬 지갑을 사용하는 테스트 경로다. sandbox 성공만으로 Devnet/Mainnet 온체인 결제를 증명하지 않는다.
- 실제 Mainnet 자동화는 의도적인 승인 정책 없이 무제한으로 열어 두지 않는 것이 공식 문서의 안전 방향이다.
- MPP의 단일 charge·session과 x402 exact/usage 등 지원 조합은 scheme별로 다르다.

## 오해 방지

`가입이나 공급자 API key 없이 유료 API를 호출한다`는 메시지는 공급자별 계정 개설을 줄인다는 뜻으로 읽어야 한다. 로컬 지갑, pay.sh 계정 설정, 자금, 결제 승인이 모두 사라진다는 뜻은 아니다.
