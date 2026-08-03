# 03. Q&A 전사 대조

원본: [2026-07-21 20-31-25 전사](../../../.harness/enrichment/transcripts/2026-07-21-20-31-25-495a3baab6.md)

주의: speaker label이 없고, 구두 약속과 공식 공개 계약을 구분해야 한다.

| 위치 | 로컬 문서의 주장 | 판정 | 현재 공식 근거 | 적용 조치 |
|---|---|---|---|---|
| 01:12~01:17 | 빌드위크가 3/3까지 | **상충** | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 8/3 23:59 KST 마감 | 전사 오류 또는 잘못 들은 날짜로 처리 |
| 03:10~03:28 | pay.sh/x402/Solana Pay가 아니어도 Solana smart contract 결제를 직접 구현 가능 | 부분 일치 | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 Solana 결제 통합을 평가하고 예시 스택을 제시하지만 특정 한 프로토콜만 강제하지 않음 | 직접 구현 시 agent-triggered payment와 verification을 명확히 증명 |
| 04:01~04:43 | 기존 오픈소스/프로젝트를 확장해 참가 가능 | 공식 근거 없음 | 현재 [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)에는 재사용 범위가 명시되지 않음 | 구두 Q&A 기록으로 보존하되 제출 폼/주최자 서면 확인 필요 |
| 04:46~05:18 | ADK/Vertex 같은 복잡한 스택 자체가 목표는 아님 | 부분 일치 | 현재 [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 AI 활용과 통합 품질을 평가; [ADK](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/adk)는 선택 가능한 프레임워크 | 단순 호출만으로 agent autonomy를 주장하지 말고 필요한 만큼만 구성 |
| 05:40~05:54, 08:38~08:52 | Mainnet 불필요, Devnet으로 충분 | 일치 | 현재 [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 localnet/testnet/devnet live를 허용; [Solana core](https://solana.com/docs/core)도 Devnet을 개발자 실험용으로 정의 | Devnet tx로 제출 증거 구성 가능 |
| 00:09~00:38 | faucet이 하루 0.5~5 SOL 제한이고 Discord에서 추가 지급 | 공식 근거 없음 | [Solana core](https://solana.com/docs/core)와 현재 행사 페이지에는 이 행사별 수량 보장이 없음 | 자금 조달 계획을 구두 수량에 의존하지 않음 |
| 08:10~08:33 | USD 300은 신규 계정에 한함 | 부분 일치 | [Google Cloud Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features)은 신규 사용자 자격 조건을 둠 | 자격 확인 후 별도 비용 fallback 마련 |
| 09:06~09:30 | Gemini 초과 사용분에 별도 크레딧을 제공할 수 있음 | 공식 근거 없음 | [Gemini billing](https://ai.google.dev/gemini-api/docs/billing/)과 현재 행사 페이지에 주최자의 개별 추가 지급 보장이 없음 | 예산에 포함하지 말고 서면 voucher가 있을 때만 반영 |
| 12:36~13:36 | 개인키를 agent에 주지 않고 생체 승인을 요구하므로 prompt injection을 막음 | **부분 일치** | [pay.sh docs](https://pay.sh/docs)는 local wallet authorization을 설명하지만 일반적 prompt-injection 방어를 보장하지 않음 | spending limit, allowlist, human approval, prompt isolation, audit log를 별도 통제로 구현 |

## 결론

Devnet 허용과 기술 선택의 유연성은 현재 공식 방향과 맞는다. 기존 프로젝트 허용, 추가 SOL·Gemini 크레딧, prompt-injection 방어 보장은 공개 공식 계약에 없으므로 구두 참고사항으로만 보존해야 한다.
