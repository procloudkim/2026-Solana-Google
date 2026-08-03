# HITL opportunity evidence — 2026-08-02 KST

This file records only safe, read-only observations. No wallet signed, no payment was sent, and no resource was unlocked.

## 1. Current hackathon page

- Retrieval: `GET https://www.gcp-solana-ai-agentic-hacks-kr.xyz/` and its deployed JavaScript asset
- Observed at: approximately 2026-08-02 14:10 KST
- Page title: `2026 Google Cloud Hackathon`
- Current product-purpose text: the product should let an AI Agent handle payments within a set limit without human approval at every step.
- Track: one `Solana 기반 Agentic Commerce` track. A–D are examples and the page explicitly allows other ideas inside the theme.
- Current criteria:
  1. innovation and UX;
  2. Gemini / Google Cloud AI use;
  3. technical completion and Solana / infrastructure / protocol integration;
  4. live localnet, testnet, or Devnet transaction and log evidence.
- Deadline displayed: 2026-08-03 23:59 KST.

Boundary: this proves the text served by the site at retrieval time. It does not prove judging weights, which are not published on the page.

## 2. Local readiness state

- Command: `./harness.sh status --json`
- Observed at: 2026-08-02 14:13 KST
- State: `DISCOVERY`
- Overlay: `PIVOT_REQUIRED`
- Gate: `G0 Knowledge passed`, `G1 Candidate pending`
- Blocker: `candidate_set`
- Product, product contract, candidate evaluation, approvals, and receipts: absent.

Boundary: local state is direct project evidence. It does not describe any unrecorded external deployment.

## 3. QuickNode x402 RPC offer

- Request: unauthenticated `POST https://x402.quicknode.com/solana-mainnet` with JSON-RPC `getHealth`
- Observed at: 2026-08-02 14:13:52 KST
- Response: `HTTP 402`
- Protocol metadata: `x402Version: 2`
- Resource description: payment for QuickNode RPC access
- Accepted networks included Solana Devnet and Solana Mainnet options.
- Response described a settlement-issued QuickNode session token for subsequent authorized requests.

Boundary: an offer and machine-readable payment requirement were directly verified. This project did not sign or settle, so a Solana signature, settlement receipt, session token, and paid RPC response remain unverified.

## 4. pay.sh BigQuery gateway

- Request: unauthenticated `POST https://bigquery.google.gateway-402.com/bigquery/v2/projects/solana-mainnet/queries` with `SELECT 1`
- Observed at: 2026-08-02 14:14:33 KST
- Response: `HTTP 402`
- Body: `payment_required`
- Payment schemes: `mpp/charge` and `x402/exact`
- Pricing metadata: USD 0.001 per request
- Payment requirements offered Solana Mainnet assets.

Boundary: the gateway currently produces a payment challenge. No payment or BigQuery result was obtained. Catalog and challenge evidence do not prove the target Solana query, result quality, or user value.

## 5. pay.sh Document AI gateway — negative evidence

Two unauthenticated read-only POST probes were attempted:

1. `.../v1/projects/demo/locations/us/processors/demo:process` with `{}`
2. the catalog-style path `.../v1/projects/solana-mainnet/locations/solana-mainnet/processors/solana-mainnet:process` with the published example body

Both returned:

```text
HTTP 500
{"error":"challenge_generation_failed"}
```

Observed at: 2026-08-02 14:14 KST.

Boundary: the public pay.sh catalog page exists and lists the service, but this direct result does not establish a usable payment challenge. The failure may be transient or request-contract-specific; until resolved, `Invoice Line Rescue` is parked rather than treated as available.

## 6. Source links

- Hackathon: https://www.gcp-solana-ai-agentic-hacks-kr.xyz/
- Stanford d.school Bootleg: https://dschool.stanford.edu/tools/design-thinking-bootleg
- Stanford Method Cards: https://dschool.stanford.edu/s/METHODCARDS-v3-slim.pdf
- AP2 specification: https://ap2-protocol.org/ap2/specification/
- AP2 flows: https://ap2-protocol.org/ap2/flows/
- NIST human–AI interaction: https://airc.nist.gov/airmf-resources/airmf/appendices/app-c-ai-risk-management-and-human-ai-interaction/
- Solana x402: https://solana.com/x402/what-is-x402
- pay.sh BigQuery: https://pay.sh/services/solana-foundation/google/bigquery
- pay.sh Document AI: https://pay.sh/services/solana-foundation/google/documentai
- Google Document AI processor list: https://docs.cloud.google.com/document-ai/docs/processors-list

## 7. Official page re-check — approximately 2026-08-02 16:50 KST

- Retrieval: `GET https://www.gcp-solana-ai-agentic-hacks-kr.xyz/` and the currently referenced asset `/assets/index-DHFtfSyp.js`
- Mutation performed: none
- The served page still described one `Solana 기반 Agentic Commerce` track and said AI Agents should handle payments autonomously within a set limit rather than request approval at every step.
- The four displayed criteria were still innovation/UX, Gemini/Google Cloud AI use, Solana/infrastructure/protocol integration, and live localnet/testnet/Devnet transaction plus log evidence.
- The page still displayed the recruitment period ending on 8/3.

Boundary: this is a second read-only observation of the currently served asset. It does not establish unpublished judging weights or any candidate's compliance.
