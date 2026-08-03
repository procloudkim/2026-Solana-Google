# 에이전트·상거래 프로토콜: 책임과 구현 경계

확인일: 2026-08-03

이 문서는 프로토콜 이름을 한 아키텍처에 쌓는 대신, 각 규격이 소유하는 메시지와 제품 책임을 구분한다. 실제 선택은 [에이전트 프로토콜 지도](../modules/agent-protocol-map.md)에서 한다.

## 공식 출처

- [Google AP2 repository](https://github.com/google-agentic-commerce/AP2)
- [A2A latest specification](https://a2a-protocol.org/latest/)
- [MCP specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/)
- [UCP core concepts](https://ucp.dev/documentation/core-concepts/)
- [ACP repository](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe ACP documentation](https://docs.stripe.com/agentic-commerce/protocol)
- [Google developer guide to agent protocols](https://developers.googleblog.com/en/developers-guide-to-ai-agent-protocols/)

## 책임별 요약

| 프로토콜 | 공식 문서에서의 중심 책임 | 구현 증거 |
|---|---|---|
| A2A | 독립 agent의 발견, task 위임, 상태·result 교환 | Agent Card, message/task/artifact trace |
| MCP | LLM application과 외부 data·resources·prompts·tools의 표준 연결 | negotiated capabilities와 tool/resource calls |
| AP2 | agent payment에서 사용자 의도·권한 위임과 감사 가능한 authorization | 규격에 맞는 mandate와 verification |
| UCP | business capability 발견과 catalog·cart·checkout·order lifecycle | `/.well-known/ucp`, negotiated version, typed checkout/order |
| ACP | buyer·AI agent·business가 purchase를 완료하는 commerce interaction model | 고정 spec version의 checkout·payment handler exchange |
| x402 | HTTP resource의 payment requirement·proof·settlement | v2 402 headers와 settlement receipt |
| MPP | charge·session·subscription·반복 payment interaction | challenge, authorization, lifecycle state |

## 중요한 경계

### A2A와 MCP

A2A 공식 문서는 둘을 보완 관계로 설명한다. MCP는 agent가 tool·API·resource를 쓰는 연결이고, A2A는 독립 agent가 서로 발견하고 task와 result를 교환하는 연결이다. 내부 함수나 같은 process의 역할 분담만으로 A2A를 구현했다고 주장하지 않는다.

### AP2와 ADK/Gemini

AP2 repository의 sample은 ADK와 Gemini를 사용하지만 repository는 AP2가 둘을 요구하지 않는다고 명시한다. sample runtime과 protocol conformance를 분리한다. 자체 approval JSON에 `mandate`라는 이름을 붙이는 것만으로 AP2가 되지 않는다.

### UCP와 ACP

둘 다 agentic commerce를 다루지만 동일한 wire protocol은 아니다. UCP는 profile 기반 capability discovery와 typed shopping lifecycle을 제공하고, ACP는 buyer·agent·business의 purchase flow를 정의하며 현재 공식 repository는 beta라고 표시한다. 구현할 규격과 날짜 버전을 명시한다.

### 상거래와 결제

AP2/UCP/ACP는 의도, 권한, catalog, checkout, order 같은 상거래 상태를 다룬다. x402/MPP는 HTTP 결제 요구와 authorization·settlement를 다룬다. 필요하면 조합할 수 있지만 자동으로 호환되지는 않는다.

## Mandate Pool에 적용

현재 제품은 ADK/Gemini와 프로젝트 고유 policy proof, custom Solana settlement를 사용한다. A2A·MCP·AP2·UCP·ACP·x402·MPP의 wire contract는 구현하지 않았다. 따라서 이 규격들은 배경 연구 또는 후속 adapter 후보이며 제출용 구현 목록이 아니다.

후속 선택은 다음 순서로 한다.

1. 해결할 책임과 현재 custom interface를 한 문장으로 정의한다.
2. 공식 stable/latest spec과 package version을 고정한다.
3. message fixture, negative case, conformance evidence를 만든다.
4. 기존 policy·signing boundary가 약해지지 않는지 검토한다.
5. 실제 trace가 생긴 뒤에만 protocol 이름을 제품 설명에 추가한다.

각 규격은 계속 갱신된다. presentation의 버전 없는 이름보다 실제 구현이 참조하는 공식 schema URL과 release를 우선한다.
