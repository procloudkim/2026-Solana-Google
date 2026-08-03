import {createHash} from 'node:crypto';

import {
  address,
  generateKeyPairSigner,
  getTransactionDecoder,
  signature as parseSignature,
  type Blockhash,
} from '@solana/kit';
import {findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS} from '@solana-program/token';
import {describe, expect, it, vi} from 'vitest';

import {
  buildAndSignSettlement,
  DEVNET_GENESIS_HASH,
  DEVNET_USDC_DECIMALS,
  DEVNET_USDC_MINT,
  FinalizedSettlementVerificationError,
  settlementMemo,
  validateSettlementPlan,
  verifyFinalizedSettlementRecord,
  type FinalizedTransactionRecord,
  type ObservedTokenBalance,
  type SettlementSignerSet,
  type SignedSettlement,
  type SolanaSettlementPlan,
} from '../src/runtime/solana-kit.js';
import {
  LiveSolanaSettlementRuntime,
  type LiveSolanaClient,
  type PreparedSettlement,
} from '../src/service/settlement-runtime.js';
import {SolanaKitTransactionMessageDecoder} from '../src/solana/index.js';

const digest = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

async function fixture(): Promise<{
  signers: SettlementSignerSet;
  plan: SolanaSettlementPlan;
  merchantOwner: string;
}> {
  const sponsor = await generateKeyPairSigner();
  const buyerA = await generateKeyPairSigner();
  const buyerB = await generateKeyPairSigner();
  const buyerC = await generateKeyPairSigner();
  const merchant = await generateKeyPairSigner();
  const mint = address(DEVNET_USDC_MINT);
  const tokenProgram = address(TOKEN_PROGRAM_ADDRESS);
  const [merchantAta] = await findAssociatedTokenPda({
    mint,
    owner: merchant.address,
    tokenProgram,
  });
  const buyers = {A: buyerA, B: buyerB, C: buyerC} as const;
  const transfers = await Promise.all(
    (['A', 'B', 'C'] as const).map(async (buyerId) => {
      const [sourceAta] = await findAssociatedTokenPda({
        mint,
        owner: buyers[buyerId].address,
        tokenProgram,
      });
      return {
        buyerId,
        authority: buyers[buyerId].address,
        sourceAta,
        amountAtomic: '3000000',
      };
    }),
  );
  return {
    signers: {sponsor, buyers},
    merchantOwner: merchant.address,
    plan: {
      quoteHash: digest('quote'),
      policyProofHash: digest('proof'),
      mint: DEVNET_USDC_MINT,
      decimals: DEVNET_USDC_DECIMALS,
      merchantOwner: merchant.address,
      merchantAta,
      sponsorAddress: sponsor.address,
      transfers,
    },
  };
}

function finalizedRecord(
  plan: SolanaSettlementPlan,
  signed: SignedSettlement,
  merchantOwner: string,
): FinalizedTransactionRecord {
  const wire = getTransactionDecoder().decode(
    Buffer.from(signed.rawTransactionBase64, 'base64'),
  );
  const decoded = new SolanaKitTransactionMessageDecoder().decodeTransactionMessage(
    Uint8Array.from(wire.messageBytes),
  );
  const accountIndexes = new Map(
    decoded.staticAccounts.map((account, index) => [account.address, index]),
  );
  const balance = (
    accountAddress: string,
    owner: string,
    amountAtomic: string,
  ): ObservedTokenBalance => {
    const accountIndex = accountIndexes.get(accountAddress);
    if (accountIndex === undefined) throw new Error(`Missing account ${accountAddress}`);
    return {
      accountIndex,
      mint: plan.mint,
      owner,
      programId: TOKEN_PROGRAM_ADDRESS,
      amountAtomic,
      decimals: plan.decimals,
    };
  };
  const initialAmounts = ['10000000', '9000000', '8000000'] as const;
  return {
    slot: '12345',
    version: 0,
    rawTransactionBase64: signed.rawTransactionBase64,
    metaError: null,
    preTokenBalances: [
      ...plan.transfers.map((transfer, index) =>
        balance(
          transfer.sourceAta,
          transfer.authority,
          initialAmounts[index] ?? '0',
        ),
      ),
      balance(plan.merchantAta, merchantOwner, '1000000'),
    ],
    postTokenBalances: [
      ...plan.transfers.map((transfer, index) =>
        balance(
          transfer.sourceAta,
          transfer.authority,
          (BigInt(initialAmounts[index] ?? '0') - BigInt(transfer.amountAtomic)).toString(),
        ),
      ),
      balance(plan.merchantAta, merchantOwner, '10000000'),
    ],
  };
}

function verificationCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(FinalizedSettlementVerificationError);
    return (error as FinalizedSettlementVerificationError).code;
  }
  throw new Error('Expected finalized settlement verification to fail');
}

describe('Solana Kit settlement runtime', () => {
  it('pins the complete Solana Devnet genesis hash', () => {
    expect(DEVNET_GENESIS_HASH).toBe('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
    expect(DEVNET_GENESIS_HASH).toHaveLength(44);
  });

  it('builds one fully signed, bounded v0 transaction', async () => {
    const {plan, signers} = await fixture();
    const result = await buildAndSignSettlement(plan, signers, {
      blockhash: '11111111111111111111111111111111' as Blockhash,
      lastValidBlockHeight: 10_000n,
    });

    expect(() => parseSignature(result.transactionSignature)).not.toThrow();
    expect(result.wireSize).toBeLessThanOrEqual(1232);
    expect(result.memo).toBe(settlementMemo(plan));
    expect(result.messageHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects a destination/signer/amount deviation before signing', async () => {
    const {plan, signers} = await fixture();
    const other = await generateKeyPairSigner();
    expect(() =>
      validateSettlementPlan({...plan, merchantAta: other.address}, signers),
    ).not.toThrow();
    expect(() =>
      validateSettlementPlan(
        {
          ...plan,
          transfers: plan.transfers.map((transfer) =>
            transfer.buyerId === 'B'
              ? {...transfer, authority: other.address}
              : transfer,
          ),
        },
        signers,
      ),
    ).toThrow(/Buyer B authority/);
    expect(() =>
      validateSettlementPlan(
        {
          ...plan,
          transfers: plan.transfers.map((transfer) =>
            transfer.buyerId === 'A'
              ? {...transfer, amountAtomic: '0'}
              : transfer,
          ),
        },
        signers,
      ),
    ).toThrow(/positive atomic amount/);
  });

  it('independently verifies exact finalized bytes, intent, and four token deltas', async () => {
    const {plan, signers, merchantOwner} = await fixture();
    const signed = await buildAndSignSettlement(plan, signers, {
      blockhash: '11111111111111111111111111111111' as Blockhash,
      lastValidBlockHeight: 10_000n,
    });
    const evidence = verifyFinalizedSettlementRecord(
      plan,
      signed,
      finalizedRecord(plan, signed, merchantOwner),
    );

    expect(evidence.transactionSignature).toBe(signed.transactionSignature);
    expect(evidence.messageHash).toBe(signed.messageHash);
    expect(evidence.sourceDebits.map((debit) => debit.debitAtomic)).toEqual([
      '3000000',
      '3000000',
      '3000000',
    ]);
    expect(evidence.destinationCreditAtomic).toBe('9000000');
  });

  it('rejects finalized wire, signature, message, and intent substitutions', async () => {
    const {plan, signers, merchantOwner} = await fixture();
    const signed = await buildAndSignSettlement(plan, signers, {
      blockhash: '11111111111111111111111111111111' as Blockhash,
      lastValidBlockHeight: 10_000n,
    });
    const otherSigned = await buildAndSignSettlement(plan, signers, {
      blockhash: signers.sponsor.address as unknown as Blockhash,
      lastValidBlockHeight: 10_001n,
    });
    const record = finalizedRecord(plan, signed, merchantOwner);

    expect(verificationCode(() => verifyFinalizedSettlementRecord(
      plan,
      {...signed, rawTransactionBase64: otherSigned.rawTransactionBase64},
      record,
    ))).toBe('RAW_TRANSACTION_MISMATCH');
    expect(verificationCode(() => verifyFinalizedSettlementRecord(
      plan,
      {...signed, transactionSignature: otherSigned.transactionSignature},
      record,
    ))).toBe('SIGNATURE_MISMATCH');
    expect(verificationCode(() => verifyFinalizedSettlementRecord(
      plan,
      {...signed, messageBase64: otherSigned.messageBase64},
      record,
    ))).toBe('MESSAGE_BYTES_MISMATCH');
    expect(verificationCode(() => verifyFinalizedSettlementRecord(
      plan,
      {...signed, messageHash: '0'.repeat(64)},
      record,
    ))).toBe('MESSAGE_HASH_MISMATCH');
    expect(verificationCode(() => verifyFinalizedSettlementRecord(
      {...plan, merchantAta: signers.sponsor.address},
      signed,
      record,
    ))).toBe('INTENT_MISMATCH');

    const trailingBytes = Buffer.concat([
      Buffer.from(signed.rawTransactionBase64, 'base64'),
      Buffer.from([1]),
    ]).toString('base64');
    expect(verificationCode(() => verifyFinalizedSettlementRecord(
      plan,
      {...signed, rawTransactionBase64: trailingBytes},
      {...record, rawTransactionBase64: trailingBytes},
    ))).toBe('MESSAGE_BYTES_MISMATCH');
  });

  it('rejects any finalized USDC balance evidence mutation', async () => {
    const {plan, signers, merchantOwner} = await fixture();
    const signed = await buildAndSignSettlement(plan, signers, {
      blockhash: '11111111111111111111111111111111' as Blockhash,
      lastValidBlockHeight: 10_000n,
    });
    const baseline = finalizedRecord(plan, signed, merchantOwner);
    type MutableRecord = {
      -readonly [Key in keyof FinalizedTransactionRecord]:
        FinalizedTransactionRecord[Key] extends readonly (infer Item)[] ? Item[] : FinalizedTransactionRecord[Key];
    };
    const mutate = (change: (record: MutableRecord) => void): FinalizedTransactionRecord => {
      const record = structuredClone(baseline) as MutableRecord;
      change(record);
      return record;
    };

    const cases: readonly [
      string,
      string,
      (record: MutableRecord) => void,
    ][] = [
      ['meta error', 'META_ERROR', (record) => { record.metaError = {InstructionError: [0, 'Custom']}; }],
      ['legacy version', 'VERSION_MISMATCH', (record) => { record.version = 'legacy'; }],
      ['missing pre balance', 'TOKEN_BALANCE_SET', (record) => { record.preTokenBalances.pop(); }],
      ['wrong mint', 'TOKEN_BALANCE_METADATA', (record) => {
        const value = record.postTokenBalances[0];
        if (value === undefined) throw new Error('Missing post balance');
        record.postTokenBalances[0] = {...value, mint: signers.sponsor.address};
      }],
      ['wrong decimals', 'TOKEN_BALANCE_METADATA', (record) => {
        const value = record.postTokenBalances[0];
        if (value === undefined) throw new Error('Missing post balance');
        record.postTokenBalances[0] = {...value, decimals: 9};
      }],
      ['missing token program', 'TOKEN_BALANCE_METADATA', (record) => {
        const value = record.postTokenBalances[0];
        if (value === undefined) throw new Error('Missing post balance');
        record.postTokenBalances[0] = {...value, programId: null};
      }],
      ['wrong source owner', 'TOKEN_BALANCE_METADATA', (record) => {
        const value = record.postTokenBalances[0];
        if (value === undefined) throw new Error('Missing post balance');
        record.postTokenBalances[0] = {...value, owner: signers.sponsor.address};
      }],
      ['wrong source debit', 'TOKEN_BALANCE_DELTA', (record) => {
        const value = record.postTokenBalances[0];
        if (value === undefined) throw new Error('Missing post balance');
        record.postTokenBalances[0] = {...value, amountAtomic: '7000001'};
      }],
      ['wrong destination credit', 'TOKEN_BALANCE_DELTA', (record) => {
        const index = record.postTokenBalances.length - 1;
        const value = record.postTokenBalances[index];
        if (value === undefined) throw new Error('Missing destination balance');
        record.postTokenBalances[index] = {...value, amountAtomic: '9999999'};
      }],
      ['wrong destination owner', 'TOKEN_BALANCE_METADATA', (record) => {
        const index = record.postTokenBalances.length - 1;
        const before = record.preTokenBalances[index];
        const after = record.postTokenBalances[index];
        if (before === undefined || after === undefined) {
          throw new Error('Missing destination balance');
        }
        record.preTokenBalances[index] = {...before, owner: signers.sponsor.address};
        record.postTokenBalances[index] = {...after, owner: signers.sponsor.address};
      }],
    ];

    for (const [name, code, change] of cases) {
      expect(
        verificationCode(() => verifyFinalizedSettlementRecord(plan, signed, mutate(change))),
        name,
      ).toBe(code);
    }
  });

  it('keeps a finalized payment in reconciliation when independent verification fails', async () => {
    const {plan, signers} = await fixture();
    const signed = await buildAndSignSettlement(plan, signers, {
      blockhash: '11111111111111111111111111111111' as Blockhash,
      lastValidBlockHeight: 10_000n,
    });
    const prepared: PreparedSettlement = {
      mode: 'live',
      messageBase64: signed.messageBase64,
      messageHash: signed.messageHash,
      rawTransactionBase64: signed.rawTransactionBase64,
      rawTransactionHash: digest(signed.rawTransactionBase64),
      transactionSignature: signed.transactionSignature,
      blockhash: signed.blockhash,
      lastValidBlockHeight: signed.lastValidBlockHeight,
      memo: signed.memo,
      wireSize: signed.wireSize,
      simulationUnits: null,
      plan,
    };
    let verificationCalled = false;
    const client: LiveSolanaClient = {
      latestBlockhash: async () => ({
        blockhash: '11111111111111111111111111111111' as Blockhash,
        lastValidBlockHeight: 10_000n,
      }),
      validateSettlementAccounts: async () => undefined,
      sendIdentical: async () => signed.transactionSignature,
      signatureStatus: async () => ({
        found: true,
        confirmationStatus: 'finalized',
        error: null,
      }),
      verifyFinalizedSettlement: async () => {
        verificationCalled = true;
        throw new FinalizedSettlementVerificationError(
          'TOKEN_BALANCE_DELTA',
          'Injected mismatch',
        );
      },
      currentBlockHeight: async () => 1n,
    };
    const runtime = new LiveSolanaSettlementRuntime('http://unused.invalid', signers, 0, client);

    const result = await runtime.finalize(prepared);
    expect(verificationCalled).toBe(true);
    expect(result.status).toBe('unknown');
    expect(result.commitment).toBeNull();
  });

  it('retries a transient finalized-record miss and fulfills the exact same wire', async () => {
    vi.useFakeTimers();
    try {
      const {plan, signers, merchantOwner} = await fixture();
      const signed = await buildAndSignSettlement(plan, signers, {
        blockhash: '11111111111111111111111111111111' as Blockhash,
        lastValidBlockHeight: 10_000n,
      });
      const prepared: PreparedSettlement = {
        mode: 'live',
        messageBase64: signed.messageBase64,
        messageHash: signed.messageHash,
        rawTransactionBase64: signed.rawTransactionBase64,
        rawTransactionHash: digest(signed.rawTransactionBase64),
        transactionSignature: signed.transactionSignature,
        blockhash: signed.blockhash,
        lastValidBlockHeight: signed.lastValidBlockHeight,
        memo: signed.memo,
        wireSize: signed.wireSize,
        simulationUnits: null,
        plan,
      };
      const sendIdentical = vi.fn(async () => signed.transactionSignature);
      let verificationAttempts = 0;
      const client: LiveSolanaClient = {
        latestBlockhash: async () => ({
          blockhash: '11111111111111111111111111111111' as Blockhash,
          lastValidBlockHeight: 10_000n,
        }),
        validateSettlementAccounts: async () => undefined,
        sendIdentical,
        signatureStatus: async () => ({
          found: true,
          confirmationStatus: 'finalized',
          error: null,
        }),
        verifyFinalizedSettlement: async () => {
          verificationAttempts += 1;
          if (verificationAttempts === 1) {
            throw new FinalizedSettlementVerificationError(
              'NOT_FOUND',
              'Injected indexing delay',
            );
          }
          return verifyFinalizedSettlementRecord(
            plan,
            signed,
            finalizedRecord(plan, signed, merchantOwner),
          );
        },
        currentBlockHeight: async () => 1n,
      };
      const runtime = new LiveSolanaSettlementRuntime(
        'http://unused.invalid',
        signers,
        1_500,
        client,
      );

      const resultPromise = runtime.finalize(prepared);
      await vi.advanceTimersByTimeAsync(1_000);
      const result = await resultPromise;
      expect(result.status).toBe('success');
      expect(verificationAttempts).toBe(2);
      expect(sendIdentical).toHaveBeenCalledTimes(1);
      expect(sendIdentical).toHaveBeenCalledWith(prepared);
    } finally {
      vi.useRealTimers();
    }
  });
});
