# 운영진 채널의 Solana 테스트·Devnet SOL 안내 기록

## 문서 목적과 출처 경계

이 문서는 사용자가 프로젝트 대화에 붙여 넣은 운영진 채널 메시지를 보존하고, 그 내용을 Mandate Pool의 안전한 테스트 순서와 Devnet SOL 확보 절차로 변환한다.

| 항목 | 기록값 |
|---|---|
| 수신일 | 2026-08-03 KST |
| 전달 경로 | 사용자가 프로젝트 대화에 붙여 넣은 운영진 채널 메시지 |
| 독립 검증 | 공개 행사 페이지에서 작성자·채널·전문을 재확인하지 못함 |
| 적용 범위 | 테스트 순서와 Devnet SOL 추가 지원 경로 |

따라서 아래 원문은 **사용자 제공 전달본**으로 취급한다. 운영진의 공개 규정이나 필수 제출 조건으로 확대 해석하지 않는다.

## 전달 원문

> pay.sh/솔라나 블록체인를 사용하실 때는 먼저 샌드박스(pay.sh) 혹은 로컬넷(localnet - solana-local-validator)에서 테스트하시고, 실제 동작 확인은 데브넷에서 진행하시길 권장드립니다.
>
> 다만 데브넷 퍼셋(https://faucet.solana.com/) 에서 받을 수 있는 SOL은 하루 지급량에 제한이 있습니다. 빌더분들께는 데브넷 SOL을 별도로 지원해 드릴 수 있으니, 추가로 필요하신 분은 저에게 DM 주시고 본 채널에서 언급해주시기 바랍니다!

## 해석한 실행 원칙

| 원문 요지 | 프로젝트 적용 | 이유 |
|---|---|---|
| sandbox 또는 localnet에서 먼저 테스트 | pay.sh 경로는 sandbox, 직접 Solana transaction 경로는 localnet을 적용 | 원문의 두 도구를 제품 결제 rail에 맞게 구분하기 위해 |
| 실제 동작은 Devnet에서 확인 | 제출용 온체인 증거는 Devnet finalized transaction으로 생성 | 프로젝트의 Mainnet·실자산 금지 경계를 유지하면서 공개 검증 가능한 signature를 남기기 위해 |
| faucet 지급량 제한 | 실행 전 필요한 SOL을 계산하고 반복 airdrop 요청을 피함 | faucet 소진과 불필요한 재시도를 줄이기 위해 |
| 추가 SOL은 운영진 지원 가능 | finalized Sponsor 잔액이 부족할 때만 DM과 채널 언급 | 별도 지원을 기본 자금 조달로 간주하지 않기 위해 |

원문의 `solana-local-validator`는 현재 프로젝트에서 공식 Solana CLI 명령인 `solana-test-validator`를 가리키는 표현으로 해석한다. Solana 공식 자료도 초기 개발·테스트에는 local cluster를 권장하고, CLI 도구의 `solana-test-validator`를 실행 방법으로 제시한다. [Solana RPC infrastructure](https://solana.com/rpc)

## 현재 범위에 반영한 결정

1. Mandate Pool은 pay.sh를 사용하지 않으므로 pay.sh sandbox가 아니라 `solana-test-validator` localnet 권고가 적용된다.
2. 현재 완료된 fixture와 transaction build/verify test는 localnet 실행이 아니다. 현재 환경에는 Solana CLI와 `solana-test-validator`도 설치되어 있지 않으므로 localnet 증거는 **미확보**다.
3. Devnet 결제 전에 Devnet 키를 재사용하지 않는 전용 localnet signer·mint·ATA로 세 `TransferChecked`의 submit·finality·정확한 잔액 변화를 검증한다.
4. 제품의 live 구성은 계속 `SOLANA_CLUSTER=devnet`과 Circle Devnet mint에 잠근다. localnet 검증을 위해 이 production guard를 느슨하게 만들지 않고 별도 smoke harness를 사용한다.
5. 실제 Devnet 실행 전에는 Buyer·Merchant ATA, Sponsor SOL, Buyer별 Devnet USDC, genesis hash와 mint를 finalized 기준으로 다시 읽는다.
6. 실행은 명시적 HITL 승인 뒤 한 번만 수행하고 transaction signature와 finalized 전후 잔액을 보존한다.
7. Faucet 추가 요청은 계산된 부족분이 있을 때만 한다. 부족하면 사용자에게 운영진 DM·채널 언급을 요청한다.

## 한계와 금지되는 해석

- 이 메시지는 Mainnet 사용 요구가 아니다.
- pay.sh 사용이 의무라는 근거가 아니다.
- localnet 결과가 Devnet 온체인 증거를 대체해도 된다는 허가가 아니다.
- 별도 Devnet SOL 지원의 지급량·응답 시간·승인을 보증하지 않는다.
- Devnet SOL과 Devnet USDC는 테스트 자산이며 실자산 결제 근거로 제시하지 않는다.

현재 자금과 실행 준비 상태는 [Devnet 지갑 프로비저닝 검증 기록](devnet-wallet-provisioning-2026-08-03.md) 및 [환경 런북](../hackathon-environment-codex-runbook.md)을 기준으로 판단한다.
