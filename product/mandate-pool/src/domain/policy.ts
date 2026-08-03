import {
  addAtomicAmounts,
  compareAtomicAmounts,
  splitAtomicAmount,
} from './atomic.js';
import {canonicalJson, mandateHash, quoteHash} from './canonical.js';
import {SIGNAL_DESK_CATALOG} from './catalog.js';
import {BUYER_IDS} from './types.js';
import type {
  BuyerId,
  CatalogSkuV1,
  HumanApprovalV1,
  MandateV1,
  PolicyCheckV1,
  PolicyProofV1,
  QuoteAllocationV1,
  QuoteV1,
} from './types.js';

export interface EvaluatePolicyInput {
  readonly mandates: readonly MandateV1[];
  readonly approvals: readonly HumanApprovalV1[];
  readonly quote: QuoteV1;
  /** Explicit input keeps the evaluator deterministic and replayable. */
  readonly evaluatedAt: string;
  /** Defaults to the immutable SignalDesk demo catalog. */
  readonly catalog?: readonly CatalogSkuV1[];
}

function validTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasExactBuyerSet(values: readonly {readonly buyerId: BuyerId}[]): boolean {
  return (
    values.length === BUYER_IDS.length &&
    BUYER_IDS.every((buyerId) => values.filter((value) => value.buyerId === buyerId).length === 1)
  );
}

function mapByBuyer<T extends {readonly buyerId: BuyerId}>(values: readonly T[]): Map<BuyerId, T> {
  return new Map(values.map((value) => [value.buyerId, value]));
}

function containsAll(haystack: readonly string[], needles: readonly string[]): boolean {
  const values = new Set(haystack);
  return needles.every((needle) => values.has(needle));
}

