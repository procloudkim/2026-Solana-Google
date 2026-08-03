# 행사 계약과 일정: 제출 기준의 단일 출처

확인일: 2026-08-03

이 문서는 주최자가 공개한 현재 규칙을 제품 수용 기준으로 정규화한다. 전사·슬라이드·구두 Q&A와 충돌하면 이 문서가 연결한 공식 페이지를 우선하고, 제출 폼이나 별도 약관이 더 구체적인 조건을 제시하면 그 조건을 다시 반영한다.

## 공식 출처

- [Google Cloud × Solana AI Agentic Hackathon 공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)
- [Kickoff & Tech Session 공식 Luma 페이지](https://luma.com/gcp-solana-tech-session?locale=ko)

## 현재 계약

| 영역 | 공식 페이지에서 확인한 내용 | 프로젝트 적용 |
|---|---|---|
| 목적 | AI 에이전트가 매 단계의 사람 승인 없이 정해진 한도 안에서 결제를 처리하는 제품 | 정상 경로의 무질문 실행과 한도 밖 거부를 모두 보여줌 |
| 주제 | Solana 기반 Agentic Commerce 단일 트랙 | Mandate Pool을 공동 조건 합의와 원자적 정산 문제로 설명 |
| 아이디어 범주 | Agent-Initiated Commerce, Autonomous On-chain Settlement, Multi-Agent Commerce, Verifiable Distribution at Scale | 독립 트랙으로 오해하지 않고 해당 책임만 연결 |
| 빌드 기간 | 2026-07-17~2026-08-03 | 제출 commit과 배포 revision 고정 |
| 제출 마감 | 2026-08-03 23:59 KST | 완료 화면과 시각 보존 |
| 파이널리스트 | 2026-08-07 발표, 약 10팀 | 연락 채널 확인 |
| 멘토링 | 2026-08-10~2026-08-20 | 결선 진출 시 개선 기간으로 사용 |
| Demo Day | 2026-08-21, Google Startup Campus | 8월 20일 표기 제거 |
| 팀·언어 | 개인 가능, 최대 4명; 제품 한/영, 발표 한국어 | 제출 메타데이터와 발표 준비에 반영 |
| 제출물 | 제품 소개서, GitHub repository, 데모 영상 | 세 항목을 최소 제출 묶음으로 관리 |
| 라이브 배포 | endpoint 제출 권장 | 재현성 증거로 제공하되 필수라고 단정하지 않음 |
| 심사 | 혁신·UX, Gemini/GCP AI 활용, Solana·GCP·결제/agent protocol 통합, 실제 구동 | end-to-end 인과 흐름과 실패 경계로 설명 |
| 실행 증거 | localnet·testnet·Devnet live에서 에이전트가 실제 transaction을 발생시키고 결제를 완료하며 로그·이력으로 확인 | Devnet signature와 app trace를 같은 주문에 연결 |
| 상금 | 총 USD 5,000: 1위 3,000, 2위 1,500, 3위 500 | 수령 조건을 팀 계획에서 별도 확인 |

FAQ는 상금이 Solana Foundation Grants Program을 통해 지급되며 절반은 Solana 글로벌 해커톤 참여 시 지급된다고 안내한다. 이는 구현 수용 기준이 아니라 수령 조건이므로 제품 설계와 섞지 않는다.

## 공식 페이지가 확정하지 않은 세부사항

현재 공개 페이지에서 다음을 확인하지 못했다.

- 데모 영상 정확히 3분
- 특정 PPT 형식·필수 목차·아키텍처 도식
- 개인 Gmail 계정의 참가 필수 여부
- 기존 프로젝트 재사용 허용 범위
- Mainnet 배포 의무
- mock-up의 정확한 실격 문구

`확인하지 못함`은 금지 또는 허용을 뜻하지 않는다. 제출 폼·약관·주최자 서면 답변을 확인하기 전까지 이 항목에 의존하지 않는다.

## Mandate Pool 수용 기준

```text
조건 입력
  -> Gemini/ADK 제안
  -> A/B/C HITL 확인
  -> deterministic policy PASS
  -> one Solana Devnet transaction
  -> finalized verification
  -> entitlement
```

정상 경로뿐 아니라 한도 불일치 시 거래가 생성되지 않는 거부 경로도 보존한다. fixture 결과는 제품 흐름 증거일 수 있지만 온체인 실행 증거라고 표현하지 않는다.

## 제출 전 재확인

행사 페이지는 변경될 수 있다. 제출 직전에 일정, form field, file size·format, repository visibility, live endpoint access를 실제 제출 UI에서 다시 확인하고 [행사 규칙 모듈](../modules/event-rules.md)에 현재 상태를 반영한다.
