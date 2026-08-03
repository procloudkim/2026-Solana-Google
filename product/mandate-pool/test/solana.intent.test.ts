import {
  address,
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createNoopSigner,
  createTransactionMessage,
  getCompiledTransactionMessageEncoder,
  getUtf8Encoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Blockhash,
  type Instruction,
} from '@solana/kit';
import {getTransferCheckedInstruction} from '@solana-program/token';
import {describe, expect, it} from 'vitest';

import {
  DEMO_ADDRESSES,
  createHappyPathFixture,
  evaluatePolicy,
} from '../src/domain/index.js';
import {
  CLASSIC_TOKEN_PROGRAM_ADDRESS,
  MEMO_PROGRAM_ADDRESS,
  SolanaKitTransactionMessageDecoder,
  deriveExpectedSettlementIntent,
  verifySerializedTransactionIntent,
  verifyTransactionIntent,
} from '../src/solana/index.js';
import type {
  DecodedMemoInstruction,
  DecodedTransactionIntent,
  DecodedTransferCheckedInstruction,
  ExpectedSettlementIntent,
  IntentViolationCode,
} from '../src/solana/index.js';

type DeepMutable<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? DeepMutable<Item>[]
    : T extends object
      ? {-readonly [Key in keyof T]: DeepMutable<T[Key]>}
      : T;

function expectedIntent(): ExpectedSettlementIntent {
  const fixture = createHappyPathFixture();
  const proof = evaluatePolicy({
    mandates: fixture.mandates,
    approvals: fixture.approvals,
    quote: fixture.quote,
    evaluatedAt: fixture.evaluatedAt,
  });
  return deriveExpectedSettlementIntent({
    feePayerAddress: DEMO_ADDRESSES.sponsor,
    quote: fixture.quote,
    policyProof: proof,
  });
}

function validDecoded(expected: ExpectedSettlementIntent): DecodedTransactionIntent {
  const firstTransfer = expected.transfers[0];
  if (firstTransfer === undefined) throw new Error('Expected transfer fixture is empty');
  return {
    messageVersion: 0,
    recentBlockhash: '11111111111111111111111111111111',
    feePayerAddress: expected.feePayerAddress,
    addressTableLookups: [],
    requiredSignerAddresses: [...expected.requiredSignerAddresses],
    staticAccounts: [
      {address: expected.feePayerAddress, isSigner: true, isWritable: true},
      ...expected.transfers.map((transfer) => ({
        address: transfer.authorityAddress,
        isSigner: true,
        isWritable: false,
      })),
      ...expected.transfers.map((transfer) => ({
        address: transfer.sourceAta,
        isSigner: false,
        isWritable: true,
      })),
      {address: firstTransfer.destinationAta, isSigner: false, isWritable: true},
      {address: firstTransfer.mint, isSigner: false, isWritable: false},
      {address: CLASSIC_TOKEN_PROGRAM_ADDRESS, isSigner: false, isWritable: false},
      {address: MEMO_PROGRAM_ADDRESS, isSigner: false, isWritable: false},
    ],
    instructions: [
      ...expected.transfers.map((transfer) => ({
        kind: 'transferChecked' as const,
        programAddress: CLASSIC_TOKEN_PROGRAM_ADDRESS,
        sourceAta: transfer.sourceAta,
        mint: transfer.mint,
        destinationAta: transfer.destinationAta,
        authorityAddress: transfer.authorityAddress,
        amountAtomic: transfer.amountAtomic,
        decimals: transfer.decimals,
        multisignerAddresses: [],
      })),
      {
        kind: 'memo' as const,
        programAddress: MEMO_PROGRAM_ADDRESS,
        memo: expected.memo,
        accountAddresses: [],
      },
    ],
  };
}

function mutableClone(value: DecodedTransactionIntent): DeepMutable<DecodedTransactionIntent> {
  return structuredClone(value) as DeepMutable<DecodedTransactionIntent>;
}

function transferAt(
  decoded: DeepMutable<DecodedTransactionIntent>,
  index = 0,
): DeepMutable<DecodedTransferCheckedInstruction> {
  const instruction = decoded.instructions[index];
  if (instruction?.kind !== 'transferChecked') throw new Error('Expected TransferChecked fixture');
  return instruction;
}

function memoAt(decoded: DeepMutable<DecodedTransactionIntent>): DeepMutable<DecodedMemoInstruction> {
  const instruction = decoded.instructions[3];
  if (instruction?.kind !== 'memo') throw new Error('Expected memo fixture');
  return instruction;
}

function violationCodes(
  decoded: DecodedTransactionIntent,
  expected: ExpectedSettlementIntent,
): readonly IntentViolationCode[] {
  const result = verifyTransactionIntent(decoded, expected);
  return result.ok ? [] : result.violations.map((violation) => violation.code);
}

