#!/usr/bin/env node

import {spawn, spawnSync, type ChildProcessByStdio} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants as fsConstants} from 'node:fs';
import {access, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import type {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';

import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getCreateMintInstructionPlan,
  getMintSize,
  getMintToATAInstructionPlan,
  getTransferCheckedInstruction,
} from '@solana-program/token';
import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithinSizeLimit,
  compileTransactionMessage,
  createSolanaRpc,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageEncoder,
  getSignatureFromTransaction,
  getUtf8Encoder,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  signature,
  type Instruction,
  type InstructionPlan,
  type KeyPairSigner,
} from '@solana/kit';

import {
  atomicAmount,
  evaluatePolicy,
  mandateHash,
  splitAtomicAmount,
  type BuyerId,
  type CatalogSkuV1,
  type HumanApprovalV1,
  type MandateV1,
  type PolicyProofV1,
  type QuoteV1,
} from '../src/domain/index.js';
import {
  DEVNET_GENESIS_HASH,
  DEVNET_USDC_MINT,
  FinalizedSettlementVerificationError,
  MEMO_PROGRAM_ADDRESS,
  SolanaRpcSettlementClient,
  type BlockhashLifetime,
  type FinalizedSettlementEvidence,
  type SettlementSignerSet,
  type SignedSettlement,
  type SolanaSettlementPlan,
} from '../src/runtime/solana-kit.js';
import {
  SolanaKitTransactionMessageDecoder,
  assertTransactionIntent,
  deriveExpectedSettlementIntent,
  type ExpectedSettlementIntent,
} from '../src/solana/index.js';

const RPC_PORT = 18_899;
const FAUCET_PORT = 19_900;
const RPC_URL = `http://127.0.0.1:${String(RPC_PORT)}`;
const TOKEN_DECIMALS = 6;
const INITIAL_BUYER_BALANCE = 1_000_000n;
const TOTAL_AMOUNT = '1000000';
const HAPPY_ALLOCATIONS = ['333334', '333333', '333333'] as const;
const STARTUP_TIMEOUT_MS = 30_000;
const FINALITY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;
const MAX_VALIDATOR_LOG_BYTES = 32 * 1024;

type LocalRpc = ReturnType<typeof createSolanaRpc>;

interface LocalBuyerAccount {
  readonly signer: KeyPairSigner;
  readonly ata: string;
}

interface LocalPolicyInput {
  readonly clusterGenesisHash: string;
  readonly mint: string;
  readonly merchantOwner: string;
  readonly merchantAta: string;
  readonly buyers: Readonly<Record<BuyerId, {readonly signerAddress: string; readonly sourceAta: string}>>;
  readonly buyerBCapAtomic: '340000' | '300000';
  readonly evaluatedAt: string;
}

export interface LocalPolicyScenario {
  readonly mandates: readonly MandateV1[];
  readonly approvals: readonly HumanApprovalV1[];
  readonly quote: QuoteV1;
  readonly proof: PolicyProofV1;
}

export interface NoTransactionRejection {
  readonly decision: 'NO_BUY';
  readonly buyerId: 'B';
  readonly capAtomic: '300000';
  readonly requiredAtomic: '333333';
  readonly reasonCodes: readonly string[];
  readonly rejectedProofBuilderRefused: boolean;
  readonly transactionBuilt: false;
  readonly rawTransactionBase64: null;
  readonly signature: null;
}

