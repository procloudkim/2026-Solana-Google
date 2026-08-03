const BUYERS = ["A", "B", "C"];
const TERMINAL_STATES = new Set(["NO_BUY", "POLICY_REJECTED", "FINALIZED_FAILED", "RECONCILIATION_REQUIRED", "SAFE_ABORT", "FULFILLED"]);

const scenarios = {
  happy: {
    label: "정상 결제 · 총 1 Devnet USDC",
    mandates: [
      {buyerId: "A", naturalLanguage: "SignalDesk 공동 구매. 최대 0.4 USDC, API와 CSV가 모두 필요합니다."},
      {buyerId: "B", naturalLanguage: "최대 0.34 USDC. API가 필요하고 자동갱신은 금지합니다."},
      {buyerId: "C", naturalLanguage: "최대 0.4 USDC. 7일 동안 쓰는 일회성 상품만 허용합니다."},
    ],
  },
  "cap-low": {
    label: "거부 검증 · B 한도 0.3 USDC",
    mandates: [
      {buyerId: "A", naturalLanguage: "SignalDesk 공동 구매. 최대 0.4 USDC, API와 CSV가 모두 필요합니다."},
      {buyerId: "B", naturalLanguage: "최대 0.3 USDC. API가 필요하고 자동갱신은 금지합니다."},
      {buyerId: "C", naturalLanguage: "최대 0.4 USDC. 7일 동안 쓰는 일회성 상품만 허용합니다."},
    ],
  },
};

const ui = {
  demoKey: document.querySelector("#demo-key"),
  create: document.querySelector("#create-order"),
  run: document.querySelector("#run-order"),
  message: document.querySelector("#operator-message"),
  mandateGrid: document.querySelector("#mandate-grid"),
  approvalSummary: document.querySelector("#approval-summary"),
  selection: document.querySelector("#selection"),
  policyStatus: document.querySelector("#policy-status"),
  policyChecks: document.querySelector("#policy-checks"),
  chainStatus: document.querySelector("#chain-status"),
  evidence: document.querySelector("#evidence"),
  explorer: document.querySelector("#explorer-link"),
  orderState: document.querySelector("#order-state"),
  orderId: document.querySelector("#order-id"),
  copyOrderId: document.querySelector("#copy-order-id"),
  timeline: document.querySelector("#timeline"),
  catalog: document.querySelector("#catalog"),
  entitlementToken: document.querySelector("#entitlement-token"),
  checkAccess: document.querySelector("#check-access"),
  resourcePreview: document.querySelector("#resource-preview"),
  runtimePill: document.querySelector("#runtime-pill"),
  runtimeBanner: document.querySelector("#runtime-banner"),
  runtimeFooter: document.querySelector("#runtime-footer"),
  evidenceHeading: document.querySelector("#evidence-heading"),
  accessProofCopy: document.querySelector("#access-proof-copy"),
  paymentStepLabel: document.querySelector("#payment-step-label"),
};

// Entitlement is kept only in memory for this tab; it is never rendered or persisted.
const state = {
  scenario: "happy",
  order: null,
  pollTimer: null,
  reconciliationFailures: 0,
  reconciling: false,
  runMutationKey: null,
  entitlementToken: null,
  runtimeMode: "unknown",
};

function text(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"})[character]);
}

