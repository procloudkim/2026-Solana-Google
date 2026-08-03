const ATOMIC_AMOUNT_PATTERN = /^(?:0|[1-9][0-9]*)$/u;

/** SPL Token amounts are unsigned 64-bit integers on the wire. */
export const MAX_U64 = 18_446_744_073_709_551_615n;

declare const atomicAmountBrand: unique symbol;

/**
 * A base-10 integer string representing token base units.
 *
 * JSON APIs must use this type instead of JavaScript numbers so values cannot
 * silently lose precision.
 */
export type AtomicAmount = string & {readonly [atomicAmountBrand]: 'AtomicAmount'};

export class AtomicAmountError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AtomicAmountError';
  }
}

export function atomicAmount(value: string): AtomicAmount {
  if (!ATOMIC_AMOUNT_PATTERN.test(value)) {
    throw new AtomicAmountError('Atomic amounts must be canonical, unsigned base-10 integer strings');
  }

  const parsed = BigInt(value);
  if (parsed > MAX_U64) {
    throw new AtomicAmountError('Atomic amount exceeds the SPL Token u64 limit');
  }

  return value as AtomicAmount;
}

export function parseAtomicAmount(value: AtomicAmount | string): bigint {
  return BigInt(atomicAmount(value));
}

export function formatAtomicAmount(value: bigint): AtomicAmount {
  if (value < 0n || value > MAX_U64) {
    throw new AtomicAmountError('Atomic amount must fit in an unsigned 64-bit integer');
  }
  return atomicAmount(value.toString(10));
}

export function addAtomicAmounts(values: readonly (AtomicAmount | string)[]): AtomicAmount {
  const total = values.reduce((sum, value) => sum + parseAtomicAmount(value), 0n);
  return formatAtomicAmount(total);
}

export function compareAtomicAmounts(
  left: AtomicAmount | string,
  right: AtomicAmount | string,
): -1 | 0 | 1 {
  const leftValue = parseAtomicAmount(left);
  const rightValue = parseAtomicAmount(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}
