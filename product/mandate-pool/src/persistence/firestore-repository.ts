import type {
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Transaction,
} from '@google-cloud/firestore';

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

interface IdempotencyDocument {
  readonly orderId: string;
  readonly createdAt: string;
}

interface LockDocument {
  readonly orderId: string;
  readonly createdAt: string;
}

export interface FirestoreWorkflowRepositoryOptions {
  /** Isolates demo/test deployments below mandatePoolRuntime/{namespace}. */
  readonly namespace?: string;
}

/** Firestore implementation whose writes mirror the in-memory CAS semantics. */
export class FirestoreWorkflowRepository implements WorkflowRepository {
  readonly #root: DocumentReference;

  public constructor(
    private readonly firestore: Firestore,
    options: FirestoreWorkflowRepositoryOptions = {},
  ) {
    const namespace = options.namespace ?? 'v0';
    assertIdentifier(namespace, 'Firestore namespace');
    this.#root = firestore.collection('mandatePoolRuntime').doc(namespace);
  }

  public async readiness(): Promise<boolean> {
    try {
      await this.#root.get();
      return true;
    } catch {
      return false;
    }
  }

  public async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    assertIdentifier(input.orderId, 'orderId');
    assertIdentifier(input.actor, 'actor');
    assertTimestamp(input.at, 'at');
    const context = input.context ?? {};
    validateContext(context);
    const keyHash = hashIdempotencyKey(input.idempotencyKey);
    const idempotencyRef = this.#collection('idempotency').doc(keyHash);
    const requestedOrderRef = this.#orderRef(input.orderId);

