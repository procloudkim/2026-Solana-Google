import {describe, expect, it} from 'vitest';

import {InMemoryWorkflowRepository} from '../src/persistence/index.js';
import {sha256Hex, verifyAuditChain, type WorkflowOrder} from '../src/workflow/index.js';

const BASE_TIME = '2026-08-02T00:00:00.000Z';
const MINT = 'DevnetUsdcMint';
const QUOTE_HASH = sha256Hex('quote-1');
const POLICY_HASH = sha256Hex('policy-1');

async function createPlanned(
  repository: InMemoryWorkflowRepository,
  orderId: string,
  key = `${orderId}-key`,
): Promise<WorkflowOrder> {
  let order = (await repository.createOrder({
    orderId,
    idempotencyKey: key,
    context: {scenario: 'test'},
    actor: 'test',
    at: BASE_TIME,
  })).order;
  for (const to of ['AWAITING_APPROVAL', 'APPROVED', 'PLANNED'] as const) {
    order = await repository.transition({
      orderId,
      expectedVersion: order.version,
      to,
      actor: 'test',
      at: BASE_TIME,
    });
  }
  return order;
}

async function registerBudgets(repository: InMemoryWorkflowRepository, suffix = ''): Promise<void> {
  await Promise.all([
    repository.registerBudget({mandateId: `mandate-a${suffix}`, buyerId: `buyer-a${suffix}`, mint: MINT, limitAtomic: '4000000', at: BASE_TIME}),
    repository.registerBudget({mandateId: `mandate-b${suffix}`, buyerId: `buyer-b${suffix}`, mint: MINT, limitAtomic: '3000000', at: BASE_TIME}),
    repository.registerBudget({mandateId: `mandate-c${suffix}`, buyerId: `buyer-c${suffix}`, mint: MINT, limitAtomic: '4000000', at: BASE_TIME}),
  ]);
}

function allocations(suffix = '') {
  return [
    {mandateId: `mandate-a${suffix}`, buyerId: `buyer-a${suffix}`, mint: MINT, amountAtomic: '3000000'},
    {mandateId: `mandate-b${suffix}`, buyerId: `buyer-b${suffix}`, mint: MINT, amountAtomic: '3000000'},
    {mandateId: `mandate-c${suffix}`, buyerId: `buyer-c${suffix}`, mint: MINT, amountAtomic: '3000000'},
  ] as const;
}

