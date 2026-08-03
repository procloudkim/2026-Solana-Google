export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export const WORKFLOW_STATES = [
  'DRAFT',
  'AWAITING_APPROVAL',
  'APPROVED',
  'PLANNED',
  'NO_BUY',
  'POLICY_REJECTED',
  'RESERVED',
  'MESSAGE_BUILT',
  'SIGNING',
  'FULLY_SIGNED',
  'SUBMISSION_STARTED',
  'FINALIZED_FAILED',
  'RECONCILIATION_REQUIRED',
  'FINALIZED_SUCCESS',
  'FULFILLING',
  'FULFILLED',
  'SAFE_ABORT',
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export type ReservationStatus = 'HELD' | 'CONSUMED' | 'RELEASED';

export interface ReservationAllocation {
  readonly mandateId: string;
  readonly buyerId: string;
  readonly mint: string;
  readonly amountAtomic: string;
}

export interface BudgetAccount {
  readonly mandateId: string;
  readonly buyerId: string;
  readonly mint: string;
  readonly limitAtomic: string;
  readonly reservedAtomic: string;
  readonly consumedAtomic: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReservationRecord {
  readonly settlementKey: string;
  readonly quoteHash: string;
  readonly policyProofHash: string;
  readonly totalAtomic: string;
  readonly allocations: readonly ReservationAllocation[];
  readonly status: ReservationStatus;
  readonly reservedAt: string;
  readonly resolvedAt?: string;
}

export interface MessageArtifact {
  readonly attemptId: string;
  readonly messageHash: string;
  readonly messageBase64: string;
  readonly recentBlockhash: string;
  readonly lastValidBlockHeight: number;
  readonly requiredSigners: readonly string[];
  readonly createdAt: string;
}

export interface SignedTransactionArtifact {
  readonly rawTransactionBase64: string;
  readonly rawTransactionHash: string;
  readonly txSignature: string;
  readonly signedAt: string;
}

export interface SettlementAttempt {
  readonly attemptNumber: 1;
  readonly message: MessageArtifact;
  readonly signedTransaction?: SignedTransactionArtifact;
  readonly submissionCount: number;
  readonly firstSubmittedAt?: string;
  readonly lastSubmittedAt?: string;
}

export interface WorkflowOrder {
  readonly orderId: string;
  readonly idempotencyKeyHash: string;
  readonly state: WorkflowState;
  readonly version: number;
  readonly context: JsonObject;
  readonly reservation?: ReservationRecord;
  readonly settlement?: SettlementAttempt;
  readonly auditHead: string;
  readonly auditLength: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuditEvent {
  readonly eventId: string;
  readonly orderId: string;
  readonly sequence: number;
  readonly eventType: string;
  readonly actor: string;
  readonly fromState: WorkflowState | null;
  readonly toState: WorkflowState;
  readonly payload: JsonObject;
  readonly payloadHash: string;
  readonly previousEventHash: string | null;
  readonly eventHash: string;
  readonly occurredAt: string;
}

export interface CreateOrderInput {
  readonly orderId: string;
  readonly idempotencyKey: string;
  readonly context?: JsonObject;
  readonly actor: string;
  readonly at: string;
}

export interface CreateOrderResult {
  readonly order: WorkflowOrder;
  readonly created: boolean;
}

export interface RegisterBudgetInput {
  readonly mandateId: string;
  readonly buyerId: string;
  readonly mint: string;
  readonly limitAtomic: string;
  readonly at: string;
}

export interface TransitionInput {
  readonly orderId: string;
  readonly expectedVersion: number;
  readonly to: WorkflowState;
  readonly actor: string;
  readonly at: string;
  readonly eventType?: string;
  readonly payload?: JsonObject;
  readonly contextPatch?: JsonObject;
}

export interface ReserveSettlementInput {
  readonly orderId: string;
  readonly expectedVersion: number;
  readonly settlementKey: string;
  readonly quoteHash: string;
  readonly policyProofHash: string;
  readonly totalAtomic: string;
  readonly allocations: readonly ReservationAllocation[];
  readonly actor: string;
  readonly at: string;
  readonly payload?: JsonObject;
}

export interface AttachMessageInput {
  readonly orderId: string;
  readonly expectedVersion: number;
  readonly message: Omit<MessageArtifact, 'createdAt'>;
  readonly actor: string;
  readonly at: string;
  readonly payload?: JsonObject;
}

export interface MarkFullySignedInput {
  readonly orderId: string;
  readonly expectedVersion: number;
  readonly signedTransaction: Omit<SignedTransactionArtifact, 'signedAt'>;
  readonly actor: string;
  readonly at: string;
  readonly payload?: JsonObject;
}

export interface RecordSubmissionInput {
  readonly orderId: string;
  readonly expectedVersion: number;
  readonly attemptId: string;
  readonly rawTransactionHash: string;
  readonly txSignature: string;
  readonly actor: string;
  readonly at: string;
  readonly payload?: JsonObject;
}
