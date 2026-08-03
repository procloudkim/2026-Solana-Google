import {buildAuditEvent} from '../workflow/audit.js';
import {conflict, invariant, notFound} from '../workflow/errors.js';
import {assertOrderInvariants, assertTransition} from '../workflow/state-machine.js';
import type {
  AttachMessageInput,
  AuditEvent,
  BudgetAccount,
  CreateOrderInput,
  CreateOrderResult,
  MarkFullySignedInput,
  RecordSubmissionInput,
  RegisterBudgetInput,
  ReserveSettlementInput,
  TransitionInput,
  WorkflowOrder,
} from '../workflow/types.js';
import {
  assertHash,
  assertIdentifier,
  assertTimestamp,
  cloneOrder,
  hashIdempotencyKey,
  parseAtomic,
  validateAllocations,
  validateContext,
} from '../workflow/validation.js';
import {
  applyAttachMessage,
  applyBudgetEffect,
  applyMarkFullySigned,
  applyRecordSubmission,
  applyTransition,
  assertExpectedVersion,
  type MutationResult,
} from './mutations.js';
import type {WorkflowRepository} from './repository.js';

function cloneBudget(budget: BudgetAccount): BudgetAccount {
  return structuredClone(budget);
}

/** Deterministic repository used by unit tests and local demo mode. */
export class InMemoryWorkflowRepository implements WorkflowRepository {
  readonly #orders = new Map<string, WorkflowOrder>();
  readonly #idempotency = new Map<string, string>();
  readonly #budgets = new Map<string, BudgetAccount>();
  readonly #settlementLocks = new Map<string, string>();
  readonly #quoteLocks = new Map<string, string>();
  readonly #audits = new Map<string, AuditEvent[]>();
  #tail: Promise<void> = Promise.resolve();

  public async readiness(): Promise<boolean> {
    return true;
  }

