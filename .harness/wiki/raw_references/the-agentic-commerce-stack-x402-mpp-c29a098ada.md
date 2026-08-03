---
harness_schema: 1
source_path: "참고레퍼런스/The Agentic Commerce Stack_ x402 & mpp.pdf"
sha256: "99d0e8852e38f8a2a451fa178ee0a5c7464af31027f2b65a34a7798ddb34cbaf"
size_bytes: 2799770
kind: "pdf"
status: "enriched"
duplicate_of: null
transcript_sidecar: null
enrichment: {"adapter": "pymupdf+paddleocr+opencv-qrcode", "artifacts": {"markdown": ".harness/enrichment/pdfs/the-agentic-commerce-stack-x402-mpp-c29a098ada.md", "metadata": ".harness/enrichment/pdfs/the-agentic-commerce-stack-x402-mpp-c29a098ada.metadata.json", "ocr_json": ".harness/enrichment/pdfs/the-agentic-commerce-stack-x402-mpp-c29a098ada.ocr.json", "qr_json": ".harness/enrichment/pdfs/the-agentic-commerce-stack-x402-mpp-c29a098ada.qr.json"}, "settings_fingerprint": "9b95b4be43c06bfe", "source_sha256": "99d0e8852e38f8a2a451fa178ee0a5c7464af31027f2b65a34a7798ddb34cbaf", "status": "complete"}
categories:
  - "Solana Engine"
  - "GCP Infrastructure"
  - "AP2/x402 Payment Protocols"
  - "Google ADK"
---

# The Agentic Commerce Stack_ x402 & mpp.pdf

## Page 1

The Agentic Commerce Stack: 
x402 & mpp
유준혁(Jun)
2026년 7월 21일

## Page 2

시작하기에 앞서
Jun
Rearcher, Four Pillars
클라우드플레어
카카오페이 x402
ERC-8183
X402 데이터 분석..
에이전틱 커머스 분석
리눅스 Open Source Summit
TG: @JunYooo

## Page 3

시작하기에 앞서
에이전틱 커머스
에이전틱 페이먼트
헤드리스 머천트 엔드포인트
구매 주체가 사람이 아니라 사람을 대리하는 AI 에이전트인 상거래다. 탐색, 
비교, 협상, 선택, 결제, 사후 관리로 이어지는 거래 사이클 전체를 에이전트가 
수행한다.
에이전트가 주체가 되어 개시하고 실행하는 가치 이전이다. 결제 실행 시점에 
사람이 트랜잭션 루프 안에 존재하지 않는다는 점이 기존 결제와의 결정적 
차이다.
UI 레이어를 완전히 제거하고 API 엔드포인트 자체가 판매 접점이 되는 머천트 
형태다. 상품 페이지도 장바구니도 체크아웃 화면도 없다. 호출 가능한 리소스가 
곧 상점이다.

## Page 4

에이전틱 커머스 지형도

## Page 5

에이전틱 커머스(w.블록체인) 지형도

## Page 6

에이전틱 커머스(w.블록체인) 지형도

## Page 7

x402, mpp

## Page 8

pay.sh는 x402와 mpp를 동시 지원함

## Page 9

x402 vs MPP

## Page 10

기업 주도 커뮤니티 주도
x402 vs MPP

## Page 11

x402 vs MPP

## Page 12

x402 vs MPP

## Page 13

x402 vs MPP
자세한 Spec은 x402, mpp docs 참고
https://docs.x402.org/introduction
https://mpp.dev/overview
 Claude. gpt와 함께라면 두렵지 않아

## Page 14

A2A, AP2, UCP

## Page 15

Google Cloud의 에이전틱 커머스 스택
소통 레이어: A2A (Agent-to-Agent Protocol)
Google이 개발한 에이전트 간 통신 프로토콜
A2A란?
● Google이 2025년 4월 개발한 에이전트 간 통신 프로토콜 HTTP/SSE/JSON-RPC 기반 클라이언트-서버 모델
● 1) 다른 에이전트의 능력 발견, 2) Task 위임 및 상태 추적, 3) 필요시 정보 공유
Google의 통합 스택
● A2A -> AP2 -> UCP
● 소통 → 결제 → 쇼핑까지 하나의 스택으로 연결
●  에이전틱 커머스에서 가장 일관된 full-stack 접근

