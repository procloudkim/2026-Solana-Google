import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import type {
  AgentDecisionTrace,
  AgentRuntime,
  BuyerId,
  NaturalLanguageMandate,
} from '../agents/index.js';
import {
  BUYER_IDS,
  atomicAmount,
  canonicalSha256,
  evaluatePolicy,
  mandateHash,
  policyProofHash,
  quoteHash,
  settlementKey,
  settlementMemo,
  splitAtomicAmount,
  type CatalogSkuV1,
  type HumanApprovalV1,
  type MandateV1,
  type PolicyProofV1,
  type QuoteV1,
} from '../domain/index.js';
import {
  HttpServiceError,
  type ApproveMandateRequest,
  type CatalogItemView,
  type CreateOrderRequest,
  type MandatePoolHttpService,
  type OrderSnapshotView,
  type ProtectedResourceResult,
  type RunOrderRequest,
  type SettlementEvidenceView,
} from '../http/contracts.js';
import type {WorkflowRepository} from '../persistence/index.js';
import {
  WorkflowError,
  type JsonObject,
  type WorkflowOrder,
  type WorkflowState,
} from '../workflow/index.js';
import {
  SettlementPreparationError,
  settlementPlanFromQuote,
  type PreparedSettlement,
  type SettlementFinalization,
  type SettlementRuntime,
} from './settlement-runtime.js';

const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

export interface BuyerIdentity {
  readonly signerAddress: string;
  readonly sourceAta: string;
}

export interface MandatePoolServiceOptions {
  readonly repository: WorkflowRepository;
  readonly agentRuntime: AgentRuntime;
  readonly settlementRuntime: SettlementRuntime;
  readonly catalog: readonly CatalogSkuV1[];
  readonly buyerIdentities: Readonly<Record<BuyerId, BuyerIdentity>>;
  readonly entitlementSecret: string;
  readonly entitlementPreviousSecrets?: readonly string[];
  readonly now?: () => Date;
}

interface StoredEntitlement {
  readonly entitlementId: string;
  readonly buyerId: BuyerId;
  readonly skuId: string;
  readonly expiresAt: string;
  readonly keyId: string;
  readonly tokenHash: string;
}

interface StoredOrderContext {
  readonly requestHash: string;
  readonly scenarioLabel: string | null;
  readonly naturalMandates: readonly {
    readonly buyerId: BuyerId;
    readonly naturalLanguage: string;
  }[];
  readonly mandates: readonly MandateV1[];
  readonly approvalNonces: Readonly<Record<BuyerId, string>>;
  readonly approvals: Readonly<Partial<Record<BuyerId, HumanApprovalV1>>>;
  readonly runIdempotencyKeyHash?: string;
  readonly agentTrace: AgentDecisionTrace;
  readonly quote?: QuoteV1;
  readonly policyProof?: PolicyProofV1;
  readonly evidence?: SettlementEvidenceView;
  readonly entitlements?: readonly StoredEntitlement[];
  readonly failure?: {readonly code: string; readonly message: string} | null;
}

function jsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function contextOf(order: WorkflowOrder): StoredOrderContext {
  return order.context as unknown as StoredOrderContext;
}

function rawTransactionHash(rawBase64: string): string {
  return createHash('sha256')
    .update(Buffer.from(rawBase64, 'base64'))
    .digest('hex');
}

function isBuyerId(value: unknown): value is BuyerId {
  return typeof value === 'string' && BUYER_IDS.includes(value as BuyerId);
}

function exactBuyerSet<T extends {readonly buyerId: BuyerId}>(
  values: readonly T[],
): readonly T[] {
  if (
    values.length !== 3 ||
    BUYER_IDS.some(
      (buyerId) => values.filter((value) => value.buyerId === buyerId).length !== 1,
    )
  ) {
    throw new HttpServiceError(
      422,
      'BUYERS_MUST_BE_A_B_C',
      '구매자 A, B, C가 정확히 한 명씩 필요합니다.',
    );
  }
  return BUYER_IDS.map((buyerId) => {
    const value = values.find((candidate) => candidate.buyerId === buyerId);
    if (value === undefined) throw new Error('Exact buyer set invariant failed');
    return value;
  });
}

function minimumDays(requiredFeatures: readonly string[]): number {
  return requiredFeatures.includes('7-day-access') ? 7 : 0;
}

function displayUsdc(amountAtomic: string): string {
  const padded = amountAtomic.padStart(7, '0');
  const whole = padded.slice(0, -6);
  const fraction = padded.slice(-6).replace(/0+$/u, '');
  return `${whole}${fraction === '' ? '' : `.${fraction}`} USDC`;
}

function timelineLabel(state: WorkflowState): string {
  const labels: Record<WorkflowState, string> = {
    DRAFT: '주문 초안 생성',
    AWAITING_APPROVAL: '구매 조건 HITL 승인 대기',
    APPROVED: '세 구매 조건 승인 완료',
    PLANNED: '에이전트 상품 선택 완료',
    NO_BUY: '공통 조건 상품 없음',
    POLICY_REJECTED: '결정론적 정책 거부',
    RESERVED: '예산 및 quote 예약',
    MESSAGE_BUILT: 'Solana 메시지 생성·검증',
    SIGNING: '네 signer가 동일 메시지 서명',
    FULLY_SIGNED: '완전 서명 원본 보관',
    SUBMISSION_STARTED: '동일 바이트 제출·조정',
    FINALIZED_FAILED: '온체인 실패 확정',
    RECONCILIATION_REQUIRED: '결과 불명, 수동 확인 필요',
    FINALIZED_SUCCESS: 'finalized 거래 독립 검증',
    FULFILLING: '구매자별 이용권 발급',
    FULFILLED: '이용권 3개 발급 완료',
    SAFE_ABORT: '결제 전 안전 중단',
  };
  return labels[state];
}

export class MandatePoolService implements MandatePoolHttpService {
  readonly #repository: WorkflowRepository;
  readonly #agentRuntime: AgentRuntime;
  readonly #settlementRuntime: SettlementRuntime;
  readonly #catalog: readonly CatalogSkuV1[];
  readonly #buyerIdentities: Readonly<Record<BuyerId, BuyerIdentity>>;
  readonly #activeEntitlementKeyId: string;
  readonly #entitlementKeys: ReadonlyMap<string, string>;
  readonly #now: () => Date;
  readonly #preparedInProcess = new Map<string, PreparedSettlement>();

