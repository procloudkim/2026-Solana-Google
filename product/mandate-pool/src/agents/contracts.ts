export const BUYER_IDS = ["A", "B", "C"] as const;

export type BuyerId = (typeof BUYER_IDS)[number];

export interface NaturalLanguageMandate {
  buyerId: BuyerId;
  naturalLanguage: string;
  signerAddress: string;
  sourceAta: string;
}

export interface AgentCatalogItem {
  skuId: string;
  name: string;
  features: string[];
  forbiddenCharacteristics: string[];
  durationDays: number;
  autoRenew: boolean;
  totalAmountAtomic: string;
}

/**
 * An LLM proposal, never a payment authorization. The deterministic policy
 * engine must validate every field against canonical catalog and mandate data.
 */
export interface NormalizedMandateProposal {
  buyerId: BuyerId;
  allowedMint: string;
  allowedMerchantOwners: string[];
  requiredFeatures: string[];
  forbiddenFeatures: string[];
  maxAmountAtomic: string;
  validUntil: string;
  rationale: string;
}

export interface CoalitionSelectionProposal {
  skuId: string | "NO_BUY";
  rationale: string;
}

export interface AgentPlanInput {
  orderId: string;
  mandates: NaturalLanguageMandate[];
  catalog: AgentCatalogItem[];
  allowedMint: string;
  allowedMerchantOwners: string[];
  now?: Date;
}

export interface AgentDecisionTrace {
  provider: "google-adk" | "fixture";
  model: string;
  startedAt: string;
  completedAt: string;
  normalizedMandates: NormalizedMandateProposal[];
  selection: CoalitionSelectionProposal;
}

/** This boundary deliberately exposes no signer, RPC, or settlement methods. */
export interface AgentRuntime {
  plan(input: AgentPlanInput): Promise<AgentDecisionTrace>;
  /** Cheap configuration/liveness probe; it must not authorize or purchase. */
  readiness(): Promise<boolean>;
}
