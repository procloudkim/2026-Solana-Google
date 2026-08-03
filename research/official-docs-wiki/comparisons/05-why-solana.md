# 05. Why Solana for Agentic Commerce OCR 대조

원본: [Why Solana OCR](../../../.harness/enrichment/pdfs/kickoff-tech-session-솔라나-why-solana-for-agentic-commerce-9037e55496.md)

주의: 명령어와 숫자는 OCR 오염의 영향이 크다. 실행 전 공식 문서의 복사 가능한 코드 블록을 사용한다.

| 페이지 | 로컬 문서의 주장 | 판정 | 현재 공식 근거 | 적용 조치 |
|---|---|---|---|---|
| 11 | Solana는 약 400ms, 1초 이내, USD 0.001 미만 | 부분 일치 | [Solana Pay](https://solana.com/docs/tools/solana-pay)는 under-one-second와 평균 약 USD 0.0005를 제시; [fee structure](https://solana.com/docs/core/fees/fee-structure)는 실제 fee 공식을 정의 | 마케팅 평균과 실제 tx fee를 분리 기록 |
| 13 | pay.sh는 가입·계정·API key 없이 유료 API 사용 | 부분 일치 | [pay.sh docs](https://pay.sh/docs), [accounts](https://pay.sh/docs/pay-for-apis/accounts) | 공급자 계정 불필요와 로컬 wallet/account/setup 필요를 함께 설명 |
| 14 | API 선택→평소처럼 요청→자동 결제, 코드 변경 없음 | 부분 일치 | [pass-through commands](https://pay.sh/docs/toolchain/commands/pass-through)은 wrapper 흐름을 지원 | wrapper·wallet 승인·retry 동작을 구현 범위에 포함 |
| 14 | `npx`와 `@solana/pay`가 분리되어 보임 | **OCR 오류** | [pay.sh install](https://pay.sh/docs/get-started/install)의 정확한 명령은 `npx @solana/pay` | OCR 문자열을 실행하지 않고 정정 명령 사용 |
| 15 | `brew install pay.` | **OCR 오류** | [pay.sh install](https://pay.sh/docs/get-started/install)의 정확한 명령은 `brew install pay` | trailing period 제거 |
| 15 | `pay setup` | 일치 | [pay.sh install](https://pay.sh/docs/get-started/install), [accounts](https://pay.sh/docs/pay-for-apis/accounts) | setup이 wallet/account configuration을 만든다는 점을 명시 |
| 16 | Solana Pay·pay.sh·x402·USDC를 실제 유스케이스에 녹인 구현 기대 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)의 통합·실행 평가 | 하나의 end-to-end payment proof로 연결 |
| 17 | Localnet은 반복 개발, Testnet은 validator/protocol, Devnet은 앱 테스트, Mainnet은 실제 자산 | 일치 | [Solana core](https://solana.com/docs/core) | network 역할 설명으로 사용 가능 |
| 17 | Mainnet은 `프로덕션/배포 시에만` | 부분 일치 | [Solana core](https://solana.com/docs/core)는 Mainnet을 production으로 정의하지만 현재 [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 localnet/testnet/devnet live도 수용 | 제품 장기 경로와 해커톤 제출 조건을 분리 |
| 12~13 | 기관·파트너·70+ API 등 시점 의존 생태계 수치 | 공식 근거 없음 | 이번 조사에서 대조한 [Solana](https://solana.com/docs/core)와 [pay.sh](https://pay.sh/docs) 공식 기술 문서만으로 모든 수치·사례를 재현하지 못함 | 원문 발표자료의 dated citation이 없으면 마케팅 주장에 사용하지 않음 |

## 결론

네트워크 역할과 pay.sh의 기본 흐름은 유효하지만 설치 명령 두 곳은 반드시 정정해야 한다. `no account/no key`는 로컬 지갑과 사용자 승인까지 없다는 뜻이 아니며, 해커톤은 Devnet 증거로 충분하므로 Mainnet 비용을 필수화하지 않는다.
