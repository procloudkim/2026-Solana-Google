# 03. Q&A 전사 대조

이 문서는 구두 Q&A를 구현·제출 규칙으로 바로 승격할 때 생기는 위험을 정리한다. 공개 계약과 일치하는 안내는 사용하되, 기존 프로젝트 허용·추가 faucet·추가 Gemini credit처럼 공식 페이지에 없는 약속에는 의존하지 않는다.

- 원본: [2026-07-21 20-31-25 전사](../../../.harness/enrichment/transcripts/2026-07-21-20-31-25-495a3baab6.md)
- 비교 데이터: 2026-07-23
- 고영향 공식 사실 재확인: 2026-08-03

전사에는 speaker label이 없다. 따라서 화자의 권한을 추정하지 않고 현재 공개된 공식 문서와 비교한다.

## 판정과 조치

| 위치 | Q&A에서 읽힌 주장 | 판정 | 공식 근거와 보정 | 실행 조치 |
|---|---|---|---|---|
| 01:12~01:17 | 빌드위크가 3/3까지 | **상충** | [행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)는 8/3 23:59 KST 마감 | 전사 오류로 처리하고 마감 기준에서 제거 |
| 03:10~03:28 | pay.sh/x402/Solana Pay가 아니어도 custom Solana payment 가능 | 부분 일치 | 행사 페이지는 Solana payment integration을 평가하지만 특정 rail 하나를 강제하지 않음 | custom path의 agent trigger·authorization·verification을 증명 |
| 04:01~04:43 | 기존 open source/project 확장 가능 | 공식 근거 없음 | 현재 행사 페이지에 재사용 범위가 없음 | 제출 폼·주최자 서면 확인 전까지 허용 규칙으로 인용하지 않음 |
| 04:46~05:18 | ADK/Vertex 같은 복잡한 stack 자체가 목표는 아님 | 부분 일치 | 행사는 AI 활용과 integration 품질을 평가하고 [ADK](https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/adk)는 선택 가능한 framework | 필요한 책임만 구현하고 agent behavior를 trace로 증명 |
| 05:40~05:54, 08:38~08:52 | Mainnet 불필요, Devnet 충분 | 일치 | 행사 페이지는 localnet·testnet·Devnet live를 허용하고 [Solana core](https://solana.com/docs/core)는 Devnet을 developer experimentation으로 정의 | Devnet receipt로 제출 proof 구성 |
| 00:09~00:38 | faucet 하루 0.5~5 SOL, Discord 추가 지급 | 공식 근거 없음 | Solana core와 행사 페이지는 행사별 수량을 보장하지 않음 | 잔액을 미리 점검하고 구두 수량을 budget plan에 넣지 않음 |
| 08:10~08:33 | USD 300은 신규 계정에 한함 | 부분 일치 | [Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features)은 더 구체적인 자격 조건을 둠 | 계정 자격과 만료를 콘솔에서 확인 |
| 09:06~09:30 | Gemini 초과분 추가 credit 제공 가능 | 공식 근거 없음 | [Gemini billing](https://ai.google.dev/gemini-api/docs/billing/)과 행사 페이지에 지급 보장이 없음 | 서면 voucher 전에는 예산에 포함하지 않음 |
| 12:36~13:36 | 생체 승인으로 prompt injection을 막음 | 부분 일치 | [pay.sh docs](https://pay.sh/docs)는 local wallet authorization을 설명하지만 일반적 prompt-injection 방어를 보장하지 않음 | cap·allowlist·HITL·prompt isolation·exact message verification·audit log를 별도 구현 |

## Mandate Pool 결정

custom Solana settlement 선택은 행사 취지와 양립한다. 다만 `mandate`와 `agent`라는 이름만으로 protocol compliance나 보안을 주장하지 않는다. 현재 HITL은 한 명의 operator가 A/B/C 역할을 순서대로 확인하는 simulation이며, buyer별 독립 identity proof는 후속 과제라고 공개한다.

## 실행 항목

1. 추가 SOL·Gemini credit 없이도 한 번의 정상 Devnet demo가 가능한 잔액을 유지한다.
2. 기존 code 재사용 범위가 질문되면 commit history와 새 작업 범위를 투명하게 제시하고 주최자 서면 답변을 보존한다.
3. 생체 인증 또는 wallet approval을 단일 보안 해법으로 설명하지 않는다.
4. Devnet 허용을 `실제 돈 사용`으로 오해하지 않도록 test-token 경계를 표시한다.

구두 안내는 유용한 맥락이지만 공개 계약을 대체하지 않는다. 공식 근거가 없는 항목은 거짓이 아니라 **제출 의존성으로 사용하기에 미확정**이다.