describe('signer-safe settlement intent verifier', () => {
  it('accepts only the exact approved message intent', () => {
    const expected = expectedIntent();
    expect(verifyTransactionIntent(validDecoded(expected), expected)).toEqual({ok: true});
    expect(expected.requiredSignerAddresses).toEqual([
      DEMO_ADDRESSES.sponsor,
      DEMO_ADDRESSES.buyerA,
      DEMO_ADDRESSES.buyerB,
      DEMO_ADDRESSES.buyerC,
    ]);
    expect(expected.transfers.map((transfer) => transfer.buyerId)).toEqual(['A', 'B', 'C']);
  });

  const mutations: readonly [
    string,
    IntentViolationCode,
    (decoded: DeepMutable<DecodedTransactionIntent>) => void,
  ][] = [
    ['legacy message', 'MESSAGE_VERSION', (decoded) => { decoded.messageVersion = 'legacy'; }],
    ['address lookup table', 'ADDRESS_TABLE_LOOKUP', (decoded) => { decoded.addressTableLookups.push('lookup'); }],
    ['empty blockhash', 'RECENT_BLOCKHASH', (decoded) => { decoded.recentBlockhash = ''; }],
    ['different fee payer', 'FEE_PAYER', (decoded) => { decoded.feePayerAddress = DEMO_ADDRESSES.buyerA; }],
    ['missing signer', 'REQUIRED_SIGNERS', (decoded) => { decoded.requiredSignerAddresses.pop(); }],
    ['extra signer', 'REQUIRED_SIGNERS', (decoded) => { decoded.requiredSignerAddresses.push('extra'); }],
    ['fee payer moved from signer zero', 'REQUIRED_SIGNERS', (decoded) => {
      const sponsor = decoded.requiredSignerAddresses[0];
      const buyer = decoded.requiredSignerAddresses[1];
      if (sponsor === undefined || buyer === undefined) throw new Error('Missing signers');
      decoded.requiredSignerAddresses[0] = buyer;
      decoded.requiredSignerAddresses[1] = sponsor;
    }],
    ['duplicate static account', 'STATIC_ACCOUNT_DUPLICATE', (decoded) => {
      const first = decoded.staticAccounts[0];
      if (first === undefined) throw new Error('Missing static account');
      decoded.staticAccounts.push({...first});
    }],
    ['extra static account', 'STATIC_ACCOUNT_SET', (decoded) => {
      decoded.staticAccounts.push({address: 'extra', isSigner: false, isWritable: false});
    }],
    ['changed account flags', 'STATIC_ACCOUNT_FLAGS', (decoded) => {
      const source = decoded.staticAccounts[4];
      if (source === undefined) throw new Error('Missing source account');
      source.isWritable = false;
    }],
    ['missing instruction', 'INSTRUCTION_COUNT', (decoded) => { decoded.instructions.pop(); }],
    ['extra instruction', 'INSTRUCTION_COUNT', (decoded) => {
      decoded.instructions.push({kind: 'unknown', programAddress: 'x', accountAddresses: [], dataBase64: ''});
    }],
    ['wrong first instruction kind', 'INSTRUCTION_KIND', (decoded) => {
      decoded.instructions[0] = {kind: 'unknown', programAddress: 'x', accountAddresses: [], dataBase64: ''};
    }],
    ['token program substitution', 'TOKEN_PROGRAM', (decoded) => {
      transferAt(decoded).programAddress = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
    }],
    ['source substitution', 'TRANSFER_SOURCE', (decoded) => {
      transferAt(decoded).sourceAta = DEMO_ADDRESSES.sourceAtaB;
    }],
    ['mint substitution', 'TRANSFER_MINT', (decoded) => {
      transferAt(decoded).mint = DEMO_ADDRESSES.sourceAtaA;
    }],
    ['destination substitution', 'TRANSFER_DESTINATION', (decoded) => {
      transferAt(decoded).destinationAta = DEMO_ADDRESSES.sourceAtaA;
    }],
    ['authority substitution', 'TRANSFER_AUTHORITY', (decoded) => {
      transferAt(decoded).authorityAddress = DEMO_ADDRESSES.buyerB;
    }],
    ['amount substitution', 'TRANSFER_AMOUNT', (decoded) => {
      transferAt(decoded).amountAtomic = '3000001';
    }],
    ['decimal substitution', 'TRANSFER_DECIMALS', (decoded) => {
      transferAt(decoded).decimals = 9;
    }],
    ['multisig injection', 'TRANSFER_MULTISIG', (decoded) => {
      transferAt(decoded).multisignerAddresses.push(DEMO_ADDRESSES.buyerB);
    }],
    ['memo program substitution', 'MEMO_PROGRAM', (decoded) => {
      memoAt(decoded).programAddress = CLASSIC_TOKEN_PROGRAM_ADDRESS;
    }],
    ['memo value substitution', 'MEMO_VALUE', (decoded) => {
      memoAt(decoded).memo = `${memoAt(decoded).memo}x`;
    }],
    ['memo account injection', 'MEMO_ACCOUNTS', (decoded) => {
      memoAt(decoded).accountAddresses.push(DEMO_ADDRESSES.buyerA);
    }],
  ];

  it.each(mutations)('rejects %s', (_name, expectedCode, mutate) => {
    const expected = expectedIntent();
    const decoded = mutableClone(validDecoded(expected));
    mutate(decoded);
    expect(violationCodes(decoded, expected)).toContain(expectedCode);
  });

  it('accepts the canonical compiler reordering readonly buyer signers', () => {
    const expected = expectedIntent();
    const decoded = mutableClone(validDecoded(expected));
    const a = decoded.requiredSignerAddresses[1];
    const c = decoded.requiredSignerAddresses[3];
    if (a === undefined || c === undefined) throw new Error('Missing buyer signers');
    decoded.requiredSignerAddresses[1] = c;
    decoded.requiredSignerAddresses[3] = a;
    expect(verifyTransactionIntent(decoded, expected)).toEqual({ok: true});
  });

  it('will not derive payment intent from a rejected or mismatched proof', () => {
    const fixture = createHappyPathFixture();
    const proof = evaluatePolicy({...fixture, evaluatedAt: fixture.evaluatedAt});
    expect(() => deriveExpectedSettlementIntent({
      feePayerAddress: DEMO_ADDRESSES.sponsor,
      quote: fixture.quote,
      policyProof: {...proof, approved: false},
    })).toThrow(/fully passing/u);
    expect(() => deriveExpectedSettlementIntent({
      feePayerAddress: DEMO_ADDRESSES.sponsor,
      quote: {...fixture.quote, nonce: 'mutated-after-policy'},
      policyProof: proof,
    })).toThrow(/does not bind/u);
  });
});