interface SmokeReceipt {
  schema: 'mandate-pool/localnet-smoke-receipt@1';
  status: 'PASS';
  generatedAt: string;
  validator: {binary: string; version: string; rpcUrl: typeof RPC_URL; genesisHash: string};
  safety: {
    localLoopbackOnly: true;
    disposableKeysAndMint: true;
    devnetGenesisRejected: true;
    devnetMintRejected: true;
    secretSources: 'none';
    productionGuardModified: false;
    temporaryLedgerRemoved: boolean;
  };
  setup: {
    airdropSignature: string;
    transactionSignatures: readonly string[];
    mint: string;
    sponsor: string;
    buyers: Readonly<Record<BuyerId, {readonly owner: string; readonly ata: string; readonly initialAmountAtomic: string}>>;
    merchant: {readonly owner: string; readonly ata: string; readonly initialAmountAtomic: '0'};
  };
  rejection: NoTransactionRejection;
  settlement: {
    transactionCount: 1;
    version: 0;
    instructionCount: 4;
    transferCheckedCount: 3;
    transferAmountsAtomic: typeof HAPPY_ALLOCATIONS;
    memo: string;
    signature: string;
    finalizedSlot: string;
    messageHash: string;
    rawTransactionHash: string;
    rawTransactionMatchesPreparedBytes: true;
    sourceDebits: FinalizedSettlementEvidence['sourceDebits'];
    destinationAta: string;
    destinationPreAmountAtomic: string;
    destinationPostAmountAtomic: string;
    destinationCreditAtomic: string;
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function appendBounded(current: string, chunk: Buffer): string {
  return (current + chunk.toString('utf8')).slice(-MAX_VALIDATOR_LOG_BYTES);
}

export function parseLocalnetSmokeArgs(argv: readonly string[]): {readonly outputPath: string} {
  if (argv.length !== 1 || !argv[0]?.startsWith('--output=')) {
    throw new Error('Usage: npm run localnet:smoke -- --output=<new-receipt-path>');
  }
  const value = argv[0].slice('--output='.length).trim();
  if (value.length === 0 || value.includes('\0') || /[\r\n]/u.test(value)) {
    throw new Error('--output must name one non-empty receipt path');
  }
  return {outputPath: resolve(value)};
}

function buildPolicyScenario(input: LocalPolicyInput): LocalPolicyScenario {
  const evaluatedAtMs = Date.parse(input.evaluatedAt);
  if (!Number.isFinite(evaluatedAtMs)) throw new Error('Local policy evaluation time is invalid');
  const approvedAt = new Date(evaluatedAtMs - 1_000).toISOString();
  const validUntil = new Date(evaluatedAtMs + 15 * 60_000).toISOString();
  const sku: CatalogSkuV1 = {
    schema: 'mandate-pool/catalog-sku@1',
    skuId: 'localnet-signaldesk-team-3',
    name: 'Localnet SignalDesk Team-3',
    merchantOwner: input.merchantOwner,
    merchantUsdcAta: input.merchantAta,
    mint: input.mint,
    decimals: TOKEN_DECIMALS,
    features: ['api', 'csv'],
    accessDays: 7,
    autoRenewal: false,
    totalAmountAtomic: atomicAmount(TOTAL_AMOUNT),
  };
  const mandateDetails = {
    A: {maxAmountAtomic: '400000', requiredFeatures: ['api', 'csv'], minimumAccessDays: 3},
    B: {maxAmountAtomic: input.buyerBCapAtomic, requiredFeatures: ['api'], minimumAccessDays: 3},
    C: {maxAmountAtomic: '400000', requiredFeatures: [], minimumAccessDays: 7},
  } as const;
  const buyers: readonly BuyerId[] = ['A', 'B', 'C'];
  const mandates = buyers.map((buyerId): MandateV1 => ({
    schema: 'mandate-pool/mandate@1',
    mandateId: `localnet-mandate-${buyerId.toLowerCase()}`,
    buyerId,
    signerAddress: input.buyers[buyerId].signerAddress,
    sourceAta: input.buyers[buyerId].sourceAta,
    allowedMint: input.mint,
    allowedMerchantOwners: [input.merchantOwner],
    requiredFeatures: mandateDetails[buyerId].requiredFeatures,
    forbiddenFeatures: [],
    maxAmountAtomic: atomicAmount(mandateDetails[buyerId].maxAmountAtomic),
    minimumAccessDays: mandateDetails[buyerId].minimumAccessDays,
    allowAutoRenewal: false,
    validUntil,
    nonce: `localnet-mandate-${buyerId.toLowerCase()}-nonce`,
  }));
  const approvals = mandates.map((mandate): HumanApprovalV1 => ({
    schema: 'mandate-pool/human-approval@1',
    approvalId: `localnet-approval-${mandate.buyerId.toLowerCase()}`,
    buyerId: mandate.buyerId,
    mandateHash: mandateHash(mandate),
    decision: 'approved',
    method: 'demo_operator',
    approvedAt,
    validUntil,
    nonce: `localnet-approval-${mandate.buyerId.toLowerCase()}-nonce`,
  }));
  const allocationAmounts = splitAtomicAmount(TOTAL_AMOUNT, buyers.length);
  const mandateByBuyer = new Map(mandates.map((mandate) => [mandate.buyerId, mandate]));
  const mandateA = mandateByBuyer.get('A');
  const mandateB = mandateByBuyer.get('B');
  const mandateC = mandateByBuyer.get('C');
  if (mandateA === undefined || mandateB === undefined || mandateC === undefined) {
    throw new Error('Localnet policy requires buyers A, B, and C');
  }
  const quote: QuoteV1 = {
    schema: 'mandate-pool/quote@1',
    quoteId: `localnet-quote-${input.buyerBCapAtomic}`,
    orderId: `localnet-order-${input.buyerBCapAtomic}`,
    clusterGenesisHash: input.clusterGenesisHash,
    sku,
    allocations: [mandateA, mandateB, mandateC].map((mandate, index) => {
      const amountAtomic = allocationAmounts[index];
      if (amountAtomic === undefined) throw new Error(`Missing localnet allocation ${String(index)}`);
      return {buyerId: mandate.buyerId, signerAddress: mandate.signerAddress, sourceAta: mandate.sourceAta, amountAtomic};
    }),
    totalAmountAtomic: sku.totalAmountAtomic,
    mandateHashes: {A: mandateHash(mandateA), B: mandateHash(mandateB), C: mandateHash(mandateC)},
    expiresAt: validUntil,
    nonce: `localnet-quote-${input.buyerBCapAtomic}-nonce`,
  };
  const proof = evaluatePolicy({mandates, approvals, quote, evaluatedAt: input.evaluatedAt, catalog: [sku]});
  return {mandates, approvals, quote, proof};
}

export function createLocalPolicyScenarios(
  input: Omit<LocalPolicyInput, 'buyerBCapAtomic'>,
): {readonly happy: LocalPolicyScenario; readonly rejected: LocalPolicyScenario} {
  return {
    happy: buildPolicyScenario({...input, buyerBCapAtomic: '340000'}),
    rejected: buildPolicyScenario({...input, buyerBCapAtomic: '300000'}),
  };
}

export function noTransactionRejection(scenario: LocalPolicyScenario): NoTransactionRejection {
  if (scenario.proof.approved) throw new Error('The rejection scenario unexpectedly passed policy');
  const failedChecks = scenario.proof.checks.filter((check) => !check.passed);
  if (failedChecks.length !== 1 || failedChecks[0]?.code !== 'AMOUNT_WITHIN_CAP' || failedChecks[0].buyerId !== 'B') {
    throw new Error(`Unexpected rejection checks: ${JSON.stringify(failedChecks)}`);
  }
  let builderRefused = false;
  try {
    deriveExpectedSettlementIntent({
      feePayerAddress: scenario.mandates[0]?.signerAddress ?? '',
      quote: scenario.quote,
      policyProof: scenario.proof,
    });
  } catch (error) {
    builderRefused = /fully passing policy proof/u.test(errorMessage(error));
  }
  if (!builderRefused) throw new Error('Rejected proof was not refused before transaction construction');
  return {
    decision: 'NO_BUY', buyerId: 'B', capAtomic: '300000', requiredAtomic: '333333',
    reasonCodes: failedChecks.map((check) => `${check.code}:${check.buyerId ?? 'ORDER'}`),
    rejectedProofBuilderRefused: true, transactionBuilt: false, rawTransactionBase64: null, signature: null,
  };
}

function flattenSequentialPlan(plan: InstructionPlan): readonly Instruction[] {
  switch (plan.kind) {
    case 'single': return [plan.instruction];
    case 'sequential': return plan.plans.flatMap(flattenSequentialPlan);
    case 'parallel': throw new Error('Localnet setup refuses parallel instruction plans');
    case 'messagePacker': throw new Error('Localnet setup refuses dynamic message packers');
  }
}

async function waitForFinalized(rpc: LocalRpc, transactionSignature: string): Promise<void> {
  const deadline = Date.now() + FINALITY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await rpc.getSignatureStatuses([signature(transactionSignature)], {searchTransactionHistory: true}).send();
    const status = response.value[0];
    if (status?.err !== null && status?.err !== undefined) {
      throw new Error(`Localnet transaction failed: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === 'finalized') return;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Localnet finality timed out for ${transactionSignature}`);
}

async function sendInstructions(rpc: LocalRpc, sponsor: KeyPairSigner, instructions: readonly Instruction[]): Promise<string> {
  const lifetime = (await rpc.getLatestBlockhash({commitment: 'finalized'}).send()).value;
  const message = pipe(
    createTransactionMessage({version: 0}),
    (current) => setTransactionMessageFeePayerSigner(sponsor, current),
    (current) => setTransactionMessageLifetimeUsingBlockhash(lifetime, current),
    (current) => appendTransactionMessageInstructions(instructions, current),
  );
  const transaction = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithinSizeLimit(transaction);
  const expectedSignature = String(getSignatureFromTransaction(transaction));
  const returnedSignature = await rpc.sendTransaction(getBase64EncodedWireTransaction(transaction), {
    encoding: 'base64', maxRetries: 0n, preflightCommitment: 'processed', skipPreflight: false,
  }).send();
  if (String(returnedSignature) !== expectedSignature) throw new Error('Setup signature differs from submitted bytes');
  await waitForFinalized(rpc, expectedSignature);
  return expectedSignature;
}

async function buildAndSignLocalSettlement(
  expected: ExpectedSettlementIntent,
  signers: SettlementSignerSet,
  lifetime: BlockhashLifetime,
): Promise<SignedSettlement> {
  const transfers = expected.transfers.map((transfer) => getTransferCheckedInstruction({
    source: address(transfer.sourceAta), mint: address(transfer.mint), destination: address(transfer.destinationAta),
    authority: signers.buyers[transfer.buyerId], amount: BigInt(transfer.amountAtomic), decimals: transfer.decimals,
  }, {programAddress: TOKEN_PROGRAM_ADDRESS}));
  const memo: Instruction = {programAddress: address(MEMO_PROGRAM_ADDRESS), data: getUtf8Encoder().encode(expected.memo)};
  const message = pipe(
    createTransactionMessage({version: 0}),
    (current) => setTransactionMessageFeePayerSigner(signers.sponsor, current),
    (current) => setTransactionMessageLifetimeUsingBlockhash(lifetime, current),
    (current) => appendTransactionMessageInstructions([...transfers, memo], current),
  );
  const compiled = compileTransactionMessage(message);
  const messageBytes = Uint8Array.from(getCompiledTransactionMessageEncoder().encode(compiled));
  assertTransactionIntent(new SolanaKitTransactionMessageDecoder().decodeTransactionMessage(messageBytes), expected);
  const transaction = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithinSizeLimit(transaction);
  const rawTransactionBase64 = getBase64EncodedWireTransaction(transaction);
  return {
    messageBase64: Buffer.from(messageBytes).toString('base64'), rawTransactionBase64,
    transactionSignature: String(getSignatureFromTransaction(transaction)),
    messageHash: createHash('sha256').update(messageBytes).digest('hex'), memo: expected.memo,
    blockhash: String(lifetime.blockhash), lastValidBlockHeight: lifetime.lastValidBlockHeight.toString(),
    wireSize: Buffer.from(rawTransactionBase64, 'base64').byteLength, transaction,
  };
}

class LocalValidator {
  readonly child: ChildProcessByStdio<null, Readable, Readable>;
  readonly version: string;
  #stdout = '';
  #stderr = '';
  #spawnError: Error | null = null;

  constructor(binary: string, ledgerPath: string) {
    const versionResult = spawnSync(binary, ['--version'], {encoding: 'utf8'});
    if (versionResult.error) throw versionResult.error;
    if (versionResult.status !== 0) throw new Error(versionResult.stderr.trim() || `${binary} --version failed`);
    this.version = versionResult.stdout.trim();
    this.child = spawn(binary, [
      '--ledger', ledgerPath, '--reset', '--quiet', '--bind-address', '127.0.0.1',
      '--rpc-port', String(RPC_PORT), '--faucet-port', String(FAUCET_PORT),
    ], {stdio: ['ignore', 'pipe', 'pipe']});
    this.child.stdout.on('data', (chunk: Buffer) => { this.#stdout = appendBounded(this.#stdout, chunk); });
    this.child.stderr.on('data', (chunk: Buffer) => { this.#stderr = appendBounded(this.#stderr, chunk); });
    this.child.once('error', (error) => { this.#spawnError = error; });
  }

  async waitUntilReady(rpc: LocalRpc): Promise<void> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (this.#spawnError !== null) throw this.#spawnError;
      if (this.child.exitCode !== null) throw new Error(`validator exited (${String(this.child.exitCode)}): ${this.logs()}`);
      try {
        if (String(await rpc.getHealth().send()) === 'ok') return;
      } catch {
        // Expected while the local socket starts.
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`validator startup timed out: ${this.logs()}`);
  }

  logs(): string {
    return [this.#stdout.trim(), this.#stderr.trim()].filter(Boolean).join('\n');
  }

  async stop(): Promise<void> {
    if (this.child.exitCode !== null) return;
    const exited = new Promise<void>((resolvePromise) => this.child.once('exit', () => resolvePromise()));
    this.child.kill('SIGTERM');
    await Promise.race([exited, sleep(5_000)]);
    if (this.child.exitCode === null) {
      this.child.kill('SIGKILL');
      await Promise.race([exited, sleep(2_000)]);
    }
  }
}

async function verifyFinalizedWithRetry(
  client: SolanaRpcSettlementClient,
  plan: SolanaSettlementPlan,
  signed: SignedSettlement,
): Promise<FinalizedSettlementEvidence> {
  const deadline = Date.now() + FINALITY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      return await client.verifyFinalizedSettlement(plan, signed);
    } catch (error) {
      if (!(error instanceof FinalizedSettlementVerificationError) || error.code !== 'NOT_FOUND') throw error;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Finalized transaction was not available for independent verification');
}

async function assertOutputAvailable(outputPath: string): Promise<void> {
  await access(dirname(outputPath), fsConstants.W_OK);
  try {
    await access(outputPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Refusing to overwrite existing receipt: ${outputPath}`);
}

async function executeSmoke(binary: string, ledgerPath: string): Promise<SmokeReceipt> {
  const rpc = createSolanaRpc(RPC_URL);
  const validator = new LocalValidator(binary, ledgerPath);
  try {
    await validator.waitUntilReady(rpc);
    const genesisHash = String(await rpc.getGenesisHash().send());
    if (genesisHash === DEVNET_GENESIS_HASH) throw new Error('Local validator unexpectedly reports Devnet genesis');
    const [sponsor, mintSigner, merchant, buyerA, buyerB, buyerC] = await Promise.all([
      generateKeyPairSigner(), generateKeyPairSigner(), generateKeyPairSigner(),
      generateKeyPairSigner(), generateKeyPairSigner(), generateKeyPairSigner(),
    ]);
    if (String(mintSigner.address) === DEVNET_USDC_MINT) throw new Error('Local mint unexpectedly equals Devnet USDC');

    const airdropSignature = String(await rpc.requestAirdrop(
      sponsor.address, lamports(10_000_000_000n), {commitment: 'finalized'},
    ).send());
    await waitForFinalized(rpc, airdropSignature);
    const mintRent = await rpc.getMinimumBalanceForRentExemption(BigInt(getMintSize()), {commitment: 'finalized'}).send();
    if (mintRent > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Mint rent exceeds a safe integer');
    const setupSignatures: string[] = [];
    setupSignatures.push(await sendInstructions(rpc, sponsor, flattenSequentialPlan(getCreateMintInstructionPlan({
      payer: sponsor, newMint: mintSigner, decimals: TOKEN_DECIMALS, mintAuthority: sponsor.address,
      freezeAuthority: null, mintAccountLamports: Number(mintRent),
    }))));

    const buyerSigners = {A: buyerA, B: buyerB, C: buyerC} as const;
    const buyerAccounts = {} as Record<BuyerId, LocalBuyerAccount>;
    for (const buyerId of ['A', 'B', 'C'] as const) {
      const signer = buyerSigners[buyerId];
      const [ata] = await findAssociatedTokenPda({owner: signer.address, mint: mintSigner.address, tokenProgram: TOKEN_PROGRAM_ADDRESS});
      buyerAccounts[buyerId] = {signer, ata: String(ata)};
      setupSignatures.push(await sendInstructions(rpc, sponsor, flattenSequentialPlan(getMintToATAInstructionPlan({
        payer: sponsor, ata, owner: signer.address, mint: mintSigner.address,
        mintAuthority: sponsor, amount: INITIAL_BUYER_BALANCE, decimals: TOKEN_DECIMALS,
      }))));
    }
    const [merchantAtaAddress] = await findAssociatedTokenPda({
      owner: merchant.address, mint: mintSigner.address, tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    setupSignatures.push(await sendInstructions(rpc, sponsor, [getCreateAssociatedTokenIdempotentInstruction({
      payer: sponsor, ata: merchantAtaAddress, owner: merchant.address,
      mint: mintSigner.address, tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })]));

    const mintAccount = await fetchMint(rpc, mintSigner.address, {commitment: 'finalized'});
    if (mintAccount.programAddress !== TOKEN_PROGRAM_ADDRESS || !mintAccount.data.isInitialized || mintAccount.data.decimals !== TOKEN_DECIMALS) {
      throw new Error('Local mint failed program/state/decimals validation');
    }
    const initialBuyerBalances = {} as Record<BuyerId, string>;
    for (const buyerId of ['A', 'B', 'C'] as const) {
      const token = await fetchToken(rpc, address(buyerAccounts[buyerId].ata), {commitment: 'finalized'});
      if (
        token.programAddress !== TOKEN_PROGRAM_ADDRESS || token.data.state !== AccountState.Initialized ||
        token.data.owner !== buyerAccounts[buyerId].signer.address || token.data.mint !== mintSigner.address ||
        token.data.amount !== INITIAL_BUYER_BALANCE
      ) throw new Error(`Buyer ${buyerId} token account failed validation`);
      initialBuyerBalances[buyerId] = token.data.amount.toString();
    }
    const merchantToken = await fetchToken(rpc, merchantAtaAddress, {commitment: 'finalized'});
    if (
      merchantToken.programAddress !== TOKEN_PROGRAM_ADDRESS || merchantToken.data.state !== AccountState.Initialized ||
      merchantToken.data.owner !== merchant.address || merchantToken.data.mint !== mintSigner.address || merchantToken.data.amount !== 0n
    ) throw new Error('Merchant token account failed validation');

    const scenarios = createLocalPolicyScenarios({
      clusterGenesisHash: genesisHash, mint: String(mintSigner.address),
      merchantOwner: String(merchant.address), merchantAta: String(merchantAtaAddress),
      buyers: {
        A: {signerAddress: String(buyerA.address), sourceAta: buyerAccounts.A.ata},
        B: {signerAddress: String(buyerB.address), sourceAta: buyerAccounts.B.ata},
        C: {signerAddress: String(buyerC.address), sourceAta: buyerAccounts.C.ata},
      },
      evaluatedAt: new Date().toISOString(),
    });
    if (!scenarios.happy.proof.approved) {
      throw new Error(`Happy policy failed: ${JSON.stringify(scenarios.happy.proof.checks.filter((check) => !check.passed))}`);
    }
    const rejection = noTransactionRejection(scenarios.rejected);
    const expected = deriveExpectedSettlementIntent({
      feePayerAddress: String(sponsor.address), quote: scenarios.happy.quote, policyProof: scenarios.happy.proof,
    });
    if (expected.transfers.map((transfer) => String(transfer.amountAtomic)).join(',') !== HAPPY_ALLOCATIONS.join(',')) {
      throw new Error('Policy did not derive the canonical split');
    }

    const signers: SettlementSignerSet = {sponsor, buyers: buyerSigners};
    const plan: SolanaSettlementPlan = {
      quoteHash: expected.quoteHash, policyProofHash: expected.policyProofHash,
      mint: String(mintSigner.address), decimals: TOKEN_DECIMALS,
      merchantOwner: String(merchant.address), merchantAta: String(merchantAtaAddress), sponsorAddress: String(sponsor.address),
      transfers: expected.transfers.map((transfer) => ({
        buyerId: transfer.buyerId, authority: transfer.authorityAddress,
        sourceAta: transfer.sourceAta, amountAtomic: String(transfer.amountAtomic),
      })),
    };
    const settlementClient = new SolanaRpcSettlementClient(RPC_URL);
    await settlementClient.validateSettlementAccounts(plan);
    const signed = await buildAndSignLocalSettlement(expected, signers, await settlementClient.latestBlockhash());
    if (await settlementClient.sendIdentical(signed) !== signed.transactionSignature) throw new Error('Unexpected settlement signature');
    await waitForFinalized(rpc, signed.transactionSignature);
    const evidence = await verifyFinalizedWithRetry(settlementClient, plan, signed);
    if (
      evidence.sourceDebits.map((debit) => debit.debitAtomic).join(',') !== HAPPY_ALLOCATIONS.join(',') ||
      evidence.destinationPreAmountAtomic !== '0' || evidence.destinationPostAmountAtomic !== TOTAL_AMOUNT ||
      evidence.destinationCreditAtomic !== TOTAL_AMOUNT
    ) throw new Error('Finalized balance deltas differ from the approved settlement');

    return {
      schema: 'mandate-pool/localnet-smoke-receipt@1', status: 'PASS', generatedAt: new Date().toISOString(),
      validator: {binary, version: validator.version, rpcUrl: RPC_URL, genesisHash},
      safety: {
        localLoopbackOnly: true, disposableKeysAndMint: true, devnetGenesisRejected: true,
        devnetMintRejected: true, secretSources: 'none', productionGuardModified: false, temporaryLedgerRemoved: false,
      },
      setup: {
        airdropSignature, transactionSignatures: setupSignatures, mint: String(mintSigner.address), sponsor: String(sponsor.address),
        buyers: {
          A: {owner: String(buyerA.address), ata: buyerAccounts.A.ata, initialAmountAtomic: initialBuyerBalances.A},
          B: {owner: String(buyerB.address), ata: buyerAccounts.B.ata, initialAmountAtomic: initialBuyerBalances.B},
          C: {owner: String(buyerC.address), ata: buyerAccounts.C.ata, initialAmountAtomic: initialBuyerBalances.C},
        },
        merchant: {owner: String(merchant.address), ata: String(merchantAtaAddress), initialAmountAtomic: '0'},
      },
      rejection,
      settlement: {
        transactionCount: 1, version: 0, instructionCount: 4, transferCheckedCount: 3,
        transferAmountsAtomic: HAPPY_ALLOCATIONS, memo: signed.memo, signature: evidence.transactionSignature,
        finalizedSlot: evidence.slot, messageHash: evidence.messageHash, rawTransactionHash: evidence.rawTransactionHash,
        rawTransactionMatchesPreparedBytes: true, sourceDebits: evidence.sourceDebits,
        destinationAta: evidence.destinationAta, destinationPreAmountAtomic: evidence.destinationPreAmountAtomic,
        destinationPostAmountAtomic: evidence.destinationPostAmountAtomic, destinationCreditAtomic: evidence.destinationCreditAtomic,
      },
    };
  } finally {
    await validator.stop();
  }
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const {outputPath} = parseLocalnetSmokeArgs(argv);
  await assertOutputAvailable(outputPath);
  const ledgerPath = await mkdtemp(join(tmpdir(), 'mandate-pool-localnet-'));
  const binary = process.env['SOLANA_TEST_VALIDATOR_BIN']?.trim() || 'solana-test-validator';
  if (/[\r\n]/u.test(binary)) throw new Error('SOLANA_TEST_VALIDATOR_BIN contains a newline');
  let receipt: SmokeReceipt;
  try {
    receipt = await executeSmoke(binary, ledgerPath);
  } finally {
    await rm(ledgerPath, {recursive: true, force: true});
  }
  receipt.safety.temporaryLedgerRemoved = true;
  await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, {encoding: 'utf8', flag: 'wx', mode: 0o600});
  console.log(JSON.stringify({
    status: receipt.status, receipt: outputPath, validator: receipt.validator.version,
    rejection: receipt.rejection.decision, settlementSignature: receipt.settlement.signature,
  }));
}

const invokedPath = process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
