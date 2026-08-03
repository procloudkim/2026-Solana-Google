# Repository operating rules

- Treat `research/decision-report/hackathon-environment-codex-runbook.md` as the current execution checklist and update stale status in place.
- Verify externally checkable claims against primary or official sources before publishing them. Record uncertainty instead of guessing.
- Keep Mainnet, real assets, wallet private keys, credentials, `.env` files, and secret payloads out of this repository and all logs.
- Use only the dedicated Solana Devnet wallets in `product/mandate-pool/devnet-wallets.public.json`; public addresses and transaction signatures are safe to document.
- Before product changes, run `npm run typecheck`, `npm test`, and `npm run build` from `product/mandate-pool`.
- Preserve redacted evidence for successful and rejected paths. Fixture results must never be described as on-chain proof.
- Keep documentation current rather than appending stale progress notes. Commit and push each coherent, verified change to `main` unless the user requests another branch.
