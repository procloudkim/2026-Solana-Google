# Validation Report

검증일: 2026-07-23

## 범위

- 입력 전사 3개와 PDF OCR 3개의 존재를 확인했다.
- `research/official-docs-wiki/` 밖의 원본·enrichment 파일은 수정하지 않았다.
- 공식 출처 26개를 manifest에 등록했다.
- 비교 판정 37개를 claim ledger에 구조화했다.

## 결과

| 검사 | 결과 |
|---|---|
| `manifest.json` 파싱 | PASS |
| `claim-ledger.json` 파싱 | PASS |
| claim이 참조한 미등록 source ID | 0 |
| 깨진 로컬 Markdown 링크 | 0 |
| 누락된 입력 artifact | 0 |
| 비교 페이지 | 6 |
| 공식 문서 추출 note | 7 |
| 주제 module | 4 |
| 공식 URL transport check | 26/26 HTTP 200 |

## 검증 방법

PowerShell에서 두 JSON을 `ConvertFrom-Json`으로 파싱하고, manifest의 source ID 집합과 모든 claim의 `source_ids`를 대조했다. 모든 Markdown 상대 링크를 각 파일의 디렉터리 기준으로 resolve해 실제 파일 존재 여부를 확인했다. 공식 URL은 redirect를 따라 transport 상태를 검사했다.

## 증거 경계

- HTTP 200은 페이지 접근 가능성 증거이며 모든 페이지 의미의 불변성을 보장하지 않는다.
- 이 검증은 문서·링크·참조 무결성 검사다. 실제 Cloud Run 배포, Gemini 과금, pay.sh 지갑 승인, Solana 트랜잭션 성공을 실행하지 않았다.
- 행사 페이지와 프로토콜 규격은 바뀔 수 있으므로 제출 및 구현 직전에 `as_of`를 갱신해야 한다.
