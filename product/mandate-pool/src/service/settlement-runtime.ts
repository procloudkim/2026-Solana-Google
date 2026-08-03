import {createHash} from 'node:crypto';

import {
  BUYER_IDS,
  canonicalJson,
  policyProofHash,
  quoteHash,
  settlementMemo,
  splitAtomicAmount,
  type PolicyProofV1,
  type QuoteV1,
} from '../domain/index.js';
import {
  buildAndSignSettlement,
  FinalizedSettlementVerificationError,
  SolanaRpcSettlementClient,
  type FinalizedSettlementEvidence,
  type SettlementSignerSet,
  type SolanaSettlementPlan,
} from '../runtime/solana-kit.js';

export interface PreparedSettlement {
  readonly mode: 'fixture' | 'live';
  readonly messageBase64: string;
  readonly messageHash: string;
  readonly rawTransactionBase64: string;
  readonly rawTransactionHash: string;
  readonly transactionSignature: string;
  readonly blockhash: string;
  readonly lastValidBlockHeight: string;
  readonly memo: string;
  readonly wireSize: number;
  readonly simulationUnits: string | null;
  readonly plan: SolanaSettlementPlan;
}

export type SettlementFinalization =
  | {
      readonly status: 'success';
      readonly cluster: 'fixture';
      readonly commitment: 'fixture';
      readonly transactionSignature: null;
      readonly metaError: null;
    }
  | {
      readonly status: 'success';
      readonly cluster: 'devnet';
      readonly commitment: 'finalized';
      readonly transactionSignature: string;
      readonly metaError: null;
      /** Output returned by the finalized wire and token-balance verifier. */
      readonly finalizedEvidence: FinalizedSettlementEvidence;
    }
  | {
      readonly status: 'failed';
      readonly cluster: 'devnet';
      readonly commitment: 'finalized';
      readonly transactionSignature: string;
      readonly metaError: string;
    }
  | {
      readonly status: 'pending' | 'unknown';
      readonly cluster: 'devnet';
      readonly commitment: null;
      readonly transactionSignature: string;
      readonly metaError: null;
    };

export interface SettlementRuntime {
  readonly mode: 'fixture' | 'live';
  readonly sponsorAddress: string;
  prepare(quote: QuoteV1, proof: PolicyProofV1): Promise<PreparedSettlement>;
  finalize(prepared: PreparedSettlement): Promise<SettlementFinalization>;
  /** Re-checks an already submitted signature without broadcasting again. */
  reconcile(prepared: PreparedSettlement): Promise<SettlementFinalization>;
  readiness(): Promise<boolean>;
}

export type LiveSolanaClient = Pick<
  SolanaRpcSettlementClient,
  | 'latestBlockhash'
  | 'validateSettlementAccounts'
  | 'sendIdentical'
  | 'signatureStatus'
  | 'verifyFinalizedSettlement'
  | 'currentBlockHeight'
>;

