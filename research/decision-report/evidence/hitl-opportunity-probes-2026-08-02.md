# HITL 기회 검증을 위한 읽기 전용 탐색 기록

## 검증 목적

이 문서는 해커톤 요구와 외부 유료 API의 payment challenge를 직접 관찰해 다음 두 질문에 답하기 위한 초기 탐색 기록이다.

1. AI agent가 사용자의 한도 안에서 결제를 수행하는 제품이 행사 주제에 맞는가?
2. HITL을 매 결제 승인에 두지 않고, 사전 위임과 예외 처리에 두어야 할 근거가 있는가?

모든 probe는 2026-08-02 KST에 인증 없이 읽기 전용으로 실행했다. 지갑 서명·결제·resource unlock은 없었고, Mainnet 또는 실자산을 사용하지 않았다.

## 결론 요약

| 검증 항목 | 관찰 | 제품 결정에 주는 의미 |
|---|---|---|
| 해커톤 주제 | 정해진 한도 안의 agent 결제와 Solana 기반 Agentic Commerce를 요구 | HITL은 매 결제 승인보다 mandate 설정·변경·예외에 두는 설계가 주제와 더 잘 맞는다는 제품 가설을 지지 |
| QuickNode x402 | Solana Devnet 옵션을 포함한 machine-readable HTTP 402 challenge 관찰 | 실제 유료 resource offer 후보는 존재하지만 settlement·유용성은 별도 검증 필요 |
| pay.sh BigQuery | HTTP 402, USD 0.001/request, Mainnet asset requirement 관찰 | offer 존재는 확인했지만 안전 경계상 결제·결과 품질은 검증하지 않음 |
| pay.sh Document AI | 두 요청 모두 challenge 생성 단계에서 HTTP 500 | usable challenge로 취급하지 않고 후보를 보류 |

## 1. 해커톤 요구 관찰

### 방법

- 대상: [`https://www.gcp-solana-ai-agentic-hacks-kr.xyz/`](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)
- 첫 조회: 약 2026-08-02 14:10 KST
- 재조회: 약 2026-08-02 16:50 KST
- 사실 재확인: 2026-08-03 KST
- 조회 범위: HTML과 당시 연결된 배포 JavaScript asset `/assets/index-DHFtfSyp.js`
- 변경 작업: 없음

### 관찰 결과

- 페이지 제목은 `2026 Google Cloud Hackathon`이었다.
- 제품 목적 문구는 AI Agent가 설정된 한도 안에서 매 단계마다 사람의 승인을 요청하지 않고 결제를 처리하는 방향을 제시했다.
- track은 `Solana 기반 Agentic Commerce` 하나였고, A–D는 예시이며 주제 안의 다른 아이디어도 허용한다고 표시했다.
- 표시된 심사 기준은 다음 네 범주였다.
  1. 혁신성과 UX
  2. Gemini / Google Cloud AI 활용
  3. 기술 완성도와 Solana / infrastructure / protocol 통합
  4. localnet, testnet 또는 Devnet의 실제 동작 transaction과 log 증거
- 표시된 마감은 2026-08-03 23:59 KST였다.
- 약 16:50 KST 재조회에서도 track, 자율 결제 방향, 네 심사 기준, 8/3 종료 표시는 유지됐다.
- 2026-08-03 KST 재확인에서도 HTML은 같은 제목과 asset을 제공했고, asset의 행사 목적·단일 track·심사 기준·마감 문구가 위 관찰과 일치했다.

### 해석과 한계

두 시점의 공개 페이지가 같은 방향을 제시했으므로 “한도 기반 자율 결제”는 제품 설계의 직접 근거로 사용할 수 있다. 여기서 **HITL을 mandate 생성·수정, 고위험 예외, 최종 데모 실행에 배치한다**는 것은 우리 팀의 설계 해석이지 행사 페이지의 문구 그대로가 아니다.

이 관찰은 당시 공개된 텍스트만 증명한다. 페이지에 공개되지 않은 심사 가중치, 운영진의 내부 판단, 특정 후보의 수상 가능성은 증명하지 않는다.

## 2. 당시 로컬 준비 상태

### 방법과 관찰

- 명령: `./harness.sh status --json`
- 관찰 시각: 2026-08-02 14:13 KST
- state: `DISCOVERY`
- overlay: `PIVOT_REQUIRED`
- gate: `G0 Knowledge passed`, `G1 Candidate pending`
- blocker: `candidate_set`
- product, product contract, candidate evaluation, approvals, receipts: 없음

### 의미와 현재성 경계

이 결과는 외부 아이디어 probe를 시작할 당시 후보가 정해지지 않았다는 로컬 증거다. 이후 구현·배포 상태를 나타내지 않으며, 현재 실행 상태는 [환경 런북](../hackathon-environment-codex-runbook.md)을 따른다.

## 3. QuickNode x402 RPC offer

### 방법

- 요청: 인증 없는 `POST https://x402.quicknode.com/solana-mainnet`
- JSON-RPC method: `getHealth`
- 관찰 시각: 2026-08-02 14:13:52 KST
- 서명·결제·상태 변경: 없음

### 관찰 결과