## Page 16

Google Cloud의 에이전틱 커머스 스택
소통 레이어: A2A & MCP
두 프로토콜은 경쟁이 아닌 상호보완 관계
역할 분담
● A2A가 에이전트 간 소통, MCP는 에이전트와 
외부 시스템의 연결
● 1) 다른 에이전트의 능력 발견, 2) Task 위임 및 
상태 추적, 3) 필요시 정보 공유

## Page 17

Google Cloud의 에이전틱 커머스 스택
Agent Payments Protocol (AP2)
구글이 제안하는 mandate 기반의 에이전트 결제 프로토콜

## Page 18

Google Cloud의 에이전틱 커머스 스택
Universal Commerce Protocol (UCP)
구글 클라우드의 커머스 통합 스택

## Page 19

쇼핑 레이어: UCP
UCP 업데이트 팔로우업하는 법 ( https://scout.nekuda.ai/ )
Google Cloud의 에이전틱 커머스 스택

## Page 20

당위성을 가져야 한다.

## Page 21

당위성을 가져야 한다.
ERC-8004평판
KYA
마이크로페이먼
트
x402
mpp
Solana
KYA
에이전틱 커머스
에이전틱 
페이먼트
당위성을
 가져야 한다.

## Page 22

당위성을 가져야 한다.
1. 왜 블록체인(솔라나)기반의 결제여야 
하나
블록체인 기반 결제의 장점이 
무엇일까?
-> 인증/로그인 없이 진행 가능한 
결제
-> 적은 수수료
-> 빠른 속도
[경쟁군 : 카드 네트워크]

## Page 23

당위성을 가져야 한다.
2. 어느 시장을 노려야 하나?
기존 커머스 시장에 장점이 
있을까?
새로운 커머스 시장이 도래하지 
않을까?
새로운 커머스 시장에서는 어떤 
식으로 해자를 찾을 수 있을까?
자율형위임형추천만 받음

## Page 24

당위성을 가져야 한다.
3. 어느 레이어를 노릴 것인가? (=어떤 레일이 
부족한가)
커머스&체크아
웃
신원&의도 증명
검증&가드레일

## Page 25

당위성을 가져야 한다.
4. 현재 시장은 무엇을 타겟으로 하는가x402scan.io / mppscan.io / pay.sh

## Page 26

Use Cases

## Page 27

Use Cases
1. 콜로세움 수상작 참고 - Game&Collectiblet: 6개
- DeFi&Trading: 5개
- RWA&Tokenization : 4개
- Prediction Marktes : 4개
- AI Agent : 3개
- Fintech Infra & Payment :3개
flovia402.com
https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/

## Page 28

Use Cases
2. 클라우드플레어의 Monetization Gateway

## Page 29

Use Cases
Referral 기반의 수익 구조
-> Agent에게는 적용 안됨
-> Agent를 위한 새로운 계산대

## Page 30

Use Cases

## Page 31

감사합니다

## SHA-matched local OCR/QR enrichment

# OCR and QR enrichment: The Agentic Commerce Stack_ x402 & mpp.pdf

Generated locally from rendered PDF pages. OCR text is machine-read 
and may contain recognition errors; QR values are decoded payloads.

## Page 1

The Agentic Commerce Stack:
x402 & mpp
유준혁(Jun)
:: FOUR PILLARS
2026년 7월 21일

## Page 2

시작하기에 앞서
MACHINE
PAYMENTS PROTOCOL
클라우드플레어
카카오페이x402
ERC-8183
X402 데이터 분석..
에이전틱 커머스 분석
X402
Jun
FOUR PILARS
Rearcher, Four Pillars
Wednesday, August 12
리눅스 Open Source Summit
TG: @JunYooo
14:15
How x4o2 Brings Open Source Governance to Payments - Junhyeok Yoo, Four Pillars
KST
Grand Ballroom 2-3

## Page 3

시작하기에 앞서
에이전틱 커머스
구매 주체가 사람이 아니라 사람을 대리하는 A 에이전트인 상거래다.탐색,
비교,협상,선택,결제,사후 관리로 이어지는 거래 사이클 전체를 에이전트가
수행한다.
에이전틱 페이먼트
에이전트가 주체가 되어 개시하고 실행하는 가치 이전이다.결제 실행 시점에
사람이 트랜책션 루프 안에 존재하지 않는다는 점이 기존 결제와의 결정적
차이다.
헤드리스 머천트 엔드포인트
UI 레이어를 완전히 제거하고 AP 엔드포인트 자체가 판매 접점이 되는 머천트
형태다.상품 페이지도 장바구니도 체크아웃 화면도 없다.호출 가능한 리소스가
곧 상점이다.

## Page 4

에이전틱 커머스 지형도

## Page 5

에이전틱 커머스(w.블록체인)지형도
CLOUDFLARE
Google Cloud
alchemy
2
VISA
CIRCLE
aws
-BASE

## Page 6

에이전틱 커머스(w.블록체인)지형도
A2A
7
에이전트상호운용
에이전트투에이전트(Agent2Agent)상호운용 프로토콜
에이전트끼리 말하는 법
11v1ng
Google Cloud
김증2026-87-06
UCP
ACP
7
stripe
A
에이전틱 커머스 프로토콜
커머스·체크아웃
에이전트상거래상호운용표준
장바구니와 주문
1iv1ng
11ving
Google Cloud
김2026-07-06
김2026-07-06
AP2
VI (Verifiable Intent)
Trusted Agent Protocol
7
7
7
신원·의도증명
AI 에이전트신뢰인식사양
Agent Payments
col (에이전트 결제 신뢰
검증 가능한 의도 (에이전트상거래 인가 증명레이어)
인가 프로토콜)
누가-정말승인했나
VISA
11v1ng
11v1ng
김증2026-87-06
김승2026-87-06
김승2026-87-06
Google Cloud
x402
MPP
7
7
THE
M
X
stripe
LINUX
결제-정산레일
머신 페이먼츠 프로토콜
HTTP 머신 페이먼트프로토콜
돈이 실제로 움직이는 곳
FOUNDATION
11v1ng
Liv1ng
김2026-07-06
김용2026-87-06
ARC —Automated Reasoning checks
7
검증·가드레일
자동추론 검증(AWS 뉴로심볼릭 정책형식화-검증)
행동이 규칙대로였나
Living
김승2026-87-06

## Page 7

x402, mpp

## Page 8

pay.sh는 x402와 mpp를 동시 지원함
Let your agents pay for any APl.
Compatible with protocols
×402 MPP
Pay.sh handles the payment in one line.
No accounts.No keys.No subscriptions.
protocolx402protocolMPP
IicenseMIT
A Skills 339
TRY IT NOW
The missing payment layer for HTTP —x4o2 & MPP payment challenges with user-authorized stablecoin
signing.
npx @solana/pay claude "buy some water with pay'
$
Install- Quick Start· Docs
#without pay -you get a 402
WORKS WITH AGENTS
IN COLLABORATION WITH
curl https://debugger.pay.sh/mpp/quote/AAPL
Google Cloud
Codex
Claude
# With pay -- it handles the 4e2 challenge and returns the response
pay curl https://debugger.pay.sh/mpp/quote/AAPL
Key Features
Transparent 402 Handling
LIVE SERVICES
Wrap your CLl ( curl, claude, codex, etc.) -- when an APl returns 402, pay detects the payment protocol,
Pay-per-use APls your agent can
prepares the stablecoin transaction, asks the local wallet to authorize and sign it, then retries with the payment
proof.
call now.
Supports both live payment standards on Solana:
•MPP—Machine Payments Protocol
Search the catalog, inspect endpoints, and let an agent pay for exactly the API call it needs. No sign-up,
•x402—x402 Payment Protocol
no account, pay as you go.
Stablecoins deployed to Solana are supported out of the box.

## Page 9

x402 vs MPP
Faciltator
Blockchain
client
Server
GET/api
2
402-Payment
Required
Select payment method
and create payload
Include Header:
×-PAYMENT: b64 payload
/verify
verification
6
do work to
7
fulfll request
/settle
8
Submit tx w/
Notes:
sig to usdc contract
-latency introduced ~= block time
-server can opt to not await
settled response from facilitator
10
Tx confirmed
to have faster api response times
settled
(additional latency is just facilitator
11
return response
API round trip times in that case)
W/×-PAYMENT-RESPONSE
←

## Page 10

x402 vs MPP
THE
LINUX
FOUNDATION
stripe
BASE
Tempo
CLOUDFLARE
×402
MPP
기업 주도
커뮤니티 주도

## Page 11

x402 vs MPP
x402 V2
Request 3
Request 1
Request 2
Request N
On-Chain Tx
On-Chain Tx
On-Chain Tx
On-Chain Tx
N On-Chain Transactions
MPP session
Off-chain vouchers (signature verification only)
Open Channel
Close Channel
Req 2
Req 3
Req N
Req 1
On-Chain Tx
On-Chain Tx
2 on-chain transactions (fixed)
Same service, N new requests to the same LLM APl.
x4o2: on-chain cost grows linearly with N.
MPP: on-chain cost is constant at 2, regardless of N.

## Page 12

x402 vs MPP
402 flow inherited
MPP
x402
Innovation flywheel
Sessions, multi-rail next?
x402 Stacks
Machine Payments Protocol
Rail I Card facilitator,stablecoins
MPP
Multi-rail (crypto, cards, BNPL)
Discovery | x402 Bazaar
Discovery (payments directory)
Abstracted
Settlement* I Deferred payment scheme
Settlement (streaming vouchers)
Into One layer
Sessions (pay-as-you-go)
Session I Reusable Access
SPT (Shared Payment Tokens)
x402 V2 spec | Facilitators, multi-chain(CAIP)
HTTP 402 Primitive
Core Protocol Flow
Same Protocol Flow
*Cloudflare proposal, not in core spec
-driven
Stripe + Tempo driven
Community
Developer-first,bottom-up
Enterprise-first,top-down
Both are open-source and share the same HTTP 4o2 foundation.
One innovates, the other absorbs and evolves.
This cycle accelerates 402-based payment adoption.

## Page 13

x402 vs MPP
자세한 Spec은 x402,mpp docs 참고
https://docs.x402.org/introduction
https://mpp.dev/overview
Claude.gpt와 함께라면 두렵지 않아
Google
mpp docs
×
이미지   동영상   쇼핑  뉴스   짧은 동영상   더보기    도구
AI 모드
전체
mpp.dev
M
https://mpp.dev
MPP —Machine Payments Protocol
MPP (Machine Payments Protocol) is the open standard for machine  Docs · Services · Blog · IETF
Specs; GitHub. MPP —Machine Payments Protocol. The

## Page 14

A2A, AP2, UCP

## Page 15

GoogleCloud의 에이전틱 커머스 스택
소통 레 OI 어: A2A (Agent-to-Agent Protocol)
Google이 개발한 에이전트 간 통신 프로토콜
A2A란?
Google이2025년 4월 개발한 에이전트 간 통신 프로토콜 HTTP/SSE/JSON-RPC기반 클라이언트-서버 모델
•
• 1)다른 에이전트의 능력 발견,2)Task 위임 및 상태 추적,3)필요시 정보 공유
Google의 통합 스택
•A2A->AP2 -> UCP
소통 → 결제 → 쇼핑까지 하나의 스택으로 연결
•
에이전틱 커머스에서 가장 일관된full-stack 접근
A2A**
Remote Agent 1
**
Client Agent
User
A2A**
Remote Agent 2
**

