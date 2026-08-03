import {describe, expect, it, vi} from 'vitest';

import {parseEvidenceCommand} from '../src/cli/evidence-export.js';
import {
  exportOrderEvidence,
  exportPreflightEvidence,
} from '../src/evidence/exporter.js';

const EXPORTED_AT = new Date('2026-08-03T13:00:00.000Z');
const ORDER_ID = 'ord_0123456789abcdef';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function normalOrder(): Record<string, unknown> {
  return {
    orderId: ORDER_ID,
    state: 'FULFILLED',
    version: 12,
    createdAt: '2026-08-03T12:00:00.000Z',
    updatedAt: '2026-08-03T12:01:00.000Z',
    agent: {
      provider: 'google-adk',
      model: 'gemini-2.5-flash',
      startedAt: '2026-08-03T12:00:00.000Z',
      completedAt: '2026-08-03T12:00:02.000Z',
      selectedSkuId: 'signaldesk-team-3',
    },
    mandates: [],
    selection: {
      skuId: 'signaldesk-team-3',
      productName: 'SignalDesk Team-3',
      rationale: 'matched',
      totalAmountAtomic: '1000000',
      allocations: [
        {buyerId: 'A', amountAtomic: '333334'},
        {buyerId: 'B', amountAtomic: '333333'},
        {buyerId: 'C', amountAtomic: '333333'},
      ],
    },
    policyChecks: [],
    timeline: [],
    evidence: {
      cluster: 'solana-devnet',
      txSignature: 'verified-signature',
      explorerUrl: 'https://explorer.solana.com/tx/verified-signature?cluster=devnet',
      quoteHash: 'c'.repeat(64),
      policyProofHash: 'd'.repeat(64),
      messageHash: 'b'.repeat(64),
      transferCount: 3,
      requiredSignerCount: 4,
      commitment: 'finalized',
      metaError: null,
      slot: '480900000',
      rawTransactionHash: 'a'.repeat(64),
      mint: 'devnet-mint',
      sourceDebits: [
        {
          buyerId: 'A',
          sourceAta: 'source-a',
          preAmountAtomic: '1000000',
          postAmountAtomic: '666666',
          debitAtomic: '333334',
        },
        {
          buyerId: 'B',
          sourceAta: 'source-b',
          preAmountAtomic: '1000000',
          postAmountAtomic: '666667',
          debitAtomic: '333333',
        },
        {
          buyerId: 'C',
          sourceAta: 'source-c',
          preAmountAtomic: '1000000',
          postAmountAtomic: '666667',
          debitAtomic: '333333',
        },
      ],
      destinationAta: 'destination',
      destinationPreAmountAtomic: '0',
      destinationPostAmountAtomic: '1000000',
      destinationCreditAtomic: '1000000',
    },
    entitlementCount: 3,
  };
}

