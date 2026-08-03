import {createHash} from 'node:crypto';

import {
  address,
  appendTransactionMessageInstructions,
  assertIsFullySignedTransaction,
  assertIsTransactionWithinSizeLimit,
  compileTransactionMessage,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageEncoder,
  getSignatureFromTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  getUtf8Encoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signature as parseSignature,
  signTransactionMessageWithSigners,
  type Address,
  type Base64EncodedWireTransaction,
  type Blockhash,
  type FullySignedTransaction,
  type Instruction,
  type KeyPairSigner,
  type Transaction,
} from '@solana/kit';
import {
  AccountState,
  fetchToken,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

import {atomicAmount, settlementKey} from '../domain/index.js';
import {
  assertTransactionIntent,
  type ExpectedSettlementIntent,
} from '../solana/intent.js';
import {SolanaKitTransactionMessageDecoder} from '../solana/kit-decoder.js';

export const DEVNET_USDC_MINT =
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const DEVNET_USDC_DECIMALS = 6;
export const DEVNET_GENESIS_HASH =
  'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const MEMO_PROGRAM_ADDRESS =
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export type BuyerId = 'A' | 'B' | 'C';

export interface SettlementTransfer {
  readonly buyerId: BuyerId;
  readonly authority: string;
  readonly sourceAta: string;
  readonly amountAtomic: string;
}

export interface SolanaSettlementPlan {
  readonly quoteHash: string;
  readonly policyProofHash: string;
  readonly mint: string;
  readonly decimals: number;
  readonly merchantOwner: string;
  readonly merchantAta: string;
  readonly sponsorAddress: string;
  readonly transfers: readonly SettlementTransfer[];
}

export interface BlockhashLifetime {
  readonly blockhash: Blockhash;
  readonly lastValidBlockHeight: bigint;
}

export interface SignedSettlement {
  readonly messageBase64: string;
  readonly rawTransactionBase64: Base64EncodedWireTransaction;
  readonly transactionSignature: string;
  readonly messageHash: string;
  readonly memo: string;
  readonly blockhash: string;
  readonly lastValidBlockHeight: string;
  readonly wireSize: number;
  readonly transaction: FullySignedTransaction;
}

export interface SettlementSignerSet {
  readonly sponsor: KeyPairSigner;
  readonly buyers: Readonly<Record<BuyerId, KeyPairSigner>>;
}

/** The durable identity needed to resend or verify a prepared settlement. */
export interface SettlementWireIdentity {
  readonly messageBase64: string;
  readonly rawTransactionBase64: string;
  readonly transactionSignature: string;
  readonly messageHash: string;
}

export interface ObservedTokenBalance {
  readonly accountIndex: number;
  readonly mint: string;
  readonly owner: string | null;
  readonly programId: string | null;
  readonly amountAtomic: string;
  readonly decimals: number;
}

export interface FinalizedTransactionRecord {
  readonly slot: string;
  /** Solana RPC numeric scalars are decoded as bigint by @solana/kit at runtime. */
  readonly version: 'legacy' | number | bigint;
  readonly rawTransactionBase64: string;
  readonly metaError: unknown | null;
  readonly preTokenBalances: readonly ObservedTokenBalance[];
  readonly postTokenBalances: readonly ObservedTokenBalance[];
}

export interface VerifiedSourceDebit {
  readonly buyerId: BuyerId;
  readonly sourceAta: string;
  readonly preAmountAtomic: string;
  readonly postAmountAtomic: string;
  readonly debitAtomic: string;
}

export interface FinalizedSettlementEvidence {
  readonly slot: string;
  readonly transactionSignature: string;
  readonly messageHash: string;
  readonly rawTransactionHash: string;
  readonly mint: string;
  readonly sourceDebits: readonly VerifiedSourceDebit[];
  readonly destinationAta: string;
  readonly destinationPreAmountAtomic: string;
  readonly destinationPostAmountAtomic: string;
  readonly destinationCreditAtomic: string;
}

export type FinalizedSettlementVerificationCode =
  | 'NOT_FOUND'
  | 'META_MISSING'
  | 'META_ERROR'
  | 'VERSION_MISMATCH'
  | 'WIRE_DECODE_FAILED'
  | 'RAW_TRANSACTION_MISMATCH'
  | 'SIGNATURE_MISMATCH'
  | 'MESSAGE_BYTES_MISMATCH'
  | 'MESSAGE_HASH_MISMATCH'
  | 'INTENT_MISMATCH'
  | 'TOKEN_BALANCE_SET'
  | 'TOKEN_BALANCE_METADATA'
  | 'TOKEN_BALANCE_DELTA';

export class FinalizedSettlementVerificationError extends Error {
  public constructor(
    public readonly code: FinalizedSettlementVerificationCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'FinalizedSettlementVerificationError';
  }
}

function parseAtomicAmount(value: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`Invalid positive atomic amount: ${value}`);
  }
  return BigInt(value);
}

