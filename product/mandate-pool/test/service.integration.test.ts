import {describe, expect, it, vi} from 'vitest';

import {FixtureAgentRuntime} from '../src/agents/fixture-runtime.js';
import {
  DEMO_ADDRESSES,
  SIGNAL_DESK_CATALOG,
  type BuyerId,
} from '../src/domain/index.js';
import {InMemoryWorkflowRepository} from '../src/persistence/index.js';
import {MandatePoolService} from '../src/service/mandate-pool-service.js';
import {
  FixtureSettlementRuntime,
  type PreparedSettlement,
  type SettlementFinalization,
} from '../src/service/settlement-runtime.js';
import type {WorkflowState} from '../src/workflow/index.js';

class PauseOnceRepository extends InMemoryWorkflowRepository {
  #paused = false;

  constructor(readonly pauseOn: WorkflowState) {
    super();
  }

  override async getOrder(orderId: string) {
    const order = await super.getOrder(orderId);
    if (!this.#paused && order?.state === this.pauseOn) {
      this.#paused = true;
      throw new Error(`test pause at ${this.pauseOn}`);
    }
    return order;
  }
}

class RecoveringSettlementRuntime extends FixtureSettlementRuntime {
  finalizeCalls = 0;
  reconcileCalls = 0;
  reconciledSponsor: string | null = null;

  override async finalize(
    prepared: PreparedSettlement,
  ): Promise<SettlementFinalization> {
    this.finalizeCalls += 1;
    return {
      status: 'unknown',
      cluster: 'devnet',
      commitment: null,
      transactionSignature: prepared.transactionSignature,
      metaError: null,
    };
  }

  override async reconcile(
    prepared: PreparedSettlement,
  ): Promise<SettlementFinalization> {
    this.reconcileCalls += 1;
    this.reconciledSponsor = prepared.plan.sponsorAddress;
    return {
      status: 'success',
      cluster: 'devnet',
      commitment: 'finalized',
      transactionSignature: prepared.transactionSignature,
      metaError: null,
    };
  }
}

const identities = {
  A: {
    signerAddress: DEMO_ADDRESSES.buyerA,
    sourceAta: DEMO_ADDRESSES.sourceAtaA,
  },
  B: {
    signerAddress: DEMO_ADDRESSES.buyerB,
    sourceAta: DEMO_ADDRESSES.sourceAtaB,
  },
  C: {
    signerAddress: DEMO_ADDRESSES.buyerC,
    sourceAta: DEMO_ADDRESSES.sourceAtaC,
  },
} as const;

function createService(): MandatePoolService {
  const clock = new Date('2026-08-02T12:00:00.000Z');
  return new MandatePoolService({
    repository: new InMemoryWorkflowRepository(),
    agentRuntime: new FixtureAgentRuntime(),
    settlementRuntime: new FixtureSettlementRuntime(DEMO_ADDRESSES.sponsor),
    catalog: SIGNAL_DESK_CATALOG,
    buyerIdentities: identities,
    entitlementSecret: 'fixture-entitlement-secret-32-bytes',
    now: () => new Date(clock),
  });
}

const happyMandates = [
  {
    buyerId: 'A' as const,
    naturalLanguage: '최대 4 USDC, API와 CSV가 모두 필요합니다.',
  },
  {
    buyerId: 'B' as const,
    naturalLanguage: '최대 3 USDC, API가 필요하고 자동갱신 금지입니다.',
  },
  {
    buyerId: 'C' as const,
    naturalLanguage: '최대 4 USDC, 7일 일회성만 허용합니다.',
  },
];

async function approveAll(
  service: MandatePoolService,
  order: Awaited<ReturnType<MandatePoolService['createOrder']>>,
) {
  let current = order;
  for (const buyerId of ['A', 'B', 'C'] as const) {
    const mandate = current.mandates.find((item) => item.buyerId === buyerId);
    if (mandate?.mandateHash === undefined || mandate.approvalNonce === undefined) {
      throw new Error(`Missing approval material for ${buyerId}`);
    }
    current = await service.approveMandate(current.orderId, buyerId, {
      mandateHash: mandate.mandateHash,
      approvalNonce: mandate.approvalNonce,
    });
  }
  return current;
}

