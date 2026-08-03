import {sha256Hex} from './canonical.js';

const HEX_256_PATTERN = /^[0-9a-f]{64}$/u;

function assertHash(name: string, value: string): void {
  if (!HEX_256_PATTERN.test(value)) {
    throw new TypeError(`${name} must be a lowercase SHA-256 hex digest`);
  }
}

export function settlementKey(quoteHash: string, policyProofHash: string): string {
  assertHash('quoteHash', quoteHash);
  assertHash('policyProofHash', policyProofHash);
  return sha256Hex(`MANDATE_POOL_SETTLEMENT_V1\0${quoteHash}\0${policyProofHash}`);
}

export function settlementMemo(quoteHash: string, policyProofHash: string): string {
  assertHash('quoteHash', quoteHash);
  assertHash('policyProofHash', policyProofHash);
  return `MP1:${quoteHash}:${policyProofHash}`;
}