describe('@solana/kit message decoder adapter', () => {
  function encodeRealMessage(expected: ExpectedSettlementIntent): Uint8Array {
    const sponsor = createNoopSigner(address(expected.feePayerAddress));
    const transfers = expected.transfers.map((transfer) =>
      getTransferCheckedInstruction(
        {
          source: address(transfer.sourceAta),
          mint: address(transfer.mint),
          destination: address(transfer.destinationAta),
          authority: createNoopSigner(address(transfer.authorityAddress)),
          amount: BigInt(transfer.amountAtomic),
          decimals: transfer.decimals,
        },
        {programAddress: address(CLASSIC_TOKEN_PROGRAM_ADDRESS)},
      ),
    );
    const memo: Instruction = {
      programAddress: address(MEMO_PROGRAM_ADDRESS),
      data: getUtf8Encoder().encode(expected.memo),
    };
    const message = pipe(
      createTransactionMessage({version: 0}),
      (current) => setTransactionMessageFeePayerSigner(sponsor, current),
      (current) => setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: '11111111111111111111111111111111' as Blockhash,
          lastValidBlockHeight: 100n,
        },
        current,
      ),
      (current) => appendTransactionMessageInstructions([...transfers, memo], current),
    );
    return Uint8Array.from(
      getCompiledTransactionMessageEncoder().encode(compileTransactionMessage(message)),
    );
  }

  it('projects a real v0 message without hiding accounts or instructions', () => {
    const expected = expectedIntent();
    const bytes = encodeRealMessage(expected);
    const result = verifySerializedTransactionIntent(
      bytes,
      expected,
      new SolanaKitTransactionMessageDecoder(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decoded.instructions).toHaveLength(4);
      expect(result.decoded.requiredSignerAddresses[0]).toBe(expected.feePayerAddress);
      expect(new Set(result.decoded.requiredSignerAddresses)).toEqual(
        new Set(expected.requiredSignerAddresses),
      );
      expect(result.messageHash).toMatch(/^[0-9a-f]{64}$/u);
    }
  });

  it('rejects trailing bytes instead of decoding a safe prefix', () => {
    const expected = expectedIntent();
    const original = encodeRealMessage(expected);
    const withTrailingByte = new Uint8Array(original.byteLength + 1);
    withTrailingByte.set(original);
    withTrailingByte[withTrailingByte.length - 1] = 1;
    const result = verifySerializedTransactionIntent(
      withTrailingByte,
      expected,
      new SolanaKitTransactionMessageDecoder(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((violation) => violation.code)).toContain('DECODE_FAILED');
    }
  });
});
