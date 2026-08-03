import {atomicAmount} from './atomic.js';
import type {CatalogSkuV1} from './types.js';

/** Circle's documented Solana Devnet USDC mint. */
export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const USDC_DECIMALS = 6;

export const DEMO_ADDRESSES = Object.freeze({
  sponsor: '2LU4jyY2Hx49YE2eFMmNPogkNS3SnfnBspewiYL4H9qQ',
  buyerA: 'BPFPbKymeQs376ZYGMb8CGwhxfMKaPT8fDJtEhsNRpVg',
  buyerB: 'UhVSvCWkoBe3Gftuw16diggQb8DAsTkRnqJsKSxeVfo',
  buyerC: 'AM5Ezv73uYpFy3gssETAoaGAcnfawHu4AZs8hV9vusUk',
  sourceAtaA: '23z4J3AAxVyWygfZ1x1o7PcLJC3TAjRnFhFHGB1eSgfe',
  sourceAtaB: '5JYMd2fjyo4idymYocQ5SCsSLCRqCMiGqitGLoYtAFh2',
  sourceAtaC: 'EeYBasDuFVH5yJTEyX8GgEcqkvugrLPQEcgEvPh9Xq3W',
  merchantOwner: 'G1GpkuLMt9gffS4a7uUTCJgaZnDR2Gysi1zUGrPJrmMZ',
  merchantUsdcAta: 'uMtkmBwgGJVD535iiHyoTg4AZTLicLHvvShgnFzj7gq',
});

function sku(
  skuId: string,
  name: string,
  features: readonly string[],
  accessDays: number,
  autoRenewal: boolean,
  totalAmountAtomic: string,
): CatalogSkuV1 {
  return Object.freeze({
    schema: 'mandate-pool/catalog-sku@1',
    skuId,
    name,
    merchantOwner: DEMO_ADDRESSES.merchantOwner,
    merchantUsdcAta: DEMO_ADDRESSES.merchantUsdcAta,
    mint: DEVNET_USDC_MINT,
    decimals: USDC_DECIMALS,
    features: Object.freeze([...features]),
    accessDays,
    autoRenewal,
    totalAmountAtomic: atomicAmount(totalAmountAtomic),
  });
}

/** The fixed demo catalog. Prices are USDC base units (six decimals). */
export const SIGNAL_DESK_CATALOG: readonly CatalogSkuV1[] = Object.freeze([
  sku('signaldesk-api-basic', 'SignalDesk API Basic', ['api'], 3, false, '600000'),
  sku('signaldesk-team-3', 'SignalDesk Team-3', ['api', 'csv'], 7, false, '1000000'),
  sku('signaldesk-pro-month', 'SignalDesk Pro Month', ['api', 'csv'], 30, true, '1200000'),
]);

export function signalDeskSku(skuId: string): CatalogSkuV1 {
  const match = SIGNAL_DESK_CATALOG.find((candidate) => candidate.skuId === skuId);
  if (match === undefined) {
    throw new RangeError(`Unknown SignalDesk SKU: ${skuId}`);
  }
  return match;
}
