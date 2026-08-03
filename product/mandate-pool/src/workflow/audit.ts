import {createHash} from 'node:crypto';
import {canonicalize} from 'json-canonicalize';
import {invariant} from './errors.js';
import type {AuditEvent, JsonObject, JsonValue, WorkflowState} from './types.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function assertJsonValue(value: unknown, path = '$'): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      invariant(`${path} must contain only finite safe integers; encode amounts as strings`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) invariant(`${path}.${key} must not be undefined`);
      assertJsonValue(item, `${path}.${key}`);
    }
    return;
  }
  invariant(`${path} contains a non-JSON value`);
}

export function canonicalHash(value: JsonValue): string {
  assertJsonValue(value);
  return sha256Hex(canonicalize(value));
}

export interface BuildAuditEventInput {
  readonly orderId: string;
  readonly sequence: number;
  readonly eventType: string;
  readonly actor: string;
  readonly fromState: WorkflowState | null;
  readonly toState: WorkflowState;
  readonly payload: JsonObject;
  readonly previousEventHash: string | null;
  readonly occurredAt: string;
}

export function buildAuditEvent(input: BuildAuditEventInput): AuditEvent {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) invariant('Audit sequence must be non-negative');
  if (input.previousEventHash !== null && !SHA256_PATTERN.test(input.previousEventHash)) {
    invariant('Previous audit hash must be null or a SHA-256 hex digest');
  }
  assertJsonValue(input.payload);
  const payloadHash = canonicalHash(input.payload);
  const eventBody: JsonObject = {
    orderId: input.orderId, sequence: input.sequence, eventType: input.eventType, actor: input.actor,
    fromState: input.fromState, toState: input.toState, payloadHash,
    previousEventHash: input.previousEventHash, occurredAt: input.occurredAt,
  };
  return {
    eventId: `${input.orderId}:${input.sequence.toString().padStart(10, '0')}`,
    ...input,
    payloadHash,
    eventHash: canonicalHash(eventBody),
  };
}

export function verifyAuditChain(events: readonly AuditEvent[]): boolean {
  let previous: string | null = null;
  const orderId = events[0]?.orderId;
  for (const [sequence, event] of events.entries()) {
    if (
      event.orderId !== orderId ||
      event.sequence !== sequence ||
      event.eventId !== `${event.orderId}:${sequence.toString().padStart(10, '0')}` ||
      event.previousEventHash !== previous
    ) return false;
    const rebuilt = buildAuditEvent({
      orderId: event.orderId, sequence: event.sequence, eventType: event.eventType, actor: event.actor,
      fromState: event.fromState, toState: event.toState, payload: event.payload,
      previousEventHash: event.previousEventHash, occurredAt: event.occurredAt,
    });
    if (rebuilt.payloadHash !== event.payloadHash || rebuilt.eventHash !== event.eventHash) return false;
    previous = event.eventHash;
  }
  return true;
}
