# Solana Devnet 지갑 프로비저닝 검증 기록

## 검증 목적

이 문서는 Mandate Pool의 전용 **Solana Devnet** 지갑과 classic USDC ATA가 올바르게 생성·분리됐고, 공개 manifest·Secret Manager signer·온체인 계정 상태가 서로 일치하는지 검증한다. Mainnet 지갑이나 실자산을 다루지 않으며 개인키·mnemonic·secret payload는 증거 범위에서 제외한다.

Circle은 testnet USDC와 native test token에 금전 가치가 없고 실제 미국 달러로 담보되지 않는다고 명시한다. 아래의 SOL과 USDC는 모두 테스트 자산이다. [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## 실행 환경

| 항목 | 검증값 |
|---|---|
| 실행 시각 | 2026-08-03 19:04 KST |
| 네트워크 | Solana Devnet 전용 |
| RPC | `https://api.devnet.solana.com` |
| Devnet genesis hash | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` |
| Circle Devnet USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |

## 공개 지갑 계약

| 역할 | owner 주소 | classic USDC ATA | Secret Manager 참조 |
|---|---|---|---|
| Sponsor | `2X68YFE7Q3hfgBgmascc8RD4BZKyRpMYqEKnWonijTz5` | 불필요 | `mandate-pool-fee-sponsor:1` |
| Buyer A | `JALfr8bHAMYtQwkpiZgMnrKbnEebDb314GP8kJipTDGF` | `7EQmXHZbgDvib1ETZqPr4zipGvwDGMTxnPKpoGdTteMY` | `mandate-pool-buyer-a:1` |
| Buyer B | `G1TkMqd46vDZu7ihniXy8DRtmJp143PsunNUy6fZAPM7` | `7vQVj92mQ3u1w3jEUTb9YsEAX1Ct3Qz3AmMq6xGPkc33` | `mandate-pool-buyer-b:1` |
| Buyer C | `FDgsdSgXQbWSgL3MeB99zVzZWQcMqtYgbbjjubTRbM3R` | `Fzqkcx731vFpDPHXW9wrqkYRqfRMcWokjAMWCmToesVE` | `mandate-pool-buyer-c:1` |
| Merchant | `9CiapLgCdeYhsxDCcxcAGp9q4PcyfmrzfuaQBj2pTj7p` | `5UeNvj4JGQrB4fDmJgZ9q9yMgary6Kom8yDwSbs1XgKN` | `mandate-pool-merchant:1` |

기계가 읽는 동일 정보는 [`product/mandate-pool/devnet-wallets.public.json`](../../../product/mandate-pool/devnet-wallets.public.json)에 있다. 이 표와 manifest에는 공개주소와 secret의 **리소스명·version**만 있으며 secret 값은 없다.

## 생성·검증 방법과 보안 전제

1. 저장소에 설치된 `@solana/kit`의 Ed25519 구현으로 32-byte seed를 생성했다.
2. seed와 파생 public key를 결합한 canonical Base64 64-byte keypair를 프로세스 메모리에서만 만들었다.
3. 개인키·mnemonic·secret payload를 stdout, 채팅, 파일 또는 Git에 쓰지 않고 Secret Manager stdin으로 직접 전송했다.
4. 저장된 각 version을 같은 프로세스 안에서 다시 읽어 64-byte canonical Base64, signer 주소, classic USDC ATA, 공개 manifest가 일치하는지 검증했다.
5. 다섯 owner 주소가 모두 서로 다른지 확인했다.
6. Cloud Run runtime identity에는 Sponsor와 Buyer A/B/C 네 secret만 `secretAccessor`를 부여했다. Merchant secret은 복구용으로 분리하고 runtime identity에는 접근 권한을 주지 않았다.
7. 재실행 시 기존 enabled version이 있으면 키 회전을 거부하도록 `--execute` 안전장치를 적용했다.

재현 가능한 구현은 [`product/mandate-pool/scripts/provision-devnet-wallets.mjs`](../../../product/mandate-pool/scripts/provision-devnet-wallets.mjs)에 있다. 운영자가 재실행할 때는 기존 version 존재 여부를 먼저 확인해야 하며, secret payload를 출력하는 명령은 증거로 남기지 않는다.

## 프로비저닝 중 발견한 차단 결함

제품의 Devnet genesis hash 상수에서 마지막 12자가 누락되어 정상 Devnet도 live startup에서 항상 거절될 상태였다. 공식 Devnet RPC가 반환한 전체 hash로 수정하고 길이·정확값 회귀 테스트를 추가했다. 수정 뒤 전체 Vitest 9개 파일, 87개 테스트가 통과했다.

## 온체인 관찰 결과

### 1. Sponsor와 ATA 생성

- 공식 public Devnet RPC에 1 SOL airdrop을 한 번 요청했으나 `Internal error`로 거절됐다.
- 반복 요청으로 faucet 한도를 소모하지 않고 [Solana Devnet Faucet](https://faucet.solana.com/)의 사람 확인 단계로 전환했다.
- 사용자가 Sponsor에 5 Devnet SOL을 지급했고 RPC finalized 잔액 `5,000,000,000` lamports를 확인했다.
- Sponsor가 Buyer A/B/C와 Merchant의 ATA 네 개를 하나의 idempotent v0 transaction으로 생성했다.
- ATA 생성 transaction: [`2ySPjnbRFmsFZLJDxvJvoG3mkF26L6GTH51u2z69ANbm3biRP2yTD3H3sFvWBWPShySEt84RVQRUzNGCC5e1uwjs`](https://explorer.solana.com/tx/2ySPjnbRFmsFZLJDxvJvoG3mkF26L6GTH51u2z69ANbm3biRP2yTD3H3sFvWBWPShySEt84RVQRUzNGCC5e1uwjs?cluster=devnet)
- transaction은 finalized됐고 ATA 네 개 모두 classic Token Program, 기대 owner·mint, initialized 상태임을 RPC에서 확인했다.
- ATA 생성 뒤 Sponsor 잔액은 `4,991,837,880` lamports다.

### 2. Circle Faucet 입금

[Circle Faucet](https://faucet.circle.com/)에서 사람이 CAPTCHA를 완료하고 Buyer A/B/C owner 주소 각각에 20 Devnet USDC를 요청했다. Circle의 Solana quickstart도 Devnet USDC 전송과 faucet 사용 절차를 설명한다. [Circle Solana USDC quickstart](https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana)

2026-08-03 20:11 KST, finalized slot `480902417`에서 네 ATA를 한 번에 읽어 classic SPL Token Program, Circle Devnet mint, 기대 owner, decimals 6, initialized 상태와 잔액을 확인했다.

| 역할 | finalized 잔액 | Faucet 입금 signature | slot · 시각 |
|---|---:|---|---|
| Buyer A | 20 Devnet USDC | [`jMkExVbLyeKGhweRU1rRfm3BqPHVUuJttDKX9v2geKRHbvS686Y7AymjVxJ669AEkzwQjbP3wdoo35X92N2eGfU`](https://explorer.solana.com/tx/jMkExVbLyeKGhweRU1rRfm3BqPHVUuJttDKX9v2geKRHbvS686Y7AymjVxJ669AEkzwQjbP3wdoo35X92N2eGfU?cluster=devnet) | `480902232` · 20:08:48 KST |
| Buyer B | 20 Devnet USDC | [`33yKUavJiZzWcKzATQvx315CN25t4Wfk61knJzaVsasLryhw63GQdW4SSujhMHUjs1XYPtza6MJgtbANCNkhy2qY`](https://explorer.solana.com/tx/33yKUavJiZzWcKzATQvx315CN25t4Wfk61knJzaVsasLryhw63GQdW4SSujhMHUjs1XYPtza6MJgtbANCNkhy2qY?cluster=devnet) | `480902288` · 20:09:08 KST |
| Buyer C | 20 Devnet USDC | [`5baRHTeno6PbHNf5MURxud4aCqU3MCGHUVFppJHpCP1aRJr343oE6YATSY4PshefJ6fQ5wGycWTAXr3WDS8jCEhj`](https://explorer.solana.com/tx/5baRHTeno6PbHNf5MURxud4aCqU3MCGHUVFppJHpCP1aRJr343oE6YATSY4PshefJ6fQ5wGycWTAXr3WDS8jCEhj?cluster=devnet) | `480902319` · 20:09:19 KST |
| Merchant | 0 Devnet USDC | 해당 없음 | 동일 조회 slot |

## 판정, 한계, 다음 행동

**전용 Devnet owner·ATA·테스트 자금의 준비 상태는 검증됐다.** 공개 manifest의 Buyer A/B/C와 Merchant ATA 네 개는 온체인 생성과 finalized 상태 확인을 완료했고, Sponsor SOL과 Buyer별 20 Devnet USDC도 finalized 잔액으로 확인했다.

다만 다음 경계를 유지한다.

- 어떤 Mainnet 키나 실자산도 사용하지 않았다.
- 이 프로젝트가 직접 생성·서명·전송한 transaction은 위 Devnet ATA 생성 한 건뿐이다. Faucet 입금 세 건은 Circle Faucet이 만든 외부 transaction이다.
- ATA와 잔액 검증은 **제품 결제 성공 증거가 아니다**. 제품 결제는 별도의 HITL 승인 뒤 실행하고, 제품이 만든 signature·finalized 상태·전후 잔액을 별도 receipt로 보존해야 한다.
- 다음 실행 전에는 public manifest와 finalized 잔액을 다시 읽되, 개인키나 secret payload는 조회 결과·로그·문서에 포함하지 않는다.
