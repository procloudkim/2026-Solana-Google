import {describe, expect, it} from 'vitest';

import {
  MAX_U64,
  addAtomicAmounts,
  atomicAmount,
  canonicalJson,
  canonicalSha256,
  compareAtomicAmounts,
  formatAtomicAmount,
  settlementKey,
  settlementMemo,
  splitAtomicAmount,
} from '../src/domain/index.js';

describe('atomic token amounts', () => {
  it('keeps base units as canonical decimal strings', () => {
    expect(atomicAmount('0')).toBe('0');
    expect(atomicAmount(MAX_U64.toString())).toBe(MAX_U64.toString());
    expect(addAtomicAmounts(['1000000', '2000000', '3000000'])).toBe('6000000');
    expect(compareAtomicAmounts('9007199254740993', '9007199254740992')).toBe(1);
    expect(formatAtomicAmount(3_000_000n)).toBe('3000000');
    expect(splitAtomicAmount('1000000', 3)).toEqual([
      '333334',
      '333333',
      '333333',
    ]);
    expect(splitAtomicAmount('999999', 3)).toEqual(['333333', '333333', '333333']);
    expect(splitAtomicAmount('1000001', 3)).toEqual(['333334', '333334', '333333']);
    expect(addAtomicAmounts(splitAtomicAmount('1000000', 3))).toBe('1000000');
  });

  it.each(['', '-1', '+1', '01', '1.0', '1e6', ' 1', '1 '])('rejects non-canonical value %j', (value) => {
    expect(() => atomicAmount(value)).toThrow();
  });

  it('rejects overflow and arithmetic overflow', () => {
    expect(() => atomicAmount((MAX_U64 + 1n).toString())).toThrow(/u64/u);
    expect(() => addAtomicAmounts([MAX_U64.toString(), '1'])).toThrow(/64-bit/u);
    expect(() => splitAtomicAmount('2', 3)).toThrow(/one base unit/u);
    expect(() => splitAtomicAmount('1000000', 0)).toThrow(/part count/u);
  });
});
describe('canonical hashes', () => {
  it('is independent of object insertion order', () => {
    const left = {z: 1, nested: {b: true, a: 'value'}};
    const right = {nested: {a: 'value', b: true}, z: 1};
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(canonicalSha256(left)).toBe(canonicalSha256(right));
  });

  it('rejects values outside the JSON data model', () => {
    expect(() => canonicalJson({amount: 1n})).toThrow(/JSON value/u);
    expect(() => canonicalJson({missing: undefined})).toThrow(/JSON value/u);
    expect(() => canonicalJson({invalid: Number.NaN})).toThrow(/non-finite/u);
    expect(() => canonicalJson(new Date())).toThrow(/plain JSON object/u);
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow(/cyclic/u);
  });

  it('domain-separates settlement identity and memo', () => {
    const quoteHash = 'a'.repeat(64);
    const proofHash = 'b'.repeat(64);
    const key = settlementKey(quoteHash, proofHash);
    expect(key).toMatch(/^[0-9a-f]{64}$/u);
    expect(settlementKey(quoteHash, proofHash)).toBe(key);
    expect(settlementMemo(quoteHash, proofHash)).toBe(`MP1:${quoteHash}:${proofHash}`);
    expect(() => settlementMemo('not-a-hash', proofHash)).toThrow(/SHA-256/u);
  });
});
