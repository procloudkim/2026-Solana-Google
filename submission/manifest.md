# Mandate Pool 제출 manifest와 최종 체크리스트

> 이 문서는 소개서·GitHub·영상·Cloud Run·Devnet 증거가 **같은 release와 같은 주문**을 가리키는지 판정하는 단일 제출 장부다. 런타임 증거는 고정됐고, 영상 업로드와 제출 폼 완료만 사람 작업으로 남아 있다.

## 1. 현재 상태

```text
STATUS = RUNTIME_EVIDENCE_READY — 영상 업로드·제출 폼 완료 대기
```

배포 소스 `2ac7eac17ea803b4537b630234ac6507523e5325`로 만든 private live revision에서 정상·거부 주문을 각각 한 번 검증했다. 정상 주문은 Solana Devnet에서 finalized됐고, 거부 주문에는 settlement evidence·signature·entitlement가 없다. 아래 값은 모두 저장된 redacted receipt와 공개 온체인 식별자로 역검증할 수 있다.

## 2. 제출 산출물 지도

| 공식 상위 제출물 | 이 디렉터리의 원고 | 최종 제출값 |
|---|---|---|
| 제품 소개서 | [`deck.md`](deck.md) 원고 · [`deck.html`](deck.html) 오프라인 인쇄본, 각각 정확히 6장 | [`deck.pdf`](https://github.com/procloudkim/2026-Solana-Google/blob/submission-v1/submission/deck.pdf) |
| GitHub repository | release와 재현 안내 | `https://github.com/procloudkim/2026-Solana-Google` @ source `2ac7eac17ea803b4537b630234ac6507523e5325` |
| 데모 영상 | [`video-script.md`](video-script.md), 목표 2:50·상한 3:00 | **PENDING:** 녹화·업로드 후 URL과 실제 길이 입력 |
| 실행 환경 | public fixture + private live evidence | [public fixture](https://mandate-pool-judge-x7id33dnyq-du.a.run.app) · private live `mandate-pool-live-00005-4tb` |

공식 공개 계약은 [행사 계약](../research/official-docs-wiki/sources/event-contract.md)과 [행사 규칙](../research/official-docs-wiki/modules/event-rules.md)을 따른다. 공개 페이지에서 확인된 필수 상위 묶음은 제품 소개서, GitHub repository, 데모 영상이며 live endpoint는 권장이다. 정확한 영상 길이, 소개서 형식, repository 공개성은 로그인 후 제출 폼에서 다시 확인한다.

## 3. release 식별자

배포 소스와 제출 증거를 혼동하지 않도록 source commit과 evidence release tag를 분리한다. `submission-v1` tag는 최종 증거 commit에 붙이며 자기 자신을 포함한 commit hash를 문서 안에 쓰는 순환 참조를 피한다.

| 필드 | 실제 값 | 수용 기준 |
|---|---|---|
| 제출 표시명 | `Mandate Pool` 임시값 | 실제 폼의 팀명과 제출자가 마지막으로 대조 |
| 배포 source commit | `2ac7eac17ea803b4537b630234ac6507523e5325` | Cloud Run revision label과 일치 |
| 제품 README | [commit 고정 링크](https://github.com/procloudkim/2026-Solana-Google/blob/2ac7eac17ea803b4537b630234ac6507523e5325/product/mandate-pool/README.md) | 배포 소스와 동일 |
| Cloud Run live service | `mandate-pool-live` | service describe 결과와 일치 |
| 1-USDC live revision | `mandate-pool-live-00005-4tb` | latest created = latest ready; traffic 100% |
| public fixture revision | `mandate-pool-judge-00004-kxd` | zero-role runtime; `FIXTURE · NOT ON-CHAIN` |
| image digest | `sha256:5d22c850b5fb113eaff07d653368b1cfac6e8a00d49b5e1a2ebaa9a586f0b995` | 두 revision이 같은 image를 사용 |
| private live URL | `https://mandate-pool-live-x7id33dnyq-du.a.run.app` | 무인증 403; 인증 readiness 4/4 true |
| 심사 접근 | [public fixture](https://mandate-pool-judge-x7id33dnyq-du.a.run.app), demo key `judge-fixture-key-v1` | fixture임을 UI에서 명시; 온체인은 receipt·Explorer로 검증 |
| evidence manifest | [submission-v1 고정 링크](https://github.com/procloudkim/2026-Solana-Google/blob/submission-v1/submission/manifest.md) | tag를 최종 증거 commit에 push |
| 덱 증거 배너 | `검증 완료 · Solana Devnet 테스트 토큰` | 런타임·온체인 gate 통과 뒤 사용 |

## 4. 정상 Devnet 증거 슬롯

정상 증거는 **하나의 order ID** 아래 다음 값을 연결한다. public identifier와 redacted hash만 기록하고 secret·entitlement token은 기록하지 않는다.

| 필드 | 실제 값 | 수용 기준 |
|---|---|---|
| order | `ord_b6ab984c23334cb0a3f8480d4c12abf9` | trace·approval·policy·transaction·entitlement에서 동일 |
| 실행 완료 | `2026-08-03 23:40:47.383 KST` (`2026-08-03T14:40:47.383Z`) | receipt `updatedAt` |
| agent | `google-adk` · `gemini-2.5-flash` | live receipt의 provider·model |
| trace receipt | `submission/evidence/normal-order-2ac7eac.json` | provider·model·시각·order 연결; secret 없음 |
| Buyer A mandate hash | `4da95f6157bf11701b750f6a0eaf4aafb50c4c45b160cfda83000465e25600aa` | A approval과 일치 |
| Buyer B mandate hash | `33f185202501e0123149ce09b19b8b9a9699fe8ae29abb6dc075d123d10286bc` | B approval과 일치 |
| Buyer C mandate hash | `1814e0e6c20b5cb6947f5643b5d657476a1adc38676641070548a5c58f98fe64` | C approval과 일치 |
| quote hash | `2738aeb50f428d72f7cf8ba3ef70a74b7ed56b16433fb8756cb354b9733faad9` | memo·policy proof와 연결 |
| policy proof hash | `df10b8b6d8ffdc99e89767758258a49fceea3a23fadc0d3bfeb18ec620c4b2c0` | 승인·한도·상품·만료·분담 PASS |
| message hash | `02991fe143fb321ce52816423c79ded5b6abd8bdb674f3261dd044213f7b89b4` | finalized 원문 hash 검증 통과 |
| transaction signature | `2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW` | 이 order의 유일한 정상 signature |
| 화면용 signature | `2JMWb2wc4GTt…wDt2jaMy2ZAW` | 전체 signature로 역참조 가능 |
| Explorer | [Solana Devnet transaction](https://explorer.solana.com/tx/2JMWb2wc4GTtD2XYsfD3T9F5UdQHkV7k5n88Mno9RDnBd5q7MKKyyziyRSoeQ28woWgvodqsckfuwDt2jaMy2ZAW?cluster=devnet) | `cluster=devnet` |
| finalized slot | `480936920` | `commitment=finalized`, `metaError=null` |
| balance receipt | `submission/evidence/devnet-balance-post-normal-2ac7eac.json` | A `-333334`, B `-333333`, C `-333333`, Merchant `+1000000` |
| redacted receipt | [submission-v1 receipt](https://github.com/procloudkim/2026-Solana-Google/blob/submission-v1/submission/evidence/normal-order-2ac7eac.json) | order·trace·signature·delta·entitlement count 연결 |
| proof image | `submission/evidence/normal-devnet-proof-2ac7eac.svg` | 공개 식별자와 exact delta만 포함 |

정상 최종 상태는 `FULFILLED`, entitlement count는 `3`이어야 한다. entitlement token 값 자체는 어떤 제출물에도 넣지 않는다.

## 5. 거부 증거 슬롯

거부 증거는 B cap이 `300000` atomic이고 필요한 분담 `333333`보다 작다는 동일한 반례를 사용한다.

| 필드 | 실제 값 | 수용 기준 |
|---|---|---|
| order | `ord_82ac0530d4744e098f181aa5460e6027` | 정상 주문과 분리 |
| 거부 완료 | `2026-08-03 23:40:20.643 KST` (`2026-08-03T14:40:20.643Z`) | receipt `updatedAt` |
| API receipt | `submission/evidence/reject-order-2ac7eac.json` | `NO_BUY`, `NO_COMMON_PRODUCT`, evidence 없음, entitlement 0 |
| 잔액 증명 | `submission/evidence/reject-balance-proof-2ac7eac.json` | A/B/C/Merchant delta 모두 0 |
| redacted receipt | [submission-v1 receipt](https://github.com/procloudkim/2026-Solana-Google/blob/submission-v1/submission/evidence/reject-order-2ac7eac.json) | transaction·signature·entitlement 부재 명시 |
| proof image | `submission/evidence/reject-proof-2ac7eac.svg` | B cap·NO_BUY·0 tx·0 entitlement 표시 |

UI의 `NO_BUY` 문구만으로 거래 부재를 주장하지 않는다. API response·audit의 부정 필드와 같은 시점의 잔액 불변이 함께 있어야 한다.

## 6. 주장과 증거의 경계

| 제출 문장 | 사용할 수 있는 최소 증거 | 대신 사용할 수 없는 것 |
|---|---|---|
| “Google ADK·Gemini가 조건을 정규화하고 후보를 제안했다.” | live order와 연결된 provider·model·timestamp·redacted trace | `/readyz`, fixture trace, 설정 화면 |
| “1 Devnet 테스트 USDC 결제가 완료됐다.” | finalized signature, decoded 원문, `meta.err=null`, exact debit·credit | transaction build test, ATA 생성, Faucet 입금, 임의 Explorer URL |
| “한도 초과에서는 거래를 만들지 않았다.” | `NO_BUY` API·audit, settlement/signature 부재, 전후 잔액 불변 | 거부 UI 스크린샷 하나 |
| “HITL을 거쳤다.” | A/B/C 역할별 approval event와 mandate hash·nonce 결박 | 실제 세 사용자의 독립 승인이라는 표현 |
| “부분 결제를 막는다.” | 세 `TransferChecked`가 같은 finalized transaction에 있고 exact delta 일치 | Firestore와 Solana 전체가 하나의 분산 원자 연산이라는 표현 |
| “중복 결제를 자동으로 피한다.” | 한 order의 idempotency record, stored signed bytes, signature 수 1, 모호한 결과의 reconciliation 로그 | 상용 exactly-once 보장이라는 표현 |
| “live 서비스다.” | 현재 commit의 1-USDC revision, private IAM, 인증된 실행 증거 | 과거 readiness revision |

### 반드시 유지할 표현

- `Devnet 테스트 USDC`, `테스트 토큰`, `실제 돈이 아님`
- `operator-simulated HITL`, 또는 한국어 `운영자 역할 시뮬레이션`
- `custom Solana atomic settlement`
- `같은 runtime의 finalized verifier`

### 금지할 표현

- `실제 1달러 결제`, `실제 USDC 수익`, `Mainnet 검증 완료`
- `세 사용자가 각자 지갑으로 승인`, `비수탁`, `상용 보안 검증 완료`
- `x402 구현`, `AP2 준수`, `Solana Pay 통합` — 현재 v0에서 구현 증거가 없음
- fixture·readiness·ATA 생성 transaction을 제품 결제 signature로 소개
- Explorer URL만 보고 entitlement까지 성공했다고 단정

Circle은 testnet USDC와 native test token에 금전 가치가 없고 실제 달러로 담보되지 않는다고 안내한다. 최종 덱과 영상에는 [Circle testnet 안내](https://developers.circle.com/stablecoins/usdc-contract-addresses)를 연결한다.

## 7. Hard-gate 체크리스트

### A. 로그인 후 제출 계약

- [ ] 실제 제출 폼에서 소개서 형식·용량, 영상 길이·호스팅, Repo 공개성, URL 필드를 확인했다.
- [ ] 폼 요구가 로컬 행사 계약과 다르면 폼을 우선해 원고를 갱신했다.
- [ ] 팀명·팀원·언어·연락 정보가 Repo와 일치한다.

### B. release와 보안

- [ ] 의도한 최종 파일만 commit했고 worktree가 clean하다.
- [ ] `npm run typecheck`, `npm test`, `npm run build`와 루트 test를 최종 commit에서 통과했다.
- [ ] 독립 scanner가 현재 tree와 도달 가능한 전체 Git history에서 secret 0건을 보고했다.
- [ ] `.env`, keypair, service-account JSON, PEM, API key, entitlement token이 Repo·로그·영상에 없다.
- [ ] 최종 증거 commit 뒤 local HEAD와 origin/main이 같고 `submission-v1` tag가 그 commit을 가리킨다.

### C. Cloud Run

- [x] `mandate-pool-live-00005-4tb`가 source `2ac7eac17ea803b4537b630234ac6507523e5325`의 총 1-USDC image로 배포됐다.
- [ ] latest created = latest ready이고 traffic 100%가 그 revision으로 향한다.
- [ ] user-managed runtime service account와 여섯 Secret Manager **참조**만 연결됐다.
- [x] live는 private IAM으로 유지하고, zero-role public fixture를 별도 심사 URL로 사용했다.
- [ ] 무인증 403·인증 200, readiness true, read-only probe 전후 잔액 불변을 새 receipt로 보존했다.

### D. 거부 경로

- [ ] B cap `300000`인 별도 주문에서 A/B/C 역할 승인을 보존했다.
- [ ] 상태 `NO_BUY`, failure code `NO_COMMON_PRODUCT`를 확인했다.
- [ ] settlement plan, transaction bytes, signature, entitlement가 모두 없음을 API·audit로 확인했다.
- [ ] Buyer A/B/C·Merchant의 전후 잔액이 모두 같다.
- [ ] deck slide 5와 영상의 모든 `REJECT_` 증거 슬롯을 같은 receipt로 교체했다.

### E. 정상 경로

- [ ] 별도 localnet smoke receipt와 사람의 “총 1 Devnet 테스트 USDC 거래 1회 실행” 승인이 있다.
- [ ] 실행 직전 network, genesis, mint, decimals, owner·ATA, Sponsor SOL, 네 token 잔액을 다시 읽었다.
- [ ] ADK/Gemini trace와 A/B/C 역할 승인, quote·policy·message hash를 같은 order에 연결했다.
- [ ] 정상 signature가 정확히 하나이고 finalized, `meta.err=null`이다.
- [ ] decoded instruction이 A→B→C `TransferChecked` 3개와 memo 1개, signer 4명 계약과 일치한다.
- [ ] A/B/C debit `333334/333333/333333`, Merchant credit `1000000`을 같은 RPC pre/post balance로 확인했다.
- [ ] finalized 검증 뒤 entitlement count 3과 보호 resource 성공을 확인했으며 token 값은 기록하지 않았다.
- [ ] 응답 유실·blockhash 만료·불명확 결과가 있었다면 새 결제 없이 `RECONCILIATION_REQUIRED`에서 기존 signature부터 조사했다.
- [ ] deck slide 5와 영상의 모든 `NORMAL_` 증거 슬롯을 같은 receipt로 교체했다.

### F. 소개서·영상 일치

- [ ] `deck.md`와 `deck.html`이 각각 정확히 6장이고 placeholder가 0개다.
- [ ] 영상 길이가 `3:00.000` 이하이며 placeholder·secret·브라우저 자동완성이 없다.
- [ ] 덱·영상·README가 같은 commit, revision, 정상 order, 거부 order, signature를 가리킨다.
- [ ] fixture 장면에는 `FIXTURE · NOT ON-CHAIN`, live 장면에는 `SOLANA DEVNET · TEST TOKENS`가 보인다.
- [ ] 정상 1건과 거부 1건을 보여주며, 정상 실행을 영상 때문에 반복하지 않았다.
- [ ] limitation과 operator simulation을 생략하지 않았다.

### G. 접근과 최종 제출

- [ ] 심사자 관점에서 Repo, 소개서, 영상, live URL, evidence permalink를 열어 봤다.
- [ ] source 링크는 commit에, evidence 링크는 최종 `submission-v1` tag에 고정됐는지 확인했다.
- [ ] 최종 제출 버튼은 사람이 눌렀다.
- [ ] 제출 완료 화면을 `submission/evidence/submission-complete.png`로 저장하고 KST 제출 시각을 기록했다.

## 8. 자동·수동 최종 판정

제출 직전 다음 문자열이 source에 남아 있지 않아야 한다.

```bash
rg -n '\{\{[A-Z0-9_]+\}\}' submission
```

기대 결과는 **출력 0건**이다. 다만 문자열 검사만으로 증거의 진위를 판정할 수 없으므로, 위 체크리스트와 receipt 대조를 사람이 함께 수행한다.

다음 중 하나라도 해당하면 `NO-GO`다.

- placeholder 또는 미체크 hard gate가 남음
- 최종 commit과 배포 revision의 source가 다름
- 정상 또는 거부 receipt가 다른 order·revision을 가리킴
- finalized·message·instruction·잔액 중 하나라도 불일치
- secret 또는 실제 credential이 Repo·로그·영상에 노출됨
- 심사자가 제출 링크에 접근할 수 없음

모든 gate가 충족된 시점에만 첫 줄을 다음으로 바꾼다.

```text
STATUS = SUBMISSION_READY — source 2ac7eac17ea803b4537b630234ac6507523e5325 / live mandate-pool-live-00005-4tb / evidence submission-v1
```

## 9. 최종 참고 링크

- [공식 행사 페이지](https://www.gcp-solana-ai-agentic-hacks-kr.xyz/)
- [행사 계약의 로컬 검증본](../research/official-docs-wiki/sources/event-contract.md)
- [제품 실행·무결성 계약](../product/mandate-pool/README.md)
- [현재 실행 런북](../research/decision-report/hackathon-environment-codex-runbook.md)
- [Devnet 공개 지갑 manifest](../product/mandate-pool/devnet-wallets.public.json)
- [Circle testnet token 안내](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Solana transaction core concepts](https://solana.com/docs/core/transactions)
