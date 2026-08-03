# 에이전트 프로토콜 지도: 이름이 아니라 책임으로 선택하기

이 문서는 A2A, MCP, AP2, UCP, ACP, x402, MPP가 서로 무엇을 대체하고 무엇을 조합할 수 있는지 설명한다. 공식 책임은 [에이전트·상거래 프로토콜 노트](../sources/agent-protocols.md), [x402](../sources/x402.md), [MPP](../sources/mpp.md)에 정리했다.

## 책임 지도

```text
사용자 의도·결제 권한
  AP2 mandate/authorization
          |
상품 발견·checkout·order
  UCP 또는 ACP
          |
에이전트 협업             도구·데이터 연결
  A2A                    MCP
          \              /
           HTTP 결제 상호작용
           x402 v2 또는 MPP
                  |
           지갑 실행·온체인 정산
           pay.sh / Solana
```

이 도식은 책임을 배치한 설계 지도다. 위에서 아래로 모두 구현해야 한다는 dependency graph도, 각 프로토콜이 자동으로 wire-compatible하다는 뜻도 아니다.

## 선택 질문

| 제품이 실제로 해결해야 하는 질문 | 먼저 볼 규격 | 구현하지 않았다면 쓰지 말아야 할 표현 |
|---|---|---|
| 독립 에이전트가 서로 발견하고 작업·결과를 교환하는가? | A2A | “multi-agent”를 내부 함수 3개만으로 주장 |
| 모델이 외부 tools·resources·prompts를 표준 방식으로 쓰는가? | MCP | 일반 함수 호출을 MCP 통합으로 주장 |
| 사용자가 에이전트에게 어떤 구매·결제 권한을 위임했는가? | AP2 | 자체 JSON 승인 구조를 AP2 mandate로 명명 |
| 여러 판매자·플랫폼이 catalog·checkout·order를 공유하는가? | UCP 또는 ACP | 단일 앱의 상품 목록을 commerce protocol로 주장 |
| HTTP resource가 402로 결제를 요구하는가? | x402 v2 | custom Solana transfer를 x402로 주장 |
| 반복 호출 또는 session cap을 협상하는가? | MPP | 일회성 거래를 MPP session으로 주장 |

## Mandate Pool에 필요한 최소 조합

현재 구현은 다음 책임만 실제로 가진다.

- Google ADK/Gemini: 자연어 구매 조건 정규화와 후보 제안
- 프로젝트 고유 approval/policy proof: A/B/C 조건·한도·만료 검증
- custom Solana transaction: 세 전송의 원자적 정산
- Cloud Run·Firestore: 실행과 감사 상태

따라서 제품 설명에 AP2, A2A, MCP, UCP, ACP, x402를 구현 기술로 추가하지 않는다. 다만 향후 buyer별 cryptographic mandate가 필요하면 AP2를, 외부 seller checkout이 필요하면 UCP/ACP를, 유료 HTTP resource가 필요하면 x402/MPP를 **각 책임별 adapter 후보**로 평가한다.

## 구현 규칙

1. 아키텍처 박스마다 protocol 이름이 아니라 입력·출력·권한·실패 상태를 적는다.
2. latest URL만 참조하지 말고 실제 schema/spec 날짜 또는 package major를 고정한다.
3. AP2 sample의 ADK/Gemini 사용을 AP2의 런타임 요구로 오해하지 않는다.
4. x402의 stateless 목표와 facilitator API 인증을 분리한다.
5. protocol extension이나 beta spec은 version drift를 테스트에 반영한다.
6. 사용자 승인, tool consent, wallet signing은 서로 다른 보안 경계로 취급한다.

## 다음 행동

- 제출 아키텍처에서 구현하지 않은 protocol 로고를 제거한다.
- `mandate`, `agent`, `settlement`처럼 규격명과 겹치는 자체 용어에는 `project-specific` 경계를 명시한다.
- 후속 adapter를 추가할 때는 먼저 wire message fixture와 공식 conformance 기준을 만든 뒤 호환성을 주장한다.

좋은 프로토콜 선택은 많이 연결하는 것이 아니라, **제품의 한 책임을 표준 메시지와 검증 가능한 실패 상태로 더 명확하게 만드는 것**이다.
