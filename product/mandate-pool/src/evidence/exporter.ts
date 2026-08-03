import type {OrderSnapshotView} from '../http/contracts.js';

const EXPORT_SCHEMA = 'mandate-pool/evidence-export@1' as const;
const REJECT_STATES = new Set(['NO_BUY', 'POLICY_REJECTED']);

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface EvidenceExporterOptions {
  readonly baseUrl: string;
  /** Cloud Run identity token. It is sent as a header and never included in output. */
  readonly identityToken?: string;
  readonly fetcher?: FetchLike;
  readonly now?: () => Date;
}

export interface ReadOnlyResponseEvidence {
  readonly path: string;
  readonly status: number;
  readonly body: unknown;
}

export interface PreflightEvidenceExport {
  readonly schema: typeof EXPORT_SCHEMA;
  readonly kind: 'preflight';
  readonly verdict: 'PASS';
  readonly exportedAt: string;
  readonly baseUrl: string;
  readonly responses: {
    readonly health: ReadOnlyResponseEvidence;
    readonly readiness: ReadOnlyResponseEvidence;
    readonly runtime: ReadOnlyResponseEvidence;
  };
}

export interface OrderEvidenceExport {
  readonly schema: typeof EXPORT_SCHEMA;
  readonly kind: 'order';
  readonly expectation: 'normal' | 'reject';
  readonly verdict: 'PASS';
  readonly exportedAt: string;
  readonly baseUrl: string;
  readonly orderId: string;
  readonly response: ReadOnlyResponseEvidence;
  readonly order: OrderSnapshotView;
}

export class EvidenceExportError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'EvidenceExportError';
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EvidenceExportError(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  label: string,
  pattern?: RegExp,
): string {
  if (typeof value !== 'string' || value.length === 0 || (pattern !== undefined && !pattern.test(value))) {
    throw new EvidenceExportError(`${label} is missing or invalid`);
  }
  return value;
}

function canonicalAtomic(value: unknown, label: string): bigint {
  const amount = requiredString(value, label, /^(?:0|[1-9][0-9]*)$/u);
  return BigInt(amount);
}

function normalizedBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EvidenceExportError('Evidence base URL must be absolute');
  }
  if (
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    throw new EvidenceExportError(
      'Evidence base URL must be an origin without credentials, query, fragment, or path',
    );
  }
  const localHost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost)) {
    throw new EvidenceExportError(
      'Evidence base URL must use HTTPS, except for localhost',
    );
  }
  return url.origin;
}

function authorizationHeaders(identityToken: string | undefined): Headers {
  const headers = new Headers({Accept: 'application/json'});
  if (identityToken === undefined || identityToken.trim() === '') return headers;
  const token = identityToken.trim();
  if (/\s/u.test(token)) {
    throw new EvidenceExportError('EVIDENCE_ID_TOKEN must not contain whitespace');
  }
  headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function readOnlyGet(
  baseUrl: string,
  path: string,
  identityToken: string | undefined,
  fetcher: FetchLike,
): Promise<ReadOnlyResponseEvidence> {
  const url = new URL(path, `${baseUrl}/`);
  if (url.origin !== baseUrl || url.pathname !== path) {
    throw new EvidenceExportError(`Evidence path escaped the configured origin: ${path}`);
  }
  const response = await fetcher(url, {
    method: 'GET',
    headers: authorizationHeaders(identityToken),
    redirect: 'error',
  });
  const raw = await response.text();
  let body: unknown = null;
  if (raw !== '') {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new EvidenceExportError(`${path} did not return JSON`);
    }
  }
  if (!response.ok) {
    throw new EvidenceExportError(`${path} returned HTTP ${response.status}`);
  }
  return {path, status: response.status, body};
}

