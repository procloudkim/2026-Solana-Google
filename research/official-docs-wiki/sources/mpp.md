# Machine Payments Protocol: charge와 반복 결제의 수명주기

확인일: 2026-08-03

이 문서는 MPP가 언제 x402와 다른 선택이 되는지, session 비용에 대해 어디까지 말할 수 있는지 정한다.

## 공식 출처

- [Machine Payments Protocol](https://mpp.dev/)
- [MPP sessions update](https://mpp.dev/blog/sessions-improved)
- [Stripe: Introducing the Machine Payments Protocol](https://stripe.com/blog/machine-payments-protocol)
- [Stripe machine payments](https://docs.stripe.com/payments/machine)
- [pay.sh MPP support](https://pay.sh/docs/protocol/mpp)

## 핵심 사실

- MPP는 agent가 web service에 programmatically 지불하도록 설계된 open payment standard다.
- Stripe와 Tempo가 공동 작성했으며 2026-03-18 공개됐다.
- agent가 HTTP-addressable resource를 요청하면 service가 payment request를 반환하고, agent가 authorization한 뒤 resource를 받는 흐름을 다룬다.
- 일회성 charge뿐 아니라 session, subscription, 반복 상호작용과 여러 payment method를 다룰 수 있다.
- pay.sh의 현재 MPP 문서는 `WWW-Authenticate` challenge와 authorization credential retry, single charge, capped repeated-call session을 구분한다.

Stripe machine payments는 MPP를 쓰는 하나의 processor·product 경로다. Stripe balance, fiat settlement, refund, availability 조건을 MPP 규격 전체의 보편 기능으로 일반화하지 않는다.

## x402와 비교할 때의 질문

| 질문 | 일회성 HTTP 결제가 중심 | 반복·session lifecycle이 중심 |
|---|---|---|
| 먼저 검토할 규격 | x402 `exact` 또는 MPP charge | MPP session/subscription, 또는 선택 rail의 metered scheme |
| 핵심 상태 | requirement → payment → settlement | open/authorize → repeated use → cap/expiry → close/settle |
| 반드시 측정할 것 | 요청당 latency·fee·retry | open/close 비용, call 수, cap 소비, failure recovery |

`x402는 N회 호출에 N개 transaction, MPP는 언제나 두 개 transaction`이라는 공식은 보편 규격 사실이 아니다. payment rail, scheme, batching, channel design, failure path에 따라 달라진다. 선택한 구현으로 benchmark하기 전에는 비용 우위를 주장하지 않는다.

## Mandate Pool에 미치는 의미

현재 공동 구매는 일회성 atomic settlement이므로 MPP session을 추가할 이유가 없다. MPP 로고를 붙이면 반복 결제 상태와 wire message를 실제로 구현했다는 오해를 만든다.

후속 제품에서 API를 여러 번 호출하거나 일정 기간 budget cap 안에서 구매를 반복한다면 다음을 먼저 설계한다.

1. session principal과 사용 목적
2. 총 cap, per-call cap, expiry, cancellation
3. authorization을 갱신할 HITL 조건
4. concurrent call의 atomic budget consumption
5. close·refund·unknown settlement 상태
6. 실제 call 결과와 payment receipt의 trace binding

## 불확실성과 갱신 규칙

MPP와 관련 SDK는 빠르게 갱신되고 있다. 2026-07-23 비교 데이터 생성 이후에도 공식 사이트에 agent SDK/harness integration 업데이트가 게시됐다. 구현 시 이 노트의 개요가 아니라 실제 사용 package와 해당 버전의 공식 schema를 고정한다.

`MPP=기업용, x402=커뮤니티용` 같은 시장 포지셔닝은 기능 요구사항이 아니다. protocol lifecycle과 지원 rail을 기준으로 선택한다.