- 응답은 `HTTP 402`였다.
- protocol metadata는 `x402Version: 2`였다.
- resource description은 QuickNode RPC access에 대한 결제 요구였다.
- accepted network에는 Solana Devnet과 Solana Mainnet 옵션이 포함됐다.
- 응답은 settlement 뒤 후속 요청에 사용할 QuickNode session token을 발급하는 흐름을 설명했다.

HTTP 402 challenge가 결제 조건을 전달하고, 결제 검증·정산 뒤 보호된 resource를 반환하는 구조는 Solana의 x402 설명과 방향이 일치한다. [Solana x402 개요](https://solana.com/x402/what-is-x402)

### 증거 경계

이 probe는 외부 endpoint가 machine-readable payment requirement를 반환했다는 사실만 증명한다. 프로젝트는 settle하지 않았으므로 Solana signature, facilitator receipt, session token, paid RPC response, 무료 RPC 대비 효용은 미검증이다. 더 구체적인 Devnet method probe는 [QuickNode x402 탐색 기록](quicknode-x402-probe.md)에 분리돼 있다.

## 4. pay.sh BigQuery gateway

### 방법

- 요청: 인증 없는 `POST https://bigquery.google.gateway-402.com/bigquery/v2/projects/solana-mainnet/queries`
- body의 query: `SELECT 1`
- 관찰 시각: 2026-08-02 14:14:33 KST
- 서명·결제·상태 변경: 없음

### 관찰 결과

- 응답은 `HTTP 402`, body는 `payment_required`였다.
- payment scheme으로 `mpp/charge`와 `x402/exact`가 표시됐다.
- 가격 metadata는 요청당 USD 0.001이었다.
- payment requirement는 Solana Mainnet asset을 제시했다.

### 증거 경계와 결정

현재 증거는 gateway가 payment challenge를 제공했다는 데 한정된다. Mainnet asset 요구 때문에 결제하지 않았고 BigQuery 결과도 받지 않았다. 따라서 target Solana query의 실행 가능성, 결과 품질, 사용자 가치 또는 가격 대비 효용은 주장하지 않는다.

## 5. pay.sh Document AI gateway의 부정 증거

### 방법

다음 두 개의 인증 없는 POST를 실행했다.

1. `.../v1/projects/demo/locations/us/processors/demo:process`에 `{}` 전달
2. catalog 예시 경로 `.../v1/projects/solana-mainnet/locations/solana-mainnet/processors/solana-mainnet:process`에 게시된 예시 body 전달

관찰 시각은 2026-08-02 14:14 KST이며, 서명·결제·resource unlock은 없었다.

### 관찰 결과

두 요청 모두 다음 응답을 반환했다.

```text
HTTP 500
{"error":"challenge_generation_failed"}
```

### 해석과 결정

pay.sh catalog에 Document AI 항목이 존재한다는 사실과 usable payment challenge가 생성된다는 주장은 다르다. 직접 probe가 challenge 생성 전에 실패했으므로 이 endpoint를 구현 가능한 결제 대상으로 간주하지 않는다. 실패가 일시적이거나 요청 계약 문제일 가능성은 남아 있으므로 `Invoice Line Rescue`는 폐기 대신 보류한다. 재검토하려면 공식 request contract 확인, 같은 read-only probe의 402 응답, Devnet 또는 sandbox 결제 옵션을 먼저 확보해야 한다.

## 6. HITL 설계에 반영한 실행 원칙

관찰을 제품 요구로 옮길 때 다음과 같이 구분한다.

1. 사람은 결제 목적, 총한도, 참여자별 상한, 허용 SKU를 사전에 승인한다.
2. agent는 승인된 mandate 안에서 후보 선택과 분담안을 만들 수 있다.
3. deterministic policy가 금액 합계, 참여자별 상한, 대상 resource를 다시 검증한다.
4. mandate 밖 요청, 불확실한 외부 challenge, Mainnet·실자산 경로는 자동 실행하지 않고 사람에게 돌려보낸다.
5. 실제 Devnet transaction 실행은 별도 HITL 승인을 받은 뒤 signature와 finalized receipt를 남긴다.

이는 탐색 증거에서 도출한 제품 설계안이며, 그 자체로 사용자 검증이나 심사 통과를 증명하지 않는다. 사용자 HITL 검증과 정상·거부 경로 데모가 후속 증거로 필요하다.

## 참고한 1차·공식 자료

- [해커톤 공개 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)
- [Stanford d.school Design Thinking Bootleg](https://dschool.stanford.edu/tools/design-thinking-bootleg)
- [Stanford d.school Method Cards](https://dschool.stanford.edu/s/METHODCARDS-v3-slim.pdf)
- [AP2 specification](https://ap2-protocol.org/ap2/specification/)
- [AP2 flows](https://ap2-protocol.org/ap2/flows/)
- [NIST human–AI interaction](https://airc.nist.gov/airmf-resources/airmf/appendices/app-c-ai-risk-management-and-human-ai-interaction/)
- [Solana x402](https://solana.com/x402/what-is-x402)
- [pay.sh BigQuery catalog](https://pay.sh/services/solana-foundation/google/bigquery)
- [pay.sh Document AI catalog](https://pay.sh/services/solana-foundation/google/documentai)
- [Google Document AI processor list](https://docs.cloud.google.com/document-ai/docs/processors-list)
