# Agentic Commerce candidate decision — source notes

- Research cutoff: 2026-08-01 16:31 KST
- Decision audience: a one-person hackathon team choosing what to build before 2026-08-03 23:59 KST
- Confidence: **Share with caveats**

## Decision question

Which of the seven surviving Agentic Commerce concepts should receive the next implementation sprint, given the official event evidence contract, the current repository state, the availability of real paid resources, and the need for a narrow, legible demo?

The seven concepts are defined in [`research/agentic-commerce-50-ideas.md`](../agentic-commerce-50-ideas.md): NeedlePass, RPC Lifeboat, Three-Way Match Pay, ClipLicense, ExpiryDeal Duel, ReproPay, and SLA Refund Collector.

## Decision rule

No numeric weighting was used because the event page does not publish criterion weights and the candidates have no comparable user, conversion, reliability, or willingness-to-pay observations. The report therefore uses hard evidence gates:

1. The Agent must choose `buy`, `no-buy`, or a transaction variable from delegated intent.
2. A deterministic policy must bound seller, spend, network, expiry, and idempotency.
3. A real localnet, testnet, or Devnet transaction must be confirmed.
4. Payment must unlock or cause a verifiable product/service result.
5. Decision, policy, transaction, receipt, and result must form one replayable trace.
6. The demo must remain understandable after unimplemented protocol names and mock claims are removed.

External dependencies are **conditionally retained**, not assumed available. A candidate is killed immediately when its time-boxed acquisition or end-to-end experiment fails. This is the report's working assumption because the user had not yet selected between categorical exclusion and conditional retention.

## Evidence ledger

