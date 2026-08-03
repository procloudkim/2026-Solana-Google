# Mandate Pool 제출 증거 manifest

> 이 문서는 소개서·코드·Cloud Run·Devnet transaction·redacted receipt가 같은 검증 release를 가리키는지 확인하는 장부입니다. 제품 소개는 [루트 README](../README.md), 실행 방법은 [제품 README](../product/mandate-pool/README.md)를 먼저 읽으세요.

## 현재 판정

```text
STATUS = EVIDENCE_BUNDLE_VERIFIED
SOURCE = 2ac7eac17ea803b4537b630234ac6507523e5325
EVIDENCE = submission-v2
NETWORK = Solana Devnet · test tokens · no real value
```

배포 source commit에서 Google Cloud live readiness, 정상 Devnet 주문 한 건, 한도 초과 `NO_BUY` 주문 한 건을 검증했습니다. 정상 주문은 한 transaction으로 finalized됐고, 거부 주문에는 settlement evidence·signature·entitlement가 없습니다. 제출용 덱과 영상은 이 두 주문의 저장된 증거만 사용했으며 촬영을 위해 결제를 반복하지 않았습니다.

**사용자 보고 상태:** 제출 폼은 현재 수정할 수 없고 Cloud Run 공개 fixture URL은 폼에 포함하지 못했습니다. 심사자가 저장소에서 바로 접근할 수 있도록 [루트 README](../README.md)와 아래 산출물 지도에 공개했습니다. 저장소에는 제출 완료 화면 receipt가 없으므로 폼에 실제로 전달된 필드 전체를 독립적으로 증명하지 않습니다.

## 심사 산출물 지도

