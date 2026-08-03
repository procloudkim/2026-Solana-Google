# Official Docs Wiki 검증 보고서

이 보고서는 위키의 **문서·참조 무결성**을 설명한다. 제품이 배포됐거나 결제가 성공했다는 런타임 인증서가 아니다.

- 구조화 데이터 생성·전수 검사: 2026-07-23
- 고영향 공식 사실 재검토 및 문서 윤문: 2026-08-03

## 검증 대상과 목적

입력은 전사 3개와 PDF OCR 3개다. 이 자료의 고영향 주장을 공식 행사 페이지와 각 기술 관리 주체의 1차 문서에 대조했다. 결과는 사람이 읽는 비교 문서와 기계가 읽는 manifest·claim ledger로 나눠, 사실 판정과 구현 결정을 추적할 수 있게 했다.

원본과 `research/official-docs-wiki/` 밖의 enrichment 산출물은 수정하지 않았다.

## 구조 검증 결과

| 검사 | 결과 | 의미 |
|---|---|---|
| `manifest.json` JSON 파싱 | PASS | 입력 artifact와 공식 출처 목록을 기계가 읽을 수 있음 |
| `claim-ledger.json` JSON 파싱 | PASS | 비교 판정 37개를 기계가 읽을 수 있음 |
| claim이 참조한 미등록 source ID | 0 | 판정에서 존재하지 않는 출처 ID를 사용하지 않음 |
| 누락된 입력 artifact | 0 | 비교 대상 6개가 모두 존재함 |
| 비교 페이지 | 6 | 각 입력 artifact에 대응함 |
| 공식 출처 노트 | 7 | 행사·클라우드·결제·프로토콜 근거를 분리함 |
| 주제 모듈 | 4 | 제출·인프라·결제·프로토콜 결정으로 재구성함 |
| 로컬 Markdown 링크 | PASS | 저장소 내부 참조의 대상 파일이 존재함 |
| 외부 URL transport 재검사 | PASS | 공식·참조 URL 34개는 HTTP 200, pay.sh debugger 예제는 의도한 HTTP 402 |

2026-07-23에는 manifest에 등록된 공식 URL 26개가 redirect 이후 HTTP 200을 반환했다. 2026-08-03에는 윤문된 Markdown의 외부 URL 35개를 다시 검사했다. 공식·참조 문서 34개는 HTTP 200이었고 `https://debugger.pay.sh/mpp/quote/AAPL`은 결제 challenge 예제의 정상 동작인 HTTP 402를 반환했다. 같은 날 행사 규칙, Google Cloud·Gemini 과금, Solana 클러스터·수수료·결제 검증, pay.sh setup·sandbox, x402 v2, MPP, AP2·A2A·MCP·UCP·ACP의 고영향 문구를 공식 원문으로 다시 확인했다.

## 판정 절차

1. 전사 timestamp 또는 OCR page에서 검증할 주장을 분리한다.
2. 검색 결과가 아니라 주최자나 규격 관리 주체의 공식 원문을 찾는다.
3. 같은 의미인지, 조건이 빠졌는지, 직접 상충하는지, 버전이 달라졌는지 판정한다.
4. 공식 문서가 침묵하면 `공식 근거 없음`으로 남긴다. 거짓이라고 추정하지 않는다.
5. 판정을 제품의 구현·검증·제출 행동으로 바꾼다.

## 이번 재검토에서 바로잡은 핵심

- 행사는 네 개의 독립 트랙이 아니라 **Solana 기반 Agentic Commerce 단일 트랙**이다. A~D는 아이디어 범주다.
- x402 v2는 `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`와 CAIP-2 network ID를 사용한다.
- pay.sh sandbox는 real funds 대신 임시 로컬 계정을 사용하며, 실제 결제는 local user authorization을 요구한다.
- Google Cloud Welcome credit과 Gemini API 과금은 같은 예산이 아니다.
- AP2 샘플이 ADK와 Gemini를 사용해도 AP2 규격 자체는 둘에 종속되지 않는다.

## 재검증 방법

문서를 바꾸거나 제출하기 전 다음 순서로 확인한다.

1. [공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)의 일정·제출물·심사 기준을 다시 읽는다.
2. `manifest.json`과 `claim-ledger.json`을 JSON parser로 읽고 모든 `source_ids`가 manifest에 존재하는지 검사한다.
3. Markdown 상대 링크를 각 파일 위치 기준으로 resolve해 대상 존재를 확인한다.
4. 사용 중인 SDK·protocol의 공식 latest 또는 고정 버전 문서를 확인한다.
5. 날짜가 바뀐 사실은 기존 상태 문구를 교체하고, 과거와 현재를 한 문서에 중복 보존하지 않는다.

## 증거 경계와 남은 불확실성

- HTTP 200은 페이지 접근 가능성을 뜻할 뿐, 내용의 정확성이나 불변성을 보장하지 않는다.
- `공식 근거 없음`은 반증이 아니다. 제출 폼·약관·주최자 서면 공지가 나오면 다시 판정한다.
- 이 검증은 Cloud Run 배포, Gemini 호출, wallet authorization, Solana transaction을 실행하지 않았다.
- 실제 제품 증거는 network, mint, amount, recipient, signature, confirmation, agent decision trace를 포함한 별도 receipt로 보존해야 한다.
