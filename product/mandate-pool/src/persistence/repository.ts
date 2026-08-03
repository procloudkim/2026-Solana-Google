import type {
  AttachMessageInput,
  AuditEvent,
  BudgetAccount,
  CreateOrderInput,
  CreateOrderResult,
  MarkFullySignedInput,
  RecordSubmissionInput,
  RegisterBudgetInput,
  ReserveSettlementInput,
  TransitionInput,
  WorkflowOrder,
} from '../workflow/types.js';

/**
 * Persistence contract for the payment state machine.
 *
 * Every mutating method is a compare-and-set operation. Implementations must
 * commit the order, budget effects, uniqueness locks, and audit event in one
 * transaction. Callers must reload after a CONFLICT instead of retrying a
 * stale command.
 */
export interface WorkflowRepository {
  readiness(): Promise<boolean>;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  getOrder(orderId: string): Promise<WorkflowOrder | null>;
  getOrderByIdempotencyKey(idempotencyKey: string): Promise<WorkflowOrder | null>;

  registerBudget(input: RegisterBudgetInput): Promise<BudgetAccount>;
  getBudget(mandateId: string): Promise<BudgetAccount | null>;

  transition(input: TransitionInput): Promise<WorkflowOrder>;
  reserveSettlement(input: ReserveSettlementInput): Promise<WorkflowOrder>;
  attachMessage(input: AttachMessageInput): Promise<WorkflowOrder>;
  markFullySigned(input: MarkFullySignedInput): Promise<WorkflowOrder>;

  /**
   * First call enters SUBMISSION_STARTED. Later calls are permitted only for
   * the exact same attempt id, signed bytes hash, and predicted signature.
   */
  recordSubmission(input: RecordSubmissionInput): Promise<WorkflowOrder>;

  listAuditEvents(orderId: string): Promise<readonly AuditEvent[]>;
}
