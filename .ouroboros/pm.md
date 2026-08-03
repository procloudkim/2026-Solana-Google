# Just-Enough RPC Rescue

## Product Requirements Document v0

- 제품 부제: Duplicate Payout Guard
- 문서 상태: **구현 계약 후보**
- 증거 상태: **Share with caveats — 제품 수요와 live paid fulfillment 미검증**
- 대상 행사: 2026 Google Cloud × Solana AI Agentic Hackathon
- 제출 마감: 2026-08-03 23:59 KST
- 최종 갱신: 2026-08-02 KST

**읽는 순서:** 심사·제품 의사결정의 핵심은 §1–5와 §14–17이다. §6–13은 핵심 결정을 구현 가능한 상태·API·보안 계약으로 내린 **implementation appendix**다.

제출용 decision surface: [`research/decision-report/rpc-rescue-core-prd.md`](../research/decision-report/rpc-rescue-core-prd.md)

## 1. Executive decision

**이미 제출한 Solana payout의 상태를 확인하지 못해 새 transaction을 만들려는 1인 운영자를 위해, Agent가 허용된 무료 RPC를 먼저 사용하고 필요할 때만 QuickNode RPC 한 건을 자율 구매하여, target-job fixture에 중복 지급 방지 결정을 제공한다.** 사용자 outcome은 **같은 payout을 두 번 만들지 않는 것**이다. bounded mandate와 one-field activation은 이 outcome을 안전하게 만드는 메커니즘이며 별도 제품이 아니다.

완전한 권한 안에서는 사람을 부르지 않고, 아직 실행 권한이 없는 draft에서 max spend 하나만 빠졌을 때만 정확히 한 번 묻는다.

이 제품은 범용 RPC router, 장애 예측기, 승인 middleware가 아니다. paid RPC 결과가 target job fixture를 **RETRY_BLOCKED_STATUS_UNKNOWN → FINALIZED_DO_NOT_RETRY**로 바꾸고, 같은 fixture의 transaction builder가 새 transaction 생성을 거부하는 한 장면만 증명한다. production payout system 전체를 차단한다고 주장하지 않는다.

### 제품을 잠그는 범위

| 축 | MVP 계약 |
|---|---|
| 사용자 | 상시 premium RPC 구독이 없는 1–3인 Solana 팀의 on-call 개발자 |
| incident | 이미 제출한 payout의 confirmation을 deadline 전에 확인하지 못함 |
| target job | 새 payout transaction을 만들기 전에 기존 transaction이 finalized인지 확인 |
| RPC method | getSignatureStatuses 한 개 |
| resource network | Solana Devnet |
| endpoint | free primary 1개, free alternative 1개, QuickNode x402 paid 1개 |
| payment model | pay-per-request 명시 |
| payment network | Solana Devnet USDC |
| human interruption | 정상 0회, max_spend 미정 draft에서만 1회 |
| payment | decision당 최대 1건 |
| 완료 | 정책 판정 + 결제 정산 + 유효 RPC 결과 + target job 상태 변경 + 연결된 trace |

## 2. Why: 사용자 문제

### Primary user hypothesis

무료·공용 RPC를 사용하면서 간헐적인 payout 또는 refund workflow를 운영하는 1인 Solana 개발자다. 상시 premium subscription보다 사고 순간의 한 번짜리 구매가 자연스러운 규모이며, 장애 중 provider·가격·결제창을 직접 처리할 여유는 없다.

이미 premium HA와 API key failover를 운영하는 팀, 초고빈도 RPC 사용자, Mainnet production treasury는 MVP 사용자가 아니다.

### Hypothetical incident JTBD

아래 문장은 아직 실제 인터뷰에서 나온 인용이 아니라 desk-empathy로 합성한 검증 대상이다. §15의 incident record를 통과하기 전에는 `validated JTBD`라고 부르지 않는다.

> 기존 payout transaction의 상태가 보이지 않고 blockhash 만료 후 새 transaction을 만들지 결정해야 할 때, 허용된 무료 경로 또는 최소 유료 RPC로 상태를 확인해 같은 수취인에게 다시 지급하지 않도록 하되, 이미 정한 예산과 provider 범위 안의 정상 선택마다 나를 깨우지 말라.

