import type {BuyerId} from "../agents/contracts.js";

export interface CatalogItemView {
  skuId: string;
  name: string;
  description: string;
  features: string[];
  durationDays: number;
  autoRenew: boolean;
  totalAmountAtomic: string;
  displayPrice: string;
}

export interface CreateOrderRequest {
  idempotencyKey: string;
  scenarioLabel?: string;
  mandates: Array<{buyerId: BuyerId; naturalLanguage: string}>;
}

export interface ApproveMandateRequest {
  mandateHash: string;
  approvalNonce: string;
}

export interface RunOrderRequest {
  /** Stable across initial execution and every reconciliation retry. */
  idempotencyKey: string;
}

export interface MandateView {
  buyerId: BuyerId;
  naturalLanguage: string;
  mandateHash?: string;
  /** Public, one-time challenge returned before approval; not a secret. */
  approvalNonce?: string;
  maxAmountAtomic?: string;
  requiredFeatures?: string[];
  forbiddenFeatures?: string[];
  validUntil?: string;
  approvedAt?: string;
  status: "NORMALIZING" | "PENDING_APPROVAL" | "APPROVED" | "INVALIDATED";
}

export interface PolicyCheckView {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface TimelineEventView {
  sequence: number;
  state: string;
  label: string;
  at: string;
  status: "complete" | "active" | "blocked";
}

export interface SettlementEvidenceView {
  cluster: string;
  txSignature?: string;
  explorerUrl?: string;
  quoteHash?: string;
  policyProofHash?: string;
  messageHash?: string;
  memo?: string;
  transferCount?: number;
  requiredSignerCount?: number;
  commitment?: string;
  metaError?: string | null;
}

export interface OrderSnapshotView {
  orderId: string;
  state: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  scenarioLabel?: string;
  mandates: MandateView[];
  selection?: {
    skuId: string;
    productName: string;
    rationale: string;
    totalAmountAtomic: string;
    allocations: Array<{buyerId: BuyerId; amountAtomic: string}>;
  };
  policyChecks: PolicyCheckView[];
  timeline: TimelineEventView[];
  evidence?: SettlementEvidenceView;
  entitlementCount: number;
  /** Included once by the authorized run response after fulfillment; omitted by getOrder. */
  entitlements?: Array<{buyerId: BuyerId; token: string}>;
  failure?: {code: string; message: string};
}

export interface ProtectedResourceResult {
  authorized: boolean;
  reason?: string;
  resource?: {
    title: string;
    summary: string;
    rows: Array<Record<string, string | number>>;
  };
}

/**
 * HTTP is an adapter only. Implementations own all state transitions,
 * authorization decisions, signing, settlement, and fulfillment.
 */
export interface MandatePoolHttpService {
  catalog(): Promise<CatalogItemView[]>;
  createOrder(request: CreateOrderRequest): Promise<OrderSnapshotView>;
  approveMandate(orderId: string, buyerId: BuyerId, request: ApproveMandateRequest): Promise<OrderSnapshotView>;
  runOrder(orderId: string, request: RunOrderRequest): Promise<OrderSnapshotView>;
  getOrder(orderId: string): Promise<OrderSnapshotView | null>;
  getProtectedResource(entitlementToken: string | null): Promise<ProtectedResourceResult>;
  readiness(): Promise<{ready: boolean; checks: Record<string, boolean>}>;
}

export class HttpServiceError extends Error {
  constructor(
    readonly statusCode: 400 | 401 | 403 | 404 | 409 | 422 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpServiceError";
  }
}
