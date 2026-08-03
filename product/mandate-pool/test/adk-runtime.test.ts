import {describe, expect, it, vi} from 'vitest';

import {CachedVertexReadiness} from '../src/agents/vertex-readiness.js';

const runtimeOptions = {
  model: 'gemini-2.5-flash',
  projectId: 'mandate-pool-test-project',
  location: 'global',
} as const;

describe('Google ADK Vertex readiness', () => {
  it('fails closed when Vertex access cannot be verified', async () => {
    const runtime = new CachedVertexReadiness({
      ...runtimeOptions,
      probe: async () => {
        throw new Error('permission denied');
      },
    });

    await expect(runtime.check()).resolves.toBe(false);
  });

  it('coalesces concurrent probes and caches a successful result', async () => {
    let now = 1_000;
    const readinessProbe = vi.fn(async () => undefined);
    const runtime = new CachedVertexReadiness({
      ...runtimeOptions,
      probe: readinessProbe,
      cacheMs: 500,
      clockMs: () => now,
    });

    await expect(Promise.all([runtime.check(), runtime.check()])).resolves.toEqual([
      true,
      true,
    ]);
    expect(readinessProbe).toHaveBeenCalledTimes(1);
    await expect(runtime.check()).resolves.toBe(true);
    expect(readinessProbe).toHaveBeenCalledTimes(1);

    now += 501;
    await expect(runtime.check()).resolves.toBe(true);
    expect(readinessProbe).toHaveBeenCalledTimes(2);
  });
});
