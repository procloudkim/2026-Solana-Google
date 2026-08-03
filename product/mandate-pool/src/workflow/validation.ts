import {invariant} from './errors.js';
import type {JsonObject, ReservationAllocation, WorkflowOrder} from './types.js';
import {assertJsonValue, sha256Hex} from './audit.js';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const DECIMAL_PATTERN = /^(0|[1-9][0-9]*)$/u;
const MAX_U64 = 18_446_744_073_709_551_615n;

export function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER_PATTERN.test(value)) invariant(`${label} must be 1-160 URL-safe identifier characters`);
}
export function assertHash(value: string, label: string): void {
  if (!HASH_PATTERN.test(value)) invariant(`${label} must be a lowercase SHA-256 hex digest`);
}
export function assertTimestamp(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T/u.test(value) || Number.isNaN(Date.parse(value))) invariant(`${label} must be ISO-8601`);
}
export function parseAtomic(value: string, label: string, allowZero = true): bigint {
  if (!DECIMAL_PATTERN.test(value)) invariant(`${label} must be a canonical non-negative decimal string`);
  const amount = BigInt(value);
  if (!allowZero && amount === 0n) invariant(`${label} must be greater than zero`);
  if (amount > MAX_U64) invariant(`${label} must fit in an unsigned SPL Token u64`);
  return amount;
}
export function hashIdempotencyKey(key: string): string {
  if (key.length < 1 || key.length > 256) invariant('Idempotency key must contain 1-256 characters');
  return sha256Hex(`MANDATE_POOL_IDEMPOTENCY_V1\0${key}`);
}
export function validateContext(context: JsonObject): void { assertJsonValue(context); }
export function validateAllocations(allocations: readonly ReservationAllocation[], totalAtomic: string): void {
  if (allocations.length < 1) invariant('A reservation requires at least one allocation');
  const mandateIds = new Set<string>();
  let total = 0n;
  for (const allocation of allocations) {
    assertIdentifier(allocation.mandateId, 'mandateId');
    assertIdentifier(allocation.buyerId, 'buyerId');
    if (allocation.mint.length < 1) invariant('Allocation mint must not be empty');
    if (mandateIds.has(allocation.mandateId)) invariant(`Duplicate mandate allocation: ${allocation.mandateId}`);
    mandateIds.add(allocation.mandateId);
    total += parseAtomic(allocation.amountAtomic, 'allocation amount', false);
  }
  const expected = parseAtomic(totalAtomic, 'totalAtomic', false);
  if (total !== expected) invariant(`Allocation sum ${total.toString()} does not equal total ${totalAtomic}`);
}
export function mergeContext(current: JsonObject, patch?: JsonObject): JsonObject {
  if (patch === undefined) return current;
  validateContext(patch);
  return {...current, ...patch};
}
export function cloneOrder(order: WorkflowOrder): WorkflowOrder { return structuredClone(order); }