describe('read-only evidence exporter', () => {
  it('exports preflight using only allowlisted GET requests without leaking auth', async () => {
    const calls: Array<{url: string; init: RequestInit | undefined}> = [];
    const fetcher = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = String(input);
      calls.push({url, init});
      if (url.endsWith('/health')) return jsonResponse({ok: true});
      if (url.endsWith('/readyz')) {
        return jsonResponse({ready: true, checks: {domain: true}});
      }
      return jsonResponse({mode: 'live', onChain: true, cluster: 'solana-devnet'});
    });

    const output = await exportPreflightEvidence({
      baseUrl: 'https://example.run.app',
      identityToken: 'private-identity-token',
      fetcher,
      now: () => EXPORTED_AT,
    });

    expect(output).toMatchObject({
      kind: 'preflight',
      verdict: 'PASS',
      exportedAt: EXPORTED_AT.toISOString(),
    });
    expect(calls.map((call) => new URL(call.url).pathname).sort()).toEqual([
      '/api/v1/runtime',
      '/health',
      '/readyz',
    ]);
    for (const call of calls) {
      expect(call.init?.method).toBe('GET');
      const headers = new Headers(call.init?.headers);
      expect(headers.get('X-Demo-Key')).toBeNull();
      expect(headers.get('Idempotency-Key')).toBeNull();
      expect(headers.get('Authorization')).toBe(
        'Bearer private-identity-token',
      );
    }
    expect(JSON.stringify(output)).not.toContain('private-identity-token');
  });

  it('exports a normal order only with finalized verifier balance evidence', async () => {
    const fetcher = vi.fn(async (
      _input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      expect(init?.method).toBe('GET');
      return jsonResponse(normalOrder());
    });
    const output = await exportOrderEvidence('normal', ORDER_ID, {
      baseUrl: 'http://localhost:8080',
      fetcher,
      now: () => EXPORTED_AT,
    });

    expect(output).toMatchObject({
      kind: 'order',
      expectation: 'normal',
      verdict: 'PASS',
      orderId: ORDER_ID,
      order: {
        agent: {provider: 'google-adk', selectedSkuId: 'signaldesk-team-3'},
        evidence: {
          slot: '480900000',
          rawTransactionHash: 'a'.repeat(64),
          destinationCreditAtomic: '1000000',
        },
      },
    });
  });

  it('rejects a normal export when finalized verifier output is absent', async () => {
    const order = normalOrder();
    const evidence = order['evidence'] as Record<string, unknown>;
    delete evidence['slot'];
    const fetcher = async (): Promise<Response> => jsonResponse(order);

    await expect(
      exportOrderEvidence('normal', ORDER_ID, {
        baseUrl: 'http://localhost:8080',
        fetcher,
      }),
    ).rejects.toThrow(/Finalized slot/);
  });

  it('exports a reject order only when no settlement evidence or entitlement exists', async () => {
    const rejected = {
      orderId: ORDER_ID,
      state: 'NO_BUY',
      agent: {
        provider: 'fixture',
        model: 'deterministic-fixture-v1',
        startedAt: '2026-08-03T12:00:00.000Z',
        completedAt: '2026-08-03T12:00:00.000Z',
        selectedSkuId: 'NO_BUY',
      },
      entitlementCount: 0,
      failure: {code: 'NO_COMMON_PRODUCT', message: 'B cap is too low'},
    };
    const fetcher = async (): Promise<Response> => jsonResponse(rejected);

    const output = await exportOrderEvidence('reject', ORDER_ID, {
      baseUrl: 'http://127.0.0.1:8080',
      fetcher,
      now: () => EXPORTED_AT,
    });
    expect(output).toMatchObject({
      expectation: 'reject',
      verdict: 'PASS',
      order: {state: 'NO_BUY', entitlementCount: 0},
    });
  });

  it('parses only the preflight and explicit normal/reject order commands', () => {
    expect(
      parseEvidenceCommand(
        ['preflight', '--base-url', 'https://example.run.app'],
        {},
      ),
    ).toEqual({kind: 'preflight', baseUrl: 'https://example.run.app'});
    expect(
      parseEvidenceCommand(
        ['order', 'reject', '--order-id', ORDER_ID],
        {EVIDENCE_BASE_URL: 'https://example.run.app'},
      ),
    ).toEqual({
      kind: 'order',
      expectation: 'reject',
      orderId: ORDER_ID,
      baseUrl: 'https://example.run.app',
    });
    expect(() =>
      parseEvidenceCommand(
        ['order', 'mutate', '--order-id', ORDER_ID],
        {EVIDENCE_BASE_URL: 'https://example.run.app'},
      ),
    ).toThrow(/normal or reject/);
    expect(
      parseEvidenceCommand(
        [
          '--mode=normal',
          '--order-id',
          ORDER_ID,
          '--output',
          'normal.json',
        ],
        {EVIDENCE_BASE_URL: 'https://example.run.app'},
      ),
    ).toEqual({
      kind: 'order',
      expectation: 'normal',
      orderId: ORDER_ID,
      baseUrl: 'https://example.run.app',
      outputPath: 'normal.json',
    });
  });
});
