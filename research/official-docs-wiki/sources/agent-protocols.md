# 에이전트·상거래 프로토콜

상태: 2026-07-23 현재 확인

## 공식 출처

- [Google AP2 repository](https://github.com/google-agentic-commerce/AP2)
- [A2A latest specification](https://a2a-protocol.org/latest/)
- [MCP specification](https://modelcontextprotocol.io/specification/2025-11-25/)
- [UCP core concepts](https://ucp.dev/documentation/core-concepts/)
- [ACP repository](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe ACP documentation](https://docs.stripe.com/agentic-commerce/protocol)
- [Google developer guide to agent protocols](https://developers.googleblog.com/en/developers-guide-to-ai-agent-protocols/)

## 책임별 추출

| 프로토콜 | 현재 공식 문서에서의 주 책임 |
|---|---|
| A2A | 독립 에이전트 간 발견, 작업 위임, 상태·결과 교환 |
| MCP | 모델/클라이언트가 서버의 resources, prompts, tools를 사용하는 표준 인터페이스 |
| AP2 | 에이전트 상거래의 사용자 의도·권한 위임·mandate·감사 가능성 |
| UCP | 상거래 참여자 사이의 공통 capability와 checkout/order 흐름 |
| ACP | 에이전트 기반 상품 발견·checkout·결제 handoff를 위한 상거래 규격 |
| x402 | HTTP 리소스 접근에 결제 요구·증명·정산을 결합 |
| MPP | 에이전트 결제의 charge·session·반복 상호작용과 결제 수단 협상 |

## 중요한 경계

- A2A는 에이전트 대 에이전트, MCP는 모델/클라이언트 대 도구·컨텍스트 서버의 중심 책임이 다르다.
- AP2 샘플이 ADK/Gemini를 사용해도 AP2 규격 자체가 ADK 또는 Gemini만을 요구하지는 않는다.
- AP2/UCP/ACP와 x402/MPP는 경쟁 관계로만 보면 안 된다. 앞쪽은 의도·상거래 상태·권한 위임을, 뒤쪽은 결제 요구와 정산을 담당하도록 조합될 수 있다.
- 각 규격은 갱신 중이다. 구현 시 프레젠테이션의 버전 없는 이름보다 공식 latest/spec URL을 고정해야 한다.
