export type WorkflowErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_TRANSITION'
  | 'INVARIANT_VIOLATION'
  | 'BUDGET_EXCEEDED';

export class WorkflowError extends Error {
  public constructor(
    public readonly code: WorkflowErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export function notFound(message: string): never {
  throw new WorkflowError('NOT_FOUND', message);
}

export function conflict(message: string): never {
  throw new WorkflowError('CONFLICT', message);
}

export function invalidTransition(message: string): never {
  throw new WorkflowError('INVALID_TRANSITION', message);
}

export function invariant(message: string): never {
  throw new WorkflowError('INVARIANT_VIOLATION', message);
}

export function budgetExceeded(message: string): never {
  throw new WorkflowError('BUDGET_EXCEEDED', message);
}
