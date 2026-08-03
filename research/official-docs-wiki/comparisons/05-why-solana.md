# 05. Why Solana for Agentic Commerce OCR 대조

이 문서는 Solana 발표 자료의 성능·수수료·pay.sh·cluster 설명을 현재 구현에 안전하게 사용할 수 있도록 보정한다. 특히 OCR로 손상된 설치 명령과 `no account/no key` 축약을 그대로 복사하지 않는다.

- 원본: [Why Solana OCR](../../../.harness/enrichment/pdfs/kickoff-tech-session-솔라나-why-solana-for-agentic-commerce-9037e55496.md)
- 비교 데이터: 2026-07-23
- 고영향 공식 사실 재확인: 2026-08-03

명령과 숫자는 OCR 오염에 취약하다. 실행 가능한 문자열은 항상 공식 code block에서 가져온다.

## 판정과 조치

| page | OCR에서 읽힌 주장 | 판정 | 공식 근거와 보정 | 구현·발표 조치 |
|---|---|---|---|---|
| 11 | Solana 약 400ms, 1초 이내, USD 0.001 미만 | 부분 일치 | [Solana Pay](https://solana.com/docs/tools/solana-pay)는 1초 미만·평균 USD 0.0005를 소개하고 [fee structure](https://solana.com/docs/core/fees/fee-structure)는 실제 fee formula를 정의 | marketing 평균과 실제 tx metadata를 분리 |
| 13 | pay.sh는 signup·account·API key 없이 paid API 사용 | 부분 일치 | [pay.sh docs](https://pay.sh/docs), [accounts](https://pay.sh/docs/pay-for-apis/accounts) | provider signup 감소와 local wallet/setup/authorization을 함께 설명 |
| 14 | API 선택→평소처럼 request→자동 결제, code 변경 없음 | 부분 일치 | [pass-through](https://pay.sh/docs/toolchain/commands/pass-through)은 wrapper flow를 지원 | wrapper, wallet approval, retry·failure handling을 구현 범위에 포함 |
| 14 | `npx`와 `@solana/pay`가 분리 | **OCR 오류** | [install](https://pay.sh/docs/get-started/install)의 one-shot 명령은 `npx @solana/pay ...` | 공식 한 줄 명령 사용 |
| 15 | `brew install pay.` | **OCR 오류** | 공식 명령은 `brew install pay` | trailing period 제거 |
| 15 | `pay setup` | 일치 | install/accounts 문서는 wallet과 agent integration 설정을 설명 | 무상 client setup이 아니라 key/account 경계로 설명 |
| 16 | Solana Pay·pay.sh·x402·USDC를 실제 use case에 통합 | 부분 일치 | 행사 페이지는 Solana payment·protocol integration과 actual execution을 평가하지만 모든 구성 요소를 요구하지 않음 | custom settlement 하나를 완결된 proof로 보여줌 |
| 17 | Localnet=개발, Testnet=validator, Devnet=app 실험, Mainnet=production | 일치 | [Solana core](https://solana.com/docs/core) | cluster 역할 설명으로 사용 |
| 17 | Mainnet은 production/deployment 단계 | 부분 일치 | Solana 일반 문서상 production이지만 행사 페이지는 localnet·testnet·Devnet live를 허용 | 장기 production과 hackathon submission을 분리 |
| 12~13 | 기관·partner·70+ API 등 ecosystem 수치 | 공식 근거 없음 | 대조한 공식 기술 문서만으로 기준일과 원 dataset을 재현하지 못함 | dated primary source 없이는 market claim에 사용하지 않음 |

## 제품 결정

Solana를 선택한 이유는 추상적 속도 문구보다 Mandate Pool의 요구와 직접 연결한다. 세 buyer의 transfer가 한 transaction에서 모두 성공하거나 모두 실패하고, 공개 signature를 통해 승인 의도와 최종 결과를 독립 검증할 수 있기 때문이다.

## 실행 항목

```sh
brew install pay
npx @solana/pay --sandbox curl https://debugger.pay.sh/mpp/quote/AAPL
pay setup
```

1. 실행 전에 공식 install page를 다시 확인한다.
2. 제출에는 pay.sh 명령이 아니라 실제 사용한 custom Solana transaction path를 설명한다.
3. fee와 confirmation은 해당 Devnet transaction에서 측정한다.
4. Mainnet 비용·자산·key를 제출 조건으로 만들지 않는다.

발표 자료의 생태계 수치는 dated source가 있을 때만 사용하고, 제품의 Why는 원자성·검증 가능성·정책 경계로 설명한다.