export class SettlementPreparationError extends Error {
  constructor(
    readonly code: 'INVALID_PREPARATION',
    message: string,
  ) {
    super(message);
    this.name = 'SettlementPreparationError';
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function settlementPlanFromQuote(
  sponsorAddress: string,
  quote: QuoteV1,
  proof: PolicyProofV1,
): SolanaSettlementPlan {
  const qHash = quoteHash(quote);
  const pHash = policyProofHash(proof);
  if (
    proof.schema !== 'mandate-pool/policy-proof@1' ||
    proof.engineVersion !== 'mandate-pool-policy/2' ||
    !proof.approved ||
    proof.checks.length === 0 ||
    !proof.checks.every((check) => check.passed) ||
    proof.quoteHash !== qHash
  ) {
    throw new SettlementPreparationError(
      'INVALID_PREPARATION',
      'A passing policy proof bound to the quote is required',
    );
  }
  const allocations = BUYER_IDS.map((buyerId) => {
    const matches = quote.allocations.filter(
      (allocation) => allocation.buyerId === buyerId,
    );
    if (matches.length !== 1) {
      throw new SettlementPreparationError(
        'INVALID_PREPARATION',
        `Quote must contain exactly one allocation for buyer ${buyerId}`,
      );
    }
    return matches[0] as (typeof matches)[number];
  });
  if (quote.allocations.length !== BUYER_IDS.length) {
    throw new SettlementPreparationError(
      'INVALID_PREPARATION',
      'Quote must contain only buyers A, B, and C',
    );
  }
  const expectedAmounts = splitAtomicAmount(
    quote.totalAmountAtomic,
    BUYER_IDS.length,
  );
  if (
    allocations.some(
      (allocation, index) => allocation.amountAtomic !== expectedAmounts[index],
    )
  ) {
    throw new SettlementPreparationError(
      'INVALID_PREPARATION',
      'Quote allocations do not follow the canonical buyer split',
    );
  }
  return {
    quoteHash: qHash,
    policyProofHash: pHash,
    mint: quote.sku.mint,
    decimals: quote.sku.decimals,
    merchantAta: quote.sku.merchantUsdcAta,
    merchantOwner: quote.sku.merchantOwner,
    sponsorAddress,
    transfers: allocations.map((allocation) => ({
      buyerId: allocation.buyerId,
      authority: allocation.signerAddress,
      sourceAta: allocation.sourceAta,
      amountAtomic: allocation.amountAtomic,
    })),
  };
}

export class FixtureSettlementRuntime implements SettlementRuntime {
  readonly mode = 'fixture' as const;

  constructor(readonly sponsorAddress: string) {}

  async prepare(
    quote: QuoteV1,
    proof: PolicyProofV1,
  ): Promise<PreparedSettlement> {
    const plan = settlementPlanFromQuote(this.sponsorAddress, quote, proof);
    const messageBytes = Buffer.from(
      canonicalJson({fixtureOnly: true, version: 0, plan}),
      'utf8',
    );
    const messageHash = sha256(messageBytes);
    const rawBytes = Buffer.from(
      canonicalJson({fixtureOnly: true, messageHash, signatures: 4}),
      'utf8',
    );
    const rawTransactionHash = sha256(rawBytes);
    return {
      mode: 'fixture',
      messageBase64: messageBytes.toString('base64'),
      messageHash,
      rawTransactionBase64: rawBytes.toString('base64'),
      rawTransactionHash,
      transactionSignature: `fixture:${rawTransactionHash}`,
      blockhash: 'fixture-not-a-solana-blockhash',
      lastValidBlockHeight: '1',
      memo: settlementMemo(plan.quoteHash, plan.policyProofHash),
      wireSize: rawBytes.byteLength,
      simulationUnits: null,
      plan,
    };
  }

  async finalize(_prepared: PreparedSettlement): Promise<SettlementFinalization> {
    return {
      status: 'success',
      cluster: 'fixture',
      commitment: 'fixture',
      transactionSignature: null,
      metaError: null,
    };
  }

  async reconcile(prepared: PreparedSettlement): Promise<SettlementFinalization> {
    return this.finalize(prepared);
  }

  async readiness(): Promise<boolean> {
    return true;
  }
}

export class LiveSolanaSettlementRuntime implements SettlementRuntime {
  readonly mode = 'live' as const;
  readonly #client: LiveSolanaClient;

  constructor(
    rpcUrl: string,
    readonly signers: SettlementSignerSet,
    readonly finalityWaitMs = 45_000,
    client?: LiveSolanaClient,
  ) {
    this.#client = client ?? new SolanaRpcSettlementClient(rpcUrl);
  }

  get sponsorAddress(): string {
    return this.signers.sponsor.address;
  }

  async prepare(
    quote: QuoteV1,
    proof: PolicyProofV1,
  ): Promise<PreparedSettlement> {
    const plan = settlementPlanFromQuote(this.sponsorAddress, quote, proof);
    await this.#client.validateSettlementAccounts(plan);
    const signed = await buildAndSignSettlement(
      plan,
      this.signers,
      await this.#client.latestBlockhash(),
    );
    return {
      mode: 'live',
      messageBase64: signed.messageBase64,
      messageHash: signed.messageHash,
      rawTransactionBase64: signed.rawTransactionBase64,
      rawTransactionHash: sha256(
        Buffer.from(signed.rawTransactionBase64, 'base64'),
      ),
      transactionSignature: signed.transactionSignature,
      blockhash: signed.blockhash,
      lastValidBlockHeight: signed.lastValidBlockHeight,
      memo: signed.memo,
      wireSize: signed.wireSize,
      // Signed bytes must not leave the process before the caller durably
      // persists FULLY_SIGNED and advances to SUBMISSION_STARTED.
      simulationUnits: null,
      plan,
    };
  }

  async finalize(prepared: PreparedSettlement): Promise<SettlementFinalization> {
    return this.#observe(prepared, true);
  }

  async reconcile(prepared: PreparedSettlement): Promise<SettlementFinalization> {
    return this.#observe(prepared, false);
  }

  async #observe(
    prepared: PreparedSettlement,
    submitIdenticalBytes: boolean,
  ): Promise<SettlementFinalization> {
    if (prepared.mode !== 'live') {
      throw new Error('Live settlement runtime received fixture bytes');
    }
    if (submitIdenticalBytes) {
      try {
        await this.#client.sendIdentical(prepared);
      } catch {
        // A transport error is UNKNOWN, never proof that the payment failed.
      }
    }

    const deadline = Date.now() + this.finalityWaitMs;
    do {
      let status: Awaited<ReturnType<LiveSolanaClient['signatureStatus']>>;
      try {
        status = await this.#client.signatureStatus(
          prepared.transactionSignature,
        );
      } catch {
        if (Date.now() < deadline) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
          continue;
        }
        return {
          status: 'pending',
          cluster: 'devnet',
          commitment: null,
          transactionSignature: prepared.transactionSignature,
          metaError: null,
        };
      }
      if (status.found && status.confirmationStatus === 'finalized') {
        if (status.error !== null) {
          return {
            status: 'failed',
            cluster: 'devnet',
            commitment: 'finalized',
            transactionSignature: prepared.transactionSignature,
            metaError: JSON.stringify(status.error),
          };
        }
        let finalizedEvidence: FinalizedSettlementEvidence;
        try {
          finalizedEvidence = await this.#client.verifyFinalizedSettlement(
            prepared.plan,
            prepared,
          );
        } catch (error) {
          const retryable =
            !(error instanceof FinalizedSettlementVerificationError) ||
            error.code === 'NOT_FOUND' ||
            error.code === 'META_MISSING';
          if (retryable) {
            if (Date.now() < deadline) {
              await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
              continue;
            }
            return {
              status: 'pending',
              cluster: 'devnet',
              commitment: null,
              transactionSignature: prepared.transactionSignature,
              metaError: null,
            };
          }
          // The chain may already have paid. A deterministic mismatch is never
          // converted to failure or fulfillment; a no-resubmit reconciliation
          // can verify the same signature again against another RPC response.
          return {
            status: 'unknown',
            cluster: 'devnet',
            commitment: null,
            transactionSignature: prepared.transactionSignature,
            metaError: null,
          };
        }
        return {
          status: 'success',
          cluster: 'devnet',
          commitment: 'finalized',
          transactionSignature: finalizedEvidence.transactionSignature,
          metaError: null,
          finalizedEvidence,
        };
      }
      let height: bigint;
      try {
        height = await this.#client.currentBlockHeight();
      } catch {
        if (Date.now() < deadline) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
          continue;
        }
        return {
          status: 'pending',
          cluster: 'devnet',
          commitment: null,
          transactionSignature: prepared.transactionSignature,
          metaError: null,
        };
      }
      if (height > BigInt(prepared.lastValidBlockHeight)) {
        return {
          status: 'unknown',
          cluster: 'devnet',
          commitment: null,
          transactionSignature: prepared.transactionSignature,
          metaError: null,
        };
      }
      if (Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
      }
    } while (Date.now() < deadline);

    return {
      status: 'pending',
      cluster: 'devnet',
      commitment: null,
      transactionSignature: prepared.transactionSignature,
      metaError: null,
    };
  }

  async readiness(): Promise<boolean> {
    try {
      await this.#client.currentBlockHeight();
      return true;
    } catch {
      return false;
    }
  }
}
