import {timingSafeEqual} from "node:crypto";

import {serveStatic} from "@hono/node-server/serve-static";
import {Hono, type Context, type MiddlewareHandler} from "hono";
import {z, ZodError} from "zod";

import {BUYER_IDS, type BuyerId} from "../agents/contracts.js";
import {WorkflowError, type WorkflowErrorCode} from "../workflow/errors.js";
import {HttpServiceError, type MandatePoolHttpService} from "./contracts.js";

const orderIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u);
const buyerIdSchema = z.enum(BUYER_IDS);
const createOrderSchema = z.object({
  scenarioLabel: z.string().trim().min(1).max(80).optional(),
  mandates: z.array(z.object({
    buyerId: buyerIdSchema,
    naturalLanguage: z.string().trim().min(3).max(1_000),
  }).strict()).length(3),
}).strict();
const approvalSchema = z.object({
  mandateHash: z.string().regex(/^[a-f0-9]{64}$/u),
  approvalNonce: z.string().min(16).max(256),
}).strict();

export interface HttpAppOptions {
  demoKey: string;
  settlementMode: "fixture" | "live";
  staticRoot?: string;
}

function secureEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function mutationGuard(demoKey: string): MiddlewareHandler {
  return async (context, next) => {
    const supplied = context.req.header("X-Demo-Key") ?? "";
    if (!secureEqual(supplied, demoKey)) {
      return context.json({error: {code: "UNAUTHORIZED", message: "유효한 데모 운영 키가 필요합니다."}}, 401);
    }
    await next();
  };
}

async function parseJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json<unknown>();
  } catch {
    throw new HttpServiceError(400, "INVALID_JSON", "요청 본문이 올바른 JSON이 아닙니다.");
  }
}

function assertDistinctBuyers(mandates: Array<{buyerId: BuyerId}>): void {
  const buyers = new Set(mandates.map((mandate) => mandate.buyerId));
  if (buyers.size !== BUYER_IDS.length || BUYER_IDS.some((buyer) => !buyers.has(buyer))) {
    throw new HttpServiceError(422, "BUYERS_MUST_BE_A_B_C", "구매자 A, B, C의 mandate가 각각 하나씩 필요합니다.");
  }
}

function bearerToken(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  const match = header.match(/^Bearer ([^\s]+)$/u);
  return match?.[1] ?? null;
}

function requiredIdempotencyKey(context: Context): string {
  const idempotencyKey = context.req.header("Idempotency-Key")?.trim() ?? "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    throw new HttpServiceError(400, "INVALID_IDEMPOTENCY_KEY", "8~128자의 Idempotency-Key가 필요합니다.");
  }
  return idempotencyKey;
}

function workflowStatus(code: WorkflowErrorCode): 404 | 409 | 422 | 503 {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
    case "INVALID_TRANSITION":
      return 409;
    case "BUDGET_EXCEEDED":
      return 422;
    case "INVARIANT_VIOLATION":
      return 503;
  }
}