## Page 16

Google Cloud의 에이전틱 커머스 스택
소통레이어:A2A&MCP
두 프로토콜은 경쟁이 아닌 상호보완 관계
역할분담
A2A가 에이전트 간 소통,MCP는 에이전트와
•
외부 시스템의 연결
Agent
Agent
1) 다른 에이전트의 능력 발견,2)Task 위임 및
--A2Aprotocol-->
상태 추적,3)필요시 정보 공유
Organizational or technological boundaries
Local Agents
Local Agents
LLM
Vertex AI (Gemini APl, 3P)
Agent Development Kit
Agent Framework
(ADK)
A
MCP
MCP
-→
-->
APls& Enterprise
APIs & Enterprise
Applications
Applications

## Page 17

GoogleCloud의 에이전틱 커머스 스택
Agent Payments Protocol (AP2)
구글이 제안하는 mandate 기반의 에이전트 결제 프로토콜
··
-
Al Agent
Merchant Ecosystem
Payments Ecosystem

## Page 18

Google Cloud의 에이전틱 커머스 스택
Universal Commerce Protocol (UCP)
구글 클라우드의 커머스 통합 스택
Universal Commerce Protocol (UCP)
Powering agentic experiences across the commerce ecosystem
Universal Commerce Protocol
UCP creates a common language for consumers, agents and businesses to ensure al types of
commerce actions are standardized and secure
^
Capabilities and extensions
°ㅇö°
Agents and businesses have flexibility to choose which capabilities and extensions to adopt
Business
Consumer
Product
Other vertical
Identity linking
Order
Cart
Checkout
↔
Backends
Surfaces
Discovery
capabilities
BB
Process orders,
e.g. AI Mode on
manage inventory,
Search, Gemini, and
and arrange delivery.
others
Businesses remain
Underlying communication
Merchant of Record.
Enables merchants and agents flexibility to communicate in the medium of their choice
Agent2Agent (A2A) Protocol
Model Context Protocol (MCP)
APls
Capability launched
Capability coming soon