describe('Mandate Pool service integration', () => {
  it('fulfills exactly three entitlements only after the settlement workflow', async () => {
    const service = createService();
    const created = await service.createOrder({
      idempotencyKey: 'happy-order-key',
      scenarioLabel: 'happy',
      mandates: happyMandates,
    });
    expect(created.state).toBe('AWAITING_APPROVAL');

    const approved = await approveAll(service, created);
    expect(approved.state).toBe('APPROVED');

    const fulfilled = await service.runOrder(created.orderId);
    expect(fulfilled.state).toBe('FULFILLED');
    expect(fulfilled.entitlementCount).toBe(3);
    expect(fulfilled.entitlements).toHaveLength(3);
    expect(fulfilled.evidence?.cluster).toMatch(/NOT ON-CHAIN/);
    expect(fulfilled.evidence?.transferCount).toBe(3);
    expect(fulfilled.evidence?.requiredSignerCount).toBe(4);

    const publicSnapshot = await service.getOrder(created.orderId);
    expect(publicSnapshot?.entitlements).toBeUndefined();
    const token = fulfilled.entitlements?.[0]?.token;
    expect(token).toBeDefined();
    const resource = await service.getProtectedResource(token ?? null);
    expect(resource.authorized).toBe(true);
  });

  it('returns NO_BUY with no settlement when B cap is 2.5 USDC', async () => {
    const service = createService();
    const mandates = happyMandates.map((mandate) =>
      mandate.buyerId === 'B'
        ? {...mandate, naturalLanguage: '최대 2.5 USDC, API, 자동갱신 금지'}
        : mandate,
    );
    const created = await service.createOrder({
      idempotencyKey: 'cap-low-key',
      scenarioLabel: 'cap-low',
      mandates,
    });
    await approveAll(service, created);
    const result = await service.runOrder(created.orderId);
    expect(result.state).toBe('NO_BUY');
    expect(result.evidence).toBeUndefined();
    expect(result.entitlementCount).toBe(0);
  });

  it('replays the same idempotent order and rejects a changed body', async () => {
    const service = createService();
    const first = await service.createOrder({
      idempotencyKey: 'same-idempotency-key',
      mandates: happyMandates,
    });
    const replay = await service.createOrder({
      idempotencyKey: 'same-idempotency-key',
      mandates: happyMandates,
    });
    expect(replay.orderId).toBe(first.orderId);

    await expect(
      service.createOrder({
        idempotencyKey: 'same-idempotency-key',
        mandates: happyMandates.map((mandate) =>
          mandate.buyerId === ('B' satisfies BuyerId)
            ? {...mandate, naturalLanguage: '최대 2 USDC'}
            : mandate,
        ),
      }),
    ).rejects.toMatchObject({statusCode: 409});
  });

  it('does not authorize the protected resource before fulfillment', async () => {
    const service = createService();
    expect((await service.getProtectedResource(null)).authorized).toBe(false);
    expect((await service.getProtectedResource('tampered.token')).authorized).toBe(false);
  });

  it('binds every run and reconciliation retry to the first run idempotency key', async () => {
    const service = createService();
    const created = await service.createOrder({
      idempotencyKey: 'run-key-order-create',
      mandates: happyMandates,
    });
    await approveAll(service, created);
    const firstRunKey = {idempotencyKey: 'stable-run-key-0001'};
    const fulfilled = await service.runOrder(created.orderId, firstRunKey);
    expect(fulfilled.state).toBe('FULFILLED');
    expect((await service.runOrder(created.orderId, firstRunKey)).state).toBe(
      'FULFILLED',
    );
    await expect(
      service.runOrder(created.orderId, {
        idempotencyKey: 'different-run-key-0002',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'RUN_IDEMPOTENCY_KEY_REUSED',
    });
  });

  it('keeps paid entitlements valid across an explicit signing-key rotation window', async () => {
    const repository = new InMemoryWorkflowRepository();
    const oldSecret = 'old-entitlement-secret-32-characters';
    const newSecret = 'new-entitlement-secret-32-characters';
    const serviceWithKeys = (
      entitlementSecret: string,
      entitlementPreviousSecrets: readonly string[] = [],
    ) => new MandatePoolService({
      repository,
      agentRuntime: new FixtureAgentRuntime(),
      settlementRuntime: new FixtureSettlementRuntime(DEMO_ADDRESSES.sponsor),
      catalog: SIGNAL_DESK_CATALOG,
      buyerIdentities: identities,
      entitlementSecret,
      entitlementPreviousSecrets,
      now: () => new Date('2026-08-02T12:00:00.000Z'),
    });

    const originalService = serviceWithKeys(oldSecret);
    const created = await originalService.createOrder({
      idempotencyKey: 'entitlement-key-rotation-order',
      mandates: happyMandates,
    });
    await approveAll(originalService, created);
    const fulfilled = await originalService.runOrder(created.orderId);
    const originalToken = fulfilled.entitlements?.[0]?.token;
    expect(originalToken).toBeDefined();

    const rotatedService = serviceWithKeys(newSecret, [oldSecret]);
    expect(
      (await rotatedService.getProtectedResource(originalToken ?? null)).authorized,
    ).toBe(true);
    const replay = await rotatedService.runOrder(created.orderId);
    expect(replay.entitlements?.[0]?.token).toBe(originalToken);

    const retiredService = serviceWithKeys(newSecret);
    expect(
      (await retiredService.getProtectedResource(originalToken ?? null)).authorized,
    ).toBe(false);
  });

  it('uses the injected live-style catalog as the canonical policy source', async () => {
    const liveStyleCatalog = SIGNAL_DESK_CATALOG.map((sku) => ({
      ...sku,
      merchantOwner: DEMO_ADDRESSES.buyerA,
      merchantUsdcAta: DEMO_ADDRESSES.sourceAtaA,
    }));
    const service = new MandatePoolService({
      repository: new InMemoryWorkflowRepository(),
      agentRuntime: new FixtureAgentRuntime(),
      settlementRuntime: new FixtureSettlementRuntime(DEMO_ADDRESSES.sponsor),
      catalog: liveStyleCatalog,
      buyerIdentities: identities,
      entitlementSecret: 'fixture-entitlement-secret-32-bytes',
      now: () => new Date('2026-08-02T12:00:00.000Z'),
    });
    const created = await service.createOrder({
      idempotencyKey: 'live-style-catalog-key',
      mandates: happyMandates,
    });
    await approveAll(service, created);
    const result = await service.runOrder(created.orderId);
    expect(result.state).toBe('FULFILLED');
    expect(result.policyChecks.every((check) => check.passed)).toBe(true);
  });

  it.each(['PLANNED', 'RESERVED'] as const)(
    'revalidates expiry after a restart from %s and never prepares payment',
    async (pauseOn) => {
      const repository = new PauseOnceRepository(pauseOn);
      const settlement = new FixtureSettlementRuntime(DEMO_ADDRESSES.sponsor);
      const prepare = vi.spyOn(settlement, 'prepare');
      let clock = new Date('2026-08-02T12:00:00.000Z');
      const service = new MandatePoolService({
        repository,
        agentRuntime: new FixtureAgentRuntime(),
        settlementRuntime: settlement,
        catalog: SIGNAL_DESK_CATALOG,
        buyerIdentities: identities,
        entitlementSecret: 'fixture-entitlement-secret-32-bytes',
        now: () => new Date(clock),
      });
      const created = await service.createOrder({
        idempotencyKey: `expiry-restart-${pauseOn.toLowerCase()}`,
        mandates: happyMandates,
      });
      await approveAll(service, created);
      await expect(service.runOrder(created.orderId)).rejects.toThrow(
        `test pause at ${pauseOn}`,
      );

      clock = new Date(clock.getTime() + 20 * 60_000);
      const result = await service.runOrder(created.orderId);
      expect(result.state).toBe(
        pauseOn === 'PLANNED' ? 'POLICY_REJECTED' : 'SAFE_ABORT',
      );
      expect(prepare).not.toHaveBeenCalled();
      expect(result.evidence).toBeUndefined();
      expect(result.entitlementCount).toBe(0);
    },
  );

  it.each(['MESSAGE_BUILT', 'SIGNING', 'FULLY_SIGNED'] as const)(
    'revalidates expiry before broadcast after a restart from %s',
    async (pauseOn) => {
      const repository = new PauseOnceRepository(pauseOn);
      const settlement = new FixtureSettlementRuntime(DEMO_ADDRESSES.sponsor);
      const prepare = vi.spyOn(settlement, 'prepare');
      const finalize = vi.spyOn(settlement, 'finalize');
      let clock = new Date('2026-08-02T12:00:00.000Z');
      const service = new MandatePoolService({
        repository,
        agentRuntime: new FixtureAgentRuntime(),
        settlementRuntime: settlement,
        catalog: SIGNAL_DESK_CATALOG,
        buyerIdentities: identities,
        entitlementSecret: 'fixture-entitlement-secret-32-bytes',
        now: () => new Date(clock),
      });
      const created = await service.createOrder({
        idempotencyKey: `pre-broadcast-expiry-${pauseOn.toLowerCase()}`,
        mandates: happyMandates,
      });
      await approveAll(service, created);
      await expect(service.runOrder(created.orderId)).rejects.toThrow(
        `test pause at ${pauseOn}`,
      );

      clock = new Date(clock.getTime() + 20 * 60_000);
      const result = await service.runOrder(created.orderId);
      expect(result.state).toBe('SAFE_ABORT');
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(finalize).not.toHaveBeenCalled();
      expect(result.evidence).toBeUndefined();
      expect(result.entitlementCount).toBe(0);
    },
  );

  it('resolves reconciliation without preparing or submitting a second transaction', async () => {
    const repository = new InMemoryWorkflowRepository();
    const settlement = new RecoveringSettlementRuntime(DEMO_ADDRESSES.sponsor);
    const prepare = vi.spyOn(settlement, 'prepare');
    const service = new MandatePoolService({
      repository,
      agentRuntime: new FixtureAgentRuntime(),
      settlementRuntime: settlement,
      catalog: SIGNAL_DESK_CATALOG,
      buyerIdentities: identities,
      entitlementSecret: 'fixture-entitlement-secret-32-bytes',
      now: () => new Date('2026-08-02T12:00:00.000Z'),
    });
    const created = await service.createOrder({
      idempotencyKey: 'reconciliation-recovery-key',
      mandates: happyMandates,
    });
    await approveAll(service, created);

    const uncertain = await service.runOrder(created.orderId);
    expect(uncertain.state).toBe('RECONCILIATION_REQUIRED');
    // Simulate a deployment restart after rotating the configured fee sponsor.
    // Recovery must verify the sponsor persisted in the immutable message.
    const rotatedSettlement = new RecoveringSettlementRuntime(
      DEMO_ADDRESSES.merchantOwner,
    );
    const restartedService = new MandatePoolService({
      repository,
      agentRuntime: new FixtureAgentRuntime(),
      settlementRuntime: rotatedSettlement,
      catalog: SIGNAL_DESK_CATALOG,
      buyerIdentities: identities,
      entitlementSecret: 'fixture-entitlement-secret-32-bytes',
      now: () => new Date('2026-08-02T12:00:00.000Z'),
    });
    const fulfilled = await restartedService.runOrder(created.orderId);
    expect(fulfilled.state).toBe('FULFILLED');
    expect(fulfilled.failure).toBeUndefined();
    expect(fulfilled.entitlementCount).toBe(3);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(settlement.finalizeCalls).toBe(1);
    expect(settlement.reconcileCalls).toBe(0);
    expect(rotatedSettlement.reconcileCalls).toBe(1);
    expect(rotatedSettlement.reconciledSponsor).toBe(DEMO_ADDRESSES.sponsor);
  });
});
