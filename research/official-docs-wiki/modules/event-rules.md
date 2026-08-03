# 행사 규칙: 제출 계약을 제품 수용 기준으로 바꾸기

이 문서는 발표 자료의 기억이 아니라 [공식 행사 페이지와 Luma에서 확인한 계약](../sources/event-contract.md)을 기준으로, 제출 책임자가 오늘 무엇을 닫아야 하는지 설명한다.

## 행사 주제

행사는 **Solana 기반 Agentic Commerce 단일 트랙**이다. 목표는 추천만 하는 챗봇을 넘어, AI 에이전트가 정해진 한도 안에서 판단하고 결제·정산까지 실행하는 제품을 만드는 것이다.

공식 페이지의 A~D는 별도 트랙이 아니라 아이디어 범주다.

| 아이디어 범주 | 독자가 물어야 할 질문 |
|---|---|
| Agent-Initiated Commerce | 사용자의 반복 승인을 줄이면서 에이전트가 어떤 결제를 시작하는가? |
| Autonomous On-chain Settlement | 예산·정책 안에서 어떤 서명·정산을 자동화하는가? |
| Multi-Agent Commerce | 여러 에이전트가 무엇을 협상하고 주문·결제를 어떻게 연결하는가? |
| Verifiable Distribution at Scale | 자격 판정부터 지급·정산까지 무엇을 검증 가능하게 만드는가? |

Mandate Pool은 첫 세 범주의 교차점에 있다. 세 구매자의 조건을 합의하고, 각 한도를 보존한 하나의 원자적 Solana 거래를 실행한다. 범주 이름보다 이 인과관계를 데모로 증명해야 한다.

## 현재 제출 계약

| 항목 | 공식 페이지의 현재 상태 | 실행 기준 |
|---|---|---|
| 제출 마감 | 2026-08-03 23:59 KST | 제출 완료 화면과 commit SHA를 마감 전에 보존 |
| 파이널리스트 발표 | 2026-08-07 | 연락 채널과 저장소 접근 권한 확인 |
| Demo Day | 2026-08-21, Google Startup Campus | 8월 20일 표기를 사용하지 않음 |
| 팀 | 개인 가능, 최대 4명 | 제출 폼의 팀원 정보를 저장소와 일치시킴 |
| 언어 | 제품은 한국어 또는 영어, 발표는 한국어 | 제품 용어와 발표 용어를 한 벌로 정리 |
| 필수 상위 제출물 | 제품 소개서, GitHub 저장소, 데모 영상 | 세 항목을 하나의 제출 묶음으로 관리 |
| 라이브 URL | 권장 | 비공개라면 심사자 접근 방법을 명시; 필수라고 과장하지 않음 |
| 실행 네트워크 | localnet·testnet·Devnet live | Mainnet과 실제 자산을 추가하지 않음 |
| 실제 작동 | 에이전트가 트랜잭션을 발생시키고 결제를 완료하며 로그·이력으로 확인 가능 | agent trace, tx signature, network, mint, recipient, amount, confirmation 연결 |
| 심사 | 혁신·UX, Gemini/GCP AI, Solana·GCP·프로토콜 통합, 실제 구동 | 기술 이름 수가 아니라 end-to-end 인과 증거로 설명 |

## 최소 제출 증거

```text
사용자 조건·한도
  -> 에이전트의 구조화 제안
  -> 역할별 HITL 확인
  -> 결정론적 정책 판정
  -> 동일 원문 서명과 Solana 제출
  -> finalized 거래 재검증
  -> 이용권 발급 또는 거래 없는 거부
```

정상 경로에는 Devnet signature와 Explorer 링크를, 거부 경로에는 `NO_BUY` 이유와 **거래가 생성되지 않았다는 로그**를 남긴다. fixture signature와 mock transaction ID는 위 증거를 대신하지 않는다.

## 공개 페이지에서 아직 확정할 수 없는 것

- 데모 영상의 정확한 길이
- 제품 소개서의 강제 파일 형식과 슬라이드 목차
- 개인 Gmail 계정의 참가 필수 여부
- 기존 프로젝트 재사용 허용 범위
- Mainnet 배포 의무
- mock-up의 정확한 실격 문구

이 항목은 제출 폼·약관·주최자의 서면 공지가 추가되면 확인한다. 확인 전에는 구두 Q&A나 OCR 문구만으로 하드 게이트를 만들지 않는다.

## 제출 직전 행동

1. 공식 페이지와 실제 제출 폼의 필드·파일 제한을 대조한다.
2. GitHub commit SHA, Cloud Run revision, 데모 URL, Devnet transaction receipt를 같은 제출 버전으로 고정한다.
3. README 첫 화면에 Why·What·How, 정상·거부 흐름, fixture/Devnet 경계를 둔다.
4. 영상에서 에이전트 판단과 실제 transaction 사이의 HITL·정책 검사를 생략하지 않는다.
5. 제출 완료 화면과 시각을 캡처한다.

출처가 바뀔 수 있으므로 이 모듈만 믿고 제출하지 말고 [공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)를 마지막으로 다시 확인한다.
