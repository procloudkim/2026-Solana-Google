import {sha256Hex, buildAuditEvent} from '../workflow/audit.js';
import {budgetExceeded, conflict, invariant} from '../workflow/errors.js';
import {assertOrderInvariants, assertTransition} from '../workflow/state-machine.js';
import type {
  AttachMessageInput,
  AuditEvent,
  BudgetAccount,
  MarkFullySignedInput,
  RecordSubmissionInput,
  ReservationRecord,
  TransitionInput,
  WorkflowOrder,
} from '../workflow/types.js';
import {
  assertHash,
  assertIdentifier,
  assertTimestamp,
  mergeContext,
  parseAtomic,
} from '../workflow/validation.js';

export interface MutationResult {
  readonly order: WorkflowOrder;
  readonly event: AuditEvent;
  readonly budgetEffect: 'NONE' | 'CONSUME' | 'RELEASE';
}

export function assertExpectedVersion(order: WorkflowOrder, expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    invariant('expectedVersion must be a non-negative safe integer');
  }
  if (order.version !== expectedVersion) {
    conflict(`Order ${order.orderId} version is ${order.version}, expected ${expectedVersion}`);
  }
}

function nextOrder(
  current: WorkflowOrder,
  input: {
    readonly state: WorkflowOrder['state'];
    readonly actor: string;
    readonly at: string;
    readonly eventType: string;
    readonly payload?: TransitionInput['payload'];
    readonly contextPatch?: TransitionInput['contextPatch'];
    readonly reservation?: ReservationRecord;
    readonly settlement?: WorkflowOrder['settlement'];
  },
): MutationResult {
  assertIdentifier(input.actor, 'actor');
  assertTimestamp(input.at, 'at');
  const event = buildAuditEvent({
    orderId: current.orderId,
    sequence: current.auditLength,
    eventType: input.eventType,
    actor: input.actor,
    fromState: current.state,
    toState: input.state,
    payload: input.payload ?? {},
    previousEventHash: current.auditHead,
    occurredAt: input.at,
  });
  const order: WorkflowOrder = {
    ...current,
    state: input.state,
    version: current.version + 1,
    context: mergeContext(current.context, input.contextPatch),
    ...(input.reservation === undefined ? {} : {reservation: input.reservation}),
    ...(input.settlement === undefined ? {} : {settlement: input.settlement}),
    auditHead: event.eventHash,
    auditLength: current.auditLength + 1,
    updatedAt: input.at,
  };
  assertOrderInvariants(order);
  return {order, event, budgetEffect: 'NONE'};
}

function resolveReservation(
  reservation: ReservationRecord,
  status: 'CONSUMED' | 'RELEASED',
  at: string,
): ReservationRecord {
  if (reservation.status !== 'HELD') {
    invariant(`Cannot ${status.toLowerCase()} a ${reservation.status.toLowerCase()} reservation`);
  }
  return {...reservation, status, resolvedAt: at};
}

export function applyTransition(current: WorkflowOrder, input: TransitionInput): MutationResult {
  assertExpectedVersion(current, input.expectedVersion);
  assertTransition(current.state, input.to);

  if (input.to === 'RESERVED' || input.to === 'MESSAGE_BUILT' || input.to === 'FULLY_SIGNED') {
    invariant(`Use the specialized repository method to enter ${input.to}`);
  }
  let reservation = current.reservation;
  let budgetEffect: MutationResult['budgetEffect'] = 'NONE';
  if (input.to === 'SAFE_ABORT' && reservation !== undefined) {
    reservation = resolveReservation(reservation, 'RELEASED', input.at);
    budgetEffect = 'RELEASE';
  } else if (input.to === 'FINALIZED_FAILED') {
    if (reservation === undefined) invariant('Finalized failure requires a reservation');
    reservation = resolveReservation(reservation, 'RELEASED', input.at);
    budgetEffect = 'RELEASE';
  } else if (input.to === 'FINALIZED_SUCCESS') {
    if (reservation === undefined) invariant('Finalized success requires a reservation');
    reservation = resolveReservation(reservation, 'CONSUMED', input.at);
    budgetEffect = 'CONSUME';
  }

  const result = nextOrder(current, {
    state: input.to,
    actor: input.actor,
    at: input.at,
    eventType: input.eventType ?? `STATE_${input.to}`,
    ...(input.payload === undefined ? {} : {payload: input.payload}),
    ...(input.contextPatch === undefined ? {} : {contextPatch: input.contextPatch}),
    ...(reservation === undefined ? {} : {reservation}),
  });
  return {...result, budgetEffect};
}

