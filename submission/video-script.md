# Mandate Pool 데모 영상 대본과 스토리보드

> 목표 길이 `2분 50초`, 상한 `3분`. 공식 공개 페이지가 정확한 영상 길이를 확정하지 않았으므로, 3분 이하는 이 프로젝트의 안전한 편집 기본값이다.

## 녹화 전 사용법

이 대본은 실제 증거를 **만드는 절차**가 아니라, 이미 승인·검증된 한 번의 실행을 짧게 설명하는 편집 원고다. 정상 결제를 영상 때문에 다시 실행하지 않는다. 명시적 HITL로 승인된 1회 실행을 동시에 캡처했거나, 그 실행의 저장된 UI·API receipt·Explorer를 읽기 전용으로 재생한다.

다음 항목이 준비되지 않으면 녹화를 시작하지 않는다.

- `submission/manifest.md`의 정상·거부·release 필수 슬롯
- 총 1 Devnet 테스트 USDC 코드와 연결된 commit·Cloud Run revision
- 정상 경로 finalized receipt와 거부 경로 no-transaction receipt
- 비밀정보가 제거된 ADK/Gemini trace와 API 화면

## 2분 50초 타임라인

| 시간 | 화면·조작 | 한국어 내레이션 | 화면에 남길 증거 |
|---|---|---|---|
| `0:00–0:14` | 제목과 한 줄 가치 제안. 우측 상단에 `SOLANA DEVNET · TEST TOKENS` 고정. | “여러 사람의 구매를 대신하는 AI에게 필요한 것은 추천보다 권한의 경계입니다. Mandate Pool은 세 사람의 조건이 모두 맞을 때만 세 결제를 하나로 묶습니다.” | 제품명, Devnet test-token 표기 |
| `0:14–0:32` | A/B/C 자연어 조건과 각 한도를 한 화면에 보여준다. | “A는 API와 CSV, B는 API와 자동갱신 금지, C는 7일 일회성 이용을 요구합니다. 각자 정한 금액 한도도 끝까지 보존해야 합니다.” | A/B/C 원문, 정상 한도 `400000/340000/400000` atomic |
| `0:32–0:52` | redacted ADK/Gemini trace → A/B/C 승인 카드 → 정책 검사 순서. 승인 버튼을 새로 누르지 않아도 저장된 timeline으로 설명 가능. | “Google ADK와 Gemini는 조건을 구조화하고 상품을 제안할 뿐, 서명하거나 RPC를 호출하지 않습니다. 이 버전에서는 운영자 한 명이 A, B, C 역할을 순차 확인하고, 결정론적 정책이 승인과 한도, 상품, 만료, 분담액을 다시 계산합니다.” | provider/model·trace 시각, 세 approval event, policy 결과. prompt·token·key는 가림 |
| `0:52–1:17` | **거부 receipt**를 먼저 연다. B cap `300000`, `state=NO_BUY`, evidence 없음, entitlement 0, 전후 잔액 불변을 차례로 확대. | “먼저 결제하면 안 되는 경우입니다. B의 한도를 0.3 USDC로 낮추면 필요한 0.333333보다 작습니다. 결과는 NO_BUY이고 settlement evidence와 signature가 없으며, 이용권은 0개, 네 계정의 잔액도 그대로입니다. 오류 화면이 아니라 거래가 없다는 증거입니다.” | `ord_82ac0530d4744e098f181aa5460e6027`, `NO_BUY`, `NO_COMMON_PRODUCT`, pre/post 동일 snapshot |
| `1:17–1:42` | **별도 정상 주문**의 세 approval과 PASS, quote를 보여준다. 결제 버튼 재클릭 금지. | “이제 별도 정상 주문입니다. 세 mandate가 모두 맞으면 총 1 Devnet 테스트 USDC를 정수 단위로 나눕니다. A가 333334, B와 C가 각각 333333을 부담하고, 정책이 같은 계산을 독립적으로 확인합니다.” | `ord_b6ab984c23334cb0a3f8480d4c12abf9`, quote·policy hash, `333334/333333/333333` |
| `1:42–2:08` | 저장된 transaction 요약과 state timeline을 보여준다. raw bytes 전체는 노출하지 않는다. | “통과한 quote만 세 개의 TransferChecked를 담은 Solana version-0 transaction 하나가 됩니다. Sponsor와 A, B, C는 같은 메시지에 서명합니다. 이 한 거래가 확정되거나 전체가 실패하므로 구매자 한 명만 결제되는 상태를 만들지 않습니다.” | message hash, signer 4명, transfer 3개, memo 1개, signature short form |
| `2:08–2:34` | 실제 Devnet Explorer와 redacted 정상 receipt를 나란히 보여준다. signature 검색 또는 저장된 링크 열기만 수행. | “현재 signature는 Solana Devnet에서 finalized됐습니다. 저장된 원문과 온체인 instruction이 같고, A, B, C의 debit 합계와 Merchant의 1000000 credit이 일치한 뒤에만 이용권 세 개가 발급됐습니다. Devnet USDC는 테스트 토큰이며 실제 돈이 아닙니다.” | `2JMWb2wc4GTt…wDt2jaMy2ZAW`, `finalized`, slot `480936920`, `meta.err=null`, exact pre/post delta, entitlement count 3 |
| `2:34–2:50` | 아키텍처 요약과 한계·링크 엔드카드. | “현재 HITL은 세 실제 사용자의 독립 서명이 아니라 운영자 시뮬레이션이고, 테스트 키도 서버가 보관합니다. 그 한계를 숨기지 않습니다. Mandate Pool의 핵심은 명확합니다. 모두의 권한을 만족하면 하나의 거래로, 한 명이라도 벗어나면 거래 없이 끝냅니다.” | commit, revision, Repo, Explorer, evidence manifest URL |

