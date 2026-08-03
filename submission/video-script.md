# Mandate Pool 최종 데모 영상 가이드

> 심사 영상이 어떤 주장과 증거를 보여주는지 장면별로 연결한 문서입니다. 영상 제작 계획이 아니라 최종 `153.58`초 산출물의 해설·검증 지도입니다.

## 바로 보기

- [YouTube · 2분 34초](https://youtu.be/of3GMQq8Qv8)
- [Google Cloud Storage 고정 MP4](https://storage.googleapis.com/project-682bea5f-ac81-4a36-8a1-mandate-pool-video/mandate-pool-demo.mp4?generation=1785769358677446)
- [영상 upload receipt](evidence/video-upload-2026-08-04.json)
- [한국어 내레이션 원문](video/narration.md)

영상은 저장된 6장 evidence deck과 이미 finalized된 receipt로 만들었습니다. 촬영·편집을 위해 정상 결제를 다시 실행하지 않았습니다. 화면의 Devnet USDC는 금전 가치가 없는 테스트 토큰입니다.

## Chapter map

| 시간 | 질문 | 화면과 핵심 주장 | 근거 |
|---|---|---|---|
| `0:00–0:15` | 왜 필요한가? | 여러 사람을 대신하는 Agent에는 추천보다 권한 경계가 중요하다 | [HITL 설계](../research/decision-report/agentic-commerce-hitl-design-decision.md) |
| `0:15–0:32` | 어떤 조건을 지키나? | A는 API+CSV, B는 API+자동갱신 금지, C는 7일 일회성 이용을 요구한다 | [정상 order receipt](evidence/normal-order-2ac7eac.json) |
| `0:32–0:53` | AI와 사람은 무엇을 하나? | ADK·Gemini는 구조화·후보 제안만 하고, 운영자 역할 확인과 결정론적 정책이 권한을 통제한다 | [제품 README](../product/mandate-pool/README.md#에이전트와-권한-경계) |
| `0:53–1:17` | 어떻게 부분 결제를 막나? | 세 `TransferChecked`를 한 Solana version-0 transaction에 넣고 finalized 원문·잔액을 재검증한다 | [정상 receipt](evidence/normal-order-2ac7eac.json) |
| `1:17–2:07` | 실제로 무엇을 관찰했나? | 거부 주문은 `NO_BUY`·0 transaction·0 entitlement; 정상 주문은 exact split·한 finalized transaction·entitlement 3개 | [거부 receipt](evidence/reject-order-2ac7eac.json), [정상 receipt](evidence/normal-order-2ac7eac.json) |
| `2:07–2:34` | 무엇을 아직 증명하지 않았나? | operator simulation, 서버 보관 Devnet key, custom settlement, Mainnet·x402 비범위 | [Submission manifest](manifest.md#증거-경계) |

YouTube chapter용 텍스트:

```text
0:00 왜 AI 결제에 권한 경계가 필요한가
0:15 세 구매자의 서로 다른 조건
0:32 Google ADK·Gemini, HITL, 결정론적 정책
0:53 하나의 원자적 Solana 거래
1:17 거부 경로와 Devnet 정상 거래 증거
2:07 현재 한계와 제품 약속
```

## 영상이 사용하는 고정 증거

| 항목 | 고정값 |
|---|---|
| 배포 source | `2ac7eac17ea803b4537b630234ac6507523e5325` |
| 정상 주문 | `ord_b6ab984c23334cb0a3f8480d4c12abf9` |
| 거부 주문 | `ord_82ac0530d4744e098f181aa5460e6027` |
| 정상 분담 | A `333334`, B `333333`, C `333333` atomic |
| 정상 signature | `2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW` |
| Finalized slot | `480936920` |
| 거부 판정 | Gemini selector `NO_BUY`; settlement evidence·signature 없음; entitlement `0` |
| 정상 판정 | `FULFILLED`; Merchant `+1000000`; entitlement `3` |

거부 주문의 `policyChecks`는 빈 배열입니다. Gemini selector가 공통 상품 없음으로 `NO_BUY`를 제안했고 workflow가 quote·결정론적 policy·settlement에 들어가기 전에 종료됐습니다. 정상 BUY 제안만 결정론적 policy와 transaction verifier를 모두 통과했습니다.

## 주장 경계

- 영상은 실제 사용자 세 명의 독립 wallet 승인을 보여주지 않습니다. 운영자 한 명이 A/B/C 역할을 순차 확인합니다.
- 공개 fixture를 온체인 실행처럼 보여주지 않습니다. 온체인 주장은 Devnet Explorer와 저장된 receipt로만 제시합니다.
- SignalDesk는 고정 데모 catalog이며 외부 merchant fulfillment를 증명하지 않습니다.
- `1 USDC`는 총 `1.000000` **Devnet 테스트 USDC**를 뜻합니다. 실제 달러 결제가 아닙니다.
- x402·AP2·Solana Pay·Mainnet 구현을 주장하지 않습니다.
- 정상 transaction은 한 번만 실행했습니다. 영상은 해당 실행의 증거를 재생합니다.

## Media 검증값

| 항목 | 값 |
|---|---|
| Duration | `153.58`초 |
| Video | H.264 High, 1280×720, yuv420p, 30 fps |
| Audio | AAC-LC, 22050 Hz, mono, `ko-KR` |
| File size | `2,603,713` bytes |
| SHA-256 | `13f18c032621ffbc1b1ec55703f9f6de7f5b72e9b0921546d4405cce85a9d308` |
| 공개 확인 | GCS 고정 generation HTTP `200` |

영상 내용을 변경하면 이 값과 upload receipt를 재사용하지 않습니다. 새 MP4의 duration·codec·hash·공개 접근·비밀정보 노출을 다시 검증합니다.
