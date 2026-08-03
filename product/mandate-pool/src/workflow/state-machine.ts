import {invalidTransition, invariant} from './errors.js';
import type {WorkflowOrder, WorkflowState} from './types.js';

const TRANSITIONS: Readonly<Record<WorkflowState, ReadonlySet<WorkflowState>>> = {
  DRAFT: new Set(['AWAITING_APPROVAL', 'SAFE_ABORT']),
  // A partial A/B/C approval is persisted and audited without pretending the
  // coalition is fully approved. The third approval advances to APPROVED.
  AWAITING_APPROVAL: new Set(['AWAITING_APPROVAL', 'APPROVED', 'SAFE_ABORT']),
  APPROVED: new Set(['PLANNED', 'SAFE_ABORT']),
  PLANNED: new Set(['NO_BUY', 'POLICY_REJECTED', 'RESERVED', 'SAFE_ABORT']),
  NO_BUY: new Set(),
  POLICY_REJECTED: new Set(),
  RESERVED: new Set(['MESSAGE_BUILT', 'SAFE_ABORT']),
  MESSAGE_BUILT: new Set(['SIGNING', 'SAFE_ABORT']),
  SIGNING: new Set(['FULLY_SIGNED', 'SAFE_ABORT']),
  // A fully signed transaction is still safe to abandon until the first
  // broadcast attempt. This permits a final authorization-expiry check.
  FULLY_SIGNED: new Set(['SUBMISSION_STARTED', 'SAFE_ABORT']),
  SUBMISSION_STARTED: new Set([
    'FINALIZED_FAILED',
    'RECONCILIATION_REQUIRED',
    'FINALIZED_SUCCESS',
  ]),
  FINALIZED_FAILED: new Set(),
  RECONCILIATION_REQUIRED: new Set(['FINALIZED_FAILED', 'FINALIZED_SUCCESS']),
  FINALIZED_SUCCESS: new Set(['FULFILLING']),
  FULFILLING: new Set(['FULFILLED']),
  FULFILLED: new Set(),
  SAFE_ABORT: new Set(),
};

export const TERMINAL_STATES: ReadonlySet<WorkflowState> = new Set([
  'NO_BUY',
  'POLICY_REJECTED',
  'FINALIZED_FAILED',
  'FULFILLED',
  'SAFE_ABORT',
]);

export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return TRANSITIONS[from].has(to);
}

export function assertTransition(from: WorkflowState, to: WorkflowState): void {
  if (!canTransition(from, to)) {
    invalidTransition(`Cannot transition workflow from ${from} to ${to}`);
  }
}

export function isTerminalState(state: WorkflowState): boolean {
  return TERMINAL_STATES.has(state);
}

const STATES_REQUIRING_RESERVATION: ReadonlySet<WorkflowState> = new Set([
  'RESERVED', 'MESSAGE_BUILT', 'SIGNING', 'FULLY_SIGNED', 'SUBMISSION_STARTED',
  'FINALIZED_FAILED', 'RECONCILIATION_REQUIRED', 'FINALIZED_SUCCESS', 'FULFILLING', 'FULFILLED',
]);

const STATES_REQUIRING_MESSAGE: ReadonlySet<WorkflowState> = new Set([
  'MESSAGE_BUILT', 'SIGNING', 'FULLY_SIGNED', 'SUBMISSION_STARTED', 'FINALIZED_FAILED',
  'RECONCILIATION_REQUIRED', 'FINALIZED_SUCCESS', 'FULFILLING', 'FULFILLED',
]);

const STATES_REQUIRING_SIGNED_TRANSACTION: ReadonlySet<WorkflowState> = new Set([
  'FULLY_SIGNED', 'SUBMISSION_STARTED', 'FINALIZED_FAILED', 'RECONCILIATION_REQUIRED',
  'FINALIZED_SUCCESS', 'FULFILLING', 'FULFILLED',
]);

const STATES_REQUIRING_SUBMISSION: ReadonlySet<WorkflowState> = new Set([
  'SUBMISSION_STARTED', 'FINALIZED_FAILED', 'RECONCILIATION_REQUIRED', 'FINALIZED_SUCCESS',
  'FULFILLING', 'FULFILLED',
]);

export function assertOrderInvariants(order: WorkflowOrder): void {
  if (!Number.isSafeInteger(order.version) || order.version < 0) {
    invariant('Order version must be a non-negative safe integer');
  }
  if (order.auditLength !== order.version + 1) {
    invariant('Audit length must equal order version plus one');
  }
  if (order.auditHead.length !== 64) {
    invariant('Audit head must be a SHA-256 hex digest');
  }
  if (STATES_REQUIRING_RESERVATION.has(order.state) && order.reservation === undefined) {
    invariant(`State ${order.state} requires a reservation`);
  }
  if (STATES_REQUIRING_MESSAGE.has(order.state) && order.settlement === undefined) {
    invariant(`State ${order.state} requires a settlement message`);
  }
  if (STATES_REQUIRING_SIGNED_TRANSACTION.has(order.state) && order.settlement?.signedTransaction === undefined) {
    invariant(`State ${order.state} requires a fully signed transaction`);
  }
  if (STATES_REQUIRING_SUBMISSION.has(order.state) && (order.settlement?.submissionCount ?? 0) < 1) {
    invariant(`State ${order.state} requires at least one submission`);
  }

  if (order.reservation !== undefined) {
    const mustBeConsumed = new Set<WorkflowState>(['FINALIZED_SUCCESS', 'FULFILLING', 'FULFILLED']).has(order.state);
    const mustBeReleased = order.state === 'FINALIZED_FAILED';
    if (mustBeConsumed && order.reservation.status !== 'CONSUMED') {
      invariant(`State ${order.state} requires a consumed reservation`);
    }
    if (mustBeReleased && order.reservation.status !== 'RELEASED') {
      invariant(`State ${order.state} requires a released reservation`);
    }
    if (!mustBeConsumed && !mustBeReleased && order.state !== 'SAFE_ABORT' && order.reservation.status !== 'HELD') {
      invariant(`State ${order.state} requires a held reservation`);
    }
    if (order.state === 'SAFE_ABORT' && order.reservation.status !== 'RELEASED') {
      invariant('A safely aborted order must release its reservation');
    }
  }
}
