import {atomicAmount, splitAtomicAmount} from './atomic.js';
import {mandateHash} from './canonical.js';
import {DEMO_ADDRESSES, DEVNET_USDC_MINT, signalDeskSku} from './catalog.js';
import type {BuyerId, HumanApprovalV1, MandateV1, QuoteV1} from './types.js';

export const FIXTURE_EVALUATED_AT = '2026-08-02T00:00:00.000Z';

export interface PolicyFixture {
  readonly evaluatedAt: string;
  readonly mandates: readonly MandateV1[];
  readonly approvals: readonly HumanApprovalV1[];
  readonly quote: QuoteV1;
}

const BUYER_DETAILS: Readonly<Record<BuyerId, {readonly signer: string; readonly sourceAta: string}>> = {
  A: {signer: DEMO_ADDRESSES.buyerA, sourceAta: DEMO_ADDRESSES.sourceAtaA},
  B: {signer: DEMO_ADDRESSES.buyerB, sourceAta: DEMO_ADDRESSES.sourceAtaB},
  C: {signer: DEMO_ADDRESSES.buyerC, sourceAta: DEMO_ADDRESSES.sourceAtaC},
};

function buildMandates(buyerBMaxAtomic: string): MandateV1[] {
  return [
    {
      schema: 'mandate-pool/mandate@1',
      mandateId: 'mandate-a-v1',
      buyerId: 'A',
      signerAddress: BUYER_DETAILS.A.signer,
      sourceAta: BUYER_DETAILS.A.sourceAta,
      allowedMint: DEVNET_USDC_MINT,
      allowedMerchantOwners: [DEMO_ADDRESSES.merchantOwner],
      requiredFeatures: ['api', 'csv'],
      forbiddenFeatures: [],
      maxAmountAtomic: atomicAmount('400000'),
      minimumAccessDays: 3,
      allowAutoRenewal: true,
      validUntil: '2030-01-01T00:00:00.000Z',
      nonce: 'mandate-a-nonce-1',
    },
    {
      schema: 'mandate-pool/mandate@1',
      mandateId: 'mandate-b-v1',
      buyerId: 'B',
      signerAddress: BUYER_DETAILS.B.signer,
      sourceAta: BUYER_DETAILS.B.sourceAta,
      allowedMint: DEVNET_USDC_MINT,
      allowedMerchantOwners: [DEMO_ADDRESSES.merchantOwner],
      requiredFeatures: ['api'],
      forbiddenFeatures: [],
      maxAmountAtomic: atomicAmount(buyerBMaxAtomic),
      minimumAccessDays: 3,
      allowAutoRenewal: false,
      validUntil: '2030-01-01T00:00:00.000Z',
      nonce: 'mandate-b-nonce-1',
    },
    {
      schema: 'mandate-pool/mandate@1',
      mandateId: 'mandate-c-v1',
      buyerId: 'C',
      signerAddress: BUYER_DETAILS.C.signer,
      sourceAta: BUYER_DETAILS.C.sourceAta,
      allowedMint: DEVNET_USDC_MINT,
      allowedMerchantOwners: [DEMO_ADDRESSES.merchantOwner],
      requiredFeatures: [],
      forbiddenFeatures: [],
      maxAmountAtomic: atomicAmount('400000'),
      minimumAccessDays: 7,
      allowAutoRenewal: false,
      validUntil: '2030-01-01T00:00:00.000Z',
      nonce: 'mandate-c-nonce-1',
    },
  ];
}

function buildApprovals(mandates: readonly MandateV1[]): HumanApprovalV1[] {
  return mandates.map((mandate) => ({
    schema: 'mandate-pool/human-approval@1',
    approvalId: `approval-${mandate.buyerId.toLowerCase()}-v1`,
    buyerId: mandate.buyerId,
    mandateHash: mandateHash(mandate),
    decision: 'approved',
    method: 'demo_operator',
    approvedAt: '2026-08-01T00:00:00.000Z',
    validUntil: '2026-08-04T00:00:00.000Z',
    nonce: `approval-${mandate.buyerId.toLowerCase()}-nonce-1`,
  }));
}

function buildQuote(mandates: readonly MandateV1[]): QuoteV1 {
  const selectedSku = signalDeskSku('signaldesk-team-3');
  const allocationAmounts = splitAtomicAmount(
    selectedSku.totalAmountAtomic,
    mandates.length,
  );
  const mandateByBuyer = new Map(mandates.map((mandate) => [mandate.buyerId, mandate]));
  const mandateA = mandateByBuyer.get('A');
  const mandateB = mandateByBuyer.get('B');
  const mandateC = mandateByBuyer.get('C');
  if (mandateA === undefined || mandateB === undefined || mandateC === undefined) {
    throw new Error('The fixture requires exactly buyers A, B, and C');
  }

  return {
    schema: 'mandate-pool/quote@1',
    quoteId: 'quote-signaldesk-team-3-v1',
    orderId: 'order-demo-v1',
    clusterGenesisHash: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    sku: selectedSku,
    allocations: [mandateA, mandateB, mandateC].map((mandate, index) => {
      const amountAtomic = allocationAmounts[index];
      if (amountAtomic === undefined) throw new Error('Missing fixture allocation');
      return {
        buyerId: mandate.buyerId,
        signerAddress: mandate.signerAddress,
        sourceAta: mandate.sourceAta,
        amountAtomic,
      };
    }),
    totalAmountAtomic: selectedSku.totalAmountAtomic,
    mandateHashes: {
      A: mandateHash(mandateA),
      B: mandateHash(mandateB),
      C: mandateHash(mandateC),
    },
    expiresAt: '2026-08-03T00:00:00.000Z',
    nonce: 'quote-team-3-nonce-1',
  };
}

function buildFixture(buyerBMaxAtomic: string): PolicyFixture {
  const mandates = buildMandates(buyerBMaxAtomic);
  return {
    evaluatedAt: FIXTURE_EVALUATED_AT,
    mandates,
    approvals: buildApprovals(mandates),
    quote: buildQuote(mandates),
  };
}

export function createHappyPathFixture(): PolicyFixture {
  return buildFixture('340000');
}

export function createCapTooLowFixture(): PolicyFixture {
  return buildFixture('300000');
}

export const HAPPY_PATH_FIXTURE = createHappyPathFixture();
export const CAP_TOO_LOW_FIXTURE = createCapTooLowFixture();
