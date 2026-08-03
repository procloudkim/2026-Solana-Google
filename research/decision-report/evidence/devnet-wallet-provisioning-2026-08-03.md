# Solana Devnet 지갑 프로비저닝 영수증

- 실행 시각: 2026-08-03 19:04 KST
- 네트워크: Solana Devnet 전용
- RPC: `https://api.devnet.solana.com`
- Devnet genesis hash: `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`
- Circle Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## 공개 지갑 계약

| 역할 | owner 주소 | classic USDC ATA | Secret Manager |
|---|---|---|---|
| Sponsor | `2X68YFE7Q3hfgBgmascc8RD4BZKyRpMYqEKnWonijTz5` | 불필요 | `mandate-pool-fee-sponsor:1` |
| Buyer A | `JALfr8bHAMYtQwkpiZgMnrKbnEebDb314GP8kJipTDGF` | `7EQmXHZbgDvib1ETZqPr4zipGvwDGMTxnPKpoGdTteMY` | `mandate-pool-buyer-a:1` |
| Buyer B | `G1TkMqd46vDZu7ihniXy8DRtmJp143PsunNUy6fZAPM7` | `7vQVj92mQ3u1w3jEUTb9YsEAX1Ct3Qz3AmMq6xGPkc33` | `mandate-pool-buyer-b:1` |
| Buyer C | `FDgsdSgXQbWSgL3MeB99zVzZWQcMqtYgbbjjubTRbM3R` | `Fzqkcx731vFpDPHXW9wrqkYRqfRMcWokjAMWCmToesVE` | `mandate-pool-buyer-c:1` |
| Merchant | `9CiapLgCdeYhsxDCcxcAGp9q4PcyfmrzfuaQBj2pTj7p` | `5UeNvj4JGQrB4fDmJgZ9q9yMgary6Kom8yDwSbs1XgKN` | `mandate-pool-merchant:1` |

기계가 읽는 동일 정보는 [`product/mandate-pool/devnet-wallets.public.json`](../../../product/mandate-pool/devnet-wallets.public.json)에 있다.

## 생성·검증 방법

- 저장소에 이미 설치된 `@solana/kit`의 Ed25519 구현으로 32-byte seed를 생성했다.
- seed와 파생 public key를 합친 canonical Base64 64-byte keypair만 메모리에서 만들었다.
- 개인키·mnemonic·secret payload를 stdout, 채팅, 파일, Git에 쓰지 않고 Secret Manager stdin으로 직접 전송했다.
- 저장된 각 version을 프로세스 내부로 다시 읽어 64-byte canonical Base64, signer 주소, classic USDC ATA, 공개 manifest 일치를 검증했다.
- 다섯 owner 주소는 모두 서로 다르다.
- Cloud Run runtime identity에는 Sponsor와 Buyer A/B/C 네 secret만 `secretAccessor`를 부여했다.
- Merchant secret은 복구용이며 Cloud Run runtime identity에는 접근 권한을 주지 않았다.
- 재실행 시 기존 enabled version을 발견하면 키 회전을 거부하는 `--execute` 안전장치를 적용했다.

재현 스크립트: [`product/mandate-pool/scripts/provision-devnet-wallets.mjs`](../../../product/mandate-pool/scripts/provision-devnet-wallets.mjs)

## 발견·수정한 차단 결함

제품의 Devnet genesis hash 상수가 뒤 12자 잘린 값이라 정상 Devnet도 live startup에서 항상 거절될 상태였다. 공식 Devnet RPC의 전체 hash로 수정하고 길이·정확값 회귀 테스트를 추가했다. 전체 테스트는 9개 파일 87개가 통과했다.

## 자금 상태와 HITL