function shorten(value, start = 9, end = 7) {
  if (!value || value.length <= start + end + 2) return value || "—";
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function displayUsdc(atomic) {
  if (!atomic || !/^\d+$/.test(atomic)) return "—";
  const padded = atomic.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const fraction = padded.slice(-6).replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} USDC`;
}

function setMessage(message, kind = "neutral") {
  ui.message.textContent = message;
  ui.message.className = `operator-message${kind === "neutral" ? "" : ` ${kind}`}`;
}

async function api(path, options = {}) {
  const headers = {Accept: "application/json", ...(options.headers || {})};
  if (options.mutation) {
    const key = ui.demoKey.value;
    if (key.length < 16) throw new Error("16자 이상의 데모 운영 키를 입력하세요.");
    headers["X-Demo-Key"] = key;
  }
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(path, {...options, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body)});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
  return payload;
}

function renderMandates(mandates = []) {
  const approved = mandates.filter((mandate) => mandate.status === "APPROVED").length;
  ui.approvalSummary.textContent = `${approved} / 3 승인`;
  ui.approvalSummary.className = `badge ${approved === 3 ? "badge-good" : "badge-neutral"}`;
  if (!mandates.length) return;
  ui.mandateGrid.innerHTML = mandates.map((mandate) => {
    const isApproved = mandate.status === "APPROVED";
    const chips = [
      ...(mandate.maxAmountAtomic ? [`한도 ${displayUsdc(mandate.maxAmountAtomic)}`] : []),
      ...(mandate.requiredFeatures || []).map((feature) => `필수 ${feature}`),
      ...(mandate.forbiddenFeatures || []).map((feature) => `금지 ${feature}`),
    ];
    return `<article class="mandate-card ${isApproved ? "approved" : ""}">
      <div class="buyer-row"><span class="buyer-avatar">${text(mandate.buyerId)}</span><span class="mandate-status">${text(mandate.status)}</span></div>
      <blockquote>${text(mandate.naturalLanguage)}</blockquote>
      <div class="constraint-chips">${chips.map((chip) => `<span class="chip">${text(chip)}</span>`).join("")}</div>
      <code class="hash" title="${text(mandate.mandateHash)}">HASH · ${text(shorten(mandate.mandateHash))}</code>
      <button class="approve-button ${isApproved ? "approved" : ""}" data-approve="${text(mandate.buyerId)}" ${isApproved || !mandate.mandateHash || !mandate.approvalNonce ? "disabled" : ""}>${isApproved ? "✓ 승인 완료" : "이 조건을 승인"}</button>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-approve]").forEach((button) => button.addEventListener("click", () => approve(button.dataset.approve)));
}

function renderPolicy(order) {
  const agentTrace = order.agent
    ? `<div class="agent-trace"><span>AGENT TRACE</span><strong>${text(order.agent.provider)} · ${text(order.agent.model)}</strong><code>START ${text(order.agent.startedAt)}<br>END ${text(order.agent.completedAt)}<br>SELECTED SKU ${text(order.agent.selectedSkuId)}</code></div>`
    : "";
  if (order.selection) {
    const allocationText = order.selection.allocations
      .map((allocation) => `${allocation.buyerId} ${displayUsdc(allocation.amountAtomic)}`)
      .join(" · ");
    ui.selection.className = "selection-card";
    ui.selection.innerHTML = `<span>SELECTED PRODUCT</span><strong>${text(order.selection.productName)}</strong><p>${text(order.selection.rationale)} · 총 ${text(displayUsdc(order.selection.totalAmountAtomic))} · 분담 ${text(allocationText)}</p>${agentTrace}`;
  } else {
    ui.selection.className = "selection-card muted";
    ui.selection.innerHTML = `<span>SELECTED PRODUCT</span><strong>선택 없음</strong><p>${text(order.failure?.message || "정책 판단을 기다리고 있습니다.")}</p>${agentTrace}`;
  }
  if (!order.policyChecks?.length) {
    ui.policyChecks.innerHTML = '<li class="placeholder-line"></li><li class="placeholder-line short"></li><li class="placeholder-line"></li>';
    ui.policyStatus.textContent = "대기";
    ui.policyStatus.className = "badge badge-neutral";
    return;
  }
  const allPassed = order.policyChecks.every((check) => check.passed);
  ui.policyStatus.textContent = allPassed ? "ALL PASS" : "REJECTED";
  ui.policyStatus.className = `badge ${allPassed ? "badge-good" : "badge-stop"}`;
  ui.policyChecks.innerHTML = order.policyChecks.map((check) => `<li class="check-item ${check.passed ? "" : "fail"}"><span class="check-icon">${check.passed ? "✓" : "×"}</span><span><strong>${text(check.label)}</strong><small>${text(check.detail)}</small></span></li>`).join("");
}

