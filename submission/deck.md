---
marp: true
title: Mandate Pool
description: Google Cloud × Solana AI Agentic Hackathon 제출용 6장 소개서 원고
paginate: true
footer: Mandate Pool · Solana Devnet test tokens
---

<!--
사용법
- 이 파일은 정확히 6장으로 구성한다.
- slide 5의 증거 슬롯과 slide 6의 링크를 submission/manifest.md 기준으로 교체한다.
- 증거 슬롯이 하나라도 남아 있으면 외부 제출용 PDF로 내보내지 않는다.
-->

# Mandate Pool

## 세 사람의 조건이 모두 맞을 때만, 세 결제를 하나로

세 구매자의 자연어 조건을 **검증 가능한 결제 권한**으로 바꾸는 공동구매용 Agentic Commerce 프로토타입

> AI가 결제 권한을 갖는 것이 아니라, 사람이 위임한 mandate 안에서만 제안합니다. 결정론적 정책과 하나의 원자 거래가 그 권한을 끝까지 보존합니다.

**증거 상태:** `검증 완료 · Solana Devnet 테스트 토큰`

`Devnet USDC = 테스트 토큰 · 실제 달러가 아님`

---

# 2. Why — 함께 쓰는 돈은 추천보다 권한 보존이 어렵다

세 에이전트가 한 상품을 공동 구매하면 세 질문에 답해야 합니다.

| 위험 | 결제가 지켜야 할 질문 |
|---|---|
| 조건 충돌 | 세 사람의 필수 기능·금지 조건을 모두 만족하는가? |
| 일부 결제 | 한 사람의 전송만 성공하고 나머지가 실패할 수 있는가? |
| 중복·변조 | 승인 뒤 금액이나 수취인이 바뀌거나, 재시도로 두 번 결제되는가? |

**제품 원칙**

```text
공통 조건이 있으면 → 한 번에 결제하고 결과를 검증
공통 조건이 없으면 → 거래를 만들지 않고 이유를 남김
결과가 불명확하면 → 새 결제 없이 조정 단계에서 멈춤
```

---

# 3. What — 세 mandate의 교집합만 공동 구매한다

**데모 사용자:** API·CSV 데이터 이용권을 함께 사려는 Buyer A, B, C

| 단계 | 정상 수용 기준 | 거부 수용 기준 |
|---|---|---|
| 조건 | A `≤0.400000`, B `≤0.340000`, C `≤0.400000` USDC | B 한도 `0.300000` USDC |
| 선택 | 세 조건을 만족하는 7일·비자동갱신 상품 | 필요한 B 분담액 `0.333333`이 한도 초과 |
| 결제 | 총 1 Devnet 테스트 USDC를 A/B/C가 분담 | `NO_BUY`; transaction bytes·signature 없음 |
| 결과 | finalized 검증 뒤 이용권 3개 발급 | 이용권 0개, 잔액 불변 |

정상 분담은 정수 atomic unit으로 고정합니다.

`A 333334 + B 333333 + C 333333 = Merchant 1000000`

---

# 4. How — AI의 제안과 결제 권한을 분리한다

```text
자연어 조건
  → Google ADK·Gemini: 정규화와 상품 제안만
  → 운영자 HITL: A/B/C 역할별 mandate hash·nonce 확인
  → 결정론적 정책: 승인·한도·상품·만료·분담 재계산
  → Solana v0 transaction 1개: TransferChecked 3개
  → finalized verifier: 원문·instruction·잔액 증감 대조
  → 검증이 모두 맞을 때만 이용권 발급
```

- Gemini에는 signer와 RPC 도구를 주지 않습니다.
- Firestore는 version CAS, idempotency key, 감사 hash chain을 보존합니다.
- Sponsor와 A/B/C는 **같은 거래 원문**에 서명합니다.
- 응답 유실·finality 불명확 시 새 거래를 만들지 않고 `RECONCILIATION_REQUIRED`로 멈춥니다.

---

# 5. Proof — “결제함”과 “결제하지 않음”을 함께 증명한다

| 거부 경로 · 거래 0건 | 정상 경로 · Devnet 거래 1건 |
|---|---|
| 화면 `submission/evidence/reject-proof-2ac7eac.svg` | 화면 `submission/evidence/normal-devnet-proof-2ac7eac.svg` |
| order `ord_82ac0530d4744e098f181aa5460e6027` | order `ord_b6ab984c23334cb0a3f8480d4c12abf9` |
| `state=NO_BUY` | `state=FULFILLED` |
| `failure.code=NO_COMMON_PRODUCT` | signature `2JMWb2wc4GTt…wDt2jaMy2ZAW` |
| settlement evidence·signature 없음 | finalized slot `480936920` |
| entitlement `0`, 전후 잔액 불변 | A/B/C debit 합계 `1000000` |
| [receipt](https://github.com/procloudkim/2026-Solana-Google/blob/submission-v2/submission/evidence/reject-order-2ac7eac.json) | Merchant credit `1000000` |
|  | [Devnet Explorer](https://explorer.solana.com/tx/2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW?cluster=devnet) · [receipt](https://github.com/procloudkim/2026-Solana-Google/blob/submission-v2/submission/evidence/normal-order-2ac7eac.json) |

**판정 규칙:** 두 열의 실제 receipt가 같은 제출 commit·Cloud Run revision과 연결되기 전에는 실행 성공을 주장하지 않습니다.

---

# 6. 한계와 재현 링크

**현재 프로토타입의 경계**

- HITL은 실제 세 사용자의 독립 서명이 아니라, 운영자 한 명의 A/B/C 역할 시뮬레이션입니다.
- Devnet 테스트 키는 서버가 보관합니다. 비수탁 지갑 제품을 증명하지 않습니다.
- custom Solana atomic settlement이며 x402 구현이라고 주장하지 않습니다.
- Devnet USDC는 금전 가치가 없고 실제 달러로 담보되지 않습니다.
- Mainnet·실자산·상용 운영 안정성은 범위 밖입니다.

**검증 가능한 링크**

- [GitHub 저장소](https://github.com/procloudkim/2026-Solana-Google) · 배포 소스 `2ac7eac17ea803b4537b630234ac6507523e5325`
- [현재 소스의 실행 안내](https://github.com/procloudkim/2026-Solana-Google/blob/2ac7eac17ea803b4537b630234ac6507523e5325/product/mandate-pool/README.md)
- [Cloud Run 공개 fixture](https://mandate-pool-judge-x7id33dnyq-du.a.run.app) · `FIXTURE · NOT ON-CHAIN` · 데모 키 `judge-fixture-key-v1`
- [정상 거래 Explorer](https://explorer.solana.com/tx/2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW?cluster=devnet)
- [제출 증거 manifest](https://github.com/procloudkim/2026-Solana-Google/blob/submission-v2/submission/manifest.md)
- [공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)

**한 문장 요약:** 모두의 권한을 만족하면 하나의 거래로, 한 명이라도 벗어나면 거래 없이 끝냅니다.