export function applyAttachMessage(current: WorkflowOrder, input: AttachMessageInput): MutationResult {
  assertExpectedVersion(current, input.expectedVersion);
  assertTransition(current.state, 'MESSAGE_BUILT');
  if (current.settlement !== undefined) invariant('A settlement attempt is immutable and already exists');
  assertIdentifier(input.message.attemptId, 'attemptId');
  assertHash(input.message.messageHash, 'messageHash');
  assertTimestamp(input.at, 'at');
  if (input.message.messageBase64.length < 1) invariant('messageBase64 must not be empty');
  if (!Number.isSafeInteger(input.message.lastValidBlockHeight) || input.message.lastValidBlockHeight < 1) {
    invariant('lastValidBlockHeight must be a positive safe integer');
  }
  if (input.message.requiredSigners.length < 1 || new Set(input.message.requiredSigners).size !== input.message.requiredSigners.length) {
    invariant('requiredSigners must be a non-empty unique list');
  }
  const decodedMessage = Buffer.from(input.message.messageBase64, 'base64');
  if (decodedMessage.length < 1 || sha256Hex(decodedMessage) !== input.message.messageHash) {
    invariant('messageHash does not match messageBase64');
  }
  return nextOrder(current, {
    state: 'MESSAGE_BUILT', actor: input.actor, at: input.at, eventType: 'MESSAGE_BUILT',
    ...(input.payload === undefined ? {} : {payload: input.payload}),
    settlement: {
      attemptNumber: 1,
      message: {...input.message, createdAt: input.at},
      submissionCount: 0,
    },
  });
}

export function applyMarkFullySigned(current: WorkflowOrder, input: MarkFullySignedInput): MutationResult {
  assertExpectedVersion(current, input.expectedVersion);
  assertTransition(current.state, 'FULLY_SIGNED');
  if (current.settlement === undefined) invariant('Cannot sign without a settlement message');
  if (current.settlement.signedTransaction !== undefined) invariant('Signed transaction is immutable and already exists');
  assertHash(input.signedTransaction.rawTransactionHash, 'rawTransactionHash');
  if (input.signedTransaction.rawTransactionBase64.length < 1 || input.signedTransaction.txSignature.length < 1) {
    invariant('Signed transaction bytes and predicted signature are required');
  }
  const rawBytes = Buffer.from(input.signedTransaction.rawTransactionBase64, 'base64');
  if (rawBytes.length < 1 || sha256Hex(rawBytes) !== input.signedTransaction.rawTransactionHash) {
    invariant('rawTransactionHash does not match rawTransactionBase64');
  }
  return nextOrder(current, {
    state: 'FULLY_SIGNED', actor: input.actor, at: input.at, eventType: 'FULLY_SIGNED',
    ...(input.payload === undefined ? {} : {payload: input.payload}),
    settlement: {
      ...current.settlement,
      signedTransaction: {...input.signedTransaction, signedAt: input.at},
    },
  });
}

export function applyRecordSubmission(current: WorkflowOrder, input: RecordSubmissionInput): MutationResult {
  assertExpectedVersion(current, input.expectedVersion);
  if (current.state !== 'FULLY_SIGNED' && current.state !== 'SUBMISSION_STARTED') {
    invariant(`Cannot submit a transaction while order is ${current.state}`);
  }
  const settlement = current.settlement;
  const signed = settlement?.signedTransaction;
  if (settlement === undefined || signed === undefined) invariant('Submission requires signed transaction bytes');
  if (
    input.attemptId !== settlement.message.attemptId ||
    input.rawTransactionHash !== signed.rawTransactionHash ||
    input.txSignature !== signed.txSignature
  ) {
    conflict('Submission retry must use the exact same attempt, signed bytes, and predicted signature');
  }
  const firstSubmission = current.state === 'FULLY_SIGNED';
  if (firstSubmission) assertTransition(current.state, 'SUBMISSION_STARTED');
  return nextOrder(current, {
    state: 'SUBMISSION_STARTED', actor: input.actor, at: input.at,
    eventType: firstSubmission ? 'SUBMISSION_STARTED' : 'SUBMISSION_RETRIED',
    ...(input.payload === undefined ? {} : {payload: input.payload}),
    settlement: {
      ...settlement,
      submissionCount: settlement.submissionCount + 1,
      firstSubmittedAt: settlement.firstSubmittedAt ?? input.at,
      lastSubmittedAt: input.at,
    },
  });
}

export function applyBudgetEffect(
  budget: BudgetAccount,
  allocationAmount: string,
  effect: 'RESERVE' | 'CONSUME' | 'RELEASE',
  at: string,
): BudgetAccount {
  const amount = parseAtomic(allocationAmount, 'allocation amount', false);
  const limit = parseAtomic(budget.limitAtomic, 'budget limit');
  const reserved = parseAtomic(budget.reservedAtomic, 'reserved budget');
  const consumed = parseAtomic(budget.consumedAtomic, 'consumed budget');
  let nextReserved = reserved;
  let nextConsumed = consumed;
  if (effect === 'RESERVE') {
    if (limit - reserved - consumed < amount) budgetExceeded(`Mandate ${budget.mandateId} has insufficient available budget`);
    nextReserved += amount;
  } else {
    if (reserved < amount) invariant(`Mandate ${budget.mandateId} does not hold the requested reservation`);
    nextReserved -= amount;
    if (effect === 'CONSUME') nextConsumed += amount;
  }
  return {
    ...budget,
    reservedAtomic: nextReserved.toString(),
    consumedAtomic: nextConsumed.toString(),
    version: budget.version + 1,
    updatedAt: at,
  };
}
