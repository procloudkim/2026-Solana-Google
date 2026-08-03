# 모듈: 행사 규칙

근거: [행사 계약 추출본](../sources/event-contract.md)

## 현재 제출 계약

| 항목 | 현재 공식 상태 | 구현에 적용할 기준 |
|---|---|---|
| 마감 | 2026-08-03 23:59 KST | 이 시각 이전 제출 완료 증거 보관 |
| Demo Day | 2026-08-21 | 8월 20일 표기는 사용하지 않음 |
| 팀 | 최대 4명, 개인 가능 | 팀원 수 4 이하 |
| 제출물 | 제품 소개, GitHub, 데모 영상 | 세 항목을 최소 제출 묶음으로 관리 |
| 라이브 URL | 권장 | 있으면 가점·재현성 증거로 제공하되 필수라 단정하지 않음 |
| 실행 네트워크 | localnet/testnet/devnet live | Mainnet을 억지로 추가하지 않음 |
| 실행 증거 | 에이전트가 트랜잭션을 야기하고 결제 완료, 로그/이력으로 확인 | tx signature, network, recipient, amount, status, agent decision trace 보관 |
| 기술 요소 | Gemini/GCP AI, Solana 결제, 관련 프로토콜 통합을 평가 | “목록 전부 의무”가 아니라 설계 근거와 실제 통합 품질로 증명 |

## 현재 공식 페이지에 없는 항목

- 데모 영상 정확히 3분
- 제품 소개 자료의 강제 슬라이드 목차
- 개인 Gmail 계정 필수
- 기존 프로젝트 재사용 허용 범위
- Mainnet 배포 필수

이 항목은 제출 폼, 공식 약관, 주최자 공지가 추가되면 다시 확인한다. 구두 Q&A만으로 저장소의 하드 게이트를 만들지 않는다.

## 최소 증거 묶음

```text
agent decision
  -> payment request/challenge
  -> signed authorization
  -> Solana transaction signature
  -> network confirmation
  -> application receipt/log
```

샌드박스 응답, UI 애니메이션, mock transaction id만으로 위 묶음을 대체하지 않는다.