    const result = await this.firestore.runTransaction(async (transaction) => {
      const idempotencySnapshot = await transaction.get(idempotencyRef);
      if (idempotencySnapshot.exists) {
        const mapping = idempotencySnapshot.data() as IdempotencyDocument;
        const priorSnapshot = await transaction.get(this.#orderRef(mapping.orderId));
        if (!priorSnapshot.exists) invariant(`Idempotency index points to missing order ${mapping.orderId}`);
        return {order: this.#decodeOrder(priorSnapshot), created: false};
      }

      const requestedOrderSnapshot = await transaction.get(requestedOrderRef);
      if (requestedOrderSnapshot.exists) {
        conflict(`Order ${input.orderId} already exists with another idempotency key`);
      }
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
      transaction.create(requestedOrderRef, order);
      transaction.create(idempotencyRef, {orderId: order.orderId, createdAt: input.at} satisfies IdempotencyDocument);
      transaction.create(this.#auditRef(order.orderId, event.sequence), event);
      return {order, created: true};
    });
    return {order: cloneOrder(result.order), created: result.created};
  }

  public async getOrder(orderId: string): Promise<WorkflowOrder | null> {
    assertIdentifier(orderId, 'orderId');
    const snapshot = await this.#orderRef(orderId).get();
    return snapshot.exists ? cloneOrder(this.#decodeOrder(snapshot)) : null;
  }

  public async getOrderByIdempotencyKey(idempotencyKey: string): Promise<WorkflowOrder | null> {
    const snapshot = await this.#collection('idempotency').doc(hashIdempotencyKey(idempotencyKey)).get();
    if (!snapshot.exists) return null;
    const mapping = snapshot.data() as IdempotencyDocument;
    return this.getOrder(mapping.orderId);
  }

  public async registerBudget(input: RegisterBudgetInput): Promise<BudgetAccount> {
    assertIdentifier(input.mandateId, 'mandateId');
    assertIdentifier(input.buyerId, 'buyerId');
    assertTimestamp(input.at, 'at');
    if (input.mint.length < 1) invariant('mint must not be empty');
    parseAtomic(input.limitAtomic, 'limitAtomic', false);
    const reference = this.#budgetRef(input.mandateId);
    const budget = await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        const prior = snapshot.data() as BudgetAccount;
        if (prior.buyerId !== input.buyerId || prior.mint !== input.mint || prior.limitAtomic !== input.limitAtomic) {
          conflict(`Budget ${input.mandateId} already exists with different immutable fields`);
        }
        return prior;
      }
      const created: BudgetAccount = {
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
      transaction.create(reference, created);
      return created;
    });
    return structuredClone(budget);
  }

  public async getBudget(mandateId: string): Promise<BudgetAccount | null> {
    assertIdentifier(mandateId, 'mandateId');
    const snapshot = await this.#budgetRef(mandateId).get();
    return snapshot.exists ? structuredClone(snapshot.data() as BudgetAccount) : null;
  }

  public async transition(input: TransitionInput): Promise<WorkflowOrder> {
    return this.#mutateOrder(input.orderId, (current) => applyTransition(current, input));
  }

  public async reserveSettlement(input: ReserveSettlementInput): Promise<WorkflowOrder> {
    assertIdentifier(input.orderId, 'orderId');
    assertIdentifier(input.settlementKey, 'settlementKey');
    assertHash(input.quoteHash, 'quoteHash');
    assertHash(input.policyProofHash, 'policyProofHash');
    assertIdentifier(input.actor, 'actor');
    assertTimestamp(input.at, 'at');
    validateAllocations(input.allocations, input.totalAtomic);

    const orderReference = this.#orderRef(input.orderId);
    const settlementReference = this.#collection('settlementLocks').doc(input.settlementKey);
    const quoteReference = this.#collection('quoteLocks').doc(input.quoteHash);
    const order = await this.firestore.runTransaction(async (transaction) => {
      const orderSnapshot = await transaction.get(orderReference);
      if (!orderSnapshot.exists) notFound(`Order ${input.orderId} does not exist`);
      const current = this.#decodeOrder(orderSnapshot);
      assertExpectedVersion(current, input.expectedVersion);
      assertTransition(current.state, 'RESERVED');
      if (current.reservation !== undefined) invariant('Order already has a reservation');

      const budgetReferences = input.allocations.map((allocation) => this.#budgetRef(allocation.mandateId));
      const snapshots = await transaction.getAll(settlementReference, quoteReference, ...budgetReferences);
      const settlementSnapshot = snapshots[0];
      const quoteSnapshot = snapshots[1];
      if (settlementSnapshot?.exists === true) {
        const lock = settlementSnapshot.data() as LockDocument;
        conflict(`Settlement key is already owned by order ${lock.orderId}`);
      }
      if (quoteSnapshot?.exists === true) {
        const lock = quoteSnapshot.data() as LockDocument;
        conflict(`Quote is already consumed by order ${lock.orderId}`);
      }

      const updatedBudgets: BudgetAccount[] = [];
      input.allocations.forEach((allocation, index) => {
        const snapshot = snapshots[index + 2];
        if (snapshot?.exists !== true) notFound(`Budget ${allocation.mandateId} does not exist`);
        const budget = snapshot.data() as BudgetAccount;
        if (budget.buyerId !== allocation.buyerId || budget.mint !== allocation.mint) {
          invariant(`Allocation does not match budget ${allocation.mandateId}`);
        }
        updatedBudgets.push(applyBudgetEffect(budget, allocation.amountAtomic, 'RESERVE', input.at));
      });

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
      const next: WorkflowOrder = {
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
      assertOrderInvariants(next);
      updatedBudgets.forEach((budget) => transaction.set(this.#budgetRef(budget.mandateId), budget));
      transaction.create(settlementReference, {orderId: input.orderId, createdAt: input.at} satisfies LockDocument);
      transaction.create(quoteReference, {orderId: input.orderId, createdAt: input.at} satisfies LockDocument);
      transaction.set(orderReference, next);
      transaction.create(this.#auditRef(input.orderId, event.sequence), event);
      return next;
    });
    return cloneOrder(order);
  }

  public async attachMessage(input: AttachMessageInput): Promise<WorkflowOrder> {
    return this.#mutateOrder(input.orderId, (current) => applyAttachMessage(current, input));
  }

  public async markFullySigned(input: MarkFullySignedInput): Promise<WorkflowOrder> {
    return this.#mutateOrder(input.orderId, (current) => applyMarkFullySigned(current, input));
  }

  public async recordSubmission(input: RecordSubmissionInput): Promise<WorkflowOrder> {
    return this.#mutateOrder(input.orderId, (current) => applyRecordSubmission(current, input));
  }

  public async listAuditEvents(orderId: string): Promise<readonly AuditEvent[]> {
    assertIdentifier(orderId, 'orderId');
    const orderSnapshot = await this.#orderRef(orderId).get();
    if (!orderSnapshot.exists) notFound(`Order ${orderId} does not exist`);
    const snapshot = await this.#orderRef(orderId).collection('audit').orderBy('sequence', 'asc').get();
    return snapshot.docs.map((document) => structuredClone(document.data() as AuditEvent));
  }

  async #mutateOrder(
    orderId: string,
    mutate: (order: WorkflowOrder) => MutationResult,
  ): Promise<WorkflowOrder> {
    assertIdentifier(orderId, 'orderId');
    const reference = this.#orderRef(orderId);
    const order = await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) notFound(`Order ${orderId} does not exist`);
      const current = this.#decodeOrder(snapshot);
      const mutation = mutate(current);
      await this.#applyBudgetResolution(transaction, current, mutation);
      transaction.set(reference, mutation.order);
      transaction.create(this.#auditRef(orderId, mutation.event.sequence), mutation.event);
      return mutation.order;
    });
    return cloneOrder(order);
  }

  async #applyBudgetResolution(
    transaction: Transaction,
    current: WorkflowOrder,
    mutation: MutationResult,
  ): Promise<void> {
    const budgetEffect = mutation.budgetEffect;
    if (budgetEffect === 'NONE') return;
    const reservation = current.reservation;
    if (reservation === undefined) invariant('Budget resolution requires an existing reservation');
    const references = reservation.allocations.map((allocation) => this.#budgetRef(allocation.mandateId));
    const snapshots = await transaction.getAll(...references);
    reservation.allocations.forEach((allocation, index) => {
      const snapshot = snapshots[index];
      if (snapshot?.exists !== true) notFound(`Budget ${allocation.mandateId} does not exist`);
      const budget = snapshot.data() as BudgetAccount;
      const next = applyBudgetEffect(budget, allocation.amountAtomic, budgetEffect, mutation.order.updatedAt);
      transaction.set(references[index] as DocumentReference, next);
    });
  }

  #collection(name: string): CollectionReference {
    return this.#root.collection(name);
  }

  #orderRef(orderId: string): DocumentReference {
    return this.#collection('orders').doc(orderId);
  }

  #budgetRef(mandateId: string): DocumentReference {
    return this.#collection('budgets').doc(mandateId);
  }

  #auditRef(orderId: string, sequence: number): DocumentReference {
    return this.#orderRef(orderId).collection('audit').doc(sequence.toString().padStart(10, '0'));
  }

  #decodeOrder(snapshot: DocumentSnapshot): WorkflowOrder {
    const order = snapshot.data() as WorkflowOrder | undefined;
    if (order === undefined) notFound(`Order ${snapshot.id} does not exist`);
    assertOrderInvariants(order);
    return order;
  }
}