function exporterContext(options: EvidenceExporterOptions): {
  readonly baseUrl: string;
  readonly fetcher: FetchLike;
  readonly exportedAt: string;
} {
  return {
    baseUrl: normalizedBaseUrl(options.baseUrl),
    fetcher: options.fetcher ?? fetch,
    exportedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
}

export async function exportPreflightEvidence(
  options: EvidenceExporterOptions,
): Promise<PreflightEvidenceExport> {
  const context = exporterContext(options);
  const [health, readiness, runtime] = await Promise.all([
    readOnlyGet(
      context.baseUrl,
      '/health',
      options.identityToken,
      context.fetcher,
    ),
    readOnlyGet(
      context.baseUrl,
      '/readyz',
      options.identityToken,
      context.fetcher,
    ),
    readOnlyGet(
      context.baseUrl,
      '/api/v1/runtime',
      options.identityToken,
      context.fetcher,
    ),
  ]);
  const healthBody = record(health.body, 'Health response');
  const readinessBody = record(readiness.body, 'Readiness response');
  const runtimeBody = record(runtime.body, 'Runtime response');
  if (healthBody['ok'] !== true) {
    throw new EvidenceExportError('Health response is not ok');
  }
  if (readinessBody['ready'] !== true) {
    throw new EvidenceExportError('Readiness response is not ready');
  }
  const mode = runtimeBody['mode'];
  if (mode !== 'fixture' && mode !== 'live') {
    throw new EvidenceExportError('Runtime response has an unknown mode');
  }
  if (runtimeBody['onChain'] !== (mode === 'live')) {
    throw new EvidenceExportError('Runtime mode and onChain label disagree');
  }
  return {
    schema: EXPORT_SCHEMA,
    kind: 'preflight',
    verdict: 'PASS',
    exportedAt: context.exportedAt,
    baseUrl: context.baseUrl,
    responses: {health, readiness, runtime},
  };
}

function validateAgent(order: Record<string, unknown>): void {
  const agent = record(order['agent'], 'Order agent evidence');
  if (agent['provider'] !== 'fixture' && agent['provider'] !== 'google-adk') {
    throw new EvidenceExportError('Order agent provider is invalid');
  }
  requiredString(agent['model'], 'Order agent model');
  requiredString(agent['startedAt'], 'Order agent start timestamp');
  requiredString(agent['completedAt'], 'Order agent completion timestamp');
  requiredString(agent['selectedSkuId'], 'Order agent selected SKU');
}

function validateNormalOrder(order: Record<string, unknown>): void {
  if (order['state'] !== 'FULFILLED' || order['entitlementCount'] !== 3) {
    throw new EvidenceExportError(
      'Normal evidence requires a FULFILLED order with three entitlements',
    );
  }
  const selection = record(order['selection'], 'Normal order selection');
  const agent = record(order['agent'], 'Normal order agent evidence');
  if (
    requiredString(selection['skuId'], 'Normal order selected SKU') !==
      requiredString(agent['selectedSkuId'], 'Normal agent selected SKU') ||
    agent['selectedSkuId'] === 'NO_BUY'
  ) {
    throw new EvidenceExportError('Normal order SKU does not match the agent trace');
  }
  if (selection['totalAmountAtomic'] !== '1000000') {
    throw new EvidenceExportError('Normal order total must be exactly 1000000 atomic units');
  }
  const expectedDebits = {
    A: '333334',
    B: '333333',
    C: '333333',
  } as const;
  if (!Array.isArray(selection['allocations']) || selection['allocations'].length !== 3) {
    throw new EvidenceExportError('Normal order requires exactly three allocations');
  }
  selection['allocations'].forEach((value, index) => {
    const allocation = record(value, `Normal allocation ${index}`);
    const buyerId = ['A', 'B', 'C'][index];
    if (
      allocation['buyerId'] !== buyerId ||
      allocation['amountAtomic'] !== expectedDebits[buyerId as keyof typeof expectedDebits]
    ) {
      throw new EvidenceExportError('Normal allocations must be the canonical A/B/C split');
    }
  });
  const evidence = record(order['evidence'], 'Normal settlement evidence');
  if (
    evidence['cluster'] !== 'solana-devnet' ||
    evidence['commitment'] !== 'finalized' ||
    evidence['metaError'] !== null
  ) {
    throw new EvidenceExportError(
      'Normal evidence requires independently verified finalized Devnet settlement',
    );
  }
  requiredString(evidence['txSignature'], 'Transaction signature');
  requiredString(evidence['quoteHash'], 'Quote hash', /^[a-f0-9]{64}$/u);
  requiredString(
    evidence['policyProofHash'],
    'Policy proof hash',
    /^[a-f0-9]{64}$/u,
  );
  requiredString(evidence['messageHash'], 'Message hash', /^[a-f0-9]{64}$/u);
  if (evidence['transferCount'] !== 3 || evidence['requiredSignerCount'] !== 4) {
    throw new EvidenceExportError(
      'Normal evidence requires three transfers and four required signers',
    );
  }
  requiredString(evidence['slot'], 'Finalized slot', /^[1-9][0-9]*$/u);
  requiredString(
    evidence['rawTransactionHash'],
    'Finalized raw transaction hash',
    /^[a-f0-9]{64}$/u,
  );
  requiredString(evidence['mint'], 'Verified mint');

  if (!Array.isArray(evidence['sourceDebits']) || evidence['sourceDebits'].length !== 3) {
    throw new EvidenceExportError('Normal evidence requires three verified source debits');
  }
  const buyers = new Set<string>();
  let totalDebit = 0n;
  for (const [index, value] of evidence['sourceDebits'].entries()) {
    const debit = record(value, `Source debit ${index}`);
    const buyerId = requiredString(debit['buyerId'], `Source debit ${index} buyer`);
    if (!['A', 'B', 'C'].includes(buyerId) || buyers.has(buyerId)) {
      throw new EvidenceExportError('Verified source debits must contain A, B, and C once');
    }
    buyers.add(buyerId);
    requiredString(debit['sourceAta'], `Source debit ${buyerId} ATA`);
    const before = canonicalAtomic(debit['preAmountAtomic'], `Source debit ${buyerId} pre`);
    const after = canonicalAtomic(debit['postAmountAtomic'], `Source debit ${buyerId} post`);
    const amount = canonicalAtomic(debit['debitAtomic'], `Source debit ${buyerId} amount`);
    if (
      before - after !== amount ||
      amount.toString() !== expectedDebits[buyerId as keyof typeof expectedDebits]
    ) {
      throw new EvidenceExportError(`Source debit ${buyerId} balance delta is invalid`);
    }
    totalDebit += amount;
  }
  requiredString(evidence['destinationAta'], 'Destination ATA');
  const destinationBefore = canonicalAtomic(
    evidence['destinationPreAmountAtomic'],
    'Destination pre-balance',
  );
  const destinationAfter = canonicalAtomic(
    evidence['destinationPostAmountAtomic'],
    'Destination post-balance',
  );
  const destinationCredit = canonicalAtomic(
    evidence['destinationCreditAtomic'],
    'Destination credit',
  );
  if (
    destinationAfter - destinationBefore !== destinationCredit ||
    destinationCredit !== totalDebit ||
    destinationCredit !== 1_000_000n
  ) {
    throw new EvidenceExportError('Destination credit does not equal the verified source debits');
  }
}

function validateRejectedOrder(order: Record<string, unknown>): void {
  if (!REJECT_STATES.has(String(order['state']))) {
    throw new EvidenceExportError(
      'Reject evidence requires a NO_BUY or POLICY_REJECTED order',
    );
  }
  if (order['entitlementCount'] !== 0 || order['evidence'] !== undefined) {
    throw new EvidenceExportError(
      'Reject evidence must have no settlement evidence or entitlements',
    );
  }
  const failure = record(order['failure'], 'Rejected order failure');
  requiredString(failure['code'], 'Rejected order failure code');
  requiredString(failure['message'], 'Rejected order failure message');
}

export async function exportOrderEvidence(
  expectation: 'normal' | 'reject',
  orderId: string,
  options: EvidenceExporterOptions,
): Promise<OrderEvidenceExport> {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(orderId)) {
    throw new EvidenceExportError('Order ID is invalid');
  }
  const context = exporterContext(options);
  const path = `/api/v1/orders/${encodeURIComponent(orderId)}`;
  const response = await readOnlyGet(
    context.baseUrl,
    path,
    options.identityToken,
    context.fetcher,
  );
  const order = record(response.body, 'Order response');
  if (order['orderId'] !== orderId) {
    throw new EvidenceExportError('Order response ID does not match the requested ID');
  }
  validateAgent(order);
  if (expectation === 'normal') validateNormalOrder(order);
  else validateRejectedOrder(order);
  return {
    schema: EXPORT_SCHEMA,
    kind: 'order',
    expectation,
    verdict: 'PASS',
    exportedAt: context.exportedAt,
    baseUrl: context.baseUrl,
    orderId,
    response,
    order: order as unknown as OrderSnapshotView,
  };
}