## 촬영·편집 규칙

1. 정상과 거부는 서로 다른 order ID를 사용하며, 각 장면의 order ID를 receipt와 대조한다.
2. 정상 장면은 승인된 **단 한 번의** Devnet 실행 또는 그 결과의 읽기 전용 재생만 사용한다. 영상용 재결제를 하지 않는다.
3. 화면에 `X-Demo-Key`, Google ID token, signer secret, `.env`, entitlement token, 브라우저 자동완성 값을 노출하지 않는다.
4. fixture를 보조 화면으로 쓰면 전체 장면에 `FIXTURE · NOT ON-CHAIN`을 유지하고, 실제 Devnet 장면과 컷·자막을 분리한다.
5. Explorer만으로 제품 성공을 판정하지 않는다. 같은 order의 quote·policy·message hash, decoded transaction, 잔액 delta, entitlement 결과를 receipt로 연결한다.
6. 거부 UI만으로 no-transaction을 판정하지 않는다. API의 settlement evidence·signature 부재와 전후 잔액 불변을 함께 보여준다.
7. 최종 영상의 실제 길이와 URL은 업로드 직후 `submission/manifest.md`에 기록한다. `3:00.000`을 넘으면 제출하지 않는다.

## 녹화 중 중단 조건

- 실제 화면과 대본의 order ID·commit·revision 중 하나라도 다름
- Explorer가 `finalized`가 아니거나 `meta.err`가 `null`이 아님
- 정상 debit·credit이 `333334/333333/333333/1000000`과 다름
- 거부 응답에 settlement evidence, transaction bytes, signature 또는 entitlement가 존재함
- secret·token·개인키 payload가 프레임 또는 오디오에 들어감
- 응답이 불명확해 재실행하고 싶어짐: 재실행하지 말고 기존 signature를 먼저 조정

중단 뒤 문제를 수정해 새로운 증거 묶음을 만들고, 이전 장면과 섞지 않는다.
