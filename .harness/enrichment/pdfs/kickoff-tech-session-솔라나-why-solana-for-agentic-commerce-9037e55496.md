# OCR and QR enrichment: Kickoff & Tech Session - 솔라나 - Why Solana for Agentic Commerce.pdf

Generated locally from rendered PDF pages. OCR text is machine-read 
and may contain recognition errors; QR values are decoded payloads.

## Page 1

I S E S S I O N . 2 O 26
S ES S I O N
K I C K O F F
TECH
S O L A N A
&
Why
Solana
for Agentic Commerce
AI 에이전트가 스스로 결제·정산하는 시대,실행 레이어로서 사용되는 S이ana
S P E A K E R
Chaerin Kim . APAc Tech @ Solana Foundation
D AT E
2026.7.21(화)

## Page 2

A G E N D A
목차
개관·Intro
01
블록체인·스마트 컨트랙트·코인/토큰· AI 에이전트와 블록체인은 왜 필연인가
Solana & Pay.sh
02
Solana란?·스테이블코인과 기관 온보딩·Pay.sh
마무리·Wrap-up
03
해커톤에서 보고 싶은 것·Solana 개발 꿀팁

## Page 3

0 1 .
IN T R O
B A S I C S
블록체인이란?
중개자 없이 신뢰를 코드로 만드는 탈중앙 분산 원장
블록체인= 데이터 Block이Chain 형태로 연결·저장
$
ⅢⅢ
•
블록체인·P2P 분산 저장
기존·거래정보 중앙 저장
03 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 4

0 1 . I N T R O
K E Y P R O P E R T I E S
블록체인의 3가지 핵심
왜 은행 없이도 신뢰가 성립하는가
01
02
03
블록·체인
중개자 없는 신뢰
위·변조 사실상 불가
거래 기록을 묶은 블록을 시간순으로 사슬처럼 연결한 구조
한 번 기록되면 수정·삭제 불가·모든 사본이 일치해야 하므
은행·카드사 같은 중간 기관 없이도 다수의 노드가 함께 검
·그래서 블록체인임.
증해 거래가 성립함.
로 단독 조작은 즉시 들통남.
온체인(on-chain)은 데이터·거래가 블록체인 장부에 직접 기록·실행된다는 뜻임·스마트컨트랙트로 규칙을 코드화하면 국경·시간대와 무관하게 24/7 작동해,사람
뿐 아니라 에이전트도 동등한 참여자가 됨.
04 / 18
KI CKOFF & TE CH S E S SION . S OL A N A S E S SION

## Page 5

0 1 . I N T R 0
S M R T
C O N T R A C T
스마트 컨트랙트란?
조건이 충족되면 사람 없이 자동으로 실행되는 블록체인 위의 프로그램
자판기를 떠올리면 쉬움·"1,500원이 들어오면 콜라를 내보낸다"는 규칙이 기계에 내장돼 점원 없이 거래가 성사됨.스마트 컨트랙트는"A 조건이 충족되면 B를 실
행한다"를 코드로 짜서 블록체인에 올린 것임.
IF ·조건
THEN.실행
RESULT.결과
1,500원 투입
규칙대로 자동 실행
콜라 지급·정산
→
약속된 조건이 충족됨
사람 개입 없이 코드가 처리
결과가 즉시 확정됨
02
03
01
사람 없이 자동
코드가 곧 규칙
중개 비용↓ 속도↑
한 번 배포되면 함부로 못 바꿈·단, 버그조차 규칙대로 실
점원·은행원·심사역 없이 조건만 맞으면 즉시 실행됨.
사람이 하던 일을 코드가 대신해 비용은 낮아지고 처리 속도
는 빨라짐.
행됨.
05 / 18
KIC KOFF & TE CH S E S SION . S OLA N A SES SION

## Page 6

