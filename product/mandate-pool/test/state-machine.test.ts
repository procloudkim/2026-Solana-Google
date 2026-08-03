import {describe, expect, it} from 'vitest';

import {
  buildAuditEvent,
  canTransition,
  verifyAuditChain,
  type AuditEvent,
} from '../src/workflow/index.js';

describe('workflow state machine', () => {
  it('allows only the intended payment path and reconciliation resolution', () => {
    expect(canTransition('DRAFT', 'AWAITING_APPROVAL')).toBe(true);
    expect(canTransition('AWAITING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'PLANNED')).toBe(true);
    expect(canTransition('PLANNED', 'RESERVED')).toBe(true);
    expect(canTransition('RESERVED', 'MESSAGE_BUILT')).toBe(true);
    expect(canTransition('MESSAGE_BUILT', 'SIGNING')).toBe(true);
    expect(canTransition('SIGNING', 'FULLY_SIGNED')).toBe(true);
    expect(canTransition('FULLY_SIGNED', 'SUBMISSION_STARTED')).toBe(true);
    expect(canTransition('SUBMISSION_STARTED', 'RECONCILIATION_REQUIRED')).toBe(true);
    expect(canTransition('RECONCILIATION_REQUIRED', 'FINALIZED_SUCCESS')).toBe(true);
    expect(canTransition('FINALIZED_SUCCESS', 'FULFILLING')).toBe(true);
    expect(canTransition('FULFILLING', 'FULFILLED')).toBe(true);

    expect(canTransition('FULLY_SIGNED', 'SAFE_ABORT')).toBe(true);
    expect(canTransition('SUBMISSION_STARTED', 'FULLY_SIGNED')).toBe(false);
    expect(canTransition('FULFILLED', 'DRAFT')).toBe(false);
  });

  it('permits SAFE_ABORT only before the first broadcast attempt', () => {
    for (const state of ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'PLANNED', 'RESERVED', 'MESSAGE_BUILT', 'SIGNING', 'FULLY_SIGNED'] as const) {
      expect(canTransition(state, 'SAFE_ABORT'), state).toBe(true);
    }
    for (const state of ['SUBMISSION_STARTED', 'RECONCILIATION_REQUIRED', 'FINALIZED_SUCCESS'] as const) {
      expect(canTransition(state, 'SAFE_ABORT'), state).toBe(false);
    }
  });

  it('allows only AWAITING_APPROVAL to self-transition for partial approvals', () => {
    expect(canTransition('AWAITING_APPROVAL', 'AWAITING_APPROVAL')).toBe(true);
    for (const state of ['DRAFT', 'APPROVED', 'PLANNED', 'SIGNING', 'SUBMISSION_STARTED', 'FULFILLED'] as const) {
      expect(canTransition(state, state), state).toBe(false);
    }
  });
});

describe('hash-chained audit events', () => {
  it('verifies an intact chain and detects payload tampering', () => {
    const first = buildAuditEvent({
      orderId: 'order-1',
      sequence: 0,
      eventType: 'ORDER_CREATED',
      actor: 'test',
      fromState: null,
      toState: 'DRAFT',
      payload: {source: 'unit-test'},
      previousEventHash: null,
      occurredAt: '2026-08-02T00:00:00.000Z',
    });
    const second = buildAuditEvent({
      orderId: 'order-1',
      sequence: 1,
      eventType: 'STATE_AWAITING_APPROVAL',
      actor: 'test',
      fromState: 'DRAFT',
      toState: 'AWAITING_APPROVAL',
      payload: {approved: false},
      previousEventHash: first.eventHash,
      occurredAt: '2026-08-02T00:00:01.000Z',
    });
    expect(verifyAuditChain([first, second])).toBe(true);

    const tampered = structuredClone(second) as AuditEvent & {payload: {approved: boolean}};
    tampered.payload.approved = true;
    expect(verifyAuditChain([first, tampered])).toBe(false);
  });
});
