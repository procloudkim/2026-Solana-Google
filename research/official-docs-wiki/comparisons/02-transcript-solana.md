# 02. Solana 세션 전사 대조

원본: [2026-07-21 19-56-58 전사](../../../.harness/enrichment/transcripts/2026-07-21-19-56-58-c96826ade9.md)

주의: 전사는 앞 문장의 중간에서 시작하며, `pay.sh`, `Devnet`, `x402`가 반복적으로 잘못 인식됐다.

| 위치 | 로컬 문서의 주장 | 판정 | 현재 공식 근거 | 적용 조치 |
|---|---|---|---|---|
| 02:36~05:29 | pay.sh sandbox에서 결제가 완료됨 | 부분 일치 | [pay.sh quickstart](https://pay.sh/docs/get-started/client-quickstart)는 임시 로컬 sandbox wallet을 설명 | 통합 테스트 증거로만 사용; 네트워크 tx 증거를 별도로 생성 |
| 25:43~26:37 | Solana는 매우 낮은 수수료이며 약 0.001 cent | 부분 일치 | [Solana fee structure](https://solana.com/docs/core/fees/fee-structure)는 base fee와 priority fee로 정의; [Solana Pay](https://solana.com/docs/tools/solana-pay)는 평균 비용을 제시 | 고정 USD 수수료로 계약하지 말고 실제 lamports 기록 |
| 28:03~28:57 | pay.sh는 가입·계정·API key·구독 없이 사용 | 부분 일치 | [pay.sh docs](https://pay.sh/docs), [accounts](https://pay.sh/docs/pay-for-apis/accounts)는 공급자별 가입 감소와 로컬 setup/wallet/funding/authorization을 함께 설명 | “공급자별 가입/API key 불필요”로 한정하고 로컬 계정 요구를 명시 |
| 29:18~30:05 | 코드 변경 없이 pay.sh 한 줄만 붙이면 됨 | 부분 일치 | [pass-through commands](https://pay.sh/docs/toolchain/commands/pass-through)은 기존 명령 wrapper를 지원 | wrapper·MCP/CLI 설정과 wallet approval를 구현 작업에 포함 |
| 32:41~34:10 | Testnet은 validator/client 검증, 앱은 Localnet→Devnet→Mainnet 경로 권장 | 부분 일치 | [Solana core](https://solana.com/docs/core)는 Testnet을 validator testing, Devnet을 developer experimentation으로 구분 | 역할 구분은 유지하되 Mainnet을 행사 필수 마지막 단계로 만들지 않음 |
| 전반 | Solana Pay는 빠르고 저렴한 QR/결제 표준 | 일치 | [Solana Pay](https://solana.com/docs/tools/solana-pay), [accept payments](https://solana.com/docs/payments/accept-payments) | 결제 요청뿐 아니라 수취 측 verification 구현 |
| 전반 | pay.sh·Solana Pay·x402를 실제 유스케이스에 녹인 구현이 중요 | 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 Solana 결제·프로토콜 통합과 실제 tx를 평가 | 이름 나열 대신 한 end-to-end tx와 로그로 증명 |
| 전반 | 특정 파트너·70+ API·시장 수치 | 공식 근거 없음 | 본 조사에서 대조한 [pay.sh 공식 문서](https://pay.sh/docs)만으로 슬라이드 시점의 모든 수치를 재현하지 못함 | 날짜와 원문 링크가 있는 경우에만 외부 주장에 사용 |

## 결론

Solana network 역할과 낮은 수수료 방향은 대체로 맞다. 가장 큰 보정은 pay.sh의 `no account/no key` 메시지다. 공급자별 가입은 줄지만 로컬 지갑·설정·자금·사용자 승인은 남는다. sandbox 성공은 제출용 실제 트랜잭션 증거와 분리한다.