export function evaluatePolicy(input: EvaluatePolicyInput): PolicyProofV1 {
  const checks: PolicyCheckV1[] = [];
  const addCheck = (
    code: string,
    passed: boolean,
    message: string,
    buyerId?: BuyerId,
  ): void => {
    checks.push(
      buyerId === undefined
        ? {code, passed, message}
        : {code, passed, message, buyerId},
    );
  };

  const evaluatedAtMs = validTimestamp(input.evaluatedAt);
  const quoteExpiresAtMs = validTimestamp(input.quote.expiresAt);
  addCheck(
    'EVALUATION_TIME_VALID',
    evaluatedAtMs !== null,
    'Evaluation time is a valid ISO-compatible timestamp',
  );
  addCheck(
    'QUOTE_NOT_EXPIRED',
    evaluatedAtMs !== null && quoteExpiresAtMs !== null && quoteExpiresAtMs > evaluatedAtMs,
    'Quote expiry is valid and later than evaluation time',
  );
  addCheck(
    'MANDATE_BUYER_SET_EXACT',
    hasExactBuyerSet(input.mandates),
    'There is exactly one mandate for each buyer A, B, and C',
  );
  addCheck(
    'APPROVAL_BUYER_SET_EXACT',
    hasExactBuyerSet(input.approvals),
    'There is exactly one human approval for each buyer A, B, and C',
  );
  addCheck(
    'ALLOCATION_BUYER_SET_EXACT',
    hasExactBuyerSet(input.quote.allocations),
    'There is exactly one quote allocation for each buyer A, B, and C',
  );

  let allocationTotalMatches = false;
  let allocationSplitCanonical = false;
  let skuTotalMatches = false;
  const allocationByBuyer = mapByBuyer<QuoteAllocationV1>(input.quote.allocations);
  try {
    allocationTotalMatches =
      addAtomicAmounts(input.quote.allocations.map((allocation) => allocation.amountAtomic)) ===
      input.quote.totalAmountAtomic;
    const expectedAllocations = splitAtomicAmount(
      input.quote.totalAmountAtomic,
      BUYER_IDS.length,
    );
    allocationSplitCanonical =
      input.quote.allocations.every(
        (allocation, index) => allocation.buyerId === BUYER_IDS[index],
      ) &&
      BUYER_IDS.every(
        (buyerId, index) =>
          allocationByBuyer.get(buyerId)?.amountAtomic === expectedAllocations[index],
      );
    skuTotalMatches = input.quote.sku.totalAmountAtomic === input.quote.totalAmountAtomic;
  } catch {
    allocationTotalMatches = false;
    allocationSplitCanonical = false;
    skuTotalMatches = false;
  }
  addCheck(
    'ALLOCATION_TOTAL_MATCHES',
    allocationTotalMatches,
    'Allocation base units sum exactly to the quoted total',
  );
  addCheck(
    'ALLOCATION_SPLIT_CANONICAL',
    allocationSplitCanonical,
    'Allocation order and remainder follow the canonical buyer A, B, C split',
  );
  addCheck(
    'SKU_TOTAL_MATCHES',
    skuTotalMatches,
    'The quoted total exactly matches the immutable SKU snapshot',
  );
  const catalogMatches = (input.catalog ?? SIGNAL_DESK_CATALOG).filter(
    (sku) => sku.skuId === input.quote.sku.skuId,
  );
  addCheck(
    'CATALOG_SKU_CANONICAL',
    catalogMatches.length === 1 && canonicalJson(catalogMatches[0]) === canonicalJson(input.quote.sku),
    'The complete SKU snapshot exactly matches one canonical catalog entry',
  );

  const mandates = mapByBuyer(input.mandates);
  const approvals = mapByBuyer(input.approvals);
  const allocations = allocationByBuyer;

  for (const buyerId of BUYER_IDS) {
    const mandate = mandates.get(buyerId);
    const approval = approvals.get(buyerId);
    const allocation = allocations.get(buyerId);
    if (mandate === undefined || approval === undefined || allocation === undefined) {
      addCheck(
        'BUYER_INPUT_COMPLETE',
        false,
        'Mandate, human approval, and allocation are all present',
        buyerId,
      );
      continue;
    }

    const computedMandateHash = mandateHash(mandate);
    const mandateValidUntilMs = validTimestamp(mandate.validUntil);
    const approvalValidUntilMs = validTimestamp(approval.validUntil);
    const approvalTimeMs = validTimestamp(approval.approvedAt);

    addCheck(
      'MANDATE_NOT_EXPIRED',
      evaluatedAtMs !== null && mandateValidUntilMs !== null && mandateValidUntilMs > evaluatedAtMs,
      'Mandate expiry is valid and later than evaluation time',
      buyerId,
    );
    addCheck(
      'APPROVAL_TIME_VALID',
      evaluatedAtMs !== null && approvalTimeMs !== null && approvalTimeMs <= evaluatedAtMs,
      'Human approval was recorded no later than evaluation time',
      buyerId,
    );
    addCheck(
      'APPROVAL_NOT_EXPIRED',
      evaluatedAtMs !== null && approvalValidUntilMs !== null && approvalValidUntilMs > evaluatedAtMs,
      'Human approval expiry is valid and later than evaluation time',
      buyerId,
    );
    addCheck(
      'APPROVAL_MATCHES_MANDATE',
      approval.buyerId === buyerId && approval.mandateHash === computedMandateHash,
      'Human approval binds the current canonical mandate hash',
      buyerId,
    );
    addCheck(
      'QUOTE_MATCHES_MANDATE',
      input.quote.mandateHashes[buyerId] === computedMandateHash,
      'Quote binds the current canonical mandate hash',
      buyerId,
    );
    addCheck(
      'SIGNER_MATCHES',
      allocation.signerAddress === mandate.signerAddress,
      'Allocation authority matches the approved mandate signer',
      buyerId,
    );
    addCheck(
      'SOURCE_ATA_MATCHES',
      allocation.sourceAta === mandate.sourceAta,
      'Allocation source token account matches the approved mandate',
      buyerId,
    );
    addCheck(
      'MINT_ALLOWED',
      input.quote.sku.mint === mandate.allowedMint,
      'SKU mint matches the mandate allowlist',
      buyerId,
    );
    addCheck(
      'MERCHANT_ALLOWED',
      mandate.allowedMerchantOwners.includes(input.quote.sku.merchantOwner),
      'SKU merchant owner is in the mandate allowlist',
      buyerId,
    );

    let amountWithinCap = false;
    try {
      amountWithinCap = compareAtomicAmounts(allocation.amountAtomic, mandate.maxAmountAtomic) <= 0;
    } catch {
      amountWithinCap = false;
    }
    addCheck(
      'AMOUNT_WITHIN_CAP',
      amountWithinCap,
      'Allocated token base units do not exceed the approved cap',
      buyerId,
    );
    addCheck(
      'REQUIRED_FEATURES_PRESENT',
      containsAll(input.quote.sku.features, mandate.requiredFeatures),
      'SKU contains every required feature',
      buyerId,
    );
    addCheck(
      'FORBIDDEN_FEATURES_ABSENT',
      !input.quote.sku.features.some((feature) => mandate.forbiddenFeatures.includes(feature)),
      'SKU contains no forbidden feature',
      buyerId,
    );
    addCheck(
      'ACCESS_DURATION_ALLOWED',
      Number.isSafeInteger(mandate.minimumAccessDays) &&
        mandate.minimumAccessDays >= 0 &&
        input.quote.sku.accessDays >= mandate.minimumAccessDays,
      'SKU access duration satisfies the mandate minimum',
      buyerId,
    );
    addCheck(
      'AUTO_RENEWAL_ALLOWED',
      !input.quote.sku.autoRenewal || mandate.allowAutoRenewal,
      'SKU does not enable renewal unless the mandate permits it',
      buyerId,
    );
  }

  return {
    schema: 'mandate-pool/policy-proof@1',
    engineVersion: 'mandate-pool-policy/2',
    evaluatedAt: input.evaluatedAt,
    quoteHash: quoteHash(input.quote),
    approved: checks.every((check) => check.passed),
    checks,
  };
}
