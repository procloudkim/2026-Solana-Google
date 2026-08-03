import {InMemoryRunner, LlmAgent} from "@google/adk";
import {z} from "zod";

import {
  BUYER_IDS,
  boundedAgentRationale,
  type AgentDecisionTrace,
  type AgentPlanInput,
  type AgentRuntime,
  type BuyerId,
  type NaturalLanguageMandate,
  type NormalizedMandateProposal,
} from "./contracts.js";
import {CachedVertexReadiness} from "./vertex-readiness.js";

const normalizedMandateSchema = z.object({
  // These are protocol identifiers, not free-form labels. Constraining the
  // model output keeps equivalent terms such as "API", "auto-renewal", and
  // "one-time" from becoming false catalog mismatches.
  requiredFeatures: z.array(z.enum(["api", "csv", "7-day-access"])),
  forbiddenFeatures: z.array(z.enum(["auto-renew"])),
  maxAmountAtomic: z.string().regex(/^\d+$/u),
  validUntil: z.string(),
  // The explanation is non-authoritative. Accept a bounded model response,
  // then clamp it before it reaches persistence or the public snapshot.
  rationale: z.string().max(4_000),
});

const coalitionSelectionSchema = z.object({
  skuId: z.string().min(1),
  rationale: z.string().max(4_000),
});

export interface GoogleAdkRuntimeOptions {
  model?: string;
  appName?: string;
  projectId?: string;
  location?: string;
  readinessCacheMs?: number;
  readinessProbe?: () => Promise<void>;
  clockMs?: () => number;
}

function parseStructuredOutput<T>(raw: string, schema: z.ZodType<T>): T {
  const trimmed = raw.trim();
  const json = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "")
    : trimmed;
  return schema.parse(JSON.parse(json) as unknown);
}

async function runStructuredAgent<T>(params: {
  agent: LlmAgent;
  appName: string;
  userId: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const runner = new InMemoryRunner({agent: params.agent, appName: params.appName});
  let finalText = "";
  for await (const event of runner.runEphemeral({
    userId: params.userId,
    newMessage: {role: "user", parts: [{text: params.prompt}]},
  })) {
    for (const part of event.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.trim().length > 0) {
        finalText = part.text;
      }
    }
  }
  if (finalText.length === 0) {
    throw new Error(`Google ADK agent ${params.agent.name} returned no structured response`);
  }
  return parseStructuredOutput(finalText, params.schema);
}

function normalizationInstruction(buyerId: BuyerId): string {
  return [
    `You normalize buyer ${buyerId}'s natural-language purchase mandate into the exact output schema.`,
    "Use only facts supplied in the JSON input. Never invent a budget, duration, or feature.",
    "USDC amounts are integer atomic units with six decimals. Merchant and mint allowlists are bound by the server and are not part of your output.",
    "Use only these exact requiredFeatures identifiers: api, csv, 7-day-access. Use only auto-renew in forbiddenFeatures.",
    "A request for 7 days maps to requiredFeatures 7-day-access. One-time or no-renewal wording maps to forbiddenFeatures auto-renew; it is not a required feature.",
    "This is a proposal only. You have no tools and cannot authorize, sign, broadcast, or settle a payment.",
    "If wording is ambiguous, choose the stricter interpretation. Keep rationale to one sentence and at most 200 characters.",
  ].join(" ");
}

function makeNormalizer(model: string, buyerId: BuyerId): LlmAgent {
  return new LlmAgent({
    name: `buyer_${buyerId.toLowerCase()}_normalizer`,
    description: `Normalizes buyer ${buyerId}'s purchase constraints without payment authority.`,
    model,
    instruction: normalizationInstruction(buyerId),
    outputSchema: normalizedMandateSchema,
    tools: [],
    includeContents: "none",
    disallowTransferToParent: true,
    disallowTransferToPeers: true,
    generateContentConfig: {temperature: 0},
  });
}

