import {createHash} from 'node:crypto';

import {canonicalize} from 'json-canonicalize';

import type {MandateV1, PolicyProofV1, QuoteV1} from './types.js';

function assertCanonicalJsonValue(value: unknown, path = '$', seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} contains a non-finite number`);
    }
    return;
  }

  if (typeof value !== 'object') {
    throw new TypeError(`${path} is not a JSON value`);
  }

  if (seen.has(value)) {
    throw new TypeError(`${path} contains a cyclic reference`);
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) {
        throw new TypeError(`${path}[${String(index)}] is an array hole`);
      }
      assertCanonicalJsonValue(value[index], `${path}[${String(index)}]`, seen);
    }
  } else {
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must be a plain JSON object`);
    }
    for (const [key, child] of Object.entries(value)) {
      assertCanonicalJsonValue(child, `${path}.${key}`, seen);
    }
  }

  seen.delete(value);
}

export function canonicalJson(value: unknown): string {
  assertCanonicalJsonValue(value);
  return canonicalize(value);
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

function domainSeparatedHash(domain: string, value: unknown): string {
  return canonicalSha256({domain, value});
}

export function mandateHash(mandate: MandateV1): string {
  return domainSeparatedHash('MANDATE_POOL_MANDATE_V1', mandate);
}

export function quoteHash(quote: QuoteV1): string {
  return domainSeparatedHash('MANDATE_POOL_QUOTE_V1', quote);
}

export function policyProofHash(proof: PolicyProofV1): string {
  return domainSeparatedHash('MANDATE_POOL_POLICY_PROOF_V1', proof);
}
