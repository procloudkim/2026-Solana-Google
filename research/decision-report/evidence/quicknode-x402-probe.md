# QuickNode x402 read-only probe

- Checked at: 2026-08-01 16:27 KST
- Request: unauthenticated `POST https://x402.quicknode.com/solana-mainnet` with JSON-RPC method `getHealth`
- Mutation performed: none; no wallet signature or payment was sent
- Observed response: `HTTP/2 402`

## Reviewed fields

- Resource description: paid QuickNode RPC access with per-request, nanopayment, or credit drawdown options.
- `x402Version`: `2`
- A Solana Devnet exact-payment option was present for network `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`.
- The Devnet option included USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` and an offer with `amount: "1000"` base units.
- The response advertised a `quicknode-session` token after successful settlement, with a one-hour expiry.

## What this proves

At the checked time, the endpoint was reachable and returned a machine-readable x402 payment requirement that included Solana Devnet settlement. This is evidence of a real external paid-resource offer, not evidence that this repository has paid for or consumed the resource.

## What remains unproven

- A non-zero Solana Devnet payment from the project wallet
- Facilitator verification and settlement success
- Issuance and use of the post-payment session token
- A valid Solana JSON-RPC response after payment
- Measurable latency, freshness, or availability improvement over a free endpoint

The raw `payment-required` header was intentionally not copied into this repository because it was large, short-lived, and included a nonce and expiry timestamp. Re-run the unauthenticated request to obtain a fresh challenge.

## Method-specific follow-up — 2026-08-02 14:56 KST

- Request: unauthenticated `POST https://x402.quicknode.com/solana-devnet` with JSON-RPC method `getSignatureStatuses`, one placeholder signature, and `searchTransactionHistory: true`
- Mutation performed: none; the response body and payment header were not persisted, no wallet signed, and no payment was sent
- Observed response: `HTTP 402`

This confirms that the PRD's exact Solana Devnet resource path and method currently reach a payment challenge. It does **not** prove that the offer can be settled, that a non-zero Devnet transaction will occur, or that the paid response will contain a useful signature status.