function renderEvidence(evidence) {
  ui.explorer.href = "#";
  ui.explorer.classList.add("disabled");
  if (!evidence) {
    ui.chainStatus.textContent = "미제출";
    ui.chainStatus.className = "badge badge-neutral";
    ui.evidence.innerHTML = `
      <div><dt>TransferChecked</dt><dd>— / 3</dd></div>
      <div><dt>Required signers</dt><dd>— / 4</dd></div>
      <div><dt>Finality</dt><dd>—</dd></div>
      <div><dt>Message hash</dt><dd class="mono">—</dd></div>`;
    return;
  }
  const fixtureOnly = state.runtimeMode === "fixture" || evidence.cluster?.includes("NOT ON-CHAIN");
  const finalized = evidence.commitment === "finalized" && evidence.metaError == null;
  ui.chainStatus.textContent = fixtureOnly ? "FIXTURE ONLY" : finalized ? "FINALIZED" : evidence.commitment || "준비 중";
  ui.chainStatus.className = `badge ${finalized ? "badge-good" : fixtureOnly ? "badge-stop" : "badge-neutral"}`;
  const finalizedRows = evidence.slot
    ? `<div><dt>Finalized slot</dt><dd class="mono">${text(evidence.slot)}</dd></div>
       <div><dt>Raw tx hash</dt><dd class="mono" title="${text(evidence.rawTransactionHash)}">${text(shorten(evidence.rawTransactionHash))}</dd></div>
       <div><dt>Verified mint</dt><dd class="mono" title="${text(evidence.mint)}">${text(shorten(evidence.mint))}</dd></div>
       ${(evidence.sourceDebits || []).map((debit) => `<div class="evidence-detail"><dt>Source ${text(debit.buyerId)}</dt><dd><code title="${text(debit.sourceAta)}">${text(shorten(debit.sourceAta))}</code><small>${text(displayUsdc(debit.preAmountAtomic))} → ${text(displayUsdc(debit.postAmountAtomic))} · debit ${text(displayUsdc(debit.debitAtomic))}</small></dd></div>`).join("")}
       <div class="evidence-detail"><dt>Destination</dt><dd><code title="${text(evidence.destinationAta)}">${text(shorten(evidence.destinationAta))}</code><small>${text(displayUsdc(evidence.destinationPreAmountAtomic))} → ${text(displayUsdc(evidence.destinationPostAmountAtomic))} · credit ${text(displayUsdc(evidence.destinationCreditAtomic))}</small></dd></div>`
    : "";
  ui.evidence.innerHTML = `
    <div><dt>Cluster</dt><dd>${text(evidence.cluster)}</dd></div>
    <div><dt>TransferChecked</dt><dd>${text(evidence.transferCount ?? "—")} / 3</dd></div>
    <div><dt>Required signers</dt><dd>${text(evidence.requiredSignerCount ?? "—")} / 4</dd></div>
    <div><dt>Finality</dt><dd>${text(evidence.commitment || "—")}</dd></div>
    <div><dt>Quote hash</dt><dd class="mono" title="${text(evidence.quoteHash)}">${text(shorten(evidence.quoteHash))}</dd></div>
    <div><dt>Policy proof</dt><dd class="mono" title="${text(evidence.policyProofHash)}">${text(shorten(evidence.policyProofHash))}</dd></div>
    <div><dt>Message hash</dt><dd class="mono" title="${text(evidence.messageHash)}">${text(shorten(evidence.messageHash))}</dd></div>
    ${finalizedRows}`;
  if (evidence.explorerUrl) {
    ui.explorer.href = evidence.explorerUrl;
    ui.explorer.classList.remove("disabled");
  }
}

function renderTimeline(order) {
  ui.orderState.textContent = order.state;
  ui.orderId.textContent = order.orderId;
  ui.copyOrderId.disabled = false;
  if (!order.timeline?.length) return;
  ui.timeline.innerHTML = order.timeline.map((event) => `<li class="timeline-event ${text(event.status)}"><strong>${text(event.state)}</strong><small>${text(event.label)}<br>${text(new Date(event.at).toLocaleTimeString("ko-KR", {hour12: false}))}</small></li>`).join("");
}

async function copyOrderId() {
  const orderId = state.order?.orderId;
  if (!orderId) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(orderId);
    } else {
      const input = document.createElement("textarea");
      input.value = orderId;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      if (!copied) throw new Error("clipboard unavailable");
    }
    setMessage(`주문 ID를 복사했습니다: ${orderId}`, "success");
  } catch {
    setMessage("주문 ID를 복사하지 못했습니다. 화면의 전체 ID를 직접 선택하세요.", "error");
  }
}

function render(order) {
  if (order.entitlements?.[0]?.token) {
    state.entitlementToken = order.entitlements[0].token;
    ui.entitlementToken.placeholder = "발급된 이용권이 안전하게 연결됨";
  }
  state.order = order;
  renderMandates(order.mandates);
  renderPolicy(order);
  renderEvidence(order.evidence);
  renderTimeline(order);
  const allApproved = order.mandates.every((mandate) => mandate.status === "APPROVED");
  ui.run.disabled = state.reconciling || !allApproved || (TERMINAL_STATES.has(order.state) && order.state !== "RECONCILIATION_REQUIRED");
  ui.run.textContent = order.state === "RECONCILIATION_REQUIRED" ? "동일 서명 다시 검증" : "검증 및 결제 실행";
  document.querySelectorAll(".flow-step").forEach((step, index) => {
    const reached = index === 0 || (index === 1 && order.mandates.some((mandate) => mandate.approvedAt)) || (index === 2 && order.policyChecks.length) || (index === 3 && order.evidence) || (index === 4 && order.entitlementCount === 3);
    step.classList.toggle("active", Boolean(reached));
  });
}