  async #exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    let release = (): void => undefined;
    const predecessor = this.#tail;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await predecessor;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  public async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return this.#exclusive(() => {
      assertIdentifier(input.orderId, 'orderId');
      assertIdentifier(input.actor, 'actor');
      assertTimestamp(input.at, 'at');
      const context = input.context ?? {};
      validateContext(context);
      const keyHash = hashIdempotencyKey(input.idempotencyKey);
      const priorOrderId = this.#idempotency.get(keyHash);
      if (priorOrderId !== undefined) {
        const prior = this.#orders.get(priorOrderId);
        if (prior === undefined) invariant(`Idempotency index points to missing order ${priorOrderId}`);
        return {order: cloneOrder(prior), created: false};
      }
      if (this.#orders.has(input.orderId)) conflict(`Order ${input.orderId} already exists with another idempotency key`);

      const event = buildAuditEvent({
        orderId: input.orderId,
        sequence: 0,
        eventType: 'ORDER_CREATED',
        actor: input.actor,
        fromState: null,
        toState: 'DRAFT',
        payload: {},
        previousEventHash: null,
        occurredAt: input.at,
      });
      const order: WorkflowOrder = {
        orderId: input.orderId,
        idempotencyKeyHash: keyHash,
        state: 'DRAFT',
        version: 0,
        context,
        auditHead: event.eventHash,
        auditLength: 1,
        createdAt: input.at,
        updatedAt: input.at,
      };
      assertOrderInvariants(order);
      this.#orders.set(order.orderId, structuredClone(order));
      this.#idempotency.set(keyHash, order.orderId);
      this.#audits.set(order.orderId, [structuredClone(event)]);
      return {order: cloneOrder(order), created: true};
    });
  }

  public async getOrder(orderId: string): Promise<WorkflowOrder | null> {
    const order = this.#orders.get(orderId);
    return order === undefined ? null : cloneOrder(order);
  }

  public async getOrderByIdempotencyKey(idempotencyKey: string): Promise<WorkflowOrder | null> {
    const orderId = this.#idempotency.get(hashIdempotencyKey(idempotencyKey));
    return orderId === undefined ? null : this.getOrder(orderId);
  }

  public async registerBudget(input: RegisterBudgetInput): Promise<BudgetAccount> {
    return this.#exclusive(() => {
      assertIdentifier(input.mandateId, 'mandateId');
      assertIdentifier(input.buyerId, 'buyerId');
      assertTimestamp(input.at, 'at');
      if (input.mint.length < 1) invariant('mint must not be empty');
      parseAtomic(input.limitAtomic, 'limitAtomic', false);
      const prior = this.#budgets.get(input.mandateId);
      if (prior !== undefined) {
        if (prior.buyerId !== input.buyerId || prior.mint !== input.mint || prior.limitAtomic !== input.limitAtomic) {
          conflict(`Budget ${input.mandateId} already exists with different immutable fields`);
        }
        return cloneBudget(prior);
      }
      const budget: BudgetAccount = {
        mandateId: input.mandateId,
        buyerId: input.buyerId,
        mint: input.mint,
        limitAtomic: input.limitAtomic,
        reservedAtomic: '0',
        consumedAtomic: '0',
        version: 0,
        createdAt: input.at,
        updatedAt: input.at,
      };
      this.#budgets.set(input.mandateId, budget);
      return cloneBudget(budget);
    });
  }

  public async getBudget(mandateId: string): Promise<BudgetAccount | null> {
    const budget = this.#budgets.get(mandateId);
    return budget === undefined ? null : cloneBudget(budget);
  }

  public async transition(input: TransitionInput): Promise<WorkflowOrder> {
    return this.#exclusive(() => {
      const current = this.#requiredOrder(input.orderId);
      return this.#commitMutation(current, applyTransition(current, input));
    });
  }

  public async reserveSettlement(input: ReserveSettlementInput): Promise<WorkflowOrder> {
    return this.#exclusive(() => {
      const current = this.#requiredOrder(input.orderId);
      assertExpectedVersion(current, input.expectedVersion);
      assertTransition(current.state, 'RESERVED');
      assertIdentifier(input.settlementKey, 'settlementKey');
      assertHash(input.quoteHash, 'quoteHash');
      assertHash(input.policyProofHash, 'policyProofHash');
      assertIdentifier(input.actor, 'actor');
      assertTimestamp(input.at, 'at');
      validateAllocations(input.allocations, input.totalAtomic);
      if (current.reservation !== undefined) invariant('Order already has a reservation');
      const settlementOwner = this.#settlementLocks.get(input.settlementKey);
      if (settlementOwner !== undefined) conflict(`Settlement key is already owned by order ${settlementOwner}`);
      const quoteOwner = this.#quoteLocks.get(input.quoteHash);
      if (quoteOwner !== undefined) conflict(`Quote is already consumed by order ${quoteOwner}`);

      const updatedBudgets = new Map<string, BudgetAccount>();
      for (const allocation of input.allocations) {
        const budget = this.#budgets.get(allocation.mandateId);
        if (budget === undefined) notFound(`Budget ${allocation.mandateId} does not exist`);
        if (budget.buyerId !== allocation.buyerId || budget.mint !== allocation.mint) {
          invariant(`Allocation does not match budget ${allocation.mandateId}`);
        }
        updatedBudgets.set(
          allocation.mandateId,
          applyBudgetEffect(budget, allocation.amountAtomic, 'RESERVE', input.at),
        );
      }
      const event = buildAuditEvent({
        orderId: current.orderId,
        sequence: current.auditLength,
        eventType: 'SETTLEMENT_RESERVED',
        actor: input.actor,
        fromState: current.state,
        toState: 'RESERVED',
        payload: input.payload ?? {},
        previousEventHash: current.auditHead,
        occurredAt: input.at,
      });
      const order: WorkflowOrder = {
        ...current,
        state: 'RESERVED',
        version: current.version + 1,
        reservation: {
          settlementKey: input.settlementKey,
          quoteHash: input.quoteHash,
          policyProofHash: input.policyProofHash,
          totalAtomic: input.totalAtomic,
          allocations: structuredClone(input.allocations),
          status: 'HELD',
          reservedAt: input.at,
        },
        auditHead: event.eventHash,
        auditLength: current.auditLength + 1,
        updatedAt: input.at,
      };
      assertOrderInvariants(order);
      for (const [mandateId, budget] of updatedBudgets) this.#budgets.set(mandateId, budget);
      this.#settlementLocks.set(input.settlementKey, input.orderId);
      this.#quoteLocks.set(input.quoteHash, input.orderId);
      this.#storeOrderAndEvent(order, event);
      return cloneOrder(order);
    });
  }

  public async attachMessage(input: AttachMessageInput): Promise<WorkflowOrder> {
    return this.#exclusive(() => {
      const current = this.#requiredOrder(input.orderId);
      return this.#commitMutation(current, applyAttachMessage(current, input));
    });
  }

  public async markFullySigned(input: MarkFullySignedInput): Promise<WorkflowOrder> {
    return this.#exclusive(() => {
      const current = this.#requiredOrder(input.orderId);
      return this.#commitMutation(current, applyMarkFullySigned(current, input));
    });
  }

  public async recordSubmission(input: RecordSubmissionInput): Promise<WorkflowOrder> {
    return this.#exclusive(() => {
      const current = this.#requiredOrder(input.orderId);
      return this.#commitMutation(current, applyRecordSubmission(current, input));
    });
  }

  public async listAuditEvents(orderId: string): Promise<readonly AuditEvent[]> {
    if (!this.#orders.has(orderId)) notFound(`Order ${orderId} does not exist`);
    return structuredClone(this.#audits.get(orderId) ?? []);
  }

  #requiredOrder(orderId: string): WorkflowOrder {
    const order = this.#orders.get(orderId);
    if (order === undefined) notFound(`Order ${orderId} does not exist`);
    return order;
  }

  #commitMutation(current: WorkflowOrder, mutation: MutationResult): WorkflowOrder {
    if (mutation.budgetEffect !== 'NONE') {
      const reservation = current.reservation;
      if (reservation === undefined) invariant('Budget resolution requires an existing reservation');
      const updatedBudgets = new Map<string, BudgetAccount>();
      for (const allocation of reservation.allocations) {
        const budget = this.#budgets.get(allocation.mandateId);
        if (budget === undefined) notFound(`Budget ${allocation.mandateId} does not exist`);
        updatedBudgets.set(
          allocation.mandateId,
          applyBudgetEffect(budget, allocation.amountAtomic, mutation.budgetEffect, mutation.order.updatedAt),
        );
      }
      for (const [mandateId, budget] of updatedBudgets) this.#budgets.set(mandateId, budget);
    }
    this.#storeOrderAndEvent(mutation.order, mutation.event);
    return cloneOrder(mutation.order);
  }

  #storeOrderAndEvent(order: WorkflowOrder, event: AuditEvent): void {
    const events = this.#audits.get(order.orderId);
    if (events === undefined) invariant(`Audit stream for order ${order.orderId} is missing`);
    if (events.length !== event.sequence) invariant('Audit sequence is not append-only');
    this.#orders.set(order.orderId, structuredClone(order));
    events.push(structuredClone(event));
  }
}