- 공식 public Devnet RPC에 1 SOL airdrop을 한 번 요청했으나 `Internal error`로 거절됐다.
- 반복 요청으로 faucet 한도를 소모하지 않고 [Solana Devnet Faucet](https://faucet.solana.com/)의 사람 확인 단계로 전환했다.
- 사용자가 Sponsor에 5 Devnet SOL을 지급했고 RPC finalized 잔액 `5,000,000,000` lamports를 확인했다.
- Sponsor가 Buyer A/B/C와 Merchant의 ATA 네 개를 하나의 idempotent v0 transaction으로 생성했다.
- transaction signature: [`2ySPjnbRFmsFZLJDxvJvoG3mkF26L6GTH51u2z69ANbm3biRP2yTD3H3sFvWBWPShySEt84RVQRUzNGCC5e1uwjs`](https://explorer.solana.com/tx/2ySPjnbRFmsFZLJDxvJvoG3mkF26L6GTH51u2z69ANbm3biRP2yTD3H3sFvWBWPShySEt84RVQRUzNGCC5e1uwjs?cluster=devnet)
- transaction은 finalized됐고 ATA 네 개 모두 classic Token Program, 기대 owner·mint, initialized 상태임을 RPC에서 검증했다.
- ATA 생성 뒤 Sponsor 잔액은 `4,991,837,880` lamports다.
- [Circle Faucet](https://faucet.circle.com/)에서 사람이 CAPTCHA를 완료하고 Buyer A/B/C owner 주소 각각에 20 Devnet USDC를 요청했다. [Circle Solana USDC quickstart](https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana)

## Circle USDC finalized 증거

2026-08-03 20:11 KST, finalized slot `480902417`에서 네 ATA를 한 번에 읽어 classic SPL Token program, Circle Devnet mint, 기대 owner, decimals 6, initialized 상태와 잔액을 검증했다.

| 역할 | finalized 잔액 | Faucet 입금 signature | slot · 시각 |
|---|---:|---|---|
| Buyer A | 20 USDC | [`jMkExVbLyeKGhweRU1rRfm3BqPHVUuJttDKX9v2geKRHbvS686Y7AymjVxJ669AEkzwQjbP3wdoo35X92N2eGfU`](https://explorer.solana.com/tx/jMkExVbLyeKGhweRU1rRfm3BqPHVUuJttDKX9v2geKRHbvS686Y7AymjVxJ669AEkzwQjbP3wdoo35X92N2eGfU?cluster=devnet) | `480902232` · 20:08:48 KST |
| Buyer B | 20 USDC | [`33yKUavJiZzWcKzATQvx315CN25t4Wfk61knJzaVsasLryhw63GQdW4SSujhMHUjs1XYPtza6MJgtbANCNkhy2qY`](https://explorer.solana.com/tx/33yKUavJiZzWcKzATQvx315CN25t4Wfk61knJzaVsasLryhw63GQdW4SSujhMHUjs1XYPtza6MJgtbANCNkhy2qY?cluster=devnet) | `480902288` · 20:09:08 KST |
| Buyer C | 20 USDC | [`5baRHTeno6PbHNf5MURxud4aCqU3MCGHUVFppJHpCP1aRJr343oE6YATSY4PshefJ6fQ5wGycWTAXr3WDS8jCEhj`](https://explorer.solana.com/tx/5baRHTeno6PbHNf5MURxud4aCqU3MCGHUVFppJHpCP1aRJr343oE6YATSY4PshefJ6fQ5wGycWTAXr3WDS8jCEhj?cluster=devnet) | `480902319` · 20:09:19 KST |
| Merchant | 0 USDC | 해당 없음 | 동일 조회 slot |

## 증거 경계

- 공개 manifest의 Buyer A/B/C와 Merchant ATA 네 개는 온체인 생성과 finalized 상태 검증을 완료했다.
- Sponsor SOL, ATA 네 개, Buyer A/B/C의 각 20 USDC 잔액을 finalized로 검증했다.
- 어떤 Mainnet 키나 자산도 사용하지 않았다.
- 이 프로젝트가 직접 생성·서명·전송한 transaction은 위 Devnet ATA 생성 transaction 한 건뿐이다. Faucet 입금 세 건은 Circle Faucet이 생성한 외부 transaction이다.