function parseObservedAtomicAmount(value: string, label: string): bigint {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new FinalizedSettlementVerificationError(
      'TOKEN_BALANCE_METADATA',
      `${label} is not a canonical unsigned atomic amount`,
    );
  }
  return BigInt(value);
}

function decodeCanonicalBase64(value: string, label: string): Uint8Array {
  if (value.length === 0) {
    throw new Error(`${label} is empty`);
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.byteLength === 0 || decoded.toString('base64') !== value) {
    throw new Error(`${label} is not canonical base64`);
  }
  return Uint8Array.from(decoded);
}

interface ByteSequence {
  readonly byteLength: number;
  readonly length: number;
  readonly [index: number]: number;
}

function bytesEqual(left: ByteSequence, right: ByteSequence): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function decodeCanonicalWireTransaction(rawTransactionBase64: string): {
  readonly bytes: Uint8Array;
  readonly transaction: Transaction;
} {
  try {
    const bytes = decodeCanonicalBase64(rawTransactionBase64, 'Wire transaction');
    const decoder = getTransactionDecoder();
    const [transaction, offset] = decoder.read(bytes, 0);
    if (offset !== bytes.byteLength) {
      throw new Error('Wire transaction contains trailing bytes');
    }
    const canonicalBytes = getTransactionEncoder().encode(transaction);
    if (!bytesEqual(bytes, canonicalBytes)) {
      throw new Error('Wire transaction encoding is not canonical');
    }
    return {bytes, transaction};
  } catch (error) {
    if (error instanceof FinalizedSettlementVerificationError) throw error;
    throw new FinalizedSettlementVerificationError(
      'WIRE_DECODE_FAILED',
      error instanceof Error ? error.message : 'Wire transaction decoding failed',
      {cause: error},
    );
  }
}