INT R O
A S S E T S
코인·토큰·스테이블코인
온체인에서 오가는 자산 3종 세트
코인(Coin)
스테이블코인
토큰(Token)
Native Token
Smart Contract Token
Stablecoin·토큰의 특수 형태
블록체인 자체의 기본 화폐·가스비(수수료) 지불 수단·
스마트 컨트랙트로 발행된 자산·누구나 발행 가능·발행
법정화폐 가치에 고정(페그)·변동성 없는 기축통화·결
발행 주체=블록체인 프로토콜
주체=프로젝트·개인
제·정산의 핵심
BTC
SOL
ETH
USDC .USDT
UNI . JUP . USDC
•
•
블록체인 레이어(공통 인프라)
모든 자산이 이 위에서 발행되고 이동함
06 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 7

01 .
INT R O
S T A B L E C O I N
스테이블코인이란?(USDC·USDT)
1달러 =1토큰으로 가치가 고정된 디지털 달러, 변동 없는 온체인 현금
비트코인·솔라나 같은 코인은 가격 변동이 커서 결제엔 부적합함·스테이블코인은 발행사가 실제 달러·국채를 1:1로 예치하고 그만큼만 발행해,값이 항상 1달러에 고
정됨.
TETHER ·최대유통량
CIRCLE
규제친화
USDC
USDT
미국 규제 준수와 투명한 준비금 공시로 기관이 선호함·S이lana에 네이티브로 발행됨.
세계에서 가장 많이 쓰이는 스테이블코인·거래·송금 유동성이 가장 두터움.
왜 중요한가·가격 변동 없음+24/7 즉시 정산+국경 무관·그래서 사람과 에이전트 모두가 쓰는 기계용 현금이 됨.
07 / 18
KI CKOFF & TE CH S E S SION . S OL A N A S E S SION

## Page 8

0 1 . I N T R O
W ALLET
지갑(Wallet)이란?
은행 없이,사람도 에이전트도 직접 자산을 보관·관리하는 계좌
PRIVATE KEY
HOT/
COLD
ADDRESS
주소=계좌번호
개인키·시드= 비번+인감
핫월렛·콜드월렛
공개해도 되는 입금용 문자열(예:7xKX9fBd)·남에게
이걸 가진 사람이 진짜 주인·절대 공개 금지,잃으면 누구
핫(앱·브라우저,편리하나 해킹에 노출)/ 콜드(오프라인 하
도 복구 불가.
드웨어,큰 금액 보관).
알려줘 자산을 받음.
은행은 비밀번호를 잊어도 신분증으로 재발급되지만,지갑은 시드 문구를 잃으면 복구 불가·"Not your keys,not your coins"·에이전트도 지갑만 있으면 사람
용 계좌 없이 직접 자산을 보유·결제함.
08 / 18
KICKOFF & TECH SES SION . SOLAN A SES SION

## Page 9

0 1 . I N T R O
B U I L D I N G B L O C K S
정리·에이전트 결제를 가능하게 하는 3요소
앞에서 본 개념을 한 줄로
WALLET
SMART
CONTRACT
STABLECOIN
지갑
스테이블코인
스마트 컨트랙트
정해진 규칙에 해당하면 사람 없이 자동 실행됨·기존 중앙
현금이나 카드 없이 누구나(사람·에이전트) 주고받는,값이
은행 계좌 없이 누구나 금융 결제가 가능한 창구(계좌·어카
운트).
고정된 결제 수단.
화된 검증·중개를 대체함.
이 셋이 모이면 사람 없이도 소프트웨어(에이전트)가 스스로 결제·정산할 수 있음·그래서 다음 질문은"AI 에이전트와 블록체인은 왜 필연인가".
09 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 10

0 1 . I N T RO
W H Y I N E V I T A B L E
AI 에이전트 × 블록체인은 왜 필연인가
에이전트가 스스로 결제하려면,'사람용'금융으로는 부족함
온체인 지갑이 여는 것
기존 금융 시스템의 벽
·계좌 개설에 신원·서류·심사가 필요·에이전트는 계좌를 만들 수 없음
지갑은 코드 한 줄로 생성·신원 없이 주소만으로 송·수신
’
·영업시간·평일 중심,국가·통화 장벽
24/7,국경·통화 무관,수 초 내 정산
•
·느린 정산(T+1~2)과 높은 수수료,소액결제엔 비효율
건당 수수료 $0.00x·마이크로페이먼트도 성립
·카드·PG는 매 순간'사람의 승인'을 전제로 설계
에이전트가 직접 서명·결제 → 진짜 자율 결제
AI 에이전트에게 필요한 건 사람용 금융이 아니라 기계용 결제 레일 → 블록체인과의 결합은 선택이 아니라 필연!
10 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 11