describe('InMemoryWorkflowRepository', () => {
  it('rejects non-canonical or out-of-range SPL token budget amounts', async () => {
    const repository = new InMemoryWorkflowRepository();
    await expect(repository.registerBudget({
      mandateId: 'invalid-budget', buyerId: 'buyer-a', mint: MINT,
      limitAtomic: '18446744073709551616', at: BASE_TIME,
    })).rejects.toMatchObject({code: 'INVARIANT_VIOLATION'});
  });

  it('deduplicates concurrent creates with a hashed idempotency key', async () => {
    const repository = new InMemoryWorkflowRepository();
    const results = await Promise.all(
      Array.from({length: 100}, (_, index) => repository.createOrder({
        orderId: `requested-${index}`,
        idempotencyKey: 'same-request',
        actor: 'test',
        at: BASE_TIME,
      })),
    );
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.order.orderId)).size).toBe(1);
    expect(results[0]?.order.idempotencyKeyHash).not.toBe('same-request');
  });

  it('uses CAS versions and never accepts stale writers', async () => {
    const repository = new InMemoryWorkflowRepository();
    const created = await repository.createOrder({orderId: 'cas-order', idempotencyKey: 'cas-key', actor: 'test', at: BASE_TIME});
    await repository.transition({orderId: 'cas-order', expectedVersion: 0, to: 'AWAITING_APPROVAL', actor: 'test', at: BASE_TIME});
    await expect(repository.transition({
      orderId: 'cas-order', expectedVersion: created.order.version, to: 'SAFE_ABORT', actor: 'test', at: BASE_TIME,
    })).rejects.toMatchObject({code: 'CONFLICT'});
  });

  it('persists and audits each partial approval before the third approval completes', async () => {
    const repository = new InMemoryWorkflowRepository();
    let order = (await repository.createOrder({
      orderId: 'approval-order', idempotencyKey: 'approval-key', actor: 'test', at: BASE_TIME,
    })).order;
    order = await repository.transition({
      orderId: order.orderId, expectedVersion: order.version, to: 'AWAITING_APPROVAL',
      actor: 'api', at: BASE_TIME,
    });
    for (const buyerId of ['buyer-a', 'buyer-b'] as const) {
      order = await repository.transition({
        orderId: order.orderId,
        expectedVersion: order.version,
        to: 'AWAITING_APPROVAL',
        eventType: 'MANDATE_APPROVED',
        contextPatch: {[`approval_${buyerId}`]: true},
        payload: {buyerId},
        actor: buyerId,
        at: BASE_TIME,
      });
    }
    expect(order.state).toBe('AWAITING_APPROVAL');
    expect(order.context).toMatchObject({'approval_buyer-a': true, 'approval_buyer-b': true});
    order = await repository.transition({
      orderId: order.orderId,
      expectedVersion: order.version,
      to: 'APPROVED',
      eventType: 'MANDATE_APPROVED_ALL',
      contextPatch: {'approval_buyer-c': true},
      payload: {buyerId: 'buyer-c'},
      actor: 'buyer-c',
      at: BASE_TIME,
    });
    expect(order.state).toBe('APPROVED');
    const approvals = (await repository.listAuditEvents(order.orderId)).filter((event) => event.eventType.startsWith('MANDATE_APPROVED'));
    expect(approvals.map((event) => event.actor)).toEqual(['buyer-a', 'buyer-b', 'buyer-c']);
  });

  it('holds budgets atomically, reuses only identical signed bytes, and consumes after finality', async () => {
    const repository = new InMemoryWorkflowRepository();
    await registerBudgets(repository);
    let order = await createPlanned(repository, 'happy-order');
    order = await repository.reserveSettlement({
      orderId: order.orderId,
      expectedVersion: order.version,
      settlementKey: 'settlement-happy',
      quoteHash: QUOTE_HASH,
      policyProofHash: POLICY_HASH,
      totalAtomic: '9000000',
      allocations: allocations(),
      actor: 'policy-engine',
      at: BASE_TIME,
    });
    expect((await repository.getBudget('mandate-b'))?.reservedAtomic).toBe('3000000');

    const messageBytes = Buffer.from('one immutable Solana message');
    order = await repository.attachMessage({
      orderId: order.orderId,
      expectedVersion: order.version,
      message: {
        attemptId: 'attempt-1',
        messageHash: sha256Hex(messageBytes),
        messageBase64: messageBytes.toString('base64'),
        recentBlockhash: 'devnet-blockhash',
        lastValidBlockHeight: 123,
        requiredSigners: ['sponsor', 'buyer-a', 'buyer-b', 'buyer-c'],
      },
      actor: 'settlement-engine',
      at: BASE_TIME,
    });
    order = await repository.transition({
      orderId: order.orderId, expectedVersion: order.version, to: 'SIGNING', actor: 'settlement-engine', at: BASE_TIME,
    });

    const rawBytes = Buffer.from('one immutable fully signed transaction');
    const rawHash = sha256Hex(rawBytes);
    order = await repository.markFullySigned({
      orderId: order.orderId,
      expectedVersion: order.version,
      signedTransaction: {
        rawTransactionBase64: rawBytes.toString('base64'),
        rawTransactionHash: rawHash,
        txSignature: 'predicted-signature',
      },
      actor: 'signer',
      at: BASE_TIME,
    });
    order = await repository.recordSubmission({
      orderId: order.orderId, expectedVersion: order.version, attemptId: 'attempt-1',
      rawTransactionHash: rawHash, txSignature: 'predicted-signature', actor: 'rpc', at: BASE_TIME,
    });
    order = await repository.recordSubmission({
      orderId: order.orderId, expectedVersion: order.version, attemptId: 'attempt-1',
      rawTransactionHash: rawHash, txSignature: 'predicted-signature', actor: 'rpc', at: BASE_TIME,
    });
    expect(order.settlement?.submissionCount).toBe(2);
    await expect(repository.recordSubmission({
      orderId: order.orderId, expectedVersion: order.version, attemptId: 'attempt-2',
      rawTransactionHash: sha256Hex('different'), txSignature: 'different-signature', actor: 'rpc', at: BASE_TIME,
    })).rejects.toMatchObject({code: 'CONFLICT'});

    order = await repository.transition({
      orderId: order.orderId, expectedVersion: order.version, to: 'RECONCILIATION_REQUIRED', actor: 'reconciler', at: BASE_TIME,
    });
    order = await repository.transition({
      orderId: order.orderId, expectedVersion: order.version, to: 'FINALIZED_SUCCESS', actor: 'merchant-verifier', at: BASE_TIME,
    });
    expect(order.reservation?.status).toBe('CONSUMED');
    expect(await repository.getBudget('mandate-b')).toMatchObject({reservedAtomic: '0', consumedAtomic: '3000000'});
    const events = await repository.listAuditEvents(order.orderId);
    expect(events).toHaveLength(order.version + 1);
    expect(verifyAuditChain(events)).toBe(true);
  });

  it('rolls back a failed multi-budget reservation without consuming uniqueness locks', async () => {
    const repository = new InMemoryWorkflowRepository();
    await repository.registerBudget({mandateId: 'low-a', buyerId: 'low-buyer-a', mint: MINT, limitAtomic: '4000000', at: BASE_TIME});
    await repository.registerBudget({mandateId: 'low-b', buyerId: 'low-buyer-b', mint: MINT, limitAtomic: '2000000', at: BASE_TIME});
    let rejected = await createPlanned(repository, 'rejected-order');
    const lowAllocations = [
      {mandateId: 'low-a', buyerId: 'low-buyer-a', mint: MINT, amountAtomic: '3000000'},
      {mandateId: 'low-b', buyerId: 'low-buyer-b', mint: MINT, amountAtomic: '3000000'},
    ] as const;
    await expect(repository.reserveSettlement({
      orderId: rejected.orderId, expectedVersion: rejected.version, settlementKey: 'reusable-settlement',
      quoteHash: sha256Hex('reusable-quote'), policyProofHash: POLICY_HASH, totalAtomic: '6000000',
      allocations: lowAllocations, actor: 'policy-engine', at: BASE_TIME,
    })).rejects.toMatchObject({code: 'BUDGET_EXCEEDED'});
    expect(await repository.getBudget('low-a')).toMatchObject({reservedAtomic: '0'});
    expect((await repository.getOrder(rejected.orderId))?.state).toBe('PLANNED');

    await registerBudgets(repository, '-retry');
    rejected = await createPlanned(repository, 'retry-order');
    const retried = await repository.reserveSettlement({
      orderId: rejected.orderId, expectedVersion: rejected.version, settlementKey: 'reusable-settlement',
      quoteHash: sha256Hex('reusable-quote'), policyProofHash: POLICY_HASH, totalAtomic: '9000000',
      allocations: allocations('-retry'), actor: 'policy-engine', at: BASE_TIME,
    });
    expect(retried.state).toBe('RESERVED');
  });

  it('releases held budgets on SAFE_ABORT but permanently consumes the quote nonce', async () => {
    const repository = new InMemoryWorkflowRepository();
    await registerBudgets(repository, '-abort');
    let order = await createPlanned(repository, 'abort-order');
    const quoteHash = sha256Hex('abort-quote');
    order = await repository.reserveSettlement({
      orderId: order.orderId, expectedVersion: order.version, settlementKey: 'abort-settlement',
      quoteHash, policyProofHash: POLICY_HASH, totalAtomic: '9000000', allocations: allocations('-abort'),
      actor: 'policy-engine', at: BASE_TIME,
    });
    order = await repository.transition({
      orderId: order.orderId, expectedVersion: order.version, to: 'SAFE_ABORT', actor: 'operator', at: BASE_TIME,
    });
    expect(order.reservation?.status).toBe('RELEASED');
    expect(await repository.getBudget('mandate-a-abort')).toMatchObject({reservedAtomic: '0', consumedAtomic: '0'});

    await registerBudgets(repository, '-other');
    const other = await createPlanned(repository, 'other-order');
    await expect(repository.reserveSettlement({
      orderId: other.orderId, expectedVersion: other.version, settlementKey: 'other-settlement',
      quoteHash, policyProofHash: POLICY_HASH, totalAtomic: '9000000', allocations: allocations('-other'),
      actor: 'policy-engine', at: BASE_TIME,
    })).rejects.toMatchObject({code: 'CONFLICT'});
  });
});