function assertHash(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 hex digest`);
  }
}

function asAddress(value: string, label: string): Address {
  try {
    return address(value);
  } catch (error) {
    throw new Error(`${label} is not a valid Solana address`, {cause: error});
  }
}

export function settlementMemo(plan: SolanaSettlementPlan): string {
  assertHash(plan.quoteHash, 'quoteHash');
  assertHash(plan.policyProofHash, 'policyProofHash');
  return `MP1:${plan.quoteHash}:${plan.policyProofHash}`;
}

export function validateSettlementPlan(
  plan: SolanaSettlementPlan,
  signers: SettlementSignerSet,
): void {
  if (plan.mint !== DEVNET_USDC_MINT) {
    throw new Error('Only Circle Devnet USDC is allowed');
  }
  if (plan.decimals !== DEVNET_USDC_DECIMALS) {
    throw new Error('Devnet USDC decimals must be 6');
  }
  if (plan.transfers.length !== 3) {
    throw new Error('Exactly three buyer transfers are required');
  }
  if (plan.sponsorAddress !== signers.sponsor.address) {
    throw new Error('Fee sponsor does not match the approved plan');
  }

  const expectedOrder: readonly BuyerId[] = ['A', 'B', 'C'];
  const sources = new Set<string>();
  for (const [index, buyerId] of expectedOrder.entries()) {
    const transfer = plan.transfers[index];
    if (transfer === undefined || transfer.buyerId !== buyerId) {
      throw new Error('Transfers must be ordered A, B, C');
    }
    if (transfer.authority !== signers.buyers[buyerId].address) {
      throw new Error(`Buyer ${buyerId} authority does not match its signer`);
    }
    if (sources.has(transfer.sourceAta)) {
      throw new Error('Buyer source token accounts must be distinct');
    }
    sources.add(transfer.sourceAta);
    asAddress(transfer.sourceAta, `Buyer ${buyerId} source ATA`);
    parseAtomicAmount(transfer.amountAtomic);
  }

  asAddress(plan.merchantOwner, 'Merchant owner');
  asAddress(plan.merchantAta, 'Merchant ATA');
  if (sources.has(plan.merchantAta)) {
    throw new Error('Merchant ATA must differ from all buyer source accounts');
  }
  settlementMemo(plan);
}

function createInstructions(
  plan: SolanaSettlementPlan,
  signers: SettlementSignerSet,
): readonly Instruction[] {
  const mint = asAddress(plan.mint, 'Mint');
  const destination = asAddress(plan.merchantAta, 'Merchant ATA');
  const transfers = plan.transfers.map((transfer) =>
    getTransferCheckedInstruction(
      {
        source: asAddress(transfer.sourceAta, `${transfer.buyerId} source ATA`),
        mint,
        destination,
        authority: signers.buyers[transfer.buyerId],
        amount: parseAtomicAmount(transfer.amountAtomic),
        decimals: plan.decimals,
      },
      {programAddress: TOKEN_PROGRAM_ADDRESS},
    ),
  );
  const memoInstruction: Instruction = {
    programAddress: asAddress(MEMO_PROGRAM_ADDRESS, 'Memo program'),
    data: getUtf8Encoder().encode(settlementMemo(plan)),
  };
  return [...transfers, memoInstruction];
}

function expectedIntentFromPlan(
  plan: SolanaSettlementPlan,
): ExpectedSettlementIntent {
  const memo = settlementMemo(plan);
  return {
    quoteHash: plan.quoteHash,
    policyProofHash: plan.policyProofHash,
    settlementKey: settlementKey(plan.quoteHash, plan.policyProofHash),
    memo,
    feePayerAddress: plan.sponsorAddress,
    requiredSignerAddresses: [
      plan.sponsorAddress,
      ...plan.transfers.map((transfer) => transfer.authority),
    ],
    transfers: plan.transfers.map((transfer) => ({
      buyerId: transfer.buyerId,
      authorityAddress: transfer.authority,
      sourceAta: transfer.sourceAta,
      destinationAta: plan.merchantAta,
      mint: plan.mint,
      amountAtomic: atomicAmount(transfer.amountAtomic),
      decimals: plan.decimals,
    })),
  };
}

interface IndexedObservedTokenBalance extends ObservedTokenBalance {
  readonly accountAddress: string;
}

function indexObservedTokenBalances(
  balances: readonly ObservedTokenBalance[],
  accountAddresses: readonly string[],
  expectedAccountAddresses: ReadonlySet<string>,
  plan: SolanaSettlementPlan,
  phase: 'pre' | 'post',
): Map<string, IndexedObservedTokenBalance> {
  if (balances.length !== expectedAccountAddresses.size) {
    throw new FinalizedSettlementVerificationError(
      'TOKEN_BALANCE_SET',
      `${phase} token balances must contain exactly the three sources and merchant destination`,
    );
  }

  const indexed = new Map<string, IndexedObservedTokenBalance>();
  for (const balance of balances) {
    if (
      !Number.isSafeInteger(balance.accountIndex) ||
      balance.accountIndex < 0 ||
      balance.accountIndex >= accountAddresses.length
    ) {
      throw new FinalizedSettlementVerificationError(
        'TOKEN_BALANCE_METADATA',
        `${phase} token balance has an invalid account index`,
      );
    }
    const accountAddress = accountAddresses[balance.accountIndex];
    if (accountAddress === undefined || !expectedAccountAddresses.has(accountAddress)) {
      throw new FinalizedSettlementVerificationError(
        'TOKEN_BALANCE_SET',
        `${phase} token balance refers to an unapproved token account`,
      );
    }
    if (indexed.has(accountAddress)) {
      throw new FinalizedSettlementVerificationError(
        'TOKEN_BALANCE_SET',
        `${phase} token balances contain a duplicate account`,
      );
    }
    if (
      balance.mint !== plan.mint ||
      balance.decimals !== plan.decimals ||
      balance.programId !== TOKEN_PROGRAM_ADDRESS
    ) {
      throw new FinalizedSettlementVerificationError(
        'TOKEN_BALANCE_METADATA',
        `${phase} token balance mint, decimals, or token program differs from the plan`,
      );
    }
    parseObservedAtomicAmount(balance.amountAtomic, `${phase} balance for ${accountAddress}`);
    indexed.set(accountAddress, {...balance, accountAddress});
  }
  return indexed;
}

function transactionSignature(transaction: Transaction): string {
  try {
    assertIsFullySignedTransaction(transaction);
    return String(getSignatureFromTransaction(transaction));
  } catch (error) {
    throw new FinalizedSettlementVerificationError(
      'WIRE_DECODE_FAILED',
      'Finalized wire transaction is not fully signed',
      {cause: error},
    );
  }
}

/**
 * Independently verifies an RPC-fetched finalized transaction against the
 * exact bytes and payment intent stored before broadcast.
 */
export function verifyFinalizedSettlementRecord(
  plan: SolanaSettlementPlan,
  expected: SettlementWireIdentity,
  record: FinalizedTransactionRecord,
): FinalizedSettlementEvidence {
  if (record.metaError !== null) {
    throw new FinalizedSettlementVerificationError(
      'META_ERROR',
      `Finalized transaction failed: ${JSON.stringify(record.metaError)}`,
    );
  }
  if (record.version !== 0 && record.version !== 0n) {
    throw new FinalizedSettlementVerificationError(
      'VERSION_MISMATCH',
      'Finalized settlement must be a version-0 transaction',
    );
  }
  if (
    plan.transfers.length !== 3 ||
    !(['A', 'B', 'C'] as const).every(
      (buyerId, index) => plan.transfers[index]?.buyerId === buyerId,
    )
  ) {
    throw new FinalizedSettlementVerificationError(
      'INTENT_MISMATCH',
      'Settlement plan must contain exactly transfers A, B, and C in order',
    );
  }

  const finalizedWire = decodeCanonicalWireTransaction(record.rawTransactionBase64);
  const preparedWire = decodeCanonicalWireTransaction(expected.rawTransactionBase64);
  if (!bytesEqual(finalizedWire.bytes, preparedWire.bytes)) {
    throw new FinalizedSettlementVerificationError(
      'RAW_TRANSACTION_MISMATCH',
      'Finalized wire transaction differs from the bytes persisted before broadcast',
    );
  }

  const finalizedSignature = transactionSignature(finalizedWire.transaction);
  if (finalizedSignature !== expected.transactionSignature) {
    throw new FinalizedSettlementVerificationError(
      'SIGNATURE_MISMATCH',
      'Finalized transaction signature differs from the predicted signature',
    );
  }

  let preparedMessageBytes: Uint8Array;
  try {
    preparedMessageBytes = decodeCanonicalBase64(expected.messageBase64, 'Prepared message');
  } catch (error) {
    throw new FinalizedSettlementVerificationError(
      'MESSAGE_BYTES_MISMATCH',
      error instanceof Error ? error.message : 'Prepared message is invalid',
      {cause: error},
    );
  }
  const finalizedMessageBytes = Uint8Array.from(finalizedWire.transaction.messageBytes);
  if (!bytesEqual(finalizedMessageBytes, preparedMessageBytes)) {
    throw new FinalizedSettlementVerificationError(
      'MESSAGE_BYTES_MISMATCH',
      'Finalized message bytes differ from the message persisted before broadcast',
    );
  }
  const finalizedMessageHash = createHash('sha256')
    .update(finalizedMessageBytes)
    .digest('hex');
  if (finalizedMessageHash !== expected.messageHash) {
    throw new FinalizedSettlementVerificationError(
      'MESSAGE_HASH_MISMATCH',
      'Finalized message hash differs from the hash persisted before broadcast',
    );
  }

  let decodedIntent;
  try {
    decodedIntent = new SolanaKitTransactionMessageDecoder().decodeTransactionMessage(
      finalizedMessageBytes,
    );
    assertTransactionIntent(decodedIntent, expectedIntentFromPlan(plan));
  } catch (error) {
    throw new FinalizedSettlementVerificationError(
      'INTENT_MISMATCH',
      error instanceof Error ? error.message : 'Finalized transaction intent verification failed',
      {cause: error},
    );
  }

  const expectedTokenAccounts = new Set([
    ...plan.transfers.map((transfer) => transfer.sourceAta),
    plan.merchantAta,
  ]);
  if (expectedTokenAccounts.size !== 4) {
    throw new FinalizedSettlementVerificationError(
      'TOKEN_BALANCE_SET',
      'Settlement token accounts must be three distinct sources and one destination',
    );
  }
  const accountAddresses = decodedIntent.staticAccounts.map((account) => account.address);
  const preBalances = indexObservedTokenBalances(
    record.preTokenBalances,
    accountAddresses,
    expectedTokenAccounts,
    plan,
    'pre',
  );
  const postBalances = indexObservedTokenBalances(
    record.postTokenBalances,
    accountAddresses,
    expectedTokenAccounts,
    plan,
    'post',
  );

  const sourceDebits: VerifiedSourceDebit[] = plan.transfers.map((transfer) => {
    const before = preBalances.get(transfer.sourceAta);
    const after = postBalances.get(transfer.sourceAta);
    if (before === undefined || after === undefined) {
      throw new FinalizedSettlementVerificationError(
        'TOKEN_BALANCE_SET',
        `Buyer ${transfer.buyerId} source token balance is missing`,
      );
    }
    if (before.owner !== transfer.authority || after.owner !== transfer.authority) {
      throw new FinalizedSettlementVerificationError(
        'TOKEN_BALANCE_METADATA',
        `Buyer ${transfer.buyerId} source token owner differs from its authority`,
      );
    }
    const preAmount = parseObservedAtomicAmount(before.amountAtomic, 'Source pre-balance');
    const postAmount = parseObservedAtomicAmount(after.amountAtomic, 'Source post-balance');
    const debit = preAmount - postAmount;
    if (debit !== parseAtomicAmount(transfer.amountAtomic)) {
      throw new FinalizedSettlementVerificationError(
        'TOKEN_BALANCE_DELTA',
        `Buyer ${transfer.buyerId} source debit differs from the approved allocation`,
      );
    }
    return {
      buyerId: transfer.buyerId,
      sourceAta: transfer.sourceAta,
      preAmountAtomic: preAmount.toString(10),
      postAmountAtomic: postAmount.toString(10),
      debitAtomic: debit.toString(10),
    };
  });

  const destinationBefore = preBalances.get(plan.merchantAta);
  const destinationAfter = postBalances.get(plan.merchantAta);
  if (destinationBefore === undefined || destinationAfter === undefined) {
    throw new FinalizedSettlementVerificationError(
      'TOKEN_BALANCE_SET',
      'Merchant destination token balance is missing',
    );
  }
  if (
    destinationBefore.owner !== plan.merchantOwner ||
    destinationAfter.owner !== plan.merchantOwner
  ) {
    throw new FinalizedSettlementVerificationError(
      'TOKEN_BALANCE_METADATA',
      'Merchant destination token owner differs from the approved merchant',
    );
  }
  const destinationPreAmount = parseObservedAtomicAmount(
    destinationBefore.amountAtomic,
    'Destination pre-balance',
  );
  const destinationPostAmount = parseObservedAtomicAmount(
    destinationAfter.amountAtomic,
    'Destination post-balance',
  );
  const destinationCredit = destinationPostAmount - destinationPreAmount;
  const expectedCredit = plan.transfers.reduce(
    (total, transfer) => total + parseAtomicAmount(transfer.amountAtomic),
    0n,
  );
  if (destinationCredit !== expectedCredit) {
    throw new FinalizedSettlementVerificationError(
      'TOKEN_BALANCE_DELTA',
      'Merchant destination credit differs from the sum of approved allocations',
    );
  }

  return {
    slot: record.slot,
    transactionSignature: finalizedSignature,
    messageHash: finalizedMessageHash,
    rawTransactionHash: createHash('sha256').update(finalizedWire.bytes).digest('hex'),
    mint: plan.mint,
    sourceDebits,
    destinationAta: plan.merchantAta,
    destinationPreAmountAtomic: destinationPreAmount.toString(10),
    destinationPostAmountAtomic: destinationPostAmount.toString(10),
    destinationCreditAtomic: destinationCredit.toString(10),
  };
}

export async function buildAndSignSettlement(
  plan: SolanaSettlementPlan,
  signers: SettlementSignerSet,
  lifetime: BlockhashLifetime,
): Promise<SignedSettlement> {
  validateSettlementPlan(plan, signers);
  const transactionMessage = pipe(
    createTransactionMessage({version: 0}),
    (message) => setTransactionMessageFeePayerSigner(signers.sponsor, message),
    (message) => setTransactionMessageLifetimeUsingBlockhash(lifetime, message),
    (message) =>
      appendTransactionMessageInstructions(
        createInstructions(plan, signers),
        message,
      ),
  );

  const compiledMessage = compileTransactionMessage(transactionMessage);
  const messageBytes = getCompiledTransactionMessageEncoder().encode(compiledMessage);
  const independentlyDecoded =
    new SolanaKitTransactionMessageDecoder().decodeTransactionMessage(
      Uint8Array.from(messageBytes),
    );
  assertTransactionIntent(independentlyDecoded, expectedIntentFromPlan(plan));

  const transaction = await signTransactionMessageWithSigners(transactionMessage);
  assertIsTransactionWithinSizeLimit(transaction);
  const rawTransactionBase64 = getBase64EncodedWireTransaction(transaction);
  const messageHash = createHash('sha256')
    .update(Uint8Array.from(messageBytes))
    .digest('hex');

  return {
    messageBase64: Buffer.from(Uint8Array.from(messageBytes)).toString('base64'),
    rawTransactionBase64,
    transactionSignature: getSignatureFromTransaction(transaction),
    messageHash,
    memo: settlementMemo(plan),
    blockhash: lifetime.blockhash,
    lastValidBlockHeight: lifetime.lastValidBlockHeight.toString(),
    wireSize: Buffer.from(rawTransactionBase64, 'base64').byteLength,
    transaction,
  };
}

export async function signerFromSecret(secret: string): Promise<KeyPairSigner> {
  let bytes: Uint8Array;
  const trimmed = secret.trim();
  if (trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 64 ||
      !parsed.every(
        (value) => Number.isInteger(value) && value >= 0 && value <= 255,
      )
    ) {
      throw new Error('A Solana secret JSON value must contain 64 bytes');
    }
    bytes = Uint8Array.from(parsed as number[]);
  } else {
    bytes = Uint8Array.from(Buffer.from(trimmed, 'base64'));
    if (bytes.length !== 64) {
      throw new Error('A base64 Solana secret must decode to 64 bytes');
    }
  }
  return createKeyPairSignerFromBytes(bytes);
}

export class SolanaRpcSettlementClient {
  readonly #rpc: ReturnType<typeof createSolanaRpc>;

  constructor(rpcUrl: string) {
    this.#rpc = createSolanaRpc(rpcUrl);
  }

  async latestBlockhash(): Promise<BlockhashLifetime> {
    const response = await this.#rpc
      .getLatestBlockhash({commitment: 'finalized'})
      .send();
    return response.value;
  }

  /** Re-checks mutable SPL Token account authority immediately before signing. */
  async validateSettlementAccounts(plan: SolanaSettlementPlan): Promise<void> {
    const mint = asAddress(plan.mint, 'Mint');
    const merchantOwner = asAddress(plan.merchantOwner, 'Merchant owner');
    const merchantAta = asAddress(plan.merchantAta, 'Merchant ATA');
    const [derivedMerchantAta] = await findAssociatedTokenPda({
      owner: merchantOwner,
      mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    if (merchantAta !== derivedMerchantAta) {
      throw new Error('Merchant ATA no longer matches the approved owner and mint');
    }

    const checks = [
      {address: merchantAta, owner: merchantOwner, minimum: 0n, label: 'Merchant'},
      ...plan.transfers.map((transfer) => ({
        address: asAddress(transfer.sourceAta, `Buyer ${transfer.buyerId} source ATA`),
        owner: asAddress(transfer.authority, `Buyer ${transfer.buyerId} authority`),
        minimum: parseAtomicAmount(transfer.amountAtomic),
        label: `Buyer ${transfer.buyerId}`,
      })),
    ];
    await Promise.all(checks.map(async (check) => {
      const account = await fetchToken(this.#rpc, check.address, {
        commitment: 'finalized',
      });
      if (
        account.programAddress !== TOKEN_PROGRAM_ADDRESS ||
        account.data.mint !== mint ||
        account.data.owner !== check.owner ||
        account.data.state !== AccountState.Initialized ||
        account.data.amount < check.minimum
      ) {
        throw new Error(
          `${check.label} token account no longer matches the approved owner, mint, state, or balance`,
        );
      }
    }));
  }

  async sendIdentical(
    signed: Pick<SettlementWireIdentity, 'rawTransactionBase64' | 'transactionSignature'>,
  ): Promise<string> {
    const decoded = decodeCanonicalWireTransaction(signed.rawTransactionBase64);
    const decodedSignature = transactionSignature(decoded.transaction);
    if (decodedSignature !== signed.transactionSignature) {
      throw new Error('Prepared signature differs from its wire transaction');
    }
    const canonicalWire = getBase64EncodedWireTransaction(decoded.transaction);
    const signature = await this.#rpc
      .sendTransaction(canonicalWire, {
        encoding: 'base64',
        maxRetries: 0n,
        preflightCommitment: 'processed',
        skipPreflight: false,
      })
      .send();
    if (String(signature) !== signed.transactionSignature) {
      throw new Error('RPC returned a signature different from the signed payload');
    }
    return signature;
  }

  async signatureStatus(signature: string): Promise<{
    readonly found: boolean;
    readonly confirmationStatus: string | null;
    readonly error: unknown | null;
  }> {
    const response = await this.#rpc
      .getSignatureStatuses([parseSignature(signature)], {
        searchTransactionHistory: true,
      })
      .send();
    const status = response.value[0];
    if (status === null || status === undefined) {
      return {found: false, confirmationStatus: null, error: null};
    }
    return {
      found: true,
      confirmationStatus: status.confirmationStatus ?? null,
      error: status.err,
    };
  }

  async verifyFinalizedSettlement(
    plan: SolanaSettlementPlan,
    expected: SettlementWireIdentity,
  ): Promise<FinalizedSettlementEvidence> {
    const response = await this.#rpc
      .getTransaction(parseSignature(expected.transactionSignature), {
        commitment: 'finalized',
        encoding: 'base64',
        maxSupportedTransactionVersion: 0,
      })
      .send();
    if (response === null) {
      throw new FinalizedSettlementVerificationError(
        'NOT_FOUND',
        'Finalized transaction was not returned by RPC',
      );
    }
    if (response.meta === null) {
      throw new FinalizedSettlementVerificationError(
        'META_MISSING',
        'Finalized transaction metadata is missing',
      );
    }
    const [rawTransactionBase64, encoding] = response.transaction;
    if (encoding !== 'base64') {
      throw new FinalizedSettlementVerificationError(
        'WIRE_DECODE_FAILED',
        'RPC returned an unexpected transaction encoding',
      );
    }
    const toObservedBalance = (
      balance: NonNullable<NonNullable<typeof response.meta>['preTokenBalances']>[number],
    ): ObservedTokenBalance => ({
      accountIndex: balance.accountIndex,
      mint: String(balance.mint),
      owner: balance.owner === undefined ? null : String(balance.owner),
      programId: balance.programId === undefined ? null : String(balance.programId),
      amountAtomic: String(balance.uiTokenAmount.amount),
      decimals: balance.uiTokenAmount.decimals,
    });

    return verifyFinalizedSettlementRecord(plan, expected, {
      slot: response.slot.toString(),
      version: response.version,
      rawTransactionBase64: String(rawTransactionBase64),
      metaError: response.meta.err,
      preTokenBalances: (response.meta.preTokenBalances ?? []).map(toObservedBalance),
      postTokenBalances: (response.meta.postTokenBalances ?? []).map(toObservedBalance),
    });
  }

  async currentBlockHeight(): Promise<bigint> {
    return this.#rpc.getBlockHeight({commitment: 'finalized'}).send();
  }
}
