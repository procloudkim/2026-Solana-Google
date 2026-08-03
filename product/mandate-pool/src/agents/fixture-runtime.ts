import {
  BUYER_IDS,
  type AgentCatalogItem,
  type AgentDecisionTrace,
  type AgentPlanInput,
  type AgentRuntime,
  type NaturalLanguageMandate,
  type NormalizedMandateProposal,
} from "./contracts.js";

const DEFAULT_CAPS: Readonly<Record<(typeof BUYER_IDS)[number], bigint>> = {
  A: 4_000_000n,
  B: 3_000_000n,
  C: 4_000_000n,
};

function parseCapAtomic(mandate: NaturalLanguageMandate): string {
  const amount = mandate.naturalLanguage.match(/(?:최대|max(?:imum)?|cap)\s*[:=]?\s*(\d+(?:\.\d+)?)/iu)?.[1];
  if (amount === undefined) {
    return DEFAULT_CAPS[mandate.buyerId].toString();
  }

  const [whole = "0", fraction = ""] = amount.split(".");
  const paddedFraction = `${fraction}000000`.slice(0, 6);
  return (BigInt(whole) * 1_000_000n + BigInt(paddedFraction)).toString();
}

function inferFeatures(text: string): {required: string[]; forbidden: string[]} {
  const normalized = text.toLocaleLowerCase("ko-KR");
  const required = [
    ...(normalized.includes("api") ? ["api"] : []),
    ...(normalized.includes("csv") ? ["csv"] : []),
    ...(normalized.includes("7일") || normalized.includes("7 day") ? ["7-day-access"] : []),
  ];
  const forbidden = [
    ...(normalized.includes("자동갱신 금지") || normalized.includes("no auto") || normalized.includes("일회성")
      ? ["auto-renew"]
      : []),
  ];
  return {required, forbidden};
}

function normalizeFixture(input: AgentPlanInput, mandate: NaturalLanguageMandate): NormalizedMandateProposal {
  const features = inferFeatures(mandate.naturalLanguage);
  const now = input.now ?? new Date();
  return {
    buyerId: mandate.buyerId,
    allowedMint: input.allowedMint,
    allowedMerchantOwners: [...input.allowedMerchantOwners],
    requiredFeatures: features.required,
    forbiddenFeatures: features.forbidden,
    maxAmountAtomic: parseCapAtomic(mandate),
    validUntil: new Date(now.getTime() + 15 * 60_000).toISOString(),
    rationale: "로컬 데모용 결정론적 정규화 결과입니다. 결제 권한은 정책 엔진이 별도로 판단합니다.",
  };
}

function productMatches(product: AgentCatalogItem, proposals: NormalizedMandateProposal[]): boolean {
  const total = BigInt(product.totalAmountAtomic);
  if (total % BigInt(proposals.length) !== 0n) {
    return false;
  }
  const share = total / BigInt(proposals.length);

  return proposals.every((proposal) => {
    const hasRequired = proposal.requiredFeatures.every((feature) => {
      if (feature === "7-day-access") {
        return product.durationDays >= 7;
      }
      return product.features.includes(feature);
    });
    const hasForbidden = proposal.forbiddenFeatures.some((feature) => {
      if (feature === "auto-renew") {
        return product.autoRenew;
      }
      return product.forbiddenCharacteristics.includes(feature) || product.features.includes(feature);
    });
    return hasRequired && !hasForbidden && share <= BigInt(proposal.maxAmountAtomic);
  });
}

export class FixtureAgentRuntime implements AgentRuntime {
  async readiness(): Promise<boolean> {
    return true;
  }

  async plan(input: AgentPlanInput): Promise<AgentDecisionTrace> {
    const startedAt = (input.now ?? new Date()).toISOString();
    const byBuyer = new Map(input.mandates.map((mandate) => [mandate.buyerId, mandate]));
    const mandates = BUYER_IDS.map((buyerId) => {
      const mandate = byBuyer.get(buyerId);
      if (mandate === undefined) {
        throw new Error(`Missing fixture mandate for buyer ${buyerId}`);
      }
      return mandate;
    });
    const normalizedMandates = mandates.map((mandate) => normalizeFixture(input, mandate));
    const selected = input.catalog.find((product) => productMatches(product, normalizedMandates));

    return {
      provider: "fixture",
      model: "deterministic-fixture-v1",
      startedAt,
      completedAt: (input.now ?? new Date()).toISOString(),
      normalizedMandates,
      selection: selected === undefined
        ? {skuId: "NO_BUY", rationale: "모든 구매자의 예산과 기능 조건을 동시에 만족하는 상품이 없습니다."}
        : {skuId: selected.skuId, rationale: "세 구매자의 교집합 조건을 만족하는 첫 번째 정규 카탈로그 상품입니다."},
    };
  }
}
