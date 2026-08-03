import {describe, expect, it} from 'vitest';

import {DEMO_ADDRESSES, DEVNET_USDC_MINT} from '../src/domain/index.js';
import {
  createLocalPolicyScenarios,
  noTransactionRejection,
  parseLocalnetSmokeArgs,
} from '../scripts/localnet-smoke.js';

const SCENARIO_INPUT = {
  clusterGenesisHash: 'localnet-test-genesis',
  mint: DEVNET_USDC_MINT,
  merchantOwner: DEMO_ADDRESSES.merchantOwner,
  merchantAta: DEMO_ADDRESSES.merchantUsdcAta,
  buyers: {
    A: {signerAddress: DEMO_ADDRESSES.buyerA, sourceAta: DEMO_ADDRESSES.sourceAtaA},
    B: {signerAddress: DEMO_ADDRESSES.buyerB, sourceAta: DEMO_ADDRESSES.sourceAtaB},
    C: {signerAddress: DEMO_ADDRESSES.buyerC, sourceAta: DEMO_ADDRESSES.sourceAtaC},
  },
  evaluatedAt: '2026-08-03T00:00:00.000Z',
} as const;

describe('localnet smoke CLI', () => {
  it('requires one explicit receipt output path', () => {
    expect(parseLocalnetSmokeArgs(['--output=./receipt.json']).outputPath).toMatch(/receipt\.json$/u);
    expect(() => parseLocalnetSmokeArgs([])).toThrow(/--output/u);
    expect(() => parseLocalnetSmokeArgs(['--output=a.json', '--output=b.json'])).toThrow(/--output/u);
  });
});

describe('localnet smoke policy scenarios', () => {
  it('approves the canonical 333334/333333/333333 split', () => {
    const {happy} = createLocalPolicyScenarios(SCENARIO_INPUT);

    expect(happy.proof.approved).toBe(true);
    expect(happy.quote.allocations.map(({amountAtomic}) => amountAtomic)).toEqual(['333334', '333333', '333333']);
  });

  it('rejects buyer B at a 300000 cap before any transaction exists', () => {
    const {rejected} = createLocalPolicyScenarios(SCENARIO_INPUT);

    expect(noTransactionRejection(rejected)).toEqual({
      decision: 'NO_BUY',
      buyerId: 'B',
      capAtomic: '300000',
      requiredAtomic: '333333',
      reasonCodes: ['AMOUNT_WITHIN_CAP:B'],
      rejectedProofBuilderRefused: true,
      transactionBuilt: false,
      rawTransactionBase64: null,
      signature: null,
    });
  });
});