  constructor(options: MandatePoolServiceOptions) {
    const entitlementSecrets = [
      options.entitlementSecret,
      ...(options.entitlementPreviousSecrets ?? []),
    ];
    entitlementSecrets.forEach((secret) => {
      if (secret.length < 24) {
        throw new Error('Every entitlement secret must contain at least 24 characters');
      }
    });
    if (new Set(entitlementSecrets).size !== entitlementSecrets.length) {
      throw new Error('Entitlement keyring secrets must be distinct');
    }
    if (options.catalog.length !== 3) {
      throw new Error('The v0 catalog must contain exactly three SKUs');
    }
    this.#repository = options.repository;
    this.#agentRuntime = options.agentRuntime;
    this.#settlementRuntime = options.settlementRuntime;
    this.#catalog = options.catalog;
    this.#buyerIdentities = options.buyerIdentities;
    const entitlementKeys = new Map(
      entitlementSecrets.map((secret) => [this.#entitlementKeyId(secret), secret]),
    );
    if (entitlementKeys.size !== entitlementSecrets.length) {
      throw new Error('Entitlement key identifiers must be distinct');
    }
    this.#activeEntitlementKeyId = this.#entitlementKeyId(
      options.entitlementSecret,
    );
    this.#entitlementKeys = entitlementKeys;
    this.#now = options.now ?? (() => new Date());
  }

  async catalog(): Promise<CatalogItemView[]> {
    return this.#catalog.map((sku) => ({
      skuId: sku.skuId,
      name: sku.name,
      description:
        sku.skuId === 'signaldesk-team-3'
          ? '세 에이전트가 공동 구매하는 7일 API·CSV 데이터 이용권'
          : '교집합 정책을 검증하기 위한 비교 상품',
      features: [...sku.features],
      durationDays: sku.accessDays,
      autoRenew: sku.autoRenewal,
      totalAmountAtomic: sku.totalAmountAtomic,
      displayPrice: displayUsdc(sku.totalAmountAtomic),
    }));
  }

  async createOrder(request: CreateOrderRequest): Promise<OrderSnapshotView> {
    const orderedMandates = exactBuyerSet(request.mandates);
    const requestHash = canonicalSha256({
      scenarioLabel: request.scenarioLabel ?? null,
      mandates: orderedMandates,
    });
    const prior = await this.#repository.getOrderByIdempotencyKey(
      request.idempotencyKey,
    );
    if (prior !== null) {
      if (contextOf(prior).requestHash !== requestHash) {
        throw new HttpServiceError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          '같은 Idempotency-Key가 다른 주문 본문에 사용됐습니다.',
        );
      }
      return this.#snapshot(prior, false);
    }

    const now = this.#now();
    const orderId = `ord_${randomUUID().replaceAll('-', '')}`;
    const naturalMandates: NaturalLanguageMandate[] = orderedMandates.map(
      (mandate) => ({
        ...mandate,
        ...this.#buyerIdentities[mandate.buyerId],
      }),
    );
    const agentTrace = await this.#agentRuntime.plan({
      orderId,
      mandates: naturalMandates,
      catalog: this.#catalog.map((sku) => ({
        skuId: sku.skuId,
        name: sku.name,
        features: [...sku.features],
        forbiddenCharacteristics: sku.autoRenewal ? ['auto-renew'] : [],
        durationDays: sku.accessDays,
        autoRenew: sku.autoRenewal,
        totalAmountAtomic: sku.totalAmountAtomic,
      })),
      allowedMint: this.#catalog[0]?.mint ?? '',
      allowedMerchantOwners: [this.#catalog[0]?.merchantOwner ?? ''],
      now,
    });

    const proposals = exactBuyerSet(agentTrace.normalizedMandates);
    const expectedMint = this.#catalog[0]?.mint;
    const expectedMerchant = this.#catalog[0]?.merchantOwner;
    if (expectedMint === undefined || expectedMerchant === undefined) {
      throw new Error('Catalog configuration is empty');
    }
    const mandates: MandateV1[] = proposals.map((proposal) => {
      if (
        proposal.allowedMint !== expectedMint ||
        proposal.allowedMerchantOwners.length !== 1 ||
        proposal.allowedMerchantOwners[0] !== expectedMerchant
      ) {
        throw new HttpServiceError(
          422,
          'AGENT_ALLOWLIST_DEVIATION',
          `구매자 ${proposal.buyerId} 정규화 결과가 서버 allowlist를 벗어났습니다.`,
        );
      }
      const identity = this.#buyerIdentities[proposal.buyerId];
      return {
        schema: 'mandate-pool/mandate@1',
        mandateId: `${orderId}-mandate-${proposal.buyerId.toLowerCase()}`,
        buyerId: proposal.buyerId,
        signerAddress: identity.signerAddress,
        sourceAta: identity.sourceAta,
        allowedMint: expectedMint,
        allowedMerchantOwners: [expectedMerchant],
        requiredFeatures: proposal.requiredFeatures.filter(
          (feature) => feature !== '7-day-access',
        ),
        forbiddenFeatures: proposal.forbiddenFeatures.filter(
          (feature) => feature !== 'auto-renew',
        ),
        maxAmountAtomic: atomicAmount(proposal.maxAmountAtomic),
        minimumAccessDays: minimumDays(proposal.requiredFeatures),
        allowAutoRenewal: !proposal.forbiddenFeatures.includes('auto-renew'),
        validUntil: proposal.validUntil,
        nonce: randomUUID(),
      };
    });
    const approvalNonces = Object.fromEntries(
      BUYER_IDS.map((buyerId) => [buyerId, `${randomUUID()}${randomUUID()}`]),
    ) as Record<BuyerId, string>;
    const storedContext: StoredOrderContext = {
      requestHash,
      scenarioLabel: request.scenarioLabel ?? null,
      naturalMandates: orderedMandates,
      mandates,
      approvalNonces,
      approvals: {},
      agentTrace,
    };
    const created = await this.#repository.createOrder({
      orderId,
      idempotencyKey: request.idempotencyKey,
      context: jsonObject(storedContext),
      actor: 'checkout-api',
      at: now.toISOString(),
    });
    if (!created.created && contextOf(created.order).requestHash !== requestHash) {
      throw new HttpServiceError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        '동시 요청에서 Idempotency-Key 충돌이 발견됐습니다.',
      );
    }
    const order =
      created.order.state === 'DRAFT'
        ? await this.#repository.transition({
            orderId: created.order.orderId,
            expectedVersion: created.order.version,
            to: 'AWAITING_APPROVAL',
            actor: 'checkout-api',
            at: this.#now().toISOString(),
            eventType: 'MANDATES_NORMALIZED',
            payload: {agentProvider: agentTrace.provider},
          })
        : created.order;
    return this.#snapshot(order, false);
  }

  async approveMandate(
    orderId: string,
    buyerId: BuyerId,
    request: ApproveMandateRequest,
  ): Promise<OrderSnapshotView> {
    if (!isBuyerId(buyerId)) {
      throw new HttpServiceError(422, 'INVALID_BUYER', '유효하지 않은 구매자입니다.');
    }
    const order = await this.#requiredOrder(orderId);
    const context = contextOf(order);
    const mandate = context.mandates.find(
      (candidate) => candidate.buyerId === buyerId,
    );
    if (mandate === undefined) throw new Error('Stored mandate is missing');
    const expectedHash = mandateHash(mandate);
    const priorApproval = context.approvals[buyerId];
    if (priorApproval !== undefined) {
      if (request.mandateHash !== expectedHash) {
        throw new HttpServiceError(
          409,
          'STALE_MANDATE_HASH',
          '이미 승인된 mandate와 다른 hash입니다.',
        );
      }
      return this.#snapshot(order, false);
    }
    if (order.state !== 'AWAITING_APPROVAL') {
      throw new HttpServiceError(
        409,
        'APPROVAL_CLOSED',
        `현재 상태 ${order.state}에서는 승인할 수 없습니다.`,
      );
    }
    if (
      request.mandateHash !== expectedHash ||
      request.approvalNonce !== context.approvalNonces[buyerId]
    ) {
      throw new HttpServiceError(
        409,
        'STALE_MANDATE_APPROVAL',
        'mandate hash 또는 일회성 승인 nonce가 일치하지 않습니다.',
      );
    }
    const now = this.#now().toISOString();
    const approval: HumanApprovalV1 = {
      schema: 'mandate-pool/human-approval@1',
      approvalId: randomUUID(),
      buyerId,
      mandateHash: expectedHash,
      decision: 'approved',
      method: 'demo_operator',
      approvedAt: now,
      validUntil: mandate.validUntil,
      nonce: request.approvalNonce,
    };
    const approvals = {...context.approvals, [buyerId]: approval};
    const allApproved = BUYER_IDS.every(
      (candidate) => approvals[candidate] !== undefined,
    );
    const updated = await this.#repository.transition({
      orderId,
      expectedVersion: order.version,
      to: allApproved ? 'APPROVED' : 'AWAITING_APPROVAL',
      actor: `human:${buyerId}`,
      at: now,
      eventType: `MANDATE_${buyerId}_APPROVED`,
      payload: {buyerId, mandateHash: expectedHash},
      contextPatch: jsonObject({approvals}),
    });
    return this.#snapshot(updated, false);
  }

  async runOrder(
    orderId: string,
    request?: RunOrderRequest,
  ): Promise<OrderSnapshotView> {
    const runIdempotencyKey =
      request?.idempotencyKey ?? `internal-run:${orderId}`;
    if (
      runIdempotencyKey.length < 8 ||
      runIdempotencyKey.length > 128
    ) {
      throw new HttpServiceError(
        400,
        'INVALID_IDEMPOTENCY_KEY',
        '실행 Idempotency-Key는 8~128자여야 합니다.',
      );
    }
    const runIdempotencyKeyHash = createHash('sha256')
      .update(`MANDATE_POOL_RUN_V1\0${orderId}\0${runIdempotencyKey}`)
      .digest('hex');
    let localPrepared = this.#preparedInProcess.get(orderId);
    for (let step = 0; step < 20; step += 1) {
      const order = await this.#requiredOrder(orderId);
      const context = contextOf(order);
      if (
        context.runIdempotencyKeyHash !== undefined &&
        context.runIdempotencyKeyHash !== runIdempotencyKeyHash
      ) {
        throw new HttpServiceError(
          409,
          'RUN_IDEMPOTENCY_KEY_REUSED',
          '이 주문은 최초 실행에 사용한 Idempotency-Key로만 재조정할 수 있습니다.',
        );
      }
      switch (order.state) {
        case 'DRAFT':
        case 'AWAITING_APPROVAL':
          throw new HttpServiceError(
            409,
            'APPROVAL_REQUIRED',
            '구매자 A, B, C의 mandate 승인이 모두 필요합니다.',
          );
        case 'APPROVED': {
          if (context.agentTrace.selection.skuId === 'NO_BUY') {
            await this.#repository.transition({
              orderId,
              expectedVersion: order.version,
              to: 'PLANNED',
              actor: 'coalition-agent',
              at: this.#now().toISOString(),
              payload: {selection: 'NO_BUY'},
              contextPatch: jsonObject({runIdempotencyKeyHash}),
            });
            continue;
          }
          const quote = this.#buildQuote(orderId, context);
          const approvals = BUYER_IDS.map((buyerId) => context.approvals[buyerId]);
          if (approvals.some((approval) => approval === undefined)) {
            throw new Error('APPROVED order is missing an approval');
          }
          const policyProof = evaluatePolicy({
            mandates: context.mandates,
            approvals: approvals as HumanApprovalV1[],
            quote,
            evaluatedAt: this.#now().toISOString(),
            catalog: this.#catalog,
          });
          await this.#repository.transition({
            orderId: order.orderId,
            expectedVersion: order.version,
            to: 'PLANNED',
            actor: 'policy-engine',
            at: this.#now().toISOString(),
            eventType: 'QUOTE_AND_POLICY_EVALUATED',
            payload: {
              quoteHash: quoteHash(quote),
              policyProofHash: policyProofHash(policyProof),
            },
            contextPatch: jsonObject({
              quote,
              policyProof,
              runIdempotencyKeyHash,
            }),
          });
          continue;
        }
        case 'PLANNED': {
          if (context.agentTrace.selection.skuId === 'NO_BUY') {
            const terminal = await this.#repository.transition({
              orderId,
              expectedVersion: order.version,
              to: 'NO_BUY',
              actor: 'coalition-agent',
              at: this.#now().toISOString(),
              contextPatch: jsonObject({
                failure: {
                  code: 'NO_COMMON_PRODUCT',
                  message: context.agentTrace.selection.rationale,
                },
              }),
            });
            return this.#snapshot(terminal, false);
          }
          if (context.quote === undefined || context.policyProof === undefined) {
            throw new Error('Planned order is missing quote/policy data');
          }
          // A prior policy result is evidence about its original evaluation
          // time, not a timeless authorization. Re-evaluate after a retry or
          // process pause before reserving any buyer budget.
          const freshPolicyProof = this.#evaluateCurrentPolicy(context);
          if (!context.policyProof.approved || !freshPolicyProof.approved) {
            const terminal = await this.#repository.transition({
              orderId,
              expectedVersion: order.version,
              to: 'POLICY_REJECTED',
              actor: 'policy-engine',
              at: this.#now().toISOString(),
              contextPatch: jsonObject({
                policyProof: freshPolicyProof,
                failure: {
                  code: 'POLICY_REJECTED',
                  message: '현재 시각 기준으로 승인된 mandate와 quote의 결정론적 검사를 통과하지 못했습니다.',
                },
              }),
            });
            return this.#snapshot(terminal, false);
          }
          for (const mandate of context.mandates) {
            await this.#repository.registerBudget({
              mandateId: mandate.mandateId,
              buyerId: mandate.buyerId,
              mint: mandate.allowedMint,
              limitAtomic: mandate.maxAmountAtomic,
              at: this.#now().toISOString(),
            });
          }
          await this.#repository.reserveSettlement({
            orderId,
            expectedVersion: order.version,
            settlementKey: settlementKey(
              quoteHash(context.quote),
              policyProofHash(context.policyProof),
            ),
            quoteHash: quoteHash(context.quote),
            policyProofHash: policyProofHash(context.policyProof),
            totalAtomic: context.quote.totalAmountAtomic,
            allocations: context.quote.allocations.map((allocation) => ({
              mandateId:
                context.mandates.find(
                  (mandate) => mandate.buyerId === allocation.buyerId,
                )?.mandateId ?? '',
              buyerId: allocation.buyerId,
              mint: context.quote?.sku.mint ?? '',
              amountAtomic: allocation.amountAtomic,
            })),
            actor: 'settlement-coordinator',
            at: this.#now().toISOString(),
          });
          continue;
        }
        case 'RESERVED': {
          if (context.quote === undefined || context.policyProof === undefined) {
            throw new Error('Reserved order is missing quote/policy data');
          }
          // Reservation does not authorize a later signature forever. Check
          // mandate, approval, quote, catalog, amount and recipient again at
          // the last safe point before building or signing transaction bytes.
          const freshPolicyProof = this.#evaluateCurrentPolicy(context);
          if (!freshPolicyProof.approved) {
            const terminal = await this.#repository.transition({
              orderId,
              expectedVersion: order.version,
              to: 'SAFE_ABORT',
              actor: 'signer-guard',
              at: this.#now().toISOString(),
              eventType: 'AUTHORIZATION_REVALIDATION_FAILED',
              contextPatch: jsonObject({
                policyProof: freshPolicyProof,
                failure: {
                  code: 'AUTHORIZATION_EXPIRED',
                  message: '서명 직전 재검증에서 mandate, 승인 또는 quote가 만료되어 결제하지 않았습니다.',
                },
              }),
            });
            return this.#snapshot(terminal, false);
          }
          try {
            localPrepared = await this.#settlementRuntime.prepare(
              context.quote,
              context.policyProof,
            );
          } catch (error) {
            const message =
              error instanceof SettlementPreparationError
                ? error.message
                : '결제 메시지 준비 단계에서 안전하게 중단했습니다.';
            const terminal = await this.#repository.transition({
              orderId,
              expectedVersion: order.version,
              to: 'SAFE_ABORT',
              actor: 'signer-guard',
              at: this.#now().toISOString(),
              contextPatch: jsonObject({
                failure: {code: 'PREPARATION_ABORTED', message},
              }),
            });
            return this.#snapshot(terminal, false);
          }
          this.#preparedInProcess.set(orderId, localPrepared);
          await this.#repository.attachMessage({
            orderId,
            expectedVersion: order.version,
            message: {
              attemptId: `attempt:${order.reservation?.settlementKey ?? orderId}`,
              messageHash: localPrepared.messageHash,
              messageBase64: localPrepared.messageBase64,
              recentBlockhash: localPrepared.blockhash,
              lastValidBlockHeight: Number(localPrepared.lastValidBlockHeight),
              requiredSigners: [
                localPrepared.plan.sponsorAddress,
                ...localPrepared.plan.transfers.map((transfer) => transfer.authority),
              ],
            },
            actor: 'transaction-builder',
            at: this.#now().toISOString(),
          });
          continue;
        }
        case 'MESSAGE_BUILT': {
          const freshPolicyProof = this.#evaluateCurrentPolicy(context);
          if (!freshPolicyProof.approved) {
            const terminal = await this.#safeAbortExpiredAuthorization(
              order,
              freshPolicyProof,
            );
            return this.#snapshot(terminal, false);
          }
          if (
            localPrepared === undefined ||
            !this.#preparedMatchesStoredMessage(order, localPrepared)
          ) {
            this.#preparedInProcess.delete(orderId);
            const terminal = await this.#safeAbortLostUnsignedAttempt(order);
            return this.#snapshot(terminal, false);
          }
          await this.#repository.transition({
            orderId,
            expectedVersion: order.version,
            to: 'SIGNING',
            actor: 'signer-guard',
            at: this.#now().toISOString(),
          });
          continue;
        }
        case 'SIGNING': {
          const freshPolicyProof = this.#evaluateCurrentPolicy(context);
          if (!freshPolicyProof.approved) {
            const terminal = await this.#safeAbortExpiredAuthorization(
              order,
              freshPolicyProof,
            );
            return this.#snapshot(terminal, false);
          }
          if (
            localPrepared === undefined ||
            !this.#preparedMatchesStoredMessage(order, localPrepared)
          ) {
            this.#preparedInProcess.delete(orderId);
            const terminal = await this.#safeAbortLostUnsignedAttempt(order);
            return this.#snapshot(terminal, false);
          }
          await this.#repository.markFullySigned({
            orderId,
            expectedVersion: order.version,
            signedTransaction: {
              rawTransactionBase64: localPrepared.rawTransactionBase64,
              rawTransactionHash: localPrepared.rawTransactionHash,
              txSignature: localPrepared.transactionSignature,
            },
            actor: 'signer-guard',
            at: this.#now().toISOString(),
          });
          this.#preparedInProcess.delete(orderId);
          continue;
        }
        case 'FULLY_SIGNED': {
          const freshPolicyProof = this.#evaluateCurrentPolicy(context);
          if (!freshPolicyProof.approved) {
            const terminal = await this.#safeAbortExpiredAuthorization(
              order,
              freshPolicyProof,
            );
            return this.#snapshot(terminal, false);
          }
          const signed = order.settlement?.signedTransaction;
          const message = order.settlement?.message;
          if (signed === undefined || message === undefined) {
            throw new Error('Fully signed state is missing immutable artifacts');
          }
          await this.#repository.recordSubmission({
            orderId,
            expectedVersion: order.version,
            attemptId: message.attemptId,
            rawTransactionHash: signed.rawTransactionHash,
            txSignature: signed.txSignature,
            actor: 'rpc-submitter',
            at: this.#now().toISOString(),
          });
          continue;
        }
        case 'SUBMISSION_STARTED': {
          const prepared = this.#preparedFromOrder(order, context);
          const finalization = await this.#settlementRuntime.finalize(prepared);
          if (finalization.status === 'pending') {
            return this.#snapshot(order, false);
          }
          if (finalization.status === 'unknown') {
            const unknown = await this.#repository.transition({
              orderId,
              expectedVersion: order.version,
              to: 'RECONCILIATION_REQUIRED',
              actor: 'rpc-reconciler',
              at: this.#now().toISOString(),
              contextPatch: jsonObject({
                evidence: this.#evidence(prepared, finalization),
                failure: {
                  code: 'RECONCILIATION_REQUIRED',
                  message: 'blockhash 만료 후에도 거래 결과가 확정되지 않아 자동 재결제를 중단했습니다.',
                },
              }),
            });
            return this.#snapshot(unknown, false);
          }
          if (finalization.status === 'failed') {
            const failed = await this.#repository.transition({
              orderId,
              expectedVersion: order.version,
              to: 'FINALIZED_FAILED',
              actor: 'merchant-verifier',
              at: this.#now().toISOString(),
              contextPatch: jsonObject({
                evidence: this.#evidence(prepared, finalization),
                failure: {
                  code: 'FINALIZED_FAILED',
                  message: `토큰 전송은 롤백됐습니다. Sponsor fee는 발생할 수 있습니다: ${finalization.metaError}`,
                },
              }),
            });
            return this.#snapshot(failed, false);
          }
          await this.#repository.transition({
            orderId,
            expectedVersion: order.version,
            to: 'FINALIZED_SUCCESS',
            actor: 'merchant-verifier',
            at: this.#now().toISOString(),
            contextPatch: jsonObject({
              evidence: this.#evidence(prepared, finalization),
            }),
          });
          continue;
        }
        case 'FINALIZED_SUCCESS':
          await this.#repository.transition({
            orderId,
            expectedVersion: order.version,
            to: 'FULFILLING',
            actor: 'merchant-fulfillment',
            at: this.#now().toISOString(),
          });
          continue;
        case 'FULFILLING': {
          if (context.quote === undefined) throw new Error('Fulfillment quote missing');
          const entitlements = this.#buildEntitlements(orderId, context.quote);
          const fulfilled = await this.#repository.transition({
            orderId,
            expectedVersion: order.version,
            to: 'FULFILLED',
            actor: 'merchant-fulfillment',
            at: this.#now().toISOString(),
            contextPatch: jsonObject({entitlements}),
          });
          return this.#snapshot(fulfilled, true);
        }
        case 'RECONCILIATION_REQUIRED': {
          const prepared = this.#preparedFromOrder(order, context);
          const finalization = await this.#settlementRuntime.reconcile(prepared);
          if (
            finalization.status === 'pending' ||
            finalization.status === 'unknown'
          ) {
            return this.#snapshot(order, false);
          }
          if (finalization.status === 'failed') {
            const failed = await this.#repository.transition({
              orderId,
              expectedVersion: order.version,
              to: 'FINALIZED_FAILED',
              actor: 'rpc-reconciler',
              at: this.#now().toISOString(),
              contextPatch: jsonObject({
                evidence: this.#evidence(prepared, finalization),
                failure: {
                  code: 'FINALIZED_FAILED',
                  message: `재조정에서 온체인 실패를 확인했습니다: ${finalization.metaError}`,
                },
              }),
            });
            return this.#snapshot(failed, false);
          }
          await this.#repository.transition({
            orderId,
            expectedVersion: order.version,
            to: 'FINALIZED_SUCCESS',
            actor: 'rpc-reconciler',
            at: this.#now().toISOString(),
            eventType: 'RECONCILIATION_VERIFIED',
            contextPatch: jsonObject({
              evidence: this.#evidence(prepared, finalization),
              failure: null,
            }),
          });
          continue;
        }
        case 'NO_BUY':
        case 'POLICY_REJECTED':
        case 'FINALIZED_FAILED':
        case 'SAFE_ABORT':
          return this.#snapshot(order, false);
        case 'FULFILLED':
          return this.#snapshot(order, true);
      }
    }
    throw new HttpServiceError(
      503,
      'WORKFLOW_STEP_LIMIT',
      '워크플로 상태 진행 한도를 초과했습니다.',
    );
  }

  async getOrder(orderId: string): Promise<OrderSnapshotView | null> {
    const order = await this.#repository.getOrder(orderId);
    return order === null ? null : this.#snapshot(order, false);
  }

  async getProtectedResource(
    entitlementToken: string | null,
  ): Promise<ProtectedResourceResult> {
    if (entitlementToken === null) {
      return {authorized: false, reason: '결제 후 발급되는 이용권이 필요합니다.'};
    }
    const claims = this.#verifyEntitlementToken(entitlementToken);
    if (claims === null) {
      return {authorized: false, reason: '이용권 서명이 올바르지 않습니다.'};
    }
    const order = await this.#repository.getOrder(claims.orderId);
    if (order === null || order.state !== 'FULFILLED') {
      return {authorized: false, reason: '결제가 finalized·fulfillment 상태가 아닙니다.'};
    }
    const entitlement = contextOf(order).entitlements?.find(
      (candidate) =>
        candidate.entitlementId === claims.entitlementId &&
        candidate.tokenHash === createHash('sha256').update(entitlementToken).digest('hex'),
    );
    if (entitlement === undefined || Date.parse(entitlement.expiresAt) <= this.#now().getTime()) {
      return {authorized: false, reason: '이용권이 없거나 만료됐습니다.'};
    }
    return {
      authorized: true,
      resource: {
        title: 'SignalDesk Team-3 · Solana Agent Commerce Signals',
        summary: `구매자 ${entitlement.buyerId}에게 결제 완료 후 제공된 7일 데이터입니다.`,
        rows: [
          {metric: 'agent_payment_success_rate', value: 98.4, unit: '%'},
          {metric: 'median_settlement_seconds', value: 2.1, unit: 's'},
          {metric: 'duplicate_payment_prevented', value: 17, unit: 'events'},
        ],
      },
    };
  }

  async readiness(): Promise<{
    ready: boolean;
    checks: Record<string, boolean>;
  }> {
    const [stateRepository, settlement, agentConfiguration] = await Promise.all([
      this.#repository.readiness(),
      this.#settlementRuntime.readiness(),
      this.#agentRuntime.readiness(),
    ]);
    const checks = {
      domain: this.#catalog.length === 3,
      stateRepository,
      settlement,
      agentConfiguration,
    };
    return {ready: Object.values(checks).every(Boolean), checks};
  }

  #buildQuote(orderId: string, context: StoredOrderContext): QuoteV1 {
    const selected = this.#catalog.find(
      (sku) => sku.skuId === context.agentTrace.selection.skuId,
    );
    if (selected === undefined) {
      throw new HttpServiceError(
        422,
        'UNKNOWN_AGENT_SKU',
        '에이전트가 canonical catalog 밖의 상품을 선택했습니다.',
      );
    }
    const mandates = exactBuyerSet(context.mandates);
    const allocationAmounts = splitAtomicAmount(
      selected.totalAmountAtomic,
      mandates.length,
    );
    return {
      schema: 'mandate-pool/quote@1',
      quoteId: `${orderId}-quote-1`,
      orderId,
      clusterGenesisHash: DEVNET_GENESIS_HASH,
      sku: selected,
      allocations: mandates.map((mandate, index) => {
        const amountAtomic = allocationAmounts[index];
        if (amountAtomic === undefined) {
          throw new Error('Canonical allocation is missing a buyer amount');
        }
        return {
          buyerId: mandate.buyerId,
          signerAddress: mandate.signerAddress,
          sourceAta: mandate.sourceAta,
          amountAtomic,
        };
      }),
      totalAmountAtomic: selected.totalAmountAtomic,
      mandateHashes: {
        A: mandateHash(mandates[0] as MandateV1),
        B: mandateHash(mandates[1] as MandateV1),
        C: mandateHash(mandates[2] as MandateV1),
      },
      expiresAt: new Date(this.#now().getTime() + 10 * 60_000).toISOString(),
      nonce: randomUUID(),
    };
  }

  async #requiredOrder(orderId: string): Promise<WorkflowOrder> {
    const order = await this.#repository.getOrder(orderId);
    if (order === null) {
      throw new HttpServiceError(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.');
    }
    return order;
  }

  #evaluateCurrentPolicy(context: StoredOrderContext): PolicyProofV1 {
    if (context.quote === undefined) {
      throw new Error('Current policy evaluation requires a quote');
    }
    const approvals = BUYER_IDS.map((buyerId) => context.approvals[buyerId]);
    if (approvals.some((approval) => approval === undefined)) {
      throw new Error('Current policy evaluation requires all three approvals');
    }
    return evaluatePolicy({
      mandates: context.mandates,
      approvals: approvals as HumanApprovalV1[],
      quote: context.quote,
      evaluatedAt: this.#now().toISOString(),
      catalog: this.#catalog,
    });
  }

  #preparedMatchesStoredMessage(
    order: WorkflowOrder,
    prepared: PreparedSettlement,
  ): boolean {
    const message = order.settlement?.message;
    return (
      message !== undefined &&
      prepared.messageHash === message.messageHash &&
      prepared.messageBase64 === message.messageBase64 &&
      prepared.blockhash === message.recentBlockhash &&
      prepared.lastValidBlockHeight === message.lastValidBlockHeight.toString()
    );
  }

  async #safeAbortExpiredAuthorization(
    order: WorkflowOrder,
    freshPolicyProof: PolicyProofV1,
  ): Promise<WorkflowOrder> {
    if (freshPolicyProof.approved) {
      throw new Error('Cannot expire an authorization that still passes policy');
    }
    this.#preparedInProcess.delete(order.orderId);
    return this.#repository.transition({
      orderId: order.orderId,
      expectedVersion: order.version,
      to: 'SAFE_ABORT',
      actor: 'signer-guard',
      at: this.#now().toISOString(),
      eventType: 'AUTHORIZATION_REVALIDATION_FAILED',
      contextPatch: jsonObject({
        policyProof: freshPolicyProof,
        failure: {
          code: 'AUTHORIZATION_EXPIRED',
          message: '제출 전 재검증에서 mandate, 승인 또는 quote가 만료되어 결제하지 않았습니다.',
        },
      }),
    });
  }

  async #safeAbortLostUnsignedAttempt(order: WorkflowOrder): Promise<WorkflowOrder> {
    return this.#repository.transition({
      orderId: order.orderId,
      expectedVersion: order.version,
      to: 'SAFE_ABORT',
      actor: 'recovery-guard',
      at: this.#now().toISOString(),
      contextPatch: jsonObject({
        failure: {
          code: 'UNSIGNED_ATTEMPT_LOST',
          message: '저장된 메시지와 정확히 일치하는 미서명 준비 객체를 확인할 수 없어 새 결제를 만들지 않고 중단했습니다.',
        },
      }),
    });
  }

  #preparedFromOrder(
    order: WorkflowOrder,
    context: StoredOrderContext,
  ): PreparedSettlement {
    const message = order.settlement?.message;
    const signed = order.settlement?.signedTransaction;
    if (
      message === undefined ||
      signed === undefined ||
      context.quote === undefined ||
      context.policyProof === undefined
    ) {
      throw new Error('Submission state is missing immutable settlement data');
    }
    const persistedSponsor = message.requiredSigners[0];
    const expectedBuyerSigners = context.quote.allocations.map(
      (allocation) => allocation.signerAddress,
    );
    const persistedBuyerSigners = message.requiredSigners.slice(1);
    if (
      persistedSponsor === undefined ||
      message.requiredSigners.length !== 4 ||
      persistedBuyerSigners.length !== 3 ||
      new Set(persistedBuyerSigners).size !== 3 ||
      expectedBuyerSigners.some(
        (signer) => !persistedBuyerSigners.includes(signer),
      )
    ) {
      throw new Error('Persisted settlement signer set does not match quote A/B/C');
    }
    return {
      mode: this.#settlementRuntime.mode,
      messageBase64: message.messageBase64,
      messageHash: message.messageHash,
      rawTransactionBase64: signed.rawTransactionBase64,
      rawTransactionHash: signed.rawTransactionHash,
      transactionSignature: signed.txSignature,
      blockhash: message.recentBlockhash,
      lastValidBlockHeight: message.lastValidBlockHeight.toString(),
      memo: settlementMemo(
        quoteHash(context.quote),
        policyProofHash(context.policyProof),
      ),
      wireSize: Buffer.from(signed.rawTransactionBase64, 'base64').byteLength,
      simulationUnits: null,
      plan: settlementPlanFromQuote(
        // Recovery must verify the sponsor that signed the immutable stored
        // message, not whichever fee-sponsor key the deployment uses today.
        persistedSponsor,
        context.quote,
        context.policyProof,
      ),
    };
  }

  #evidence(
    prepared: PreparedSettlement,
    finalization: SettlementFinalization,
  ): SettlementEvidenceView {
    const finalizedEvidence =
      finalization.status === 'success' && finalization.cluster === 'devnet'
        ? finalization.finalizedEvidence
        : undefined;
    return {
      cluster:
        finalization.cluster === 'fixture'
          ? 'fixture · NOT ON-CHAIN'
          : 'solana-devnet',
      ...(finalization.transactionSignature === null
        ? {}
        : {
            txSignature: finalization.transactionSignature,
            explorerUrl: `https://explorer.solana.com/tx/${finalization.transactionSignature}?cluster=devnet`,
          }),
      quoteHash: prepared.plan.quoteHash,
      policyProofHash: prepared.plan.policyProofHash,
      messageHash: finalizedEvidence?.messageHash ?? prepared.messageHash,
      memo: prepared.memo,
      transferCount: prepared.plan.transfers.length,
      requiredSignerCount: prepared.plan.transfers.length + 1,
      ...(finalization.commitment === null
        ? {}
        : {commitment: finalization.commitment}),
      metaError: finalization.metaError,
      ...(finalizedEvidence === undefined
        ? {}
        : {
            slot: finalizedEvidence.slot,
            rawTransactionHash: finalizedEvidence.rawTransactionHash,
            mint: finalizedEvidence.mint,
            sourceDebits: finalizedEvidence.sourceDebits.map((debit) => ({
              ...debit,
            })),
            destinationAta: finalizedEvidence.destinationAta,
            destinationPreAmountAtomic:
              finalizedEvidence.destinationPreAmountAtomic,
            destinationPostAmountAtomic:
              finalizedEvidence.destinationPostAmountAtomic,
            destinationCreditAtomic: finalizedEvidence.destinationCreditAtomic,
          }),
    };
  }

  #buildEntitlements(
    orderId: string,
    quote: QuoteV1,
  ): readonly StoredEntitlement[] {
    const expiresAt = new Date(
      this.#now().getTime() + quote.sku.accessDays * 24 * 60 * 60_000,
    ).toISOString();
    return BUYER_IDS.map((buyerId) => {
      const entitlementId = `${orderId}:${buyerId}:${quote.sku.skuId}`;
      const token = this.#entitlementToken({
        entitlementId,
        orderId,
        buyerId,
        skuId: quote.sku.skuId,
        expiresAt,
      }, this.#activeEntitlementKeyId);
      return {
        entitlementId,
        buyerId,
        skuId: quote.sku.skuId,
        expiresAt,
        keyId: this.#activeEntitlementKeyId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
      };
    });
  }

  #entitlementToken(claims: {
    readonly entitlementId: string;
    readonly orderId: string;
    readonly buyerId: BuyerId;
    readonly skuId: string;
    readonly expiresAt: string;
  }, keyId: string): string {
    const secret = this.#entitlementKeys.get(keyId);
    if (secret === undefined) {
      throw new Error(`Entitlement verification key ${keyId} is unavailable`);
    }
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString(
      'base64url',
    );
    const signedPayload = `mp1.${keyId}.${payload}`;
    const signature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('base64url');
    return `${signedPayload}.${signature}`;
  }

  #verifyEntitlementToken(token: string): {
    readonly entitlementId: string;
    readonly orderId: string;
    readonly buyerId: BuyerId;
    readonly skuId: string;
    readonly expiresAt: string;
  } | null {
    const [version, keyId, payload, signature, extra] = token.split('.');
    if (
      version !== 'mp1' ||
      keyId === undefined ||
      !/^[a-f0-9]{16}$/u.test(keyId) ||
      payload === undefined ||
      signature === undefined ||
      extra !== undefined
    ) return null;
    const secret = this.#entitlementKeys.get(keyId);
    if (secret === undefined) return null;
    const expected = createHmac('sha256', secret)
      .update(`${version}.${keyId}.${payload}`)
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, 'base64url');
    } catch {
      return null;
    }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    try {
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
      if (
        typeof claims['entitlementId'] !== 'string' ||
        typeof claims['orderId'] !== 'string' ||
        !isBuyerId(claims['buyerId']) ||
        typeof claims['skuId'] !== 'string' ||
        typeof claims['expiresAt'] !== 'string'
      ) {
        return null;
      }
      return {
        entitlementId: claims['entitlementId'],
        orderId: claims['orderId'],
        buyerId: claims['buyerId'],
        skuId: claims['skuId'],
        expiresAt: claims['expiresAt'],
      };
    } catch {
      return null;
    }
  }

  #entitlementKeyId(secret: string): string {
    return createHash('sha256')
      .update(`MANDATE_POOL_ENTITLEMENT_KEY_V1\0${secret}`)
      .digest('hex')
      .slice(0, 16);
  }

  async #snapshot(
    order: WorkflowOrder,
    includeEntitlementTokens: boolean,
  ): Promise<OrderSnapshotView> {
    const context = contextOf(order);
    const audit = await this.#repository.listAuditEvents(order.orderId);
    const approvals = context.approvals;
    const selectedSku = context.quote?.sku ?? (
      context.agentTrace.selection.skuId === 'NO_BUY'
        ? undefined
        : this.#catalog.find(
            (sku) => sku.skuId === context.agentTrace.selection.skuId,
          )
    );
    const selectionAmounts = selectedSku === undefined
      ? []
      : context.quote === undefined
        ? splitAtomicAmount(selectedSku.totalAmountAtomic, BUYER_IDS.length)
        : BUYER_IDS.map((buyerId) => {
            const allocation = context.quote?.allocations.find(
              (candidate) => candidate.buyerId === buyerId,
            );
            if (allocation === undefined) {
              throw new Error(`Stored quote is missing buyer ${buyerId}`);
            }
            return allocation.amountAtomic;
          });
    const snapshot: OrderSnapshotView = {
      orderId: order.orderId,
      state: order.state,
      version: order.version,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      ...(context.scenarioLabel === null
        ? {}
        : {scenarioLabel: context.scenarioLabel}),
      agent: {
        provider: context.agentTrace.provider,
        model: context.agentTrace.model,
        startedAt: context.agentTrace.startedAt,
        completedAt: context.agentTrace.completedAt,
        selectedSkuId: context.agentTrace.selection.skuId,
      },
      mandates: context.naturalMandates.map((natural) => {
        const mandate = context.mandates.find(
          (candidate) => candidate.buyerId === natural.buyerId,
        );
        if (mandate === undefined) throw new Error('Snapshot mandate missing');
        const approval = approvals[natural.buyerId];
        return {
          buyerId: natural.buyerId,
          naturalLanguage: natural.naturalLanguage,
          mandateHash: mandateHash(mandate),
          ...(approval === undefined
            ? {approvalNonce: context.approvalNonces[natural.buyerId]}
            : {}),
          maxAmountAtomic: mandate.maxAmountAtomic,
          requiredFeatures: [...mandate.requiredFeatures],
          forbiddenFeatures: [
            ...mandate.forbiddenFeatures,
            ...(mandate.allowAutoRenewal ? [] : ['auto-renew']),
          ],
          validUntil: mandate.validUntil,
          ...(approval === undefined ? {} : {approvedAt: approval.approvedAt}),
          status: approval === undefined ? 'PENDING_APPROVAL' : 'APPROVED',
        };
      }),
      ...(selectedSku === undefined || order.state === 'AWAITING_APPROVAL'
        ? {}
        : {
            selection: {
              skuId: selectedSku.skuId,
              productName: selectedSku.name,
              rationale: context.agentTrace.selection.rationale,
              totalAmountAtomic: selectedSku.totalAmountAtomic,
              allocations: selectionAmounts.map((amountAtomic, index) => ({
                buyerId: BUYER_IDS[index] as BuyerId,
                amountAtomic,
              })),
            },
          }),
      policyChecks: (context.policyProof?.checks ?? []).map((check) => ({
        code: check.code,
        label: check.buyerId === undefined ? check.code : `${check.buyerId} · ${check.code}`,
        passed: check.passed,
        detail: check.message,
      })),
      timeline: audit.map((event, index) => ({
        sequence: event.sequence,
        state: event.toState,
        label: timelineLabel(event.toState),
        at: event.occurredAt,
        status:
          index === audit.length - 1 &&
          ![
            'NO_BUY',
            'POLICY_REJECTED',
            'FINALIZED_FAILED',
            'RECONCILIATION_REQUIRED',
            'FULFILLED',
            'SAFE_ABORT',
          ].includes(order.state)
            ? 'active'
            : 'complete',
      })),
      ...(context.evidence === undefined ? {} : {evidence: context.evidence}),
      entitlementCount: context.entitlements?.length ?? 0,
      ...(context.failure == null ? {} : {failure: context.failure}),
    };
    if (
      includeEntitlementTokens &&
      order.state === 'FULFILLED' &&
      context.entitlements !== undefined
    ) {
      return {
        ...snapshot,
        entitlements: context.entitlements.map((entitlement) => ({
          buyerId: entitlement.buyerId,
          token: this.#entitlementToken({
            entitlementId: entitlement.entitlementId,
            orderId: order.orderId,
            buyerId: entitlement.buyerId,
            skuId: entitlement.skuId,
            expiresAt: entitlement.expiresAt,
          }, entitlement.keyId),
        })),
      };
    }
    return snapshot;
  }
}

export function serviceErrorFromWorkflow(error: unknown): never {
  if (error instanceof WorkflowError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'BUDGET_EXCEEDED'
          ? 422
          : error.code === 'CONFLICT' || error.code === 'INVALID_TRANSITION'
            ? 409
            : 503;
    throw new HttpServiceError(status, error.code, error.message);
  }
  throw error;
}