02 . S O L A N A
H I G H - PER F OR M A N CE L 1
Solana란?
결제·정산에 최적화된 고성능·저비용 퍼블릭 블록체인
수천+
~$0.00x
24/7
~400ms
건당수수료
블록타임
초당처리량(TPS)
단일 글로벌 상태
마이크로페이먼트 가능
빠른 거래 확정
대량 트랜책션 처리
중단 없는 정산
Solana송금
국경간송금 한 건·SWIFT 전신송금vSS
Solana 송금
항목
SWIFT 전신송금
1초이내 (~400ms)
도착시간
1-5영업일
건당수수료
$15-$50
$0.001미만
대리은행 1~3곳
중개기관
없음·지갑간 직접
이용시간
평일영업시간·휴일제한
24/7/365상시
추적
실시간·공개, 종단 간
제한적·불투명
Solana 메인넷 실측(슬롯 ~40Oms·수수료)·SWIFT 수치는 업계 통상치
11 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 12

0 2 .
I N S T I T U T I O N S
S O L A N A
스테이블코인과 기관의 선택
규제받는 대형 금융사가 이미 S이ana에서 실물 결제를 정산 중
$17B+
$650B+
5M+
200M+
월활성 주소
월 스테이블코인 거래
스테이블코인 공급량
월 정산 규모
실사용 트랜책션
실제 사용자 기반
실물 결제 흐름
온체인 유동성
B A N K - T O - B A N K
GLOBAL
REMITTANCE
CONSUMER
PAYMENTS
PayPal
Visa
Western Union
미국 은행 대상 UsDc 정산을 Solana에서 운영·연환산
자체USD스테이블코인 USDPT를Solana에 출시
PYUsD를 Solana에서 네이티브 발행(Paxos·NYDFS 규
$3.5B+ 규모.
(2026.5)· Anchorage Digital Bank 발행.
제)·Xoom해외송금·YouTube 크리에이터 지급에 실제
사용
12 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 13

0 2 . S OL A N A
S O L A N A x G O O G L E C L O U D
Pay.sh란?
Solana Foundation과 Google Cloud가 함께 만든,에이전트용 API 결제 게이트웨이
에이전트·CLI가 가입·계정·API 키 없이 유료 API를 한 줄로 호출하고 쓴 만큼 USDc로 정산함·결제는 S이lana 위 x402 마이크로페이먼트로 처리됨.
N o sign - U p
N o a c c ount
Pay as
g0
y0U
가입 없이 호출
키·구독 불필요
쓴 만큼 정산
회원가입·계정 생성 없이 필요한 AP를 바로 호출함.
미리 발급받을 API 키나 매달 내는 구독이 필요 없음.
사용한 호출만큼만 USDC로 실시간 정산함.
이미 70+ 유료 API 연결· Google Cloud · QuickNode · Perplexity · Exa · fal.ai · Purch(Amazon/Shopify) 등·런칭 파트너 Crossmint · MoonPay·
AgentCash 등·Claude·Codex에서 사용.
13 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 14

0 2 . S O L A N A
H O W I T W O R K S
Pay.sh,어떻게 동작하나
API 고르기 → 평소처럼 부르기 → 자동 결제, 이게 전부임
2
1
필요한 API 고르기
평소처럼 요청 보내기
3
자동 결제 후 응답
지갑이 그 금액만큼 USDC로 알아서 결제하고 결과를
에이전트(Claude·Codex)가 pay.sh 목록에서 필요
코드를 바꿀 필요 없이 요청을pay.sh로 보내면, 실행
한 유료 API(검색·데이터·이미지 생성 등)를 하나 고름.
전에"이번 호출 얼마"인지 미리 알려즘.
받아옴· 사람이 카드 넣고 승인하는 과정이 없음.
@solana/pay
claude "buy some water with pay"
npx
쉽게 말해·에이전트에게 USDc가 든 지갑을 쥐여주고"물 사와"같은 일을 시키는 것·필요한 유료 API가 나오면 pay.sh가 그 지갑에서 알아서 결제함·개발자가 계정·API 키·카드를 등록하는 단계가 아예 없음.
14 / 18
KICKOFF & TECH SE S SION . S OL A N A S ES SION

