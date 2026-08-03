---
harness_schema: 1
source_path: "참고레퍼런스/개발 관련 레퍼런스 SoT.txt"
sha256: "42e1ba7918bf93f684b4b681962484ca75c5cbad8e8abdb9e28eb80055ad32b5"
size_bytes: 17427
kind: "text"
status: "extracted"
duplicate_of: null
transcript_sidecar: null
enrichment: null
categories:
  - "Solana Engine"
  - "GCP Infrastructure"
  - "AP2/x402 Payment Protocols"
  - "Google ADK"
---

# 개발 관련 레퍼런스 SoT.txt

 HTML 문서에서 불필요한 태그와 스타일 코드를 제거하고, LLM이 문맥과 링크 정보를 효과적으로 파악할 수 있도록 정돈된 Markdown 및 JSON 형태로 정제(Cleansing)한 결과입니다.

---

## 1. Markdown 형태 (RAG 및 Document 학습용)

# Hackathon Resource Hub



## Google Cloud Platform (GCP)

Google Cloud AI Stack, serverless runtime, security, data, observability, and Web3 infrastructure references.

* [Google Cloud Web3 Portal](https://cloud.google.com/web3)

* [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)

* [Google Cloud Vertex AI Samples (GitHub)](https://github.com/GoogleCloudPlatform/vertex-ai-samples)

* [Google Agent Development Kit (ADK)](https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/)

* [ADK Grounding with Search](https://adk.dev/grounding/grounding_with_search/)

* [Google Cloud Agent Starter Pack](https://github.com/GoogleCloudPlatform/agent-starter-pack)

* [Agent Starter Pack Docs](https://googlecloudplatform.github.io/agent-starter-pack/)

* [Cloud Run + Secret Manager 연동 가이드](https://cloud.google.com/run/docs/configuring/services/secrets)

* [Cloud Run Jobs 개요 및 가이드](https://cloud.google.com/run/docs/create-jobs)

* [Google Cloud Secret Manager](https://cloud.google.com/security/products/secret-manager)

* [Secret Manager Access Control (IAM 설정)](https://cloud.google.com/secret-manager/docs/access-control)

* [Cloud KMS](https://cloud.google.com/security/products/security-key-management)

* [Cloud KMS Cryptographic Algorithms](https://www.google.com/url?sa=E&source=gmail&q=https://cloud.google.com/kms/docs/algorithms#elliptic-curve-signing)

* [Cloud Firestore Documentation](https://cloud.google.com/firestore/docs)

* [Google Cloud BigQuery Documentation](https://cloud.google.com/bigquery/docs)

* [Cloud Scheduler Documentation](https://cloud.google.com/scheduler/docs)

* [Google Cloud SDK (gcloud CLI) 설치 및 시작 가이드](https://cloud.google.com/sdk/docs)

* [Google Cloud Blockchain RPC Overview](https://www.google.com/url?sa=E&source=gmail&q=https://cloud.google.com/blockchain-rpc)

* [Google Cloud Blockchain RPC Quickstart](https://cloud.google.com/blockchain-rpc/docs/quickstart)

* [Google Cloud Observability](https://cloud.google.com/products/observability)

* [Error Reporting overview](https://docs.cloud.google.com/error-reporting/docs/grouping-errors)

* [Eventarc + Workflows 연동 가이드](https://cloud.google.com/blog/topics/developers-practitioners/integrating-eventarc-and-workflows)

* [Trigger a workflow with events or Pub/Sub messages](https://docs.cloud.google.com/workflows/docs/trigger-workflow-eventarc)

* [Firebase Authentication / Identity Platform](https://firebase.google.com/docs/auth)

* [Google Cloud Armor](https://docs.cloud.google.com/armor/docs)


## Google Cloud Learning Sessions

Hands-on sessions and tutorial material for Gemini, ADK, MCP, A2A, and agent deployment.

* [Vibe Coding - Zero to One](https://www.google.com/url?sa=E&source=gmail&q=http://goo.gle/itsvibecoding)

* [Develop an app with Gemini (Code Assist)](https://www.google.com/url?sa=E&source=gmail&q=https://goo.gle/app-with-gemini-code)

* [Building Personalized Agents with ADK, MCP, and Memory Bank](https://www.google.com/url?sa=E&source=gmail&q=http://goo.gle/building-personalized-agents-adk-mcp)

* [Build AI Agents with ADK for Java](https://www.google.com/url?sa=E&source=gmail&q=http://goo.gle/build-ai-agents-adk-java)

* [Evaluating Agents with ADK](https://www.google.com/url?sa=E&source=gmail&q=http://goo.gle/evaluating-agents-adk)

* [Google's Agent Stack in Action: ADK, A2A, MCP on Google Cloud](https://www.google.com/url?sa=E&source=gmail&q=https://goo.gle/agent-stack-in-action)

* [Get started with Agent Development Kit (ADK)](https://www.google.com/url?sa=E&source=gmail&q=https://goo.gle/agent-dev-kit)

* [Empower ADK agents with tools](https://www.google.com/url?sa=E&source=gmail&q=https://goo.gle/adk-agents-with-tools)

* [Deploy ADK agents to Agent Engine](https://www.google.com/url?sa=E&source=gmail&q=https://goo.gle/adk-agents-to-agent-engine)


## Architecture Recommendations

권장 아키텍처와 해커톤 기간 내 구현 범위에 대한 가이드입니다.

* **비동기 이벤트 처리 아키텍처 권장:** Pub/Sub + Eventarc + Workflows를 활용하여 pay.sh Webhook, AP2/x402 결제 이벤트, Firestore와 BigQuery 로그 저장을 비동기 파이프라인으로 구성하는 것을 권장합니다.


* **예시 플로우:** 결제 완료 이벤트 수신 → Eventarc로 Workflows 트리거 → 결제 확인 → Firestore 상태 갱신 → 영수증 발행 및 BigQuery 저장 → 에이전트 응답 전송.


* **배포 환경 가이드:** GKE는 5주간의 해커톤 일정 대비 과도한 설정 작업이 될 수 있어 Cloud Run 사용을 강력히 권장합니다. 다만 보안 및 망 분리가 필요한 팀은 VPC 설정을 테스트할 수 있습니다.



## Solana & pay.sh

Solana development, payments, mobile wallet support, pay.sh, and x402 references.

* [Solana Developer Docs](https://solana.com/docs)

* [Solana Developer Resources](https://solana.com/developers)

* [Solana Accept Payments](https://solana.com/docs/payments/accept-payments)

* [Solana Pay Docs](https://docs.solanapay.com/)

* [Solana Pay on Solana Docs](https://solana.com/docs/payments/accept-payments/solana-pay)

* [Solana Mobile Wallet Adapter](https://docs.solanamobile.com/get-started/mobile-wallet-adapter)

* [Solana Wallet Standard / MWA Migration](https://docs.solanamobile.com/recipes/mobile-wallet-adapter/migrating-to-wallet-standard)

* [pay.sh Developer Docs](https://pay.sh/docs)

* [Solana Developer Bootcamp 2026](https://www.youtube.com/watch?v=2pcm7ICRJKU&list=PLilwLeBwGuK4HBRBohc5wZdv-KdOVY-9R)

* [Solana Korea 개발자 부트캠프 2026](https://www.google.com/url?sa=E&source=gmail&q=https://youtu.be/FcXrWxqzYvA?si=z7vhoTZhVXqQ9LfS)

* [x402](https://solana.com/ko/x402)


## Agent Commerce & Payment Protocols

Agentic payment, commerce protocols, inter-agent payment extensions, and MCP references.

* [AP2 (Agent Payments Protocol)](https://ap2-protocol.org/)

* [AP2 GitHub Repository](https://github.com/google-agentic-commerce/AP2)

* [A2A x402 Extension (GitHub)](https://github.com/google-agentic-commerce/a2a-x402)

* [Universal Commerce Protocol (UCP) Organization](https://github.com/Universal-Commerce-Protocol)

* [UCP Spec (GitHub)](https://github.com/universal-commerce-protocol/ucp)

* [UCP Samples (A2A + Gemini example)](https://github.com/Universal-Commerce-Protocol/samples)

* [Agentic Commerce Protocol (ACP) Spec](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)

* [MCP (Model Context Protocol)](https://modelcontextprotocol.io/)


## GitHub Projects for Builders

Starter repos, samples, demos, and implementation references for hackathon teams.

* [Google Cloud Agent Starter Pack](https://github.com/GoogleCloudPlatform/agent-starter-pack)

* [Google Cloud Vertex AI Samples](https://github.com/GoogleCloudPlatform/vertex-ai-samples)

* [AP2 GitHub Repository](https://github.com/google-agentic-commerce/AP2)

* [A2A x402 Extension](https://github.com/google-agentic-commerce/a2a-x402)

* [Awesome x402 Resource Hub](https://github.com/xpaysh/awesome-x402)

* [x402 Agent Kit Example](https://github.com/xpaysh/x402-agent-kit)

* [x402 Wallet for Terminal Agents](https://github.com/0xkoda/x402-wallet)

* [Solana Pay Demo](https://github.com/eimaam/s6-solana-pay)


## Protocol Comparisons / Reading Materials

Landscape and protocol comparison articles for choosing the right payment architecture.

* [Agent Payment Protocol Landscape Comparison](https://www.openfort.io/blog/agentic-payments-landscape)

* [Protocol Comparison (x402 / ACP / AP2 / UCP)](https://www.google.com/url?sa=E&source=gmail&q=https://atxp.ai/blog/agent-payment-protocols-compared)


---

## 2. JSON 형태 (API 파이프라인 및 Fine-tuning 파싱용)

```json
[
  {
    "category": "Google Cloud Platform (GCP)",
    "description": "Google Cloud AI Stack, serverless runtime, security, data, observability, and Web3 infrastructure references.",
    "links": [
      {"title": "Google Cloud Web3 Portal", "url": "https://cloud.google.com/web3"},
      {"title": "Vertex AI Documentation", "url": "https://cloud.google.com/vertex-ai/docs"},
      {"title": "Google Cloud Vertex AI Samples (GitHub)", "url": "https://github.com/GoogleCloudPlatform/vertex-ai-samples"},
      {"title": "Google Agent Development Kit (ADK)", "url": "https://developers.googleblog.com/en/agent-development-kit-easy-to-build-multi-agent-applications/"},
      {"title": "ADK Grounding with Search", "url": "https://adk.dev/grounding/grounding_with_search/"},
      {"title": "Google Cloud Agent Starter Pack", "url": "https://github.com/GoogleCloudPlatform/agent-starter-pack"},
      {"title": "Agent Starter Pack Docs", "url": "https://googlecloudplatform.github.io/agent-starter-pack/"},
      {"title": "Cloud Run + Secret Manager 연동 가이드", "url": "https://cloud.google.com/run/docs/configuring/services/secrets"},
      {"title": "Cloud Run Jobs 개요 및 가이드", "url": "https://cloud.google.com/run/docs/create-jobs"},
      {"title": "Google Cloud Secret Manager", "url": "https://cloud.google.com/security/products/secret-manager"},
      {"title": "Secret Manager Access Control (IAM 설정)", "url": "https://cloud.google.com/secret-manager/docs/access-control"},
      {"title": "Cloud KMS", "url": "https://cloud.google.com/security/products/security-key-management"},
      {"title": "Cloud KMS Cryptographic Algorithms", "url": "https://cloud.google.com/kms/docs/algorithms#elliptic-curve-signing"},
      {"title": "Cloud Firestore Documentation", "url": "https://cloud.google.com/firestore/docs"},
      {"title": "Google Cloud BigQuery Documentation", "url": "https://cloud.google.com/bigquery/docs"},
      {"title": "Cloud Scheduler Documentation", "url": "https://cloud.google.com/scheduler/docs"},
      {"title": "Google Cloud SDK (gcloud CLI) 설치 및 시작 가이드", "url": "https://cloud.google.com/sdk/docs"},
      {"title": "Google Cloud Blockchain RPC Overview", "url": "https://cloud.google.com/blockchain-rpc"},
      {"title": "Google Cloud Blockchain RPC Quickstart", "url": "https://cloud.google.com/blockchain-rpc/docs/quickstart"},
      {"title": "Google Cloud Observability", "url": "https://cloud.google.com/products/observability"},
      {"title": "Error Reporting overview", "url": "https://docs.cloud.google.com/error-reporting/docs/grouping-errors"},
      {"title": "Eventarc + Workflows 연동 가이드", "url": "https://cloud.google.com/blog/topics/developers-practitioners/integrating-eventarc-and-workflows"},
      {"title": "Trigger a workflow with events or Pub/Sub messages", "url": "https://docs.cloud.google.com/workflows/docs/trigger-workflow-eventarc"},
      {"title": "Firebase Authentication / Identity Platform", "url": "https://firebase.google.com/docs/auth"},
      {"title": "Google Cloud Armor", "url": "https://docs.cloud.google.com/armor/docs"}
    ]
  },
  {
    "category": "Google Cloud Learning Sessions",
    "description": "Hands-on sessions and tutorial material for Gemini, ADK, MCP, A2A, and agent deployment.",
    "links": [
      {"title": "Vibe Coding - Zero to One", "url": "http://goo.gle/itsvibecoding"},
      {"title": "Develop an app with Gemini (Code Assist)", "url": "https://goo.gle/app-with-gemini-code"},
      {"title": "Building Personalized Agents with ADK, MCP, and Memory Bank", "url": "http://goo.gle/building-personalized-agents-adk-mcp"},
      {"title": "Build AI Agents with ADK for Java", "url": "http://goo.gle/build-ai-agents-adk-java"},
      {"title": "Evaluating Agents with ADK", "url": "http://goo.gle/evaluating-agents-adk"},
      {"title": "Google's Agent Stack in Action: ADK, A2A, MCP on Google Cloud", "url": "https://goo.gle/agent-stack-in-action"},
      {"title": "Get started with Agent Development Kit (ADK)", "url": "https://goo.gle/agent-dev-kit"},
      {"title": "Empower ADK agents with tools", "url": "https://goo.gle/adk-agents-with-tools"},
      {"title": "Deploy ADK agents to Agent Engine", "url": "https://goo.gle/adk-agents-to-agent-engine"}
    ]
  },
  {
    "category": "Architecture Recommendations",
    "description": "권장 아키텍처와 해커톤 기간 내 구현 범위에 대한 가이드입니다.",
    "guidelines": [
      "비동기 이벤트 처리 아키텍처 권장: Pub/Sub + Eventarc + Workflows를 활용하여 pay.sh Webhook, AP2/x402 결제 이벤트, Firestore와 BigQuery 로그 저장을 비동기 파이프라인으로 구성하는 것을 권장합니다.",
      "예시 플로우: 결제 완료 이벤트 수신 → Eventarc로 Workflows 트리거 → 결제 확인 → Firestore 상태 갱신 → 영수증 발행 및 BigQuery 저장 → 에이전트 응답 전송.",
      "GKE는 5주간의 해커톤 일정 대비 과도한 설정 작업이 될 수 있어 Cloud Run 사용을 강력히 권장합니다. 다만 보안 및 망 분리가 필요한 팀은 VPC 설정을 테스트할 수 있습니다."
    ]
  },
  {
    "category": "Solana & pay.sh",
    "description": "Solana development, payments, mobile wallet support, pay.sh, and x402 references.",
    "links": [
      {"title": "Solana Developer Docs", "url": "https://solana.com/docs"},
      {"title": "Solana Developer Resources", "url": "https://solana.com/developers"},
      {"title": "Solana Accept Payments", "url": "https://solana.com/docs/payments/accept-payments"},
      {"title": "Solana Pay Docs", "url": "https://docs.solanapay.com/"},
      {"title": "Solana Pay on Solana Docs", "url": "https://solana.com/docs/payments/accept-payments/solana-pay"},
      {"title": "Solana Mobile Wallet Adapter", "url": "https://docs.solanamobile.com/get-started/mobile-wallet-adapter"},
      {"title": "Solana Wallet Standard / MWA Migration", "url": "https://docs.solanamobile.com/recipes/mobile-wallet-adapter/migrating-to-wallet-standard"},
      {"title": "pay.sh Developer Docs", "url": "https://pay.sh/docs"},
      {"title": "Solana Developer Bootcamp 2026", "url": "https://www.youtube.com/watch?v=2pcm7ICRJKU&list=PLilwLeBwGuK4HBRBohc5wZdv-KdOVY-9R"},
      {"title": "Solana Korea 개발자 부트캠프 2026", "url": "https://youtu.be/FcXrWxqzYvA?si=z7vhoTZhVXqQ9LfS"},
      {"title": "x402", "url": "https://solana.com/ko/x402"}
    ]
  },
  {
    "category": "Agent Commerce & Payment Protocols",
    "description": "Agentic payment, commerce protocols, inter-agent payment extensions, and MCP references.",
    "links": [
      {"title": "AP2 (Agent Payments Protocol)", "url": "https://ap2-protocol.org/"},
      {"title": "AP2 GitHub Repository", "url": "https://github.com/google-agentic-commerce/AP2"},
      {"title": "A2A x402 Extension (GitHub)", "url": "https://github.com/google-agentic-commerce/a2a-x402"},
      {"title": "Universal Commerce Protocol (UCP) Organization", "url": "https://github.com/Universal-Commerce-Protocol"},
      {"title": "UCP Spec (GitHub)", "url": "https://github.com/universal-commerce-protocol/ucp"},
      {"title": "UCP Samples (A2A + Gemini example)", "url": "https://github.com/Universal-Commerce-Protocol/samples"},
      {"title": "Agentic Commerce Protocol (ACP) Spec", "url": "https://github.com/agentic-commerce-protocol/agentic-commerce-protocol"},
      {"title": "MCP (Model Context Protocol)", "url": "https://modelcontextprotocol.io/"}
    ]
  },
  {
    "category": "GitHub Projects for Builders",
    "description": "Starter repos, samples, demos, and implementation references for hackathon teams.",
    "links": [
      {"title": "Google Cloud Agent Starter Pack", "url": "https://github.com/GoogleCloudPlatform/agent-starter-pack"},
      {"title": "Google Cloud Vertex AI Samples", "url": "https://github.com/GoogleCloudPlatform/vertex-ai-samples"},
      {"title": "AP2 GitHub Repository", "url": "https://github.com/google-agentic-commerce/AP2"},
      {"title": "A2A x402 Extension", "url": "https://github.com/google-agentic-commerce/a2a-x402"},
      {"title": "Awesome x402 Resource Hub", "url": "https://github.com/xpaysh/awesome-x402"},
      {"title": "x402 Agent Kit Example", "url": "https://github.com/xpaysh/x402-agent-kit"},
      {"title": "x402 Wallet for Terminal Agents", "url": "https://github.com/0xkoda/x402-wallet"},
      {"title": "Solana Pay Demo", "url": "https://github.com/eimaam/s6-solana-pay"}
    ]
  },
  {
    "category": "Protocol Comparisons / Reading Materials",
    "description": "Landscape and protocol comparison articles for choosing the right payment architecture.",
    "links": [
      {"title": "Agent Payment Protocol Landscape Comparison", "url": "https://www.openfort.io/blog/agentic-payments-landscape"},
      {"title": "Protocol Comparison (x402 / ACP / AP2 / UCP)", "url": "https://atxp.ai/blog/agent-payment-protocols-compared"}
    ]
  }
]

```