## Page 19

Google Cloud의 에이전틱 커머스 스택
쇼핑 레이어:UCP
UcP 업데이트 팔로우업하는 법(https:llscout.nekuda.ai/)
nekuda
Blog
About
nekuda.ai
Monitoring active
Agentic Commerce Protocol Scout
Track real-time changes to leading agentic commerce protocol. Get notified directly to your email
UCP $
ACP $
Google
OpenAl
•LATEST
•LATEST
LAST MERGE
LAST MERGE
q
Fix typo in governance documentation
Remove price and title from checkout examples
No impact on developers as this is only a documentation typo fix with no
Developers reading the documentation will see cleaner examples that
functional changes.
focus on essential fields rather than optional display properties.
patch
patch
merged 5 days ago
merged 1 days ago , aksbro-gpu
00ed47b
e783ffa
sjparsons
merged 5 days ago
merged 1 days ago
Add Meta Platforms Inc. as Corporate CLA Signatory
Fix site title visibility on scroll
patch
patch

## Page 20

당위성을 가져야 한다.

## Page 21

당위성을 가져야 한다.
에이전틱 커머스
한다
마이크로페이먼
가져야
평판
ERC-8004
Solana
당위성을
mpp
F02
KYA
에이전틱

## Page 22

당위성을 가져야 한다.
1.왜 블록체인(솔라나)기반의 결제여야
[전문] 금융위"AI 에이전트 커머스,스테이블코
인만 전제할 필요 없어"
블록체인 기반 결제의 장점이
무엇일까?
7월21일대한민국전략경제포럼
->인증/로그인 없이 진행 가능한
결제
->적은 수수료
첫 번째로 말씀드리고 싶은 것은, 앞서 정대희 KD 부원장님께서 에이전트 커머스가
->빠른 속도
반드시 스테이블코인만을 전제로 논의되기보다는 기술 중립적으로 논의될 필요가 있
다고 말씀하셨는데,저희도 그 부분에 공감하고 있습니다.초소액 고빈도 거래의 경
[경쟁군: 카드 네트워크]
우 카드 결제 수수료보다 적을 수 있지만,거래가 발생할 때마다 바로결제를 해야 하
는지 아니면 주 단위나 월 단위로 모아 정산해야 하는지에 따라 비용이 달라질 수있
습니다.

