import {describe, expect, it} from 'vitest';

import {
  atomicAmount,
  createCapTooLowFixture,
  createHappyPathFixture,
  evaluatePolicy,
} from '../src/domain/index.js';
import type {PolicyFixture} from '../src/domain/index.js';

function evaluate(fixture: PolicyFixture) {
  return evaluatePolicy({
    mandates: fixture.mandates,
    approvals: fixture.approvals,
    quote: fixture.quote,
    evaluatedAt: fixture.evaluatedAt,
  });
}

describe('deterministic mandate policy', () => {
  it('approves the SignalDesk Team-3 happy path', () => {
    const fixture = createHappyPathFixture();
    const proof = evaluate(fixture);
    expect(proof.approved).toBe(true);
    expect(proof.checks.length).toBeGreaterThan(30);
    expect(proof.checks.every((check) => check.passed)).toBe(true);
    expect(fixture.quote.totalAmountAtomic).toBe('1000000');
    expect(fixture.quote.allocations.map((allocation) => allocation.amountAtomic)).toEqual([
      '333334',
      '333333',
      '333333',
    ]);
  });

  it('rejects before signing when buyer B has a 0.3 USDC cap', () => {
    const proof = evaluate(createCapTooLowFixture());
    expect(proof.approved).toBe(false);
    expect(proof.checks).toContainEqual(
      expect.objectContaining({code: 'AMOUNT_WITHIN_CAP', buyerId: 'B', passed: false}),
    );
  });

  it('invalidates approval and quote bindings after a mandate mutation', () => {
    const fixture = createHappyPathFixture();
    const mandates = structuredClone(fixture.mandates);
    const mandateA = mandates.find((mandate) => mandate.buyerId === 'A');
    if (mandateA === undefined) throw new Error('Missing fixture buyer A');
    Object.assign(mandateA, {maxAmountAtomic: atomicAmount('3500000')});

    const proof = evaluatePolicy({...fixture, mandates});
    expect(proof.approved).toBe(false);
    expect(proof.checks).toContainEqual(
      expect.objectContaining({code: 'APPROVAL_MATCHES_MANDATE', buyerId: 'A', passed: false}),
    );
    expect(proof.checks).toContainEqual(
      expect.objectContaining({code: 'QUOTE_MATCHES_MANDATE', buyerId: 'A', passed: false}),
    );
  });

  it('does not trust a model-proposed SKU price', () => {
    const fixture = createHappyPathFixture();
    const quote = structuredClone(fixture.quote);
    Object.assign(quote.sku, {totalAmountAtomic: atomicAmount('1')});
    const proof = evaluatePolicy({...fixture, quote});
    expect(proof.approved).toBe(false);
    expect(proof.checks).toContainEqual(
      expect.objectContaining({code: 'SKU_TOTAL_MATCHES', passed: false}),
    );
    expect(proof.checks).toContainEqual(
      expect.objectContaining({code: 'CATALOG_SKU_CANONICAL', passed: false}),
    );

    const skewed = createHappyPathFixture();
    const allocations = structuredClone(skewed.quote.allocations);
    const allocationA = allocations[0];
    const allocationB = allocations[1];
    if (allocationA === undefined || allocationB === undefined) {
      throw new Error('Missing canonical allocations');
    }
    Object.assign(allocationA, {amountAtomic: atomicAmount('333335')});
    Object.assign(allocationB, {amountAtomic: atomicAmount('333332')});
    const skewedProof = evaluate({...skewed, quote: {...skewed.quote, allocations}});
    expect(skewedProof.approved).toBe(false);
    expect(skewedProof.checks).toContainEqual(
      expect.objectContaining({code: 'ALLOCATION_SPLIT_CANONICAL', passed: false}),
    );

    const reordered = createHappyPathFixture();
    const reversedAllocations = [...reordered.quote.allocations].reverse();
    const reorderedProof = evaluate({
      ...reordered,
      quote: {...reordered.quote, allocations: reversedAllocations},
    });
    expect(reorderedProof.approved).toBe(false);
    expect(reorderedProof.checks).toContainEqual(
      expect.objectContaining({code: 'ALLOCATION_SPLIT_CANONICAL', passed: false}),
    );
  });

  it('rejects expired approval, quote, or mandate deterministically', () => {
    const fixture = createHappyPathFixture();
    const proof = evaluatePolicy({...fixture, evaluatedAt: '2031-01-01T00:00:00.000Z'});
    expect(proof.approved).toBe(false);
    expect(proof.checks.some((check) => check.code === 'QUOTE_NOT_EXPIRED' && !check.passed)).toBe(true);
    expect(proof.checks.some((check) => check.code === 'MANDATE_NOT_EXPIRED' && !check.passed)).toBe(true);
    expect(proof.checks.some((check) => check.code === 'APPROVAL_NOT_EXPIRED' && !check.passed)).toBe(true);
  });

  it('rejects duplicate buyers even if the array still has three entries', () => {
    const fixture = createHappyPathFixture();
    const allocations = structuredClone(fixture.quote.allocations);
    const allocationC = allocations[2];
    if (allocationC === undefined) throw new Error('Missing fixture allocation C');
    Object.assign(allocationC, {buyerId: 'B'});
    const quote = {...fixture.quote, allocations};
    const proof = evaluatePolicy({...fixture, quote});
    expect(proof.approved).toBe(false);
    expect(proof.checks).toContainEqual(
      expect.objectContaining({code: 'ALLOCATION_BUYER_SET_EXACT', passed: false}),
    );
  });
});
