# 운영진 채널의 Solana 테스트·Devnet SOL 안내

- 수신일: 2026-08-03 KST
- 전달 경로: 사용자가 프로젝트 대화에 붙여 넣은 운영진 채널 메시지
- 검증 상태: 사용자 제공 1차 메시지. 공개 행사 페이지에서 독립 재확인하지 않음
- 적용 범위: 테스트 순서와 Devnet SOL 지원 운영

## 전달 원문

> pay.sh/솔라나 블록체인를 사용하실 때는 먼저 샌드박스(pay.sh) 혹은 로컬넷(localnet - solana-local-validator)에서 테스트하시고, 실제 동작 확인은 데브넷에서 진행하시길 권장드립니다.
>
> 다만 데브넷 퍼셋(https://faucet.solana.com/) 에서 받을 수 있는 SOL은 하루 지급량에 제한이 있습니다. 빌더분들께는 데브넷 SOL을 별도로 지원해 드릴 수 있으니, 추가로 필요하신 분은 저에게 DM 주시고 본 채널에서 언급해주시기 바랍니다!

## 정규화한 적용 결정

1. 현재 제품의 로컬 검증은 fixture, 단위·통합 테스트, transaction build/verify 테스트로 수행한다.
2. 현재 Live 구성은 Devnet에 잠겨 있으므로 local validator 지원을 마감 전 새 범위로 추가하지 않는다.
3. 제출 가능한 온체인 실행 증거는 Devnet finalized transaction으로 만든다.
4. Faucet 한도를 반복 소모하지 않고 필요한 SOL을 계산한다.
5. 부족하면 운영진의 별도 Devnet SOL 지원 경로를 사용한다.
6. 메시지의 `solana-local-validator` 표현은 공식 CLI의 `solana-test-validator` 의미로 해석한다.
7. 이 메시지를 Mainnet 요구, pay.sh 의무, localnet 증거의 Devnet 대체 허용으로 확대 해석하지 않는다.
