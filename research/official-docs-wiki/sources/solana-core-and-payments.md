# Solana 코어와 결제

상태: 2026-07-23 현재 확인

## 공식 출처

- [Solana core concepts and clusters](https://solana.com/docs/core)
- [Solana fee structure](https://solana.com/docs/core/fees/fee-structure)
- [Solana Pay](https://solana.com/docs/tools/solana-pay)
- [Accept payments](https://solana.com/docs/payments/accept-payments)
- [Solana CLI basics](https://solana.com/docs/intro/installation/solana-cli-basics)

## 정규화 추출

- Mainnet Beta는 실제 가치가 오가는 프로덕션 네트워크, Devnet은 개발자 실험, Testnet은 주로 validator와 네트워크 기능 시험을 위한 클러스터다.
- 앱 개발에서 Devnet을 우선 추천하는 설명은 공식 역할 구분과 대체로 맞지만, Testnet 사용 금지나 모든 상황의 절대 규칙은 아니다.
- 현재 행사 계약은 localnet/testnet/devnet 작동 증거를 허용한다. Solana 일반 문서의 네트워크 역할과 행사 제출 요건을 섞지 않는다.
- 트랜잭션 수수료는 signature당 base fee와 선택적 priority fee의 조합이다. 고정된 USD 금액으로 계약하면 안 된다.
- Solana Pay는 결제 URL·QR과 참조 구현을 제공하는 표준 프로토콜이다. 공식 페이지는 1초 미만 처리와 평균 약 USD 0.0005 비용을 장점으로 제시한다.
- 결제 수신자는 RPC 또는 제공 도구를 통해 기대한 수취인, 금액, 토큰, 참조값, 확정 상태 등을 검증해야 한다.

## 공식 근거가 추가로 필요한 주장

슬라이드에 나타난 특정 TPS·시가총액·기업 파트너·국가별 채택 수치는 해당 슬라이드의 날짜와 원문 링크가 없으면 현재 사실로 확정하지 않는다.