export function createHttpApp(service: MandatePoolHttpService, options: HttpAppOptions): Hono {
  if (options.demoKey.length < 16) {
    throw new Error("DEMO_KEY must contain at least 16 characters");
  }

  const app = new Hono();
  const guard = mutationGuard(options.demoKey);

  app.use("*", async (context, next) => {
    context.header("X-Content-Type-Options", "nosniff");
    context.header("X-Frame-Options", "DENY");
    context.header("Referrer-Policy", "no-referrer");
    context.header("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    if (context.req.path.startsWith("/api/")) {
      context.header("Cache-Control", "no-store");
    }
    await next();
  });

  // Cloud Run reserves some paths ending in "z". Keep /healthz for local
  // compatibility, but use /health for deployed probes and verification.
  app.get("/health", (context) => context.json({ok: true}));
  app.get("/healthz", (context) => context.json({ok: true}));
  app.get("/api/v1/runtime", (context) => context.json({
    mode: options.settlementMode,
    cluster: options.settlementMode === "live" ? "solana-devnet" : "fixture",
    onChain: options.settlementMode === "live",
    label: options.settlementMode === "live"
      ? "LIVE · SOLANA DEVNET · TEST TOKENS"
      : "FIXTURE · NOT ON-CHAIN",
  }));
  app.get("/readyz", async (context) => {
    const readiness = await service.readiness();
    return context.json(readiness, readiness.ready ? 200 : 503);
  });

  app.get("/api/v1/catalog", async (context) => context.json({items: await service.catalog()}));

  app.post("/api/v1/orders", guard, async (context) => {
    const idempotencyKey = requiredIdempotencyKey(context);
    const body = createOrderSchema.parse(await parseJson(context));
    assertDistinctBuyers(body.mandates);
    const snapshot = await service.createOrder({
      idempotencyKey,
      mandates: body.mandates,
      ...(body.scenarioLabel === undefined ? {} : {scenarioLabel: body.scenarioLabel}),
    });
    context.header("Location", `/api/v1/orders/${snapshot.orderId}`);
    return context.json(snapshot, 201);
  });

  app.post("/api/v1/orders/:orderId/mandates/:buyerId/approve", guard, async (context) => {
    const orderId = orderIdSchema.parse(context.req.param("orderId"));
    const buyerId = buyerIdSchema.parse(context.req.param("buyerId"));
    const body = approvalSchema.parse(await parseJson(context));
    return context.json(await service.approveMandate(orderId, buyerId, body));
  });

  app.post("/api/v1/orders/:orderId/run", guard, async (context) => {
    const orderId = orderIdSchema.parse(context.req.param("orderId"));
    // The same key is reused by the UI while runOrder reconciles the one stored
    // signed transaction. It must never identify a newly built transaction.
    const idempotencyKey = requiredIdempotencyKey(context);
    const snapshot = await service.runOrder(orderId, {idempotencyKey});
    const inProgress = ["SIGNING", "FULLY_SIGNED", "SUBMISSION_STARTED", "FULFILLING"].includes(snapshot.state);
    return context.json(snapshot, inProgress ? 202 : 200);
  });

  app.get("/api/v1/orders/:orderId", async (context) => {
    const orderId = orderIdSchema.parse(context.req.param("orderId"));
    const snapshot = await service.getOrder(orderId);
    if (snapshot === null) {
      throw new HttpServiceError(404, "ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }
    return context.json(snapshot);
  });

  app.get("/api/v1/resources/signaldesk", async (context) => {
    const result = await service.getProtectedResource(bearerToken(context.req.header("Authorization")));
    if (!result.authorized || result.resource === undefined) {
      return context.json({error: {code: "ENTITLEMENT_REQUIRED", message: result.reason ?? "유효한 이용권이 필요합니다."}}, 403);
    }
    return context.json(result.resource);
  });

  const staticRoot = options.staticRoot ?? "./public";
  app.use("/assets/*", serveStatic({root: staticRoot}));
  app.get("/", serveStatic({root: staticRoot, path: "index.html"}));

  app.notFound((context) => context.json({error: {code: "NOT_FOUND", message: "요청한 경로가 없습니다."}}, 404));
  app.onError((error, context) => {
    if (error instanceof ZodError) {
      return context.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "요청 값이 계약과 일치하지 않습니다.",
          issues: error.issues.map((issue) => ({path: issue.path.join("."), message: issue.message})),
        },
      }, 422);
    }
    if (error instanceof HttpServiceError) {
      return context.json({error: {code: error.code, message: error.message}}, error.statusCode);
    }
    if (error instanceof WorkflowError) {
      return context.json({error: {code: error.code, message: error.message}}, workflowStatus(error.code));
    }
    console.error("Unhandled HTTP adapter error", error);
    return context.json({error: {code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다."}}, 500);
  });

  return app;
}