| Claim | Classification | Evidence | Boundary |
|---|---|---|---|
| The event has one `Solana 기반 Agentic Commerce` track and expects Gemini/GCP AI, Solana/payment integration, and live transaction/log evidence. | Verified | [Official event site](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/); [`event-rules.md`](../official-docs-wiki/modules/event-rules.md) | The four A–D items are starting points, not separate tracks. The current page does not state an exact three-minute video limit or require Mainnet. |
| The minimum local evidence chain is decision → payment challenge → signed authorization → Solana signature → confirmation → application receipt/log. | Verified local contract | [`event-rules.md`](../official-docs-wiki/modules/event-rules.md); [`payment-rails.md`](../official-docs-wiki/modules/payment-rails.md) | A sandbox success is not Devnet proof. |
| QuickNode currently exposes a machine-readable x402 offer that accepts Solana Devnet USDC for RPC access. | Directly verified offer | [`quicknode-x402-probe.md`](evidence/quicknode-x402-probe.md); [QuickNode x402 guide](https://www.quicknode.com/guides/solana-development/ai-agents/how-to-access-solana-rpc-with-x402-solana) | No payment or paid RPC fulfillment has yet been executed by this project. |
| x402 on Solana supports an HTTP 402 → signed payment → verification/settlement → resource response flow. | Verified protocol capability | [Solana x402](https://solana.com/x402/what-is-x402); [Kora x402 guide](https://solana.com/docs/tools/kora/guides/x402) | Protocol capability does not prove a listed merchant's uptime, quality, or product value. |
| Searchable x402 service catalogs contain paid research/data and document-processing endpoints. | Verified listings | [Coinbase Bazaar docs](https://docs.cdp.coinbase.com/x402/bazaar); [pay.sh services](https://pay.sh/services) | Listings are discovery evidence, not partnerships or successful purchases. Candidate-specific endpoints still require direct probes. |
| AP2 separates delegated mandates from payment execution and supports autonomous scenarios. | Verified protocol design | [AP2 v0.2 specification](https://ap2-protocol.org/ap2/specification/); [Google agent protocol guide](https://developers.googleblog.com/en/developers-guide-to-ai-agent-protocols/) | Full AP2 conformance is not required to demonstrate a bounded local mandate; do not claim conformance without implementing it. |
| The repository is still in discovery and has no product contract or live receipts. | Directly verified local state | `./harness.sh status --json` at 2026-08-01 16:31 KST returned `DISCOVERY`, `candidate_set`, `G1 pending`, `product: null`, and no receipts. | Existing Python modules are contracts/templates; they do not prove Gemini, GCP, payment, or RPC runtime execution. |

For the lead candidate, the minimum Google Cloud execution contract is explicit: Cloud Run hosts the agent API, Vertex AI Gemini converts a natural-language mandate into a typed intent, Cloud Monitoring supplies or records endpoint SLO observations, and structured Cloud Logging entries join `decision_id`, policy outcome, Solana signature, and fulfillment result. See [Cloud Run](https://cloud.google.com/run/docs), [Vertex AI generative AI](https://cloud.google.com/vertex-ai/generative-ai/docs), [Cloud Monitoring custom metrics](https://cloud.google.com/monitoring/custom-metrics), and [structured logging](https://cloud.google.com/logging/docs/structured-logging).

## Candidate-specific source map

| Candidate | Most relevant external evidence | Missing evidence that controls the decision |
|---|---|---|
| RPC Lifeboat | [QuickNode x402 payments](https://www.quicknode.com/docs/build-with-ai/x402-payments), [Solana-specific guide](https://www.quicknode.com/guides/solana-development/ai-agents/how-to-access-solana-rpc-with-x402-solana), direct 402 probe | Non-zero Devnet settlement, post-payment Solana RPC result, comparison against primary and eligible free fallback, pre-registered mandate-extraction scenarios, GCP-linked trace |
| NeedlePass | [Coinbase Bazaar](https://docs.cdp.coinbase.com/x402/bazaar), [pay.sh BigQuery](https://pay.sh/services/solana-foundation/google/bigquery), [Google Cloud supported blockchain datasets](https://docs.cloud.google.com/blockchain-analytics/docs/supported-datasets) | One precise Solana-history claim, direct endpoint/payment probe, evidence that the paid result changes a decision |
| ReproPay | [GitHub workflow runs](https://docs.github.com/en/rest/actions/workflow-runs), [GitHub artifacts](https://docs.github.com/en/rest/actions/artifacts), [Cloud Build GitHub triggers](https://cloud.google.com/build/docs/automating-builds/github/build-repos-from-github) | Maintainer demand, duplicate/gaming resistance, safe execution of untrusted tests |
| Three-Way Match Pay | [Google Document AI processor list](https://cloud.google.com/document-ai/docs/processors-list), [pay.sh Document AI](https://pay.sh/services/solana-foundation/google/documentai), [Solana Pay transfer requests](https://solana.com/docs/tools/solana-pay/quickstart/transfer-requests) | Real PO/receipt authority, supplier identity, ERP state, proof that Solana and Gemini are not replaceable garnish |
| ClipLicense | [C2PA specifications](https://spec.c2pa.org/specifications/), [IPTC RightsML](https://iptc.org/standards/rightsml/) | A real rights holder, legally credible license terms, a live purchasable clip merchant |
| ExpiryDeal Duel | [UCP/AP2 codelab](https://codelabs.developers.google.com/next26/adk-agent-commerce), [A2A](https://a2a-protocol.org/latest/) | Real expiring inventory and merchant constraints, non-formulaic negotiation, safe hold/consume behavior |
| SLA Refund Collector | [Cloud Monitoring SLO API](https://cloud.google.com/stackdriver/docs/solutions/slo-monitoring/api/using-api), [x402 FAQ](https://docs.cdp.coinbase.com/x402/support/faq) | Seller-recognized telemetry, signed refund authority or escrow, an external seller willing to pay the refund |

## Visual choice and QA note

No quantitative **candidate-quality** chart is justified: there are no comparable observed outcome measures across candidates, and converting qualitative judgments into numbers would create false precision. The sole chart visualizes the pre-committed hours allowed to each stage of the 48-hour kill/switch plan; it is an execution budget, not a score. Candidate judgments remain exact lookup tables and explicit decision/kill paths. Rows were reviewed against the evidence ledger above.

## Known limitations

- No external user or buyer interview has been completed for any candidate.
- No willingness-to-pay, retention, conversion, or market-size evidence is available.
- Only the QuickNode payment requirement was directly probed; no project wallet signed or settled a payment during this analysis.
- Catalog presence does not establish service reliability, response quality, legal rights, or partnership.
- The official page can change; re-check it before submission.
- The report optimizes for a credible hackathon proof under the deadline, not for the best long-term company in the abstract.
