# HITL·디자인씽킹 의사결정 보고서 검증 메모

- 검증 시각: 2026-08-02 14:34 KST
- 검증 대상: `agentic-commerce-hitl-design-decision.artifact.json`, 렌더링 HTML, 원문 Markdown, live probe 기록
- 최종 판정: **Share with caveats**

보고서의 의사결정 구조와 출처 추적성은 공유 가능한 수준이다. 다만 선두 제품은 아직 target-user 문제 증거와 실제 `payment → settlement → fulfillment` 폐쇄루프를 통과하지 않았으므로 **validated product**나 **winner**로 표현하면 안 된다. 현재 정확한 상태는 **시간 제한이 있는 선두 가설**이다.

## 1. 요청 충족성

| 요청 | 확인 결과 | 판정 |
|---|---|---|
| 필수 HITL 검증·구분 | `H-PRE`, `A-NORMAL`, `H-EXC`, `H-DOMAIN`, `H-POST`, `D-DENY`, `X-NOGO` 7개 모드와 이유코드를 분리했다. | 통과 |
| Stanford 디자인씽킹 기반 재선별 | Empathize·Define·Ideate·Prototype·Test별 증거와 공백을 명시하고 POV/HMW를 다시 만들었다. | 통과, 단 Empathize는 desk evidence |
| 기존 후보 재선별 | standalone Mandate Repair와 ReproPay를 탈락시키고 lead·switch·park 세 lane으로 축소했다. | 통과 |
| 새로운 기회 발굴 | 기존 목록 대비 신작 또는 문제 중심이 달라진 기회 16개를 기록했다. | 통과 |
| HITL 검증 가능성 | 9개 acceptance test와 네 데모 경로의 `0·0·1·0` prompt 계약을 사전 등록했다. | 통과 |

## 2. 근거·방법 검증

| 항목 | 확인 | 남는 위험 |
|---|---|---|
| 해커톤 요구 | 공식 사이트와 배포 asset을 직접 확인해 one-track, autonomous payment, Gemini/GCP, Solana integration, live transaction/log 기준과 2026-08-03 23:59 KST 마감을 사용했다. | 제출 직전 변경 여부 재확인 필요 |
| 디자인씽킹 방법 | Stanford d.school Bootleg과 Method Cards의 5 modes, POV/HMW, 저해상도 prototype, user test 원칙을 사용했다. | 사용자 인터뷰를 했다는 주장은 금지 |
| HITL 통제 | AP2의 human-present/not-present, mandate constraint, verification·receipt 원칙과 NIST의 역할·감독 구분을 비교했다. | full AP2 conformance는 아님 |
| 공급자 availability | QuickNode와 BigQuery에서 실제 HTTP 402 offer를 관측했다. Document AI는 같은 날 HTTP 500을 관측했다. | offer 관측은 결제·정산·결과 성공이 아님 |
| 후보 판정 | 사용자·심사·운영·안전·사업 렌즈를 독립 판정하고 평균 점수로 불확실성을 숨기지 않았다. | 사용자·사업 렌즈는 여전히 Unclear |

선두를 바꿀 수 있는 반증도 보존했다. QuickNode fulfillment가 닫히지 않으면 RPC vertical을 버리고 `Query-to-Act` 한 번만 확인한다. Document AI는 endpoint와 실제 AP authority가 회복되기 전까지 보류한다.

## 3. 데이터·논리 spot check

- artifact JSON parse: 통과.
- 보고서 구성: blocks 20, charts 1, tables 5, sources 18.
- snapshot row count: opportunities 16, HITL modes 7, demo paths 4, Prism lenses 5, shortlist lanes 3, acceptance tests 9.
- 모든 정상 in-mandate 경로는 동기 승인 0회다. 누락 authority field만 1회 질문한다.
- invalid signature/hash, replay, expiry·revocation은 사람에게 올리지 않고 hard deny한다.
- 외부 권리·seller authority·재고 진실이 없으면 일반 HITL로 가장하지 않고 no-go한다.
- 후보별 우승 확률이나 품질 점수는 관측 데이터가 없으므로 계산하지 않았다.
- `ReproPay`는 검증 격리·게임 가능성·마감 위험 때문에 backup에서도 제거되었다.

## 4. 시각화·렌더링 QA

유일한 차트는 후보 점수표가 아니라 네 데모 경로의 **사전 등록 acceptance contract**다. `human_prompts` 값은 `0, 0, 1, 0`이며 관측 성과로 표시하지 않았다. 후보 우열을 보여 주는 수치 차트는 데이터가 없어 의도적으로 제외했다.

최종 HTML은 원본 JSON과 대조해 검증했다.

- 데스크톱 1440px와 모바일 390px: 통과
- horizontal overflow: 통과
- source dialog와 keyboard semantic interaction: 통과
- embedded blocks·chart·tables 개수 대조: 통과
- 외부 runtime/network 의존 없는 단일 HTML: 통과

초기 빌드에서 공용 reader의 `100vw` top bar가 세로 스크롤바 폭만큼 overflow를 만들었다. 산출물 내부에 범위를 제한한 `width: 100%` override를 추가한 뒤 같은 verifier를 재실행해 통과했다. 보고서 내용·embedded artifact는 변경하지 않았다.

## 5. 공유 시 필수 caveat

1. “우승 후보 확정”이 아니라 “현재 증거에서 가장 먼저 닫아야 할 선두 가설”이라고 말한다.
2. 사용자 수요는 마지막 실제 incident 인터뷰와 카드 분류 전까지 미검증이다.
3. QuickNode·BigQuery는 402 offer까지만 관측했으며 실제 payment·fulfillment 성공을 주장하지 않는다.
4. `0·0·1·0`은 기대 성능이 아니라 실패를 판정할 계약이다.
5. API와 해커톤 페이지는 제출 직전에 다시 확인한다.

## 6. 출시 게이트

다음 두 증거가 모두 생기기 전에는 제품 후보를 동결하지 않는다.

1. target user가 자신의 마지막 자동화 결제 사건을 제시하고, `묻지 말고 실행 / 반드시 질문 / 무조건 차단` 카드 분류에서 one-field patch를 선택한다.
2. QuickNode Solana Devnet에서 실제 `402 → payment → settlement/session → valid RPC result`와 연결된 tx·receipt·fulfillment trace가 생성된다.

둘 중 하나라도 실패하면 실패 원인을 숨기기 위해 HITL을 늘리지 않는다. RPC 가설을 폐기하거나 authority 경계를 다시 정의한다.