## Page 23

당위성을 가져야 한다.
2.어느 시장을 노려야 하나?
기존 커머스 시장에 장점이
있을까?
새로운 커머스 시장이 도래하지
않을까?
새로운 커머스 시장에서는 어떤
식으로 해자를 찾을 수 있을까?
자율형
위임형
추천만 받음

## Page 24

당위성을 가져야 한다.
3.어느 레이어를 노릴 것인가?(=어떤 레일이
A2A
a
에이전트상호운용
에이전트투에이전트(Agent2Agent)상호운용 프로토콜
에이전트끼리말하는법
11v1ng
Google Cloud
검증2026-87-66
ACP
UCP
7
stripe
U
커머스&체크아
커머스·체크아웃
에이전틱커머스 프로토콜
에이전트상거래상호운용표준
장바구니와 주문
웃
1.1v1ng
11v1ng
Google Cloud
김82026-07-06
김2026-07-06
신원&의도 증명
AP2
VI (Verifiable Intent)
Trusted Agent Protocol
기
7
검증&가드레일
신원·의도 증명
AI 에이전트 신뢰인식사양
col (에이전트 결제 신뢰
검중 가능한 의도 (에이전트상거래인가 증명레이어)
Agent Payments
p
VISA
인가 프로토콜)
누가-정말승인했나
1.1v1ng
김승2026-87-06
11v1ng
김응2026-87-06
김2826-87-06
Google Cloud
MPP
x402
7
THE
7
stripe
INUX
결제-정산레일
머신 페이먼츠프로토콜
HTTP 머신 페이먼트 프로토콜
돈이 실제로 음직이는 곳
FOUNDATION
경2026-87-06
1ving
11v1ng
김음2026-87-06
ARC — Automated Reasoning checks
검증·가드레일
자동추론 검증(AWS 뉴로심볼릭정책 형식화-검증)
행동이규칙대로였나
1.1v1ng
김승2026-07-06

## Page 25

당위성을 가져야 한다.
4.현재 시장은 무엇을 타겟으로 하는sah.io/mppscan.io/ pay.sh
x402 Transactions by Category (Adjusted)
2.25M
2M
1.75M
1.5M
1.25M
1M
750K
500K
250K
Jul 28, 25
Oct 25, 25
Jan 22, 26
Apr 21, '26
Premium Content & Paywalls
Token Launches & Fair Mints
Data as a Service
Infrastructure & Utilities
AI Generated Content   Agent to Agent Services
Other

## Page 26

Use Cases

## Page 27

Use Cases
수상작 참고
콜로세움
1.를
- Game&Collectiblet: 6개
- DeFi&Trading: 5개
-RWA&Tokenization : 4개
Announcing the Winners
- Prediction Marktes : 4개
of the Solana Frontier
- Al Agent : 3개
Hackathon
- Fintech Infra & Payment :3개
mattytay
Share
26 Jun 2026 —4 min read
Flovia
ONLINE HACKATHON
COLOSSEUM
FRONTER
flovia402.com
ANNOUNCING THE WINNERS
https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/

## Page 28

Use Cases
2.클라우드플레어의 Monetization Gateway
(1) Request
Resource
(5) Verifiably paid
Cloudflare Monetization Gateway
(Your origin)
request
—(2) x402 + price
Agent
(Buyer)
(4) Evidence of payment
(3) Resend with
payment auth
Agent wallet
CLOUDFLARE

## Page 29

Use Cases
OPERATOR
CRAWL-TO-REFER RATIO
WHAT THIS MEANS
23,951:1
Anthropic (ClaudeBot)
Crawls 23,951 pages per 1 referral sent back
Referral 기반의 수익 구조
1,276:1
OpenAI (GPTBot)
Crawls 1,276 pages per 1 referral sent back
->Agent에게는 적용 안됨
111:1
Perplexity (PerplexityBot)
Crawls 111 pages per 1 referral sent back
->Agent를 위한 새로운 계산다
33:1
Microsoft (Copilot)
Includes Copilot and Bing AI features
Mistral
22:1
Relatively low crawl volume
Yandex
21:1
Russian search with growing AI features
Traditional search drives high referral volume
5:1
Google (Gemini / AI Overviews)
Baidu
4.8:1
Chinese search with established referral patterns
ByteDance
3.1:1
TikTok's parent company generates strong referrals
1.5:1
DuckDuckGo
Near-parity—the most efficient ratio of all operators

## Page 30

Use Cases
Jun::@Jun_Yoo·7월 3일
's "Monetization Gateway" Matters?
Why cLOUDFLARE
(feat.x482)
X기사
Why Cloudflare's Monetization Gateway Matters
On July 1, Cloudflare announced Monetization Gateway.
Cloudflare(@Cloudflare) is one of the companies most committed to
agentic payments. In September 2025, it co-founded the x402…
1116
16.9천
6

## Page 31

감사합니다

## Provenance

- Source SHA-256: `99d0e8852e38f8a2a451fa178ee0a5c7464af31027f2b65a34a7798ddb34cbaf`
- Pages: 31
- OCR lines: 641
- Decoded QR payloads: 0
