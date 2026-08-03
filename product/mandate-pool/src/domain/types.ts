import type {AtomicAmount} from './atomic.js';

export const BUYER_IDS = ['A', 'B', 'C'] as const;
export type BuyerId = (typeof BUYER_IDS)[number];

export interface MandateV1 {
  readonly schema: 'mandate-pool/mandate@1';
  readonly mandateId: string;
  readonly buyerId: BuyerId;
  readonly signerAddress: string;
  readonly sourceAta: string;
  readonly allowedMint: string;
  readonly allowedMerchantOwners: readonly string[];
  readonly requiredFeatures: readonly string[];
  readonly forbiddenFeatures: readonly string[];
  readonly maxAmountAtomic: AtomicAmount;
  readonly minimumAccessDays: number;
  readonly allowAutoRenewal: boolean;
  readonly validUntil: string;
  readonly nonce: string;
}

export interface HumanApprovalV1 {
  readonly schema: 'mandate-pool/human-approval@1';
  readonly approvalId: string;
  readonly buyerId: BuyerId;
  readonly mandateHash: string;
  readonly decision: 'approved';
  readonly method: 'demo_operator';
  readonly approvedAt: string;
  readonly validUntil: string;
  readonly nonce: string;
}

export interface CatalogSkuV1 {
  readonly schema: 'mandate-pool/catalog-sku@1';
  readonly skuId: string;
  readonly name: string;
  readonly merchantOwner: string;
  readonly merchantUsdcAta: string;
  readonly mint: string;
  readonly decimals: number;
  readonly features: readonly string[];
  readonly accessDays: number;
  readonly autoRenewal: boolean;
  readonly totalAmountAtomic: AtomicAmount;
}

export interface QuoteAllocationV1 {
  readonly buyerId: BuyerId;
  readonly signerAddress: string;
  readonly sourceAta: string;
  readonly amountAtomic: AtomicAmount;
}

export interface QuoteV1 {
  readonly schema: 'mandate-pool/quote@1';
  readonly quoteId: string;
  readonly orderId: string;
  readonly clusterGenesisHash: string;
  readonly sku: CatalogSkuV1;
  readonly allocations: readonly QuoteAllocationV1[];
  readonly totalAmountAtomic: AtomicAmount;
  readonly mandateHashes: Readonly<Record<BuyerId, string>>;
  readonly expiresAt: string;
  readonly nonce: string;
}

export interface PolicyCheckV1 {
  readonly code: string;
  readonly passed: boolean;
  readonly message: string;
  readonly buyerId?: BuyerId;
}

export interface PolicyProofV1 {
  readonly schema: 'mandate-pool/policy-proof@1';
  readonly engineVersion: 'mandate-pool-policy/2';
  readonly evaluatedAt: string;
  readonly quoteHash: string;
  readonly approved: boolean;
  readonly checks: readonly PolicyCheckV1[];
}

export type SettlementAttemptStatus =
  | 'RESERVED'
  | 'MESSAGE_BUILT'
  | 'SIGNING'
  | 'FULLY_SIGNED'
  | 'SUBMISSION_STARTED'
  | 'FINALIZED_FAILED'
  | 'RECONCILIATION_REQUIRED'
  | 'FINALIZED_SUCCESS';

export interface ExpectedTransferV1 {
  readonly buyerId: BuyerId;
  readonly authorityAddress: string;
  readonly sourceAta: string;
  readonly destinationAta: string;
  readonly mint: string;
  readonly amountAtomic: AtomicAmount;
  readonly decimals: number;
}

export interface SettlementAttemptV1 {
  readonly schema: 'mandate-pool/settlement-attempt@1';
  readonly settlementKey: string;
  readonly attempt: number;
  readonly quoteHash: string;
  readonly policyProofHash: string;
  readonly messageHash: string;
  readonly messageBase64: string;
  readonly blockhash: string;
  readonly lastValidBlockHeight: string;
  readonly requiredSignerAddresses: readonly string[];
  readonly expectedTransfers: readonly ExpectedTransferV1[];
  readonly rawTransactionBase64?: string;
  readonly predictedTransactionSignature?: string;
  readonly status: SettlementAttemptStatus;
}
