# 02. Solana 세션 전사 대조

이 문서는 Solana 세션의 pay.sh·수수료·network 설명을 구현 계약으로 사용할 수 있는지 판정한다. 핵심 보정은 세 가지다. sandbox와 온체인 증거를 나누고, `no account/no key`의 범위를 제한하며, Mainnet을 해커톤의 마지막 필수 단계로 만들지 않는다.

- 원본: [2026-07-21 19-56-58 전사](../../../.harness/enrichment/transcripts/2026-07-21-19-56-58-c96826ade9.md)
- 비교 데이터: 2026-07-23
- 고영향 공식 사실 재확인: 2026-08-03

전사는 앞 문장의 중간에서 시작하고 `pay.sh`, `Devnet`, `x402`를 반복해서 잘못 인식한다. 용어·명령은 공식 문서를 우선한다.

## 판정과 조치

| 위치 | 전사에서 읽힌 주장 | 판정 | 공식 근거와 보정 | 구현 조치 |
|---|---|---|---|---|
| 02:36~05:29 | pay.sh sandbox에서 결제가 완료됨 | 부분 일치 | [pay.sh quickstart](https://pay.sh/docs/get-started/client-quickstart)는 임시 local sandbox account를 사용 | challenge/retry 테스트로만 기록; Devnet transaction과 분리 |
| 25:43~26:37 | Solana 수수료는 약 0.001 cent | 부분 일치 | [fee structure](https://solana.com/docs/core/fees/fee-structure)는 base+priority fee를 정의하고 [Solana Pay](https://solana.com/docs/tools/solana-pay)는 평균 비용을 소개 | 고정 USD 계약을 쓰지 않고 실제 lamports 기록 |
| 28:03~28:57 | pay.sh는 가입·계정·API key·구독 없이 사용 | 부분 일치 | [pay.sh docs](https://pay.sh/docs)와 [accounts](https://pay.sh/docs/pay-for-apis/accounts)는 provider signup 감소와 local wallet/setup/funding/authorization을 함께 설명 | key custody와 승인을 제품 설명에서 숨기지 않음 |
| 29:18~30:05 | code 변경 없이 pay.sh 한 줄이면 됨 | 부분 일치 | [pass-through](https://pay.sh/docs/toolchain/commands/pass-through)는 기존 command wrapper를 지원하지만 setup과 approval은 남음 | wrapper 자체와 end-to-end integration을 구분 |
| 32:41~34:10 | Testnet은 validator 검증, app은 Localnet→Devnet→Mainnet | 부분 일치 | [Solana core](https://solana.com/docs/core)는 Testnet=validator testing, Devnet=developer experimentation, Mainnet=production으로 구분 | Local→Devnet까지만 해커톤 수용 경로로 사용 |
| 전반 | Solana Pay는 빠르고 저렴한 payment standard | 일치 | [Solana Pay](https://solana.com/docs/tools/solana-pay), [accept payments](https://solana.com/docs/payments/accept-payments) | payment request보다 수취 측 verification을 수용 기준으로 둠 |
| 전반 | pay.sh·Solana Pay·x402를 실제 use case에 녹이는 것이 중요 | 부분 일치 | 행사 페이지는 Solana payment와 protocol integration을 평가하지만 모든 이름을 요구하지 않음 | Mandate Pool의 custom atomic settlement를 정확히 설명하고 미구현 protocol을 제거 |
| 전반 | 특정 partner·70+ API·시장 수치가 현재도 유효 | 공식 근거 없음 | 조사한 Solana·pay.sh 공식 기술 문서만으로 시점과 수치를 재현하지 못함 | dated primary dataset이 없으면 제품 소개에 사용하지 않음 |

## Mandate Pool 결정

현재 제품은 pay.sh나 Solana Pay를 settlement runtime으로 사용하지 않는다. 세 payer의 exact allocation을 하나의 v0 transaction으로 묶고 finalized result를 재검증한다. 따라서 제출 데모의 중심은 payment tool 이름이 아니라 **일부 결제와 중복 결제를 막는 atomicity·idempotency proof**다.

## 실행 항목

1. fixture·sandbox·Devnet 화면에 서로 다른 label을 유지한다.
2. Devnet receipt에 mint, 세 source ATA, merchant ATA, 세 amount, signer, memo, fee, finalized를 기록한다.
3. `API key 불필요`, `code 변경 없음`, 고정 USD fee 표현을 제거한다.
4. Mainnet wallet과 실제 자산을 해커톤 proof에 추가하지 않는다.

파트너·API 수치는 원 데이터와 기준일을 확보할 때까지 불확실한 마케팅 정보로 남긴다.