async function createOrder() {
  try {
    setMessage("세 구매자 에이전트가 조건을 정규화하고 있습니다…");
    ui.create.disabled = true;
    stopPolling();
    state.runMutationKey = null;
    state.entitlementToken = null;
    ui.entitlementToken.value = "";
    ui.entitlementToken.placeholder = "이용권 토큰 입력";
    const preset = scenarios[state.scenario];
    const order = await api("/api/v1/orders", {
      method: "POST",
      mutation: true,
      headers: {"Idempotency-Key": crypto.randomUUID()},
      body: {scenarioLabel: preset.label, mandates: preset.mandates},
    });
    render(order);
    setMessage(`주문 ${shorten(order.orderId)} 생성 · 각 조건을 개별 승인하세요.`, "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    ui.create.disabled = false;
  }
}

async function approve(buyerId) {
  const mandate = state.order?.mandates.find((item) => item.buyerId === buyerId);
  if (!mandate?.mandateHash || !mandate.approvalNonce) return;
  try {
    setMessage(`구매자 ${buyerId}의 hash를 승인 중입니다…`);
    const order = await api(`/api/v1/orders/${encodeURIComponent(state.order.orderId)}/mandates/${buyerId}/approve`, {
      method: "POST",
      mutation: true,
      body: {mandateHash: mandate.mandateHash, approvalNonce: mandate.approvalNonce},
    });
    render(order);
    setMessage(`구매자 ${buyerId} 승인 완료.`, "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function runOrder() {
  if (!state.order) return;
  try {
    state.reconciling = true;
    state.runMutationKey ||= crypto.randomUUID();
    ui.run.disabled = true;
    setMessage(state.runtimeMode === "live"
      ? "정책 증명 → 메시지 검증 → 서명 원문 저장 → Devnet 제출을 실행합니다…"
      : "fixture 정책·상태 머신을 실행합니다. 온체인 거래는 만들지 않습니다…");
    const order = await postRunMutation(state.order.orderId);
    state.reconciling = !TERMINAL_STATES.has(order.state);
    render(order);
    if (TERMINAL_STATES.has(order.state)) {
      const fulfilledMessage = state.runtimeMode === "live"
        ? "finalized 검증과 이용권 3개 발급이 완료됐습니다."
        : "fixture 흐름과 이용권 발급이 완료됐습니다. 온체인 결제 증거는 아닙니다.";
      setMessage(order.state === "FULFILLED" ? fulfilledMessage : order.failure?.message || `결제가 ${order.state}에서 중단됐습니다.`, order.state === "FULFILLED" ? "success" : "error");
    } else {
      startPolling();
    }
  } catch (error) {
    state.reconciling = false;
    setMessage(error.message, "error");
    ui.run.disabled = false;
  }
}

function postRunMutation(orderId) {
  return api(`/api/v1/orders/${encodeURIComponent(orderId)}/run`, {
    method: "POST",
    mutation: true,
    headers: {"Idempotency-Key": state.runMutationKey},
  });
}

function stopPolling() {
  if (state.pollTimer !== null) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
  state.reconciling = false;
  state.reconciliationFailures = 0;
}

function startPolling() {
  if (state.pollTimer !== null) clearTimeout(state.pollTimer);
  const orderId = state.order.orderId;
  const reconcile = async () => {
    // POST /run advances reconciliation of the already persisted signed bytes.
    // The order id and in-memory mutation key stay unchanged across every retry.
    try {
      const order = await postRunMutation(orderId);
      state.reconciliationFailures = 0;
      state.reconciling = !TERMINAL_STATES.has(order.state);
      render(order);
      if (TERMINAL_STATES.has(order.state)) {
        stopPolling();
        const fulfilledMessage = state.runtimeMode === "live"
          ? "온체인 검증과 이용권 발급 완료."
          : "fixture 검증과 이용권 발급 완료 · NOT ON-CHAIN.";
        setMessage(order.state === "FULFILLED" ? fulfilledMessage : order.failure?.message || order.state, order.state === "FULFILLED" ? "success" : "error");
        return;
      }
      state.pollTimer = setTimeout(reconcile, 1500);
    } catch (error) {
      state.reconciliationFailures += 1;
      if (state.reconciliationFailures >= 3) {
        stopPolling();
        render(state.order);
        setMessage(`재조정 요청을 중단했습니다. 같은 주문에서 다시 실행할 수 있습니다: ${error.message}`, "error");
        return;
      }
      setMessage(`RPC 응답을 다시 확인합니다 (${state.reconciliationFailures}/3)…`);
      state.pollTimer = setTimeout(reconcile, 1500 * (state.reconciliationFailures + 1));
    }
  };
  state.pollTimer = setTimeout(reconcile, 1500);
}

async function loadCatalog() {
  try {
    const {items} = await api("/api/v1/catalog");
    ui.catalog.innerHTML = items.map((item) => `<article class="catalog-card ${item.skuId.toLowerCase().includes("team") ? "featured" : ""}"><span class="sku">${text(item.skuId)}</span><h3>${text(item.name)}</h3><p>${text(item.description)}</p><div class="catalog-meta">${item.features.map((feature) => `<span class="chip">${text(feature)}</span>`).join("")}<span class="chip">${text(item.durationDays)}일</span><span class="chip">${item.autoRenew ? "자동갱신" : "일회성"}</span></div><div class="catalog-price"><span>총 결제액</span><strong>${text(item.displayPrice)}</strong></div></article>`).join("");
  } catch (error) {
    ui.catalog.innerHTML = `<div class="empty-state wide"><p>${text(error.message)}</p></div>`;
  }
}

async function loadRuntime() {
  try {
    const runtime = await api("/api/v1/runtime");
    if (runtime.mode !== "fixture" && runtime.mode !== "live") throw new Error("알 수 없는 runtime mode");
    state.runtimeMode = runtime.mode;
    const live = runtime.mode === "live";
    ui.runtimePill.innerHTML = `<span class="pulse"></span> ${live ? "Solana Devnet · TEST" : "Fixture · NOT ON-CHAIN"}`;
    ui.runtimeBanner.textContent = live
      ? "SOLANA DEVNET · TEST TOKENS · 실제 금전 가치 없음 · OPERATOR-SIMULATED HITL"
      : "FIXTURE · NOT ON-CHAIN · OPERATOR-SIMULATED HITL · Solana 거래 증거 아님";
    ui.runtimeBanner.className = `runtime-banner ${live ? "runtime-live" : "runtime-fixture"}`;
    ui.runtimeFooter.textContent = live ? "SOLANA DEVNET TEST TOKENS · NOT USER CUSTODY" : "FIXTURE · NOT ON-CHAIN";
    ui.evidenceHeading.textContent = live ? "온체인 증거" : "Fixture 실행 증거";
    ui.accessProofCopy.textContent = live
      ? "독립 검증된 finalized 거래로 발급된 이용권만 보호 리소스를 열 수 있습니다."
      : "fixture 완료 상태로 발급된 데모 이용권입니다. 온체인 권리나 결제 증명이 아닙니다.";
    ui.paymentStepLabel.textContent = live ? "원자적 결제" : "원자성 시뮬레이션";
  } catch (error) {
    state.runtimeMode = "unknown";
    ui.runtimeBanner.textContent = `RUNTIME UNKNOWN · 결제 증거로 사용 금지 · ${error.message}`;
    ui.runtimeBanner.className = "runtime-banner runtime-unknown";
  }
}

async function checkAccess() {
  try {
    const token = ui.entitlementToken.value.trim() || state.entitlementToken;
    const result = await api("/api/v1/resources/signaldesk", {headers: token ? {Authorization: `Bearer ${token}`} : {}});
    ui.resourcePreview.textContent = `HTTP 200\n${JSON.stringify(result, null, 2)}`;
  } catch (error) {
    ui.resourcePreview.textContent = `HTTP 403 · ${error.message}`;
  }
}

document.querySelectorAll("[data-scenario]").forEach((button) => button.addEventListener("click", () => {
  state.scenario = button.dataset.scenario;
  document.querySelectorAll("[data-scenario]").forEach((candidate) => candidate.classList.toggle("selected", candidate === button));
  setMessage(state.scenario === "happy" ? "정상 결제 시나리오를 선택했습니다." : "B의 한도를 낮춰 NO BROADCAST를 검증합니다.");
}));
ui.create.addEventListener("click", createOrder);
ui.run.addEventListener("click", runOrder);
ui.copyOrderId.addEventListener("click", copyOrderId);
ui.checkAccess.addEventListener("click", checkAccess);
loadRuntime();
loadCatalog();