## Page 15

0 2 . S OL A N A
F O R D E V E L O P E R S
개발자 시나리오
pay.sh를 에이전트에'붙인다'는 건 무슨 뜻일까
+ pay.sh
내에이전트
유료API 7O+·USDC 자동 결제
CLI한줄
PAY.SH 붙인 후
PAY.SH붙이기전
·에이전트가 유료 API 앞에서 멈춤·매번 사람이 개입해야 함
CLI 한 줄 설치로 결제 지갑이 에이전트에 연결됨
서비스마다 계정을 만들고 API 키·카드를 코드에 심어야 함
에이전트가 카탈로그에서 AP를 찾아 스스로 호출·결제(USDC)
·새 AP를 쓰려면 같은 작업을 처음부터 반복
새 서비스도 코드 수정 없이 그대로 사용
•
brew install pay.
→ 이제 에이전트가 유료 API를 스스로 결제
•
pay setup
$
15 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 16

0 3 . W R A P - U P
FOR B UI LDER S
이번 해커톤에서 보고 싶은 것
실제로 '동작'하는 온체인 결제
사람 승인 없는 자율 결제
2
1
시연 중 실제 트랜책션이 발생하고 정산까지 완료되는 프로덕트를 보고 싶음.
정책·예산 한도 안에서 에이전트가 스스로 판단하고 직접 서명·결제하는 흐름.
Solana 결제 스택 활용
4
직관적UX·명확한이유
3
"왜 이게 온체인이어야 하는가"에 스스로 답하는,쓰고 싶은 경험.
Solana Pay·pay.sh·x4o2·UsDc를 실제 유스케이스에 녹여낸 구현.
16 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Page 17

03 . W R A P- U P
D EV T I P S
Solana 개발 꿀팁
빠르게 반복하고,안전하게 시연하기
개발은 무조건 로컬넷 및 샌드박스 환경에서 시작하고, 실제 네트워크는 시연·배포 때만 쓸 것.
건너뛰기
시연직전
START HERE .개발
프로덕션
Testnet
Mainnet
Devnet
Localnet
>
>
>
내 PC에 띄우는 1인용 체인·무료·무제
검증인·프로토콜 성능 테스트용 공용망
공용 테스트망·무료 에어드랍(제한)·실
실제 자산·수수료 발생,되돌릴 수 없음
제와유사한환경
한, 즉시 리셋, 가장 빠른 반복 루프
·앱 개발 타깃으로는 부족
·배포시에만
같은 Solana지만 비용·리셋·안정성이 다름·Localnet은 공짜로 무한 반복,Mainnet은 실제 돈이 나감.Devnet SOL이 더 필요하면 Discord에서 추가 수령 희
망자에 한해 송부 예정임.
17 / 18
KIC KOFF & TE CH S ES SION . S OLA N A SES SION

## Page 18

Q& A
W R A P - U P
Build it on
Solana
발표자 . Chaerin Kim . APAc Tech at Solana Foundation
chaerin.kim@solana.org
(EM AIL)
해커톤 안내
C O M MUN I T Y
CONT ACT
gcp-solana-ai-agentic-hacks-kr
gcp-solana-ai-agentic-hacks-kr.xyz
Discord · pay.sh· Solana Docs
dsuperteamkr.com
18 / 18
KICKOFF & TECH SESSION . SOLANA SESSION

## Provenance

- Source SHA-256: `544daa9b0d76a346125b3d76bc90f37454ea7c80cae84605133f0826feba6503`
- Pages: 18
- OCR lines: 392
- Decoded QR payloads: 0
