import {
  BUYER_IDS,
  addAtomicAmounts,
  parseAtomicAmount,
  policyProofHash,
  quoteHash,
  settlementKey,
  settlementMemo,
  sha256Hex,
  splitAtomicAmount,
} from '../domain/index.js';
import type {
  AtomicAmount,
  BuyerId,
  ExpectedTransferV1,
  PolicyProofV1,
  QuoteV1,
} from '../domain/index.js';

export const CLASSIC_TOKEN_PROGRAM_ADDRESS =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const MEMO_PROGRAM_ADDRESS =
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export interface ExpectedSettlementIntent {
  readonly quoteHash: string;
  readonly policyProofHash: string;
  readonly settlementKey: string;
  readonly memo: string;
  readonly feePayerAddress: string;
  readonly requiredSignerAddresses: readonly string[];
  readonly transfers: readonly ExpectedTransferV1[];
}

export interface DeriveExpectedSettlementIntentInput {
  readonly feePayerAddress: string;
  readonly quote: QuoteV1;
  readonly policyProof: PolicyProofV1;
}

function assertNonEmptyAddress(value: string, label: string): void {
  if (value.trim() === '') {
    throw new TypeError(`${label} must not be empty`);
  }
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${label} must be distinct`);
  }
}

export function deriveExpectedSettlementIntent(
  input: DeriveExpectedSettlementIntentInput,
): ExpectedSettlementIntent {
  const computedQuoteHash = quoteHash(input.quote);
  if (input.policyProof.quoteHash !== computedQuoteHash) {
    throw new Error('Policy proof does not bind the supplied quote');
  }
  if (
    input.policyProof.schema !== 'mandate-pool/policy-proof@1' ||
    input.policyProof.engineVersion !== 'mandate-pool-policy/2' ||
    !input.policyProof.approved ||
    input.policyProof.checks.length === 0 ||
    !input.policyProof.checks.every((check) => check.passed)
  ) {
    throw new Error('A fully passing policy proof is required before constructing payment intent');
  }

  const allocations = BUYER_IDS.map((buyerId) => {
    const matches = input.quote.allocations.filter((allocation) => allocation.buyerId === buyerId);
    if (matches.length !== 1) {
      throw new Error(`Quote must contain exactly one allocation for buyer ${buyerId}`);
    }
    return matches[0] as (typeof matches)[number];
  });
  if (input.quote.allocations.length !== BUYER_IDS.length) {
    throw new Error('Quote must contain only buyers A, B, and C');
  }
  if (
    addAtomicAmounts(allocations.map((allocation) => allocation.amountAtomic)) !==
    input.quote.totalAmountAtomic
  ) {
    throw new Error('Quote allocation amounts do not sum to the quoted total');
  }
  const expectedAllocationAmounts = splitAtomicAmount(
    input.quote.totalAmountAtomic,
    BUYER_IDS.length,
  );
  if (
    allocations.some(
      (allocation, index) =>
        allocation.amountAtomic !== expectedAllocationAmounts[index],
    )
  ) {
    throw new Error('Quote allocations do not follow the canonical buyer split');
  }
  if (!Number.isInteger(input.quote.sku.decimals) || input.quote.sku.decimals < 0 || input.quote.sku.decimals > 255) {
    throw new Error('Token decimals must be an unsigned byte');
  }
  if (allocations.some((allocation) => parseAtomicAmount(allocation.amountAtomic) === 0n)) {
    throw new Error('Settlement transfers must be positive');
  }

  assertNonEmptyAddress(input.feePayerAddress, 'Fee payer');
  const signerAddresses = [
    input.feePayerAddress,
    ...allocations.map((allocation) => allocation.signerAddress),
  ];
  const sourceAddresses = allocations.map((allocation) => allocation.sourceAta);
  for (const [index, address] of signerAddresses.entries()) {
    assertNonEmptyAddress(address, `Signer ${String(index)}`);
  }
  for (const [index, address] of sourceAddresses.entries()) {
    assertNonEmptyAddress(address, `Source ATA ${String(index)}`);
  }
  assertUnique(signerAddresses, 'Sponsor and buyer signer addresses');
  assertUnique(sourceAddresses, 'Buyer source token accounts');

  const allTransactionAddresses = [
    ...signerAddresses,
    ...sourceAddresses,
    input.quote.sku.merchantUsdcAta,
    input.quote.sku.mint,
    CLASSIC_TOKEN_PROGRAM_ADDRESS,
    MEMO_PROGRAM_ADDRESS,
  ];
  allTransactionAddresses.forEach((address, index) => {
    assertNonEmptyAddress(address, `Transaction address ${String(index)}`);
  });
  assertUnique(allTransactionAddresses, 'Transaction account roles');

  const computedPolicyProofHash = policyProofHash(input.policyProof);
  const transfers: ExpectedTransferV1[] = allocations.map((allocation) => ({
    buyerId: allocation.buyerId,
    authorityAddress: allocation.signerAddress,
    sourceAta: allocation.sourceAta,
    destinationAta: input.quote.sku.merchantUsdcAta,
    mint: input.quote.sku.mint,
    amountAtomic: allocation.amountAtomic,
    decimals: input.quote.sku.decimals,
  }));

  return {
    quoteHash: computedQuoteHash,
    policyProofHash: computedPolicyProofHash,
    settlementKey: settlementKey(computedQuoteHash, computedPolicyProofHash),
    memo: settlementMemo(computedQuoteHash, computedPolicyProofHash),
    feePayerAddress: input.feePayerAddress,
    requiredSignerAddresses: signerAddresses,
    transfers,
  };
}

export interface DecodedAccountMeta {
  readonly address: string;
  readonly isSigner: boolean;
  readonly isWritable: boolean;
}

export interface DecodedTransferCheckedInstruction {
  readonly kind: 'transferChecked';
  readonly programAddress: string;
  readonly sourceAta: string;
  readonly mint: string;
  readonly destinationAta: string;
  readonly authorityAddress: string;
  readonly amountAtomic: AtomicAmount | string;
  readonly decimals: number;
  /** TransferChecked multisig trailing accounts. This MVP forbids them. */
  readonly multisignerAddresses: readonly string[];
}

export interface DecodedMemoInstruction {
  readonly kind: 'memo';
  readonly programAddress: string;
  readonly memo: string;
  /** Memo may carry accounts (including signers); this settlement memo must carry none. */
  readonly accountAddresses: readonly string[];
}

export interface DecodedUnknownInstruction {
  readonly kind: 'unknown';
  readonly programAddress: string;
  readonly accountAddresses: readonly string[];
  readonly dataBase64: string;
}

export type DecodedSettlementInstruction =
  | DecodedTransferCheckedInstruction
  | DecodedMemoInstruction
  | DecodedUnknownInstruction;

/**
 * Security-relevant, complete projection of one serialized transaction message.
 * A decoder adapter MUST include every static account and compiled instruction;
 * it must reject trailing bytes and malformed/non-canonical encodings.
 */
export interface DecodedTransactionIntent {
  readonly messageVersion: 'legacy' | number;
  readonly recentBlockhash: string;
  readonly feePayerAddress: string;
  readonly addressTableLookups: readonly string[];
  readonly requiredSignerAddresses: readonly string[];
  readonly staticAccounts: readonly DecodedAccountMeta[];
  readonly instructions: readonly DecodedSettlementInstruction[];
}

export interface TransactionMessageDecoder {
  decodeTransactionMessage(serializedMessage: Uint8Array): DecodedTransactionIntent;
}

export interface SettlementMessageBuilder {
  buildUnsignedSettlementMessage(
    expected: ExpectedSettlementIntent,
    lifetime: {readonly blockhash: string; readonly lastValidBlockHeight: bigint},
  ): Uint8Array;
}

export type IntentViolationCode =
  | 'MESSAGE_VERSION'
  | 'ADDRESS_TABLE_LOOKUP'
  | 'RECENT_BLOCKHASH'
  | 'FEE_PAYER'
  | 'REQUIRED_SIGNERS'
  | 'STATIC_ACCOUNT_DUPLICATE'
  | 'STATIC_ACCOUNT_SET'
  | 'STATIC_ACCOUNT_FLAGS'
  | 'INSTRUCTION_COUNT'
  | 'INSTRUCTION_KIND'
  | 'TOKEN_PROGRAM'
  | 'TRANSFER_SOURCE'
  | 'TRANSFER_MINT'
  | 'TRANSFER_DESTINATION'
  | 'TRANSFER_AUTHORITY'
  | 'TRANSFER_AMOUNT'
  | 'TRANSFER_DECIMALS'
  | 'TRANSFER_MULTISIG'
  | 'MEMO_PROGRAM'
  | 'MEMO_VALUE'
  | 'MEMO_ACCOUNTS'
  | 'EMPTY_MESSAGE'
  | 'DECODE_FAILED';

export interface IntentViolation {
  readonly code: IntentViolationCode;
  readonly message: string;
  readonly instructionIndex?: number;
}

export type IntentVerificationResult =
  | {readonly ok: true}
  | {readonly ok: false; readonly violations: readonly IntentViolation[]};

export type SerializedIntentVerificationResult =
  | {
      readonly ok: true;
      readonly messageHash: string;
      readonly decoded: DecodedTransactionIntent;
    }
  | {
      readonly ok: false;
      readonly messageHash: string | null;
      readonly violations: readonly IntentViolation[];
    };

function signerSetMatches(
  decoded: readonly string[],
  expected: ExpectedSettlementIntent,
): boolean {
  if (
    decoded.length !== expected.requiredSignerAddresses.length ||
    decoded[0] !== expected.feePayerAddress ||
    new Set(decoded).size !== decoded.length
  ) {
    return false;
  }
  const expectedSet = new Set(expected.requiredSignerAddresses);
  return decoded.every((address) => expectedSet.has(address));
}

function addViolation(
  violations: IntentViolation[],
  code: IntentViolationCode,
  message: string,
  instructionIndex?: number,
): void {
  violations.push(
    instructionIndex === undefined
      ? {code, message}
      : {code, message, instructionIndex},
  );
}

function expectedStaticAccounts(expected: ExpectedSettlementIntent): Map<string, DecodedAccountMeta> {
  const accounts = new Map<string, DecodedAccountMeta>();
  const add = (address: string, isSigner: boolean, isWritable: boolean): void => {
    accounts.set(address, {address, isSigner, isWritable});
  };

  add(expected.feePayerAddress, true, true);
  for (const transfer of expected.transfers) {
    add(transfer.authorityAddress, true, false);
    add(transfer.sourceAta, false, true);
  }
  const firstTransfer = expected.transfers[0];
  if (firstTransfer === undefined) {
    throw new Error('Expected settlement intent has no transfers');
  }
  add(firstTransfer.destinationAta, false, true);
  add(firstTransfer.mint, false, false);
  add(CLASSIC_TOKEN_PROGRAM_ADDRESS, false, false);
  add(MEMO_PROGRAM_ADDRESS, false, false);
  return accounts;
}

export function verifyTransactionIntent(
  decoded: DecodedTransactionIntent,
  expected: ExpectedSettlementIntent,
): IntentVerificationResult {
  const violations: IntentViolation[] = [];

  if (decoded.messageVersion !== 0) {
    addViolation(violations, 'MESSAGE_VERSION', 'Settlement must use a version-0 transaction message');
  }
  if (decoded.addressTableLookups.length !== 0) {
    addViolation(violations, 'ADDRESS_TABLE_LOOKUP', 'Address lookup tables are forbidden');
  }
  if (decoded.recentBlockhash.trim() === '') {
    addViolation(violations, 'RECENT_BLOCKHASH', 'Recent blockhash must not be empty');
  }
  if (decoded.feePayerAddress !== expected.feePayerAddress) {
    addViolation(violations, 'FEE_PAYER', 'Fee payer differs from the approved sponsor');
  }
  if (!signerSetMatches(decoded.requiredSignerAddresses, expected)) {
    addViolation(
      violations,
      'REQUIRED_SIGNERS',
      'Fee payer must be signer zero and the remaining signer set must be exactly buyers A, B, and C',
    );
  }

  const expectedAccounts = expectedStaticAccounts(expected);
  const decodedAccountAddresses = decoded.staticAccounts.map((account) => account.address);
  if (new Set(decodedAccountAddresses).size !== decodedAccountAddresses.length) {
    addViolation(violations, 'STATIC_ACCOUNT_DUPLICATE', 'Static account addresses must be unique');
  }
  const staticAccountSetMatches =
    decoded.staticAccounts.length === expectedAccounts.size &&
    decoded.staticAccounts.every((account) => expectedAccounts.has(account.address));
  if (!staticAccountSetMatches) {
    addViolation(
      violations,
      'STATIC_ACCOUNT_SET',
      'Static account set must contain only the approved settlement accounts and programs',
    );
  }
  for (const account of decoded.staticAccounts) {
    const expectedAccount = expectedAccounts.get(account.address);
    if (
      expectedAccount !== undefined &&
      (account.isSigner !== expectedAccount.isSigner || account.isWritable !== expectedAccount.isWritable)
    ) {
      addViolation(
        violations,
        'STATIC_ACCOUNT_FLAGS',
        `Signer/writable flags differ for ${account.address}`,
      );
    }
  }

  if (decoded.instructions.length !== expected.transfers.length + 1) {
    addViolation(
      violations,
      'INSTRUCTION_COUNT',
      'Message must contain exactly three TransferChecked instructions followed by one memo',
    );
  }

  for (const [index, expectedTransfer] of expected.transfers.entries()) {
    const instruction = decoded.instructions[index];
    if (instruction?.kind !== 'transferChecked') {
      addViolation(
        violations,
        'INSTRUCTION_KIND',
        `Instruction ${String(index)} must be TransferChecked for buyer ${expectedTransfer.buyerId}`,
        index,
      );
      continue;
    }
    if (instruction.programAddress !== CLASSIC_TOKEN_PROGRAM_ADDRESS) {
      addViolation(violations, 'TOKEN_PROGRAM', 'Transfer must use the classic SPL Token program', index);
    }
    if (instruction.sourceAta !== expectedTransfer.sourceAta) {
      addViolation(violations, 'TRANSFER_SOURCE', 'Transfer source ATA differs from the quote', index);
    }
    if (instruction.mint !== expectedTransfer.mint) {
      addViolation(violations, 'TRANSFER_MINT', 'Transfer mint differs from the quote', index);
    }
    if (instruction.destinationAta !== expectedTransfer.destinationAta) {
      addViolation(
        violations,
        'TRANSFER_DESTINATION',
        'Transfer destination ATA differs from the registered merchant ATA',
        index,
      );
    }
    if (instruction.authorityAddress !== expectedTransfer.authorityAddress) {
      addViolation(
        violations,
        'TRANSFER_AUTHORITY',
        'Transfer authority differs from the approved buyer signer',
        index,
      );
    }
    if (instruction.amountAtomic !== expectedTransfer.amountAtomic) {
      addViolation(violations, 'TRANSFER_AMOUNT', 'Transfer base-unit amount differs from the quote', index);
    }
    if (instruction.decimals !== expectedTransfer.decimals) {
      addViolation(violations, 'TRANSFER_DECIMALS', 'TransferChecked decimals differ from the quote', index);
    }
    if (instruction.multisignerAddresses.length !== 0) {
      addViolation(violations, 'TRANSFER_MULTISIG', 'Transfer multisig accounts are forbidden', index);
    }
  }

  const memoIndex = expected.transfers.length;
  const memoInstruction = decoded.instructions[memoIndex];
  if (memoInstruction?.kind !== 'memo') {
    addViolation(
      violations,
      'INSTRUCTION_KIND',
      'The final instruction must be the settlement memo',
      memoIndex,
    );
  } else {
    if (memoInstruction.programAddress !== MEMO_PROGRAM_ADDRESS) {
      addViolation(violations, 'MEMO_PROGRAM', 'Memo must use the approved Memo program', memoIndex);
    }
    if (memoInstruction.memo !== expected.memo) {
      addViolation(violations, 'MEMO_VALUE', 'Memo does not bind the quote and policy proof hashes', memoIndex);
    }
    if (memoInstruction.accountAddresses.length !== 0) {
      addViolation(violations, 'MEMO_ACCOUNTS', 'Memo must not introduce any accounts', memoIndex);
    }
  }

  return violations.length === 0 ? {ok: true} : {ok: false, violations};
}

export function verifySerializedTransactionIntent(
  serializedMessage: Uint8Array,
  expected: ExpectedSettlementIntent,
  decoder: TransactionMessageDecoder,
): SerializedIntentVerificationResult {
  if (serializedMessage.byteLength === 0) {
    return {
      ok: false,
      messageHash: null,
      violations: [{code: 'EMPTY_MESSAGE', message: 'Serialized transaction message is empty'}],
    };
  }

  const messageHash = sha256Hex(serializedMessage);
  let decoded: DecodedTransactionIntent;
  try {
    decoded = decoder.decodeTransactionMessage(serializedMessage.slice());
  } catch (error) {
    return {
      ok: false,
      messageHash,
      violations: [
        {
          code: 'DECODE_FAILED',
          message: error instanceof Error ? error.message : 'Transaction message decoding failed',
        },
      ],
    };
  }

  const verification = verifyTransactionIntent(decoded, expected);
  return verification.ok
    ? {ok: true, messageHash, decoded}
    : {ok: false, messageHash, violations: verification.violations};
}

export class UnsafeTransactionIntentError extends Error {
  public readonly violations: readonly IntentViolation[];

  public constructor(violations: readonly IntentViolation[]) {
    super(violations.map((violation) => `${violation.code}: ${violation.message}`).join('; '));
    this.name = 'UnsafeTransactionIntentError';
    this.violations = violations;
  }
}

export function assertTransactionIntent(
  decoded: DecodedTransactionIntent,
  expected: ExpectedSettlementIntent,
): void {
  const result = verifyTransactionIntent(decoded, expected);
  if (!result.ok) {
    throw new UnsafeTransactionIntentError(result.violations);
  }
}