| 산출물 | 공개 링크 | 용도와 경계 |
|---|---|---|
| 데모 영상 | [YouTube · 2분 34초](https://youtu.be/of3GMQq8Qv8) | 심사용 재생 링크 |
| 고정 영상 파일 | [Google Cloud Storage MP4 · 153.58초](https://storage.googleapis.com/project-682bea5f-ac81-4a36-8a1-mandate-pool-video/mandate-pool-demo.mp4?generation=1785769358677446) | SHA-256와 media metadata를 보존한 release 원본 |
| 제품 소개서 | [6장 PDF](deck.pdf) · [원고](deck.md) | 문제, Agent 역할, 아키텍처, 정상·거부 증거, 한계 |
| GitHub | [procloudkim/2026-Solana-Google](https://github.com/procloudkim/2026-Solana-Google) | 제품 코드, 재현 방법, redacted evidence |
| 공개 데모 | [Cloud Run fixture](https://mandate-pool-judge-x7id33dnyq-du.a.run.app) | 데모 키 `judge-fixture-key-v1`; 반복 실행 가능; `FIXTURE · NOT ON-CHAIN` |
| 온체인 증거 | [Solana Devnet transaction](https://explorer.solana.com/tx/2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW?cluster=devnet) | 정상 주문의 finalized transaction |

## Release 식별자

Source와 evidence를 구분합니다. `2ac7eac`은 실제 배포·주문 실행에 사용한 코드이고, `submission-v2`는 덱·영상·redacted receipt까지 포함한 증거 release입니다. 이후 문서 개선 commit은 과거 실행의 source로 소급해 표현하지 않습니다.

| 필드 | 고정값 | 의미 |
|---|---|---|
| 배포 source commit | `2ac7eac17ea803b4537b630234ac6507523e5325` | Cloud Run image와 주문 실행의 코드 기준 |
| Evidence tag | `submission-v2` → `3062d9f210992be86b1d59bb73cad6acd2b426c7` | 영상과 제출 증거를 포함한 immutable Git tag |
| 공개 fixture revision | `mandate-pool-judge-00004-kxd` | signer·Gemini·RPC를 사용하지 않는 반복 시연 환경 |
| 비공개 live revision | `mandate-pool-live-00005-4tb` | Secret Manager signer와 인증을 사용한 검증 환경 |
| Container image digest | `sha256:5d22c850b5fb113eaff07d653368b1cfac6e8a00d49b5e1a2ebaa9a586f0b995` | 두 revision이 사용한 동일 image |
| 정상 주문 | `ord_b6ab984c23334cb0a3f8480d4c12abf9` | `FULFILLED` |
| 거부 주문 | `ord_82ac0530d4744e098f181aa5460e6027` | `NO_BUY` |
| 영상 원본 SHA-256 | `13f18c032621ffbc1b1ec55703f9f6de7f5b72e9b0921546d4405cce85a9d308` | GCS 고정 generation의 MP4 |

정상·거부 order receipt의 `baseUrl`은 `http://127.0.0.1:18080`입니다. 이는 인증된 local Cloud Run proxy를 통해 비공개 live service에서 evidence exporter를 실행한 주소이며, 공개 fixture나 로컬 fixture가 아닙니다. [deployment receipt](evidence/deployment-2ac7eac.json)의 `readinessInspection`이 이 transport 경계를 기록합니다.

source commit·revision·order receipt의 연결은 deployment receipt에 보존한 revision inspection, Firestore namespace, 실행 시각을 통한 운영상 연결입니다. order receipt 자체가 source commit을 암호학적으로 attestation하는 것은 아닙니다.

## 정상 주문 증거

정상 주문은 세 mandate, 세 역할 승인, Gemini/ADK trace, quote, policy proof, Solana message, finalized transaction, 잔액 변화, entitlement를 하나의 order ID로 연결합니다.

| 검증 항목 | 관찰값 | 근거 |
|---|---|---|
| Agent | `google-adk` · `gemini-2.5-flash` | [정상 order receipt](evidence/normal-order-2ac7eac.json) |
| 선택 상품 | `signaldesk-team-3` | 같은 receipt의 agent·selection |
| 분담 | A `333334`, B `333333`, C `333333` atomic | 합계 `1000000` |
| 상태 | `FULFILLED`; entitlement count `3` | 같은 order의 finalized 검증 이후 상태 |
| Transaction signature | `2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW` | [Solana Explorer](https://explorer.solana.com/tx/2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW?cluster=devnet) |
| Finality | slot `480936920`; `meta.err = null` | [정상 order receipt](evidence/normal-order-2ac7eac.json) |
| Token delta | A `-333334`, B `-333333`, C `-333333`, Merchant `+1000000` | [post-finalized snapshot](evidence/devnet-balance-post-normal-2ac7eac.json) |
| 사람이 읽는 proof | exact split·signature·slot·entitlement 요약 | [정상 proof image](evidence/normal-devnet-proof-2ac7eac.svg) |

정상 transaction의 quote hash는 `2738aeb50f428d72f7cf8ba3ef70a74b7ed56b16433fb8756cb354b9733faad9`, policy proof hash는 `df10b8b6d8ffdc99e89767758258a49fceea3a23fadc0d3bfeb18ec620c4b2c0`, message hash는 `02991fe143fb321ce52816423c79ded5b6abd8bdb674f3261dd044213f7b89b4`입니다. Buyer별 mandate hash와 approval 시각은 order receipt에 보존합니다. Entitlement token 원문은 공개하지 않습니다.

## 거부 주문 증거

거부 주문은 B의 최대 분담 `300000` atomic이 필요한 `333333`보다 작도록 만든 반례입니다.

| 검증 항목 | 관찰값 | 근거 |
|---|---|---|
| Agent 선택 | `NO_BUY` | [거부 order receipt](evidence/reject-order-2ac7eac.json) |
| 최종 상태 | `NO_BUY`; failure code `NO_COMMON_PRODUCT` | 같은 receipt의 response·failure·timeline |
| Settlement | redacted receipt에 settlement evidence·signature 필드 없음; exporter verdict는 `PASS` | [거부 order receipt](evidence/reject-order-2ac7eac.json), [exporter 구현](../product/mandate-pool/src/cli/evidence-export.ts) |
| Fulfillment | entitlement count `0` | 같은 receipt |
| Token delta | 관측창에서 A/B/C/Merchant 모두 net `0` | [잔액 불변 proof](evidence/reject-balance-proof-2ac7eac.json) |
| 사람이 읽는 proof | B cap·필요액·0 tx·0 entitlement 요약 | [거부 proof image](evidence/reject-proof-2ac7eac.svg) |

`NO_BUY` UI만으로 거래 부재를 주장하지 않습니다. exporter가 보존한 `PASS`·`NO_BUY`·entitlement `0`·settlement evidence/signature 미포함과, 거부 전 snapshot 및 다음 정상 거래의 pre-token balance를 비교한 net-zero 관측을 함께 사용합니다. 이 잔액 proof는 즉시 전후 snapshot이 아니라 관측창 증거입니다.

## 주장과 최소 증거

| 허용하는 주장 | 필요한 최소 증거 | 단독으로는 부족한 자료 |
|---|---|---|
| Google ADK·Gemini가 조건을 구조화하고 후보를 제안했다 | order에 연결된 provider·model·시각·selection | `/readyz`, fixture trace, 설정 화면 |
| 총 1 Devnet 테스트 USDC가 결제됐다 | finalized signature, decoded 원문, `meta.err=null`, 정확한 debit·credit | transaction build test, ATA 생성, 임의 Explorer URL |
| 한도 초과에서 거래를 만들지 않았다 | `NO_BUY`, settlement/signature 부재, 잔액 불변 | 거부 UI 한 장 |
| HITL을 거쳤다 | A/B/C 역할별 approval event와 mandate hash·nonce 결박 | 실제 세 사용자의 독립 승인이라는 표현 |
| 세 token 전송이 부분 실행되지 않는다 | 같은 transaction의 세 `TransferChecked`와 exact delta | Firestore까지 포함한 분산 원자성 주장 |
| 중복 거래 생성을 억제한다 | idempotency record, 저장된 signed bytes 재사용, 불명확 결과의 reconciliation 경로 | 상용 exactly-once 보장 |

## 증거 경계

- `Devnet 테스트 USDC`와 Devnet SOL은 실제 돈이 아닙니다. [Circle testnet 안내](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- 공개 Cloud Run은 **fixture**이며 Gemini·Firestore·Solana를 호출하지 않습니다.
- Live readiness는 의존성 접근을 증명하지만 주문 성공은 정상 order receipt와 finalized transaction이 별도로 증명합니다.
- 현재 HITL은 한 운영자가 A/B/C 역할을 순차 확인하는 **operator simulation**입니다.
- Devnet buyer key는 서버가 보관합니다. 실제 사용자별 외부 wallet 승인과 비수탁 custody는 구현하지 않았습니다.
- 결제 rail은 **custom Solana atomic settlement**입니다. x402·AP2·Solana Pay 호환을 주장하지 않습니다.
- 같은 runtime의 finalized verifier가 거래 원문과 잔액을 검증합니다. 독립 검증 서비스가 있다는 뜻은 아닙니다.
- SignalDesk와 entitlement는 고정 데모 catalog·애플리케이션 접근권입니다. 외부 merchant 판매를 증명하지 않습니다.

## Release 검증 기록

| 검사 | 고정 결과 |
|---|---|
| 제품 소스 | typecheck·Vitest `96/96`·build 통과 |
| 루트 하네스 | Python `37/37` 통과 |
| Localnet | 정상·거부 smoke receipt 통과 |
| Live readiness | `domain`, `stateRepository`, `settlement`, `agentConfiguration` 모두 `true` |
| 비밀정보 | release 시점의 staged 고신뢰 패턴 0건; keypair·`.env`·credential payload 미포함 |
| 영상 | H.264/AAC, 1280×720, `153.58`초, 공개 HTTP 200 |

이 표는 `submission-v2` 생성 시점의 검증 기록입니다. 이후 문서 commit의 상태는 현재 CI·로컬 검증 결과로 다시 판정합니다.

## 연결 문서

- [제품·실행·무결성 계약](../product/mandate-pool/README.md)
- [운영 런북](../research/decision-report/hackathon-environment-codex-runbook.md)
- [HITL 설계 의사결정](../research/decision-report/agentic-commerce-hitl-design-decision.md)
- [아이디어 선택 보고서](../research/decision-report/mece-hackathon-idea-selection.md)
- [Official Docs Wiki](../research/official-docs-wiki/README.md)
- [Devnet 공개 지갑 manifest](../product/mandate-pool/devnet-wallets.public.json)