function makeCoalitionSelector(model: string): LlmAgent {
  return new LlmAgent({
    name: "coalition_catalog_selector",
    description: "Proposes one canonical catalog SKU for the three normalized buyer mandates.",
    model,
    instruction: [
      "Choose exactly one skuId from the supplied canonical catalog, or return skuId NO_BUY.",
      "A product is eligible only if every buyer's required features, forbidden features, duration, and budget are satisfied.",
      "Split integer atomic units in buyer A, B, C order: use floor(total/3), then give one extra base unit to each earliest buyer until the remainder is exhausted.",
      "For the budget check, compare each buyer's maxAmountAtomic with that buyer's computed share. Never compare a SKU's full total with one buyer's cap.",
      "Never rewrite prices or product facts. Never authorize or initiate payment.",
      "Keep rationale to one sentence and at most 240 characters.",
    ].join(" "),
    outputSchema: coalitionSelectionSchema,
    tools: [],
    includeContents: "none",
    disallowTransferToParent: true,
    disallowTransferToPeers: true,
    generateContentConfig: {temperature: 0},
  });
}

function mandatePrompt(input: AgentPlanInput, mandate: NaturalLanguageMandate): string {
  return JSON.stringify({
    buyerId: mandate.buyerId,
    naturalLanguage: mandate.naturalLanguage,
    currentTime: (input.now ?? new Date()).toISOString(),
    defaultValidityMinutes: 15,
  });
}

export class GoogleAdkAgentRuntime implements AgentRuntime {
  readonly #model: string;
  readonly #appName: string;
  readonly #vertexReadiness: CachedVertexReadiness;

  constructor(options: GoogleAdkRuntimeOptions = {}) {
    this.#model = options.model ?? process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
    this.#appName = options.appName ?? "mandate-pool";
    this.#vertexReadiness = new CachedVertexReadiness({
      model: this.#model,
      projectId: options.projectId ?? process.env["GOOGLE_CLOUD_PROJECT"] ?? "",
      location: options.location ?? process.env["GOOGLE_CLOUD_LOCATION"] ?? "",
      ...(options.readinessCacheMs === undefined ? {} : {cacheMs: options.readinessCacheMs}),
      ...(options.readinessProbe === undefined ? {} : {probe: options.readinessProbe}),
      ...(options.clockMs === undefined ? {} : {clockMs: options.clockMs}),
    });
  }

  async readiness(): Promise<boolean> {
    return this.#vertexReadiness.check();
  }

  async plan(input: AgentPlanInput): Promise<AgentDecisionTrace> {
    const startedAt = new Date().toISOString();
    const byBuyer = new Map(input.mandates.map((mandate) => [mandate.buyerId, mandate]));
    const mandates = BUYER_IDS.map((buyerId) => {
      const mandate = byBuyer.get(buyerId);
      if (mandate === undefined) {
        throw new Error(`Missing mandate for buyer ${buyerId}`);
      }
      return mandate;
    });

    // Three isolated ADK agents run concurrently. No agent receives signer or RPC tools.
    const proposals = await Promise.all(mandates.map(async (mandate) => {
      const agent = makeNormalizer(this.#model, mandate.buyerId);
      const proposal = await runStructuredAgent({
        agent,
        appName: `${this.#appName}-buyer-${mandate.buyerId.toLowerCase()}`,
        userId: `${input.orderId}:${mandate.buyerId}`,
        prompt: mandatePrompt(input, mandate),
        schema: normalizedMandateSchema,
      });
      return {
        ...proposal,
        // Payment destinations are authoritative server configuration, never
        // values copied or selected by the model.
        allowedMint: input.allowedMint,
        allowedMerchantOwners: [...input.allowedMerchantOwners],
        rationale: boundedAgentRationale(proposal.rationale, 400),
        buyerId: mandate.buyerId,
      } satisfies NormalizedMandateProposal;
    }));

    const selector = makeCoalitionSelector(this.#model);
    const selection = await runStructuredAgent({
      agent: selector,
      appName: `${this.#appName}-selector`,
      userId: input.orderId,
      prompt: JSON.stringify({normalizedMandates: proposals, canonicalCatalog: input.catalog}),
      schema: coalitionSelectionSchema,
    });
    const catalogIds = new Set(input.catalog.map((item) => item.skuId));
    if (selection.skuId !== "NO_BUY" && !catalogIds.has(selection.skuId)) {
      throw new Error("Coalition agent selected a SKU outside the canonical catalog");
    }

    return {
      provider: "google-adk",
      model: this.#model,
      startedAt,
      completedAt: new Date().toISOString(),
      normalizedMandates: proposals,
      selection: {
        skuId: selection.skuId,
        rationale: boundedAgentRationale(selection.rationale, 500),
      },
    };
  }
}