Solana 공식 retry 가이드는 기존 blockhash가 아직 유효할 때 새로 서명하면 두 transaction이 모두 수락될 수 있다고 경고한다. 이 제품은 payout을 자동 재실행하지 않고, 그 전에 status를 확보하여 **새 transaction 생성 금지** 여부만 결정한다. [Solana Retrying Transactions](https://solana.com/developers/guides/advanced/retry)

### POV와 HMW

가설 POV:

> 장애 중인 소규모 Solana 운영자는 transaction 상태를 빠르게 확보하면서도 지출 경계를 유지해야 한다. 그의 진짜 선택은 “자동화할까?”가 아니라 “사람을 방해하지 않으면서 어디까지 위임할까?”다.

HMW:

- Agent가 결제 승인을 반복해서 묻지 않고 아직 없는 권한 하나만 물을 수 있을까?
- 무료 결과가 충분하면 no-buy를 성공 장면으로 만들 수 있을까?
- paid result가 실제 retry/stop 결정을 바꾼 경우에만 결제를 정당화할 수 있을까?
- target payout signature와 RPC 구매 payment signature를 혼동 없이 감사할 수 있을까?

### Extreme users

- **Delegate-hesitant operator:** seller, network, amount, expiry를 직접 통제하려 한다.
- **Unavailable operator:** 잠들어 있거나 이동 중이라 정상 경로의 승인창에 답할 수 없다.
- **Free-first operator:** 무료 결과가 충분하면 더 빠른 paid provider에도 돈을 쓰지 않는다.

## 3. 사실, 직접 관측, 가설

| 종류 | 현재 근거 | 제품에 미치는 영향 |
|---|---|---|
| 확인된 사실 | QuickNode는 x402 pay-per-request를 문서화하며 요청당 $0.001, 요청당 한 번의 on-chain settlement, Solana Devnet USDC 결제를 안내한다. 제품 상태는 alpha다. | paymentModel을 반드시 pay-per-request로 고정하고 production SLA를 주장하지 않는다. |
| 확인된 사실 | QuickNode SDK의 기본값은 credit-drawdown이며 pay-per-request는 명시 옵션이다. | 기본 설정을 사용하면 데모의 한 요청·한 tx 인과관계가 깨질 수 있다. |
| 확인된 사실 | QuickNode는 월 1,000,000 API credit의 shared free tier를 문서화한다. | live non-zero tx가 생기지 않으면 해커톤 결제 증거 gate는 실패다. |
| 확인된 사실 | getSignatureStatuses는 signature 배열과 searchTransactionHistory를 받아 context와 status value를 반환한다. | method와 validator를 고정할 수 있다. |
| 확인된 사실 | x402 v2의 핵심 흐름은 402 PAYMENT-REQUIRED → PAYMENT-SIGNATURE 재요청 → settlement → 200 resource + PAYMENT-RESPONSE다. | session을 성공조건으로 가정하지 않는다. |
| 확인된 사실 | Payment Identifier는 optional extension이다. | provider가 실제 광고하지 않으면 response loss 후 자동 재결제를 금지한다. |
| 직접 관측 | 2026-08-02 QuickNode solana-devnet의 getSignatureStatuses 요청이 HTTP 402를 반환했다. 서명·결제는 하지 않았다. | 정확한 endpoint와 method가 challenge까지 도달한다. |
| 로컬 사실 | 현재 src/protocols/payment.py는 non-executing contract이며 wallet, HTTP, signing, settlement를 수행하지 않는다. | 기존 테스트 통과를 live integration 증거로 사용하지 않는다. |
| 사용자 가설 | 대상 사용자가 실제 incident를 겪고 bounded delegation을 원한다. | 실제 last-incident 인터뷰 전까지 미검증이다. |
| 기술 가설 | QuickNode challenge가 non-zero Devnet payment와 유효 status response로 닫힌다. | 가장 먼저 반증해야 할 load-bearing assumption이다. |

공식 근거: [QuickNode x402 Solana Guide](https://www.quicknode.com/guides/solana-development/ai-agents/how-to-access-solana-rpc-with-x402-solana), [QuickNode Agentic Payments](https://www.quicknode.com/docs/build-with-ai/agentic-payments), [QuickNode x402 Payments](https://www.quicknode.com/docs/build-with-ai/x402-payments), [Solana getSignatureStatuses](https://solana.com/docs/rpc/http/getsignaturestatuses), [x402 flow](https://docs.cdp.coinbase.com/x402/core-concepts/how-it-works), [x402 FAQ](https://docs.cdp.coinbase.com/x402/support/faq), [로컬 probe](../research/decision-report/evidence/quicknode-x402-probe.md)

## 4. Product outcomes

| outcome | 의미 | human prompt | payment tx | target job transition |
|---|---|---:|---:|---|
| FREE_FINALIZED | free endpoint가 finalized status를 반환 | 0 | 0 | FINALIZED_DO_NOT_RETRY |
| FREE_RESOLVED_FAILED | free endpoint가 on-chain failure를 확정 | 0 | 0 | FAILED_REVIEW_REQUIRED |
| PAID_FINALIZED | paid endpoint가 finalized status를 반환 | 0 | 1 | FINALIZED_DO_NOT_RETRY |
| PAID_RESOLVED_FAILED | paid endpoint가 on-chain failure를 확정 | 0 | 1 | FAILED_REVIEW_REQUIRED |
| NO_BUY | paid가 금지·불필요·cap 초과·기한 초과 | 0 | 0 | STATUS_UNRESOLVED_STOPPED |
| PREAUTH_REQUIRED | mandate와 human-confirmed draft가 모두 없음 | 0 | 0 | SETUP_REQUIRED |
| PATCH_REQUIRED | paid가 필요하고 human-confirmed draft에는 cap 하나만 없음 | 정확히 1 | 0 before activation | WAITING_FOR_AUTHORITY |
| DENIED | integrity, replay, expiry, binding 실패 | 0 | 0 | SECURITY_BLOCKED |
| NO_GO | 두 개 이상 권한 공백 또는 MVP 외부 판단 필요 | 0 | 0 | OUT_OF_SCOPE |
| FAILED_UNPAID | challenge, balance, signer preflight가 payment 전 실패 | 0 | 0 | STATUS_UNRESOLVED_STOPPED |
| PAYMENT_UNKNOWN | payment payload 전송 후 결과가 불명확 | 0 | 최대 1 | AUTOMATION_FROZEN |
| PAID_INCONCLUSIVE | 유효 RPC response지만 status value가 null 또는 confirmation 미달 | 0 | 1 | STATUS_UNRESOLVED_STOPPED |
| PAID_INVALID_RESPONSE | HTTP/RPC body 또는 settlement evidence가 무효 | 0 | 1 | EVIDENCE_FAILURE |

PAID_INCONCLUSIVE는 seller가 반드시 잘못했다는 뜻이 아니다. 정확한 null 응답일 수 있다. 그러나 target job을 닫지 못했으므로 제품 성공으로 표시하지 않는다.

### 사용자에게 보이는 예외 계약

내부 상태명만 노출하지 않는다. 네 핵심 예외는 다음 정보와 행동을 고정한다.

| outcome | 반드시 보여줄 정보 | 허용 행동 | 금지 행동 |
|---|---|---|---|
| PATCH_REQUIRED | “결제 권한 없음”, 추가할 cap, seller, asset/network, expiry, 기존 draft hash | 전체 effective mandate 확인 후 **cap 1개 추가 서명** 또는 취소 | 다른 scope 동시 변경, 일반 `Approve` 문구, 두 번째 질문 |
| PAYMENT_UNKNOWN | “결제가 됐을 수 있어 자동화를 멈춤”, stable decision ID, payment/Explorer evidence의 유무 | evidence 보기, 운영자 reconciliation으로 보내기 | 재시도·새 request 생성·`다시 결제` 버튼 |
| NO_BUY | 결제하지 않은 이유, offer와 cap 또는 deadline, payment tx 0건 | trace 보기, 현재 incident 종료 | active mandate의 cap 증액 upsell |
| PREAUTH_REQUIRED | “사전에 위임된 결제 권한 없음”, payment tx 0건 | incident 밖 setup에서 새 immutable draft 만들기 | runtime 결제 승인으로 우회 |

모든 문구의 첫 줄은 내부 enum이 아니라 payout outcome을 말한다. 예: `기존 지급 상태를 확인하지 못해 새 지급 생성을 멈췄습니다.`

## 5. Experience and HITL contract

### 원칙

1. 경계를 승인하고 거래마다 승인하지 않는다.
2. 충분한 무료 결과가 있으면 돈을 쓰지 않는다.
3. 이미 거절된 권한을 다시 협상하지 않는다.
4. LLM은 언어를 구조화하고 deterministic code가 돈을 통제한다.
5. 보안 위반은 승인창이 아니라 hard deny로 끝난다.
6. payment success가 아니라 target job recovery가 완료다.
7. 정상 경로는 조용하고 예외 경로만 설명 가능해야 한다.
8. target payout tx와 RPC payment tx를 항상 다른 이름·색·network label로 표시한다.

### HITL taxonomy

| mode | 정확한 동작 |
|---|---|
| H-PRE | mandate/draft가 전혀 없으면 실행을 멈추고 setup으로 보낸다. runtime 질문으로 세지 않으며 tx는 0건이다. |
| A-NORMAL | active mandate 안의 free/no-buy/paid 선택은 prompt 0회다. |
| H-EXC | paid path가 실제로 필요하고 human-confirmed immutable draft에서 max_spend만 null일 때 한 번 질문한다. |
| H-POST | PAYMENT_UNKNOWN, audit, revocation을 사후 검토한다. 동기 approve 버튼이 아니다. |
| D-DENY | signature/hash, replay, expiry, payee/network/asset/request binding 실패는 override 없이 차단한다. |
| X-NOGO | 두 개 이상 authority field가 없거나 외부 진실이 필요하면 일반 사용자의 클릭으로 해결하지 않는다. |

### One-field activation의 안전 의미

PATCH_REQUIRED는 active mandate의 cap 증액이 아니다.

- base는 execution_authorized=false인 human-confirmed immutable draft다.
- draft의 max_spend_atomic만 null이어야 한다.
- 사람은 cap을 추가한 **전체 effective mandate hash**에 서명한다.
- 이미 active mandate에 cap이 있고 offer가 더 비싸면 NO_BUY다.
- “cap을 높일까요?”라는 반복 upsell prompt는 금지한다.

## 6. Functional requirements

### FR-1 Typed incident intent

Gemini는 자연어 incident를 아래 typed intent 후보로 변환한다. Gemini output 자체에는 실행 권한이 없다.

데모 입력은 정적 form을 읽는 문장이 아니라 부정·조건·deadline이 섞인 실제형 문장으로 고정한다.

> `sig <…> 지급 건이 finalized인지 안 보이면 새 지급은 만들지 마. 무료 RPC 두 곳이 1.5초 안에 확정하지 못하면 QuickNode 한 번은 써도 되지만, 결제 한도는 아직 정하지 않았어. 오늘 16:00 전에 확인해.`

Gemini는 `incident_intent`와 `unresolved_authority_fields: ["max_spend_atomic"]`를 나란히 제안한다. 후자는 질문 후보일 뿐이며 signed draft가 정말 cap-null인지 deterministic verifier가 확인하기 전에는 PATCH_REQUIRED도, signer 권한도 만들지 못한다.

~~~json
{
  "schema": "com.klab.rpc-rescue.intent.v1",
  "request_id": "req-uuid",
  "operator_pubkey": "<human-control-wallet>",
  "incident_id": "inc-uuid",
  "target_job_id": "payout-row-4837",
  "target_tx_signature": "<base58 Solana signature>",
  "rpc": {
    "resource_network": "solana-devnet",
    "method": "getSignatureStatuses",
    "params": [
      ["<same target_tx_signature>"],
      {"searchTransactionHistory": true}
    ],
    "required_confirmation": "finalized",
    "max_latency_ms": 1500,
    "deadline_at": "2026-08-02T07:00:00Z"
  },
  "completion_policy": "must_resolve",
  "paid_fallback_allowed": true
}
~~~

request_id와 operator_pubkey는 인증된 application context가 주입하며 Gemini가 생성하지 않는다. target signature, deadline, paid policy는 사용자 입력에서 추출하되 schema와 signature binding으로 다시 검증한다.

MVP의 required_confirmation은 finalized로 고정한다. processed와 confirmed는 duplicate payout guard의 성공으로 인정하지 않는다. max latency와 deadline은 signed input 또는 사전 등록 fixture에서 오며 Gemini가 만들지 않는다.

MVP input bounds는 code constant로 고정한다.

- HTTP request body ≤ 16 KiB, natural-language incident ≤ 2,048 UTF-8 bytes
- 모든 opaque ID는 1–128자의 allowlisted ASCII, target signature는 base58 decode 결과 64 bytes
- params는 target signature 정확히 1개와 `searchTransactionHistory: true`만 허용
- max_latency_ms는 100–5,000, deadline은 수신 시각보다 5초 이후·1시간 이내
- max_spend_atomic은 1–10,000 Devnet USDC atomic units, max_payments는 1
- resource URL, origin, path, method는 registry의 exact value만 허용하고 redirect·추가 JSON field는 거부

### FR-2 Free endpoint eligibility

같은 canonical JSON-RPC body를 두 free endpoint에 병렬 전송한다.

통과 조건:

- HTTP 200
- matching JSON-RPC id
- error 필드 없음
- result.context.slot은 integer
- result.value 길이 1
- value[0]가 non-null
- confirmationStatus가 finalized
- elapsed_ms가 max_latency_ms 이하

value[0].err가 null이면 finalized success이고, non-null이면 finalized failure다. 두 endpoint가 모두 통과하면 latency, stable endpoint_id 사전순으로 고른다. free가 통과하면 402를 요청하지 않는다.

### FR-3 Deterministic economic decision

첫 실패가 최종 판단이며 이후 단계가 이전 deny를 완화하지 않는다.

| 순서 | 검사 | 결과 |
|---:|---|---|
| 1 | strict schema, duplicate key, type, URL, decimal amount | 무효면 DENIED |
| 2 | operator_pubkey + request_id idempotency lookup | 기존 decision 반환 또는 conflict deny |
| 3 | active mandate 또는 human-confirmed draft의 hash, signer, delegate, expiry, revocation; `authenticated_operator_pubkey == intent.operator_pubkey == authority_signer_pubkey` | 하나라도 불일치하면 D1 DENIED; authority가 모두 없으면 PREAUTH_REQUIRED |
| 4 | incident, target signature params hash, method, resource network binding | mismatch면 DENIED |
| 5 | free endpoint 두 개 probe | resolved 결과면 FREE_* |
| 6 | incident deadline 재확인 | 지났으면 NO_BUY |
| 7 | unsigned QuickNode request로 fresh 402 획득 | challenge가 없거나 무효면 FAILED_UNPAID |
| 8 | version, scheme, origin/path, payee, payment network, asset, amount, request binding | mismatch면 DENIED |
| 9 | draft cap만 null | PATCH_REQUIRED |
| 10 | active cap, remaining budget, wallet balance, allow_paid, max_payments | cap·policy 불충족이면 NO_BUY |
| 11 | atomic payment reservation과 signer authorization | 한 worker만 통과 |
| 12 | PAYMENT-SIGNATURE로 같은 요청 재전송 | sign_count 최대 1 |
| 13 | PAYMENT-RESPONSE, settlement tx, RPC response 검증 | PAID_* 또는 PAYMENT_UNKNOWN/INVALID |
| 14 | status를 target job fixture state로 변환 | finalized면 DO_NOT_RETRY; fixture transaction builder의 새 tx 생성 거부 |

### FR-4 Mandate

금액은 JavaScript overflow와 단위 혼동을 피하도록 atomic decimal string으로 저장한다. 추가 필드는 거부한다.

~~~json
{
  "schema": "com.klab.rpc-rescue.mandate.v1",
  "mandate_id": "mandate-uuid",
  "version": 1,
  "authority_signer_pubkey": "<human-control-wallet>",
  "delegate_agent_pubkey": "<dedicated-low-balance-agent-wallet>",
  "intent_binding": {
    "incident_id": "inc-uuid",
    "target_job_id": "payout-row-4837",
    "resource_network": "solana-devnet",
    "rpc_method": "getSignatureStatuses",
    "params_hash": "<sha256 of canonical params>",
    "required_confirmation": "finalized",
    "max_latency_ms": 1500,
    "deadline_at": "2026-08-02T07:00:00Z",
    "completion_policy": "must_resolve"
  },
  "authority": {
    "allow_paid": true,
    "allowed_free_provider_ids": ["free-primary", "free-alt"],
    "paid_provider_id": "quicknode-x402",
    "paid_origin": "https://x402.quicknode.com",
    "paid_resource_path": "/solana-devnet",
    "allowed_payees": ["<fresh preflight registry value>"],
    "payment_network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "asset_mint": "<fresh challenge + pinned registry match>",
    "max_spend_atomic": "1000",
    "max_payments": 1
  },
  "recovery": {
    "allow_new_payment_after_unknown": false
  },
  "validity": {
    "issued_at": "<RFC3339>",
    "expires_at": "<RFC3339>"
  },
  "nonce": "<128-bit random>",
  "signature": {
    "algorithm": "ed25519",
    "signed_hash": "<domain-separated hash of RFC 8785 JCS body>",
    "value": "<base58 signature>"
  }
}
~~~

Human-confirmed draft는 위 객체와 같은 필드를 사용하되 다음 차이만 허용한다.

- schema는 com.klab.rpc-rescue.mandate-draft.v1
- execution_authorized는 false
- authority.max_spend_atomic은 null
- draft_confirmation은 authority signer가 JUST_ENOUGH_RPC_RESCUE_DRAFT_V1 domain으로 전체 draft hash에 서명한 값

Draft confirmation은 non-monetary scope를 고정하지만 payment authority를 만들지 않는다. 어떤 code path도 draft hash만으로 signer를 호출할 수 없다. cap activation은 base_draft_hash를 대조하고 완전한 effective mandate 전체를 JUST_ENOUGH_RPC_RESCUE_ACTIVATE_V1 domain으로 다시 서명한다.

Human authority key와 Agent payment key는 분리한다. 같은 key를 사용하면 Agent가 자신의 권한을 만들어내므로 acceptance 실패다.

### FR-5 One-field activation

~~~json
{
  "schema": "com.klab.rpc-rescue.cap-activation.v1",
  "patch_id": "patch-uuid",
  "decision_id": "dec-uuid",
  "request_id": "req-uuid",
  "prompt_id": "prompt-uuid",
  "operator_pubkey": "<authenticated-human-control-wallet>",
  "base_draft_hash": "<immutable non-executable draft hash>",
  "operation": {
    "op": "add",
    "path": "/authority/max_spend_atomic",
    "value": "1000"
  },
  "effective_mandate_hash": "<complete mandate hash>",
  "issued_at": "<RFC3339>",
  "expires_at": "<RFC3339>",
  "signer_pubkey": "<human-control-wallet>",
  "signature": "<base58 signature>"
}
~~~

Verifier requirements:

- operation은 정확히 하나
- op는 add
- path는 /authority/max_spend_atomic
- base draft 값은 null
- value는 positive bounded atomic decimal string
- effective hash 재계산 일치
- origin, path, payee, payment network, asset, method, target signature, deadline, delegate key는 불변
- signed body의 decision_id는 API path와, request_id·prompt_id는 현재 WAITING_FOR_AUTHORITY decision과, operator_pubkey는 인증된 session 및 signer_pubkey와 각각 일치
- base_draft_hash당 activation은 전역 1회다. Firestore 한 transaction에서 draft consumption record 생성과 WAITING_FOR_AUTHORITY → EVALUATING 전이를 함께 CAS하며, 다른 decision에서 재사용할 수 없다.
- activation 뒤 fresh 402를 다시 받아 price와 expiry 재검증

### FR-6 Idempotency

요청 중복과 payment 중복을 다른 key로 잠근다.

~~~text
request_key = sha256(operator_pubkey || request_id)
economic_request_hash = sha256(JCS(target_job_id, target_tx_signature, resource_network, method, semantic_params, required_confirmation, paid_provider_id))
payment_decision_key = sha256(effective_mandate_hash || economic_request_hash || paid_provider_id)
~~~

`economic_request_hash`는 JSON-RPC transport `id`, HTTP header, serialization, request_id를 포함하지 않는다. 같은 target payout과 같은 경제적 RPC 의도를 표현만 바꾸거나 새 request_id로 제출해도 같은 key가 된다.

동작 계약:

- 같은 request_key·same intent가 EVALUATING/PROBING/PAYING이면 HTTP 202와 기존 decision을 반환하고 새 worker를 만들지 않는다.
- terminal replay는 저장된 immutable response를 반환한다.
- WAITING_FOR_AUTHORITY replay는 같은 prompt_id를 반환하며 prompt_count는 1로 유지한다.
- 같은 request_key·different intent bytes는 HTTP 409 D2_IDEMPOTENCY_KEY_CONFLICT다.
- cap activation은 global base_draft_hash consumption과 WAITING_FOR_AUTHORITY → EVALUATING compare-and-set을 같은 transaction에서 한 번만 통과한다.
- 하나의 payment_decision_key에는 PAYMENT_SIGNED event가 최대 한 개다.
- reservation transaction은 decision state와 mandate_hash별 `payments_used`, `spent_reserved_atomic`, `spent_settled_atomic`을 함께 CAS한다. `payments_used <= max_payments`와 `spent_reserved_atomic + spent_settled_atomic <= max_spend_atomic`은 request_id가 아니라 이 mandate ledger에서 집행한다.
- `RESERVED_UNSIGNED`에서는 signer가 호출되지 않았다는 증거가 있을 때만 reservation을 해제할 수 있다. worker lease takeover도 이 상태까지만 허용한다.
- signer 호출 직전에 `SIGN_ATTEMPT_STARTED`와 single-use capability consumption을 원자 기록한다. 이 시점 이후 응답이 불명확하면 counter·budget을 되돌리거나 sign을 반복하지 않고 PAYMENT_UNKNOWN으로 동결한다.
- signer가 signature를 반환하면 PAYMENT_SIGNED로 전이한다. settlement가 확인되면 reserved amount를 spent amount로 확정한다.
- Payment Identifier extension이나 재사용 가능한 entitlement가 실제 응답에서 검증되지 않으면 resource-only retry도 가정하지 않는다.

x402의 Payment Identifier는 optional이므로 response loss 후 새 challenge 또는 새 payment payload를 자동 생성하지 않는다. [x402 FAQ](https://docs.cdp.coinbase.com/x402/support/faq)

## 7. State machine

~~~mermaid
stateDiagram-v2
    [*] --> REQUEST_RECEIVED
    REQUEST_RECEIVED --> INTENT_TYPED
    INTENT_TYPED --> AUTHORITY_PREFLIGHT

    AUTHORITY_PREFLIGHT --> PREAUTH_REQUIRED: no mandate or draft
    AUTHORITY_PREFLIGHT --> DENIED: integrity or binding failure
    AUTHORITY_PREFLIGHT --> FREE_PROBING: active mandate or human-confirmed draft

    FREE_PROBING --> FREE_FINALIZED: finalized success
    FREE_PROBING --> FREE_RESOLVED_FAILED: definitive onchain error
    FREE_PROBING --> PAID_CHALLENGE_PENDING: all free results ineligible

    PAID_CHALLENGE_PENDING --> NO_BUY: deadline or paid disabled
    PAID_CHALLENGE_PENDING --> FAILED_UNPAID: endpoint or challenge failure
    PAID_CHALLENGE_PENDING --> OFFER_RECEIVED: HTTP 402
    OFFER_RECEIVED --> DENIED: offer binding mismatch
    OFFER_RECEIVED --> PATCH_REQUIRED: only draft cap is null
    OFFER_RECEIVED --> NO_BUY: explicit cap or budget insufficient
    OFFER_RECEIVED --> PAYMENT_PREFLIGHT: active authority passes

    PATCH_REQUIRED --> ACTIVATION_VALIDATING: signed one-field activation
    ACTIVATION_VALIDATING --> DENIED: scope or signature failure
    ACTIVATION_VALIDATING --> PAID_CHALLENGE_PENDING: effective mandate active

    PAYMENT_PREFLIGHT --> FAILED_UNPAID: balance, capability or signer preflight failure
    PAYMENT_PREFLIGHT --> RESERVED_UNSIGNED: preflight passes and budget CAS wins
    RESERVED_UNSIGNED --> SIGN_ATTEMPT_STARTED: signer capability consumed
    SIGN_ATTEMPT_STARTED --> PAYMENT_UNKNOWN: signer result uncertain
    SIGN_ATTEMPT_STARTED --> PAYMENT_SIGNED: signature returned
    PAYMENT_SIGNED --> PAID_REQUEST_IN_FLIGHT
    PAID_REQUEST_IN_FLIGHT --> PAYMENT_UNKNOWN: response lost
    PAID_REQUEST_IN_FLIGHT --> SETTLEMENT_VERIFYING: response received
    SETTLEMENT_VERIFYING --> PAYMENT_UNKNOWN: settlement uncertain
    SETTLEMENT_VERIFYING --> FULFILLMENT_VERIFYING: settlement confirmed
    FULFILLMENT_VERIFYING --> PAID_FINALIZED: finalized
    FULFILLMENT_VERIFYING --> PAID_RESOLVED_FAILED: onchain err resolved
    FULFILLMENT_VERIFYING --> PAID_INCONCLUSIVE: null or below commitment
    FULFILLMENT_VERIFYING --> PAID_INVALID_RESPONSE: malformed or wrong id
~~~

## 8. API contract

### Endpoints

- POST /v1/recoveries — intent와 active mandate 또는 draft 제출
- GET /v1/recoveries/{decision_id} — 현재 또는 terminal decision
- POST /v1/recoveries/{decision_id}/cap-activation — signed one-field activation

MVP는 위 세 endpoint만 공개한다. redacted evidence는 GET recovery envelope의 evidence_refs로 조회하며 별도 범용 recovery API를 만들지 않는다.

### Common response envelope

~~~json
{
  "schema_version": "1.0",
  "decision_id": "dec-uuid",
  "request_id": "req-uuid",
  "outcome": "PAID_FINALIZED",
  "human_mode": "A-NORMAL",
  "reason_code": "PAID_RPC_FINALIZED",
  "terminal_for_automation": true,
  "retryable": false,
  "payment_may_have_settled": false,
  "prompt_count": 0,
  "transaction_count": 1,
  "target_tx_signature": "<queried payout signature>",
  "payment_tx_signature": "<x402 settlement signature>",
  "mandate_hash": "<hash>",
  "policy_version": "rpc-rescue-v1",
  "target_job_state": "FINALIZED_DO_NOT_RETRY",
  "evidence_refs": ["log://...", "solana://..."],
  "next_action": null
}
~~~

### Status mapping

| HTTP | outcome |
|---:|---|
| 200 | FREE_*, PAID_*, NO_BUY, PAYMENT_UNKNOWN, PAID_INVALID_RESPONSE |
| 202 | in progress 또는 기존 in-flight decision |
| 428 | PREAUTH_REQUIRED, PATCH_REQUIRED |
| 403 | DENIED integrity/binding |
| 409 | idempotency 또는 patch conflict |
| 422 | NO_GO |
| 502 | sign 전 실패가 확정된 FAILED_UNPAID만 |

HTTP status보다 outcome과 reason_code가 제품 판정의 source of truth다. 모든 terminal response는 `retryable:false`와 stable `decision_id`를 반환한다. PAYMENT_UNKNOWN과 PAID_INVALID_RESPONSE는 `payment_may_have_settled:true`이며, 5xx·Retry-After·자동 재요청 대상이 아니다. HTTP 202만 `retryable:true`와 동일 request_id 사용 조건을 명시할 수 있다.

### Reason codes

| code | 판정 |
|---|---|
| P1_MANDATE_REQUIRED | mandate와 human-confirmed draft가 모두 없음 |
| H1_MAX_SPEND_REQUIRED | cap-null draft의 유일한 runtime 질문 |
| A1_FREE_FINALIZED | free endpoint로 finalized status 확보 |
| A2_PAID_FINALIZED | paid endpoint로 finalized status 확보 |
| A3_TRANSACTION_FAILED | finalized status의 err가 non-null |
| N1_DEADLINE_PASSED | target job deadline 경과 |
| N2_PAID_DISABLED | mandate에서 paid fallback 금지 |
| N3_OFFER_OVER_CAP | 명시 cap 또는 잔여 budget 초과 |
| N4_PAYMENT_LIMIT_EXHAUSTED | max_payments 소진 |
| D1_MANDATE_INTEGRITY | signature/hash/delegate 불일치 |
| D2_REPLAY_OR_CONFLICT | request, patch, payment 중복·충돌 |
| D3_UNKNOWN_CONSTRAINT | policy가 해석할 수 없는 field |
| D4_EXPIRED_OR_REVOKED | mandate/draft 만료·폐기 |
| D5_OFFER_BINDING | origin/path/payee/network/asset/request 불일치 |
| F0_FAILED_UNPAID | challenge, balance, signer preflight가 payment 전에 실패 |
| F1_PAYMENT_UNKNOWN | payload 전송 뒤 settlement 결과 불명확 |
| F2_PAID_INCONCLUSIVE | 유효 response지만 finalized status를 얻지 못함 |
| F3_PAID_INVALID_RESPONSE | settlement 또는 JSON-RPC evidence 무효 |
| X1_MULTIPLE_AUTHORITY_GAPS | cap 외 authority도 비어 있어 MVP 밖 |

## 9. x402 execution contract

QuickNode SDK를 사용한다면 paymentModel을 pay-per-request로 명시한다. default credit-drawdown을 허용하지 않는다.

~~~text
same unsigned getSignatureStatuses request
  → 402 + PAYMENT-REQUIRED
  → exact offer validation
  → atomic payment reservation
  → policy-gated signer signs once
  → same request + PAYMENT-SIGNATURE
  → facilitator verification and onchain settlement
  → 200 + PAYMENT-RESPONSE + JSON-RPC body
  → settlement and fulfillment validation
~~~

Timeout contract:

- free probe는 endpoint당 intent의 max_latency_ms, 병렬 phase 전체 5초 상한
- unsigned 402 challenge는 connect 2초·전체 5초 상한
- signed paid request는 전체 20초 상한. request body 전송이 시작된 뒤 timeout/connection loss는 PAYMENT_UNKNOWN이며, 0 bytes 전송이 증명된 sign 전 실패만 FAILED_UNPAID
- PAYMENT-RESPONSE 뒤 settlement evidence 확인은 20초 상한이며 미확정이면 PAYMENT_UNKNOWN
- incident deadline이 먼저 와도 sign-attempt 이후 작업을 새 payment로 재시도하지 않는다

x402 공식 흐름에서 facilitator는 signed payload를 검증하고 on-chain submission을 수행할 수 있다. 따라서 resource용 free RPC 장애와 payment broadcast가 반드시 같은 경로에 의존하는 것은 아니다. 그러나 QuickNode 실제 path가 이 폐쇄루프를 완성하는지는 아직 미검증이므로 live spike에서 증명한다. [x402 facilitator](https://docs.cdp.coinbase.com/x402/core-concepts/facilitator)

정책 검사가 끝나기 전에 SDK가 자동 sign하지 못하도록 signer 앞에 single-use policy authorization gate를 둔다. raw PAYMENT-SIGNATURE, private key, session/JWT는 로그에 남기지 않는다.

Signer는 SDK의 임의 객체가 아니라 아래 **domain-separated, policy-signed capability**만 받는다.

~~~json
{
  "schema": "com.klab.rpc-rescue.signer-capability.v1",
  "payment_decision_key": "<hash>",
  "economic_request_hash": "<hash>",
  "fresh_offer_hash": "<canonical 402 offer hash>",
  "x402_version": 2,
  "scheme": "exact",
  "network_caip2": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "asset_address": "<exact token mint/address from verified offer>",
  "pay_to": "<exact payTo from verified offer>",
  "amount": "1000",
  "resource_url": "https://x402.quicknode.com/solana-devnet",
  "http_method": "POST",
  "request_body_hash": "<sha256 of exact unsigned JSON-RPC request body>",
  "challenge_expires_at": "<RFC3339>",
  "delegate_pubkey": "<agent payment key>",
  "one_use_nonce": "<128-bit random>",
  "policy_signature": "<policy authority signature>"
}
~~~

Capability의 x402 식별자는 검증한 fresh offer에서 그대로 복사하며 `Devnet`, `USDC` 같은 alias를 허용하지 않는다. Signer는 policy signature·expiry를 독립 검증하고, 실제 signing payload와 resource request의 x402 version, scheme, CAIP-2 network, asset address, payTo, atomic amount, URL, HTTP method, request body hash가 capability와 byte-for-byte 일치하는지 확인한다. 그 뒤 one_use_nonce 소비와 `SIGN_ATTEMPT_STARTED` 전이를 같은 CAS transaction으로 확정해야만 한 번 서명한다. offer 검증 뒤 payload가 바뀌는 TOCTOU는 DENIED이며 사용자 override가 없다.

## 10. Architecture

~~~mermaid
flowchart LR
    U["Operator<br/>incident + authority"] --> CR["Cloud Run<br/>Recovery API"]
    CR --> G["Vertex AI Gemini<br/>typed intent + minimal question"]
    G --> P["Deterministic policy engine"]
    P --> F1["Free RPC primary"]
    P --> F2["Free RPC alternative"]
    P --> QN["QuickNode x402<br/>pay-per-request"]
    P <--> DS["Firestore<br/>atomic decision + sign reservation"]
    P --> SG["Policy-gated signer<br/>Secret Manager key"]
    SG --> QN
    QN --> XF["x402 facilitator"]
    XF --> SOL["Solana Devnet<br/>USDC settlement"]
    QN --> R["getSignatureStatuses result"]
    R --> J["Target job state<br/>FINALIZED_DO_NOT_RETRY"]
    J --> TB["Target job fixture<br/>new tx creation refused"]
    CR --> CL["Cloud Logging<br/>joined redacted trace"]
~~~

### 책임 경계

| component | 책임 | 금지 |
|---|---|---|
| Gemini | natural language → typed draft, unresolved field 표시, one-field 질문·diff 설명 | provider 선택, cap 판정, wallet sign |
| deterministic policy | allowlist, binding, finalized-status validation, cap, expiry, idempotency | LLM confidence를 authority로 사용 |
| Cloud Run | API와 orchestration | local-only 실행을 cloud 증거로 주장 |
| Firestore | decision CAS, sign reservation, terminal response | raw secret·payment payload 저장 |
| Secret Manager / signer | low-balance Devnet Agent key와 one-sign gate | human authority key 보관 |
| Cloud Logging | decision_id 중심 redacted trace | private key, raw payment header, token 로그 |
| QuickNode/x402 | 실제 402, settlement, paid RPC resource | challenge만 보여주고 성공 주장 |
| target job fixture | state transition 뒤 replacement transaction builder 호출을 실제 거부 | production payout integration으로 과장 |

Pub/Sub, Workflows, Eventarc, multi-region, provider marketplace는 MVP에서 제외한다. Firestore와 Secret Manager는 idempotency와 key boundary에 필요한 최소 control plane이다.

## 11. Observability

필수 로그:

- decision_id, request_id, incident_id, target_job_id
- target_tx_signature_hash와 별도 payment_tx_signature
- intent_hash, draft_hash, effective_mandate_hash, policy_version
- human_mode, reason_code, prompt_count
- endpoint_id, evidence_source=live|fixture, latency_ms
- 402 offer hash, amount, network, asset, payee hash
- payment state, settlement status, receipt hash
- RPC response hash, confirmationStatus, err-present boolean
- prior and next target_job_state

비밀·원문 PAYMENT-SIGNATURE·wallet key·JWT/session token은 0건이어야 한다.

## 12. Security and abuse cases

| 공격·실패 | 통제 |
|---|---|
| merchant/RPC text가 cap 무시를 유도 | 외부 text는 observation이며 signed mandate와 code만 signer를 호출 |
| 402가 payee, mint, network를 변경 | fresh challenge와 pinned registry exact match; mismatch hard deny |
| 가격이 관찰 후 변함 | sign 직전 fresh 402를 다시 검증 |
| 두 Cloud Run worker 경쟁 | Firestore compare-and-set; sign_count 최대 1 |
| response loss 뒤 새 결제 | PAYMENT_UNKNOWN, reservation 유지, 자동 retry 0 |
| patch가 다른 field도 변경 | fixed one-operation schema와 effective hash |
| Gemini가 “유료 금지”를 반대로 parse | human-signed effective body가 authority |
| free fault injection을 실제 장애처럼 표시 | UI와 로그에 FAULT FIXTURE 명시 |
| HTTP 200 + wrong id/error/null | finalized success로 표시하지 않음 |
| redirect/SSRF | exact HTTPS origin/path, redirect 금지 |
| amount overflow | bounded atomic decimal string |
| target tx와 payment tx 혼동 | 별도 label, network, purpose, hash field |

## 13. Acceptance tests

| ID | 입력 | 반드시 나와야 하는 결과 |
|---|---|---|
| FREE-01 | primary timeout fixture, free-alt live finalized 400ms | prompt 0, sign 0, payment tx 0, FREE_FINALIZED |
| FREE-02 | free 둘 다 finalized | latency → endpoint_id tie-break |
| PAID-01 | free 둘 fixture-ineligible, valid active cap, matching live 402 | prompt 0, sign 1, non-zero Devnet payment tx 1, valid paid status, PAID_FINALIZED |
| JOB-01 | paid status가 target payout finalized | target job이 FINALIZED_DO_NOT_RETRY로 실제 변경 |
| JOB-02 | 그 뒤 fixture에서 같은 payout의 replacement tx 생성 시도 | builder가 거부하고 new target transaction signature 0건 |
| PATCH-01 | free 둘 실패, human-confirmed draft cap만 null | prompt 정확히 1, activation operation 1개, tx는 서명 전 0 |
| PATCH-02 | activation이 payee/network/method도 변경 | tx 0, DENIED, approve-anyway 없음 |
| PATCH-03 | valid activation 뒤 fresh matching 402 | 두 번째 prompt 없이 policy 재평가·single payment·target job 전이까지 완료 |
| PATCH-04 | 같은 base_draft_hash activation을 다른 decision에서 재사용 | global consumption CAS loser, tx 0, DENIED |
| CAP-01 | active cap보다 offer가 큼 | prompt 0, sign 0, tx 0, NO_BUY |
| UNPAID-01 | challenge error 또는 Agent wallet balance 부족 | prompt 0, sign 0, tx 0, FAILED_UNPAID |
| PREAUTH-01 | mandate와 draft 모두 없음 | prompt 0, tx 0, PREAUTH_REQUIRED setup link |
| DENY-01 | invalid signature/hash, expired, revoked, binding mismatch | 각 prompt 0, tx 0 |
| LLM-01 | Gemini가 cap 초과 paid를 추천 | deterministic NO_BUY, signer call 0 |
| LLM-02 | 부정·조건·deadline·cap 미정 자연어 입력 | typed intent와 unresolved field가 보이고, signed authority 전까지 tx 0 |
| AUTH-01 | authenticated operator와 intent 또는 mandate authority signer가 다름 | D1 DENIED, prompt 0, signer call 0 |
| IDEMP-01 | 동일 decision을 worker 두 개가 실행 | reservation winner 1, sign_count 1 이하 |
| IDEMP-02 | 같은 mandate·target을 새 request_id 또는 JSON-RPC id로 재제출 | 같은 economic key와 mandate ledger, 추가 sign/payment 0 |
| BUDGET-01 | 서로 다른 target 두 개가 max_payments=1 mandate를 동시 사용 | mandate ledger CAS winner 1, loser NO_BUY |
| SIGN-01 | signer 호출 직후 worker crash | SIGN_ATTEMPT_STARTED → PAYMENT_UNKNOWN, reservation 해제·takeover·재서명 0 |
| TOCTOU-01 | offer 검증 뒤 payee/amount/request mutation | signer independent mismatch, tx 0, DENIED |
| ALIAS-01 | capability가 CAIP-2/address 대신 Devnet·USDC alias 사용 | schema reject, signer call 0 |
| REPLAY-01 | same request_key·same intent terminal replay | stored response 반환, 추가 side effect 0 |
| CONFLICT-01 | same request_key·different intent bytes | HTTP 409 D2 conflict, 원 decision 불변 |
| UNKNOWN-01 | paid payload 전송 뒤 response loss | PAYMENT_UNKNOWN, 자동 sign/payment retry 0 |
| UNKNOWN-02 | PAYMENT_UNKNOWN 또는 PAID_INVALID_RESPONSE API 반환 | HTTP 200, retryable=false, stable decision_id, payment_may_have_settled=true |
| INVALID-01 | paid HTTP 200 + wrong id/invalid JSON-RPC | PAID_INVALID_RESPONSE, success 표시 금지 |
| INCONCLUSIVE-01 | paid value null 또는 confirmation 미달 | PAID_INCONCLUSIVE, payout 자동 retry 0 |
| TRACE-01 | paid/free/patch/deny 각 한 건 | decision_id 하나로 policy, tx, result, job state 연결; secret 0 |
| TRUTH-01 | free failure는 fixture, paid query/payment는 live | 화면·로그가 source를 명시 |
| COLD-READ-01 | 90초 데모를 본 신규 관찰자 | “기존 payout 상태를 유·무료 RPC로 확인해 중복 transaction 생성을 막는 Agent”로 설명하고, 결제·HITL은 메커니즘으로 구분 |

## 14. Demo contract

### 90-second internal script

| 시간 | 장면 |
|---:|---|
| 0–12초 | 부정·조건·deadline 자연어 → Gemini typed intent, active signed boundary, blocked replacement job |
| 12–45초 | 두 free endpoint가 **FAULT FIXTURE**로 부적격 → live 402 → deterministic ALLOW → prompt 0 → non-zero Devnet payment |
| 45–65초 | PAYMENT-RESPONSE + valid status → FINALIZED_DO_NOT_RETRY → target-job fixture의 replacement builder가 새 tx 생성을 실제 거부 |
| 65–78초 | cap-null 예외 trace: deterministic diff → 질문 1회 → full mandate → 같은 decision이 추가 질문 없이 자동 완주 |
| 78–90초 | joined trace와 compact matrix: free=0 payment, cap 초과=0 payment, replay=hard deny, unknown=retry 0 |

target_tx_signature와 payment_tx_signature를 화면에서 반드시 구분한다. fault fixture는 실제 Solana 또는 provider outage라고 말하지 않는다. HERO는 control logic과 live purchase의 인과관계를 증명할 뿐 QuickNode의 우월성이나 실제 outage 복구율을 증명하지 않는다.

공개 UI는 내부 13개 outcome을 그대로 나열하지 않고 다섯 가족으로만 보여준다: **resolved without payment, resolved with payment, authority required, stopped before payment, frozen after possible payment**. reason code와 세부 상태는 evidence drawer에 둔다. `NO PAYMENT`는 UI badge이고 `NO_BUY` internal outcome과 혼용하지 않는다.

### Hackathon criteria mapping

| 공개 기준 | 런타임 증거 |
|---|---|
| 혁신·UX | paid/free 정상 경로 0회 질문, 아직 없는 cap만 1회, integrity는 override 없음 |
| Gemini/GCP AI | Gemini typed intent와 minimal question, Cloud Run 실행, joined Cloud Logging |
| Solana·protocol 완성도 | x402 pay-per-request, real Devnet USDC settlement, deterministic mandate verifier |
| live 거래·로그 | Explorer-visible payment tx와 같은 decision_id의 receipt·RPC result·job transition |

공개 가중치는 없으므로 점수로 환산하지 않는다.

## 15. User validation

상태는 **desk-empathy hypothesis**다. 기능 선호가 아니라 마지막 실제 행동을 묻는다. 제출 전 최소 모집은 최근 6개월 안에 Solana transaction workflow를 직접 운영한 3명이며, 그중 최소 2명은 status 불확실성 또는 수동 confirmation 확인을 실제로 겪어야 한다.

1. 마지막 RPC confirmation 문제의 로그, target method, deadline, 수동 workaround를 보여 달라고 한다.
2. “같은 지급을 다시 만들기 전에 무엇을 확인했습니까?”를 묻는다.
3. normal paid burst, free success, cap 초과, seller 변경, response loss를 **묻지 말고 실행 / 반드시 질문 / 무조건 차단**으로 분류하게 한다.
4. 매번 승인, unlimited wallet, one-field activation 세 저해상도 화면에서 실제 wallet을 맡길 조건을 행동으로 확인한다.
5. 자신의 incident data로 mandate draft를 직접 수정하고, paid normal path에는 개입하지 않는지 관찰한다.

후보를 살리는 행동 증거:

- 실제 최근 incident와 workaround를 제시
- method, seller, cap, expiry를 표현
- in-mandate paid path에 추가 승인을 요구하지 않음
- cap-null draft에서는 전체 checkout이 아니라 one-field activation을 선택
- free success의 no-buy를 올바른 결과로 인정

후보를 죽이는 증거:

- 실제 incident가 없고 hypothetical interest만 존재
- 기존 subscription/failover로 완전히 해결
- 소액이라도 모든 거래를 직접 승인하려 함
- one-field activation을 일반 결제 승인창과 다르게 인식하지 못함

인터뷰 전에 고정하는 판정 규칙은 **kill 우선 → continue → 그 외 revise** 순서로 단 한 번 적용한다.

- **kill/pivot:** 실제 incident가 2건 미만이거나 3명 중 2명 이상이 모든 개별 결제를 직접 승인하겠다고 한다.
- **continue:** kill이 아니고, 3명 모두 실제 workflow를 설명하며, 최소 2명이 incident artifact·log·workaround를 제시하고, 최소 2명이 exact bounded mandate 안의 normal paid path를 무질문 실행으로 분류하며, 3명 모두 PAYMENT_UNKNOWN을 재결제가 아닌 halt로 분류한다.
- **revise:** kill도 continue도 아닌 모든 결과. 제품 후보는 유지하되 실패한 interaction 또는 상태 문구를 바꾸고 재검증한다.

표본 3명은 시장 일반화가 아니라 해커톤 후보의 거짓 양성을 빠르게 제거하기 위한 gate다. 모집 실패를 긍정 증거로 대체하지 않는다.

## 16. Proof hierarchy and kill criteria

설명 자료는 아래 증거를 대체하지 못한다.

1. **Causal paid fulfillment:** 402 → non-zero Devnet settlement → PAYMENT-RESPONSE → valid getSignatureStatuses → job state change
2. **Autonomous decision:** active mandate의 paid/free/no-buy가 prompt 0회
3. **Bounded authority:** cap-null draft만 prompt 1회, integrity는 prompt 0회
4. **Idempotency:** response loss와 concurrency에서 sign/payment 추가 0건
5. **Gemini/GCP execution:** typed intent와 Cloud Run·Logging trace
6. **User evidence:** last incident와 bounded delegation 행동

다음 중 하나면 UI를 더 만들지 않고 RPC 후보를 중단하거나 Query-to-Act로 전환한다.

- live payment → settlement → valid method result가 닫히지 않음
- QuickNode shared free tier 때문에 non-zero Devnet tx를 만들지 못함
- SDK가 deterministic policy 전에 자동 sign하며 차단 hook을 제공하지 않음
- paid result가 target job 상태를 바꾸지 않음
- free success가 있는데 결제함
- response loss 또는 concurrency에서 sign_count가 1을 초과할 수 있음
- paid status가 계속 null/inconclusive
- fault fixture를 실제 장애라고 말해야만 서사가 성립
- target user가 실제 incident를 제시하지 못하거나 모든 거래 승인을 고수

## 17. Implementation order

User Gate 0A(§15)와 Technical Gate 0B를 마감 전 병렬 실행한다. 둘 다 통과하기 전에는 UI와 mandate framework를 확장하지 않는다.

### Gate 0B — live causal spike

UI보다 먼저 direct script로 다음을 닫는다.

1. Explorer에서 확인 가능한 finalized Devnet target payout signature와 target job fixture 사전 등록
2. pay-per-request 명시
3. fresh getSignatureStatuses 402
4. exact offer inspection
5. policy-gated single sign
6. non-zero Solana Devnet settlement signature
7. PAYMENT-RESPONSE
8. valid status body
9. target job의 FINALIZED_DO_NOT_RETRY 전이

하나라도 실패하면 PRD의 나머지를 구현하지 않는다.

제출 전 P0는 Gate 0, 한 decision의 one-field activation, single-sign/idempotency, target-job fixture 차단, joined trace뿐이다. §6–13의 outcome/reason code는 안전한 내부 상태를 빠뜨리지 않기 위한 계약이지 13개 화면이나 범용 recovery framework를 만들라는 뜻이 아니다. worker takeover의 일반화, multi-incident 운영 UI, 재조정 tooling은 제출 후다. MVP는 stale unsigned reservation도 자동 takeover하지 않고 운영자 검토로 보낸다.

### Gate 1 — deterministic core

- strict schemas, JCS/hash/signature verifier
- free endpoint validators와 honest fault fixtures
- decision table와 reason codes
- Firestore CAS와 single-sign reservation
- acceptance tests FREE/PATCH/CAP/DENY/IDEMP/UNKNOWN

### Gate 2 — Agent and cloud

- Gemini structured output과 unresolved field handling
- Cloud Run API
- Secret Manager backed low-balance Devnet signer
- Cloud Logging joined trace

### Gate 3 — demo and submission

- 네 장면 UI
- Explorer·receipt·RPC result evidence
- 90-second internal demo recording
- GitHub, product description, live transaction/log links

## 18. Non-goals

- Mainnet payment 또는 treasury
- payout 자체의 자동 retry·재서명
- 범용 RPC router, marketplace, auction
- multi-chain, multi-method
- subscription·credit drawdown 최적화
- Solana 전체 network outage 해결 주장
- full AP2 conformance
- refund·dispute automation
- provider reputation·ML outage prediction
- multi-tenant wallet custody와 production HA

이 설계는 **AP2-inspired signed local mandate**라고만 표현한다. AP2-compliant라고 주장하지 않는다. [AP2 Specification](https://ap2-protocol.org/ap2/specification/)

## 19. Final product contract

> 기존 payout의 finalized status를 확보해 target-job fixture가 중복 transaction 생성을 거부한다. 이를 위해 Agent는 위임 범위 안에서 RPC를 자율 구매하고, 아직 존재하지 않는 cap 하나만 한 번 묻는다. 명시적으로 거절된 권한은 협상하지 않고, 결제 결과가 불명확하면 다시 결제하지 않는다.

---

PM ID: pm_seed_interview_20260802_054020  
Interview ID: interview_20260802_054020  
Canonical artifact: .ouroboros/pm.md
