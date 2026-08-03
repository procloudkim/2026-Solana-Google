# Machine Payments Protocol (MPP)

상태: 2026-07-23 현재 확인

## 공식 출처

- [Machine Payments Protocol](https://mpp.dev/)
- [MPP sessions update](https://mpp.dev/blog/sessions-improved)
- [Stripe: Machine Payments Protocol](https://stripe.com/blog/machine-payments-protocol)
- [Stripe machine payments](https://docs.stripe.com/payments/machine)
- [pay.sh MPP support](https://pay.sh/docs/protocol/mpp)

## 정규화 추출

- MPP는 Tempo와 Stripe가 공동 작성해 2026-03-18 공개한 오픈 결제 표준으로 설명된다.
- 일회성 charge뿐 아니라 session, 반복·구독형 상호작용과 여러 결제 수단을 다룬다.
- Stripe의 machine payments는 MPP를 사용하는 한 구현·상품 경로이지 MPP 전체와 동의어가 아니다.
- pay.sh는 Solana challenge를 포함한 MPP 흐름을 지원하며, scheme별 지원은 x402와 동일하지 않다.

## 오해 방지

`MPP=기업용, x402=커뮤니티용` 같은 한 줄 분류는 공식 규격의 책임과 배포 선택지를 과도하게 단순화한다. 결제 수명주기, 결제 수단, facilitator·processor, 체인 지원을 열별로 비교해야 한다.
