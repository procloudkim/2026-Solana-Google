import {GoogleGenAI} from '@google/genai';

export interface VertexReadinessOptions {
  readonly model: string;
  readonly projectId: string;
  readonly location: string;
  readonly cacheMs?: number;
  readonly probe?: () => Promise<void>;
  readonly clockMs?: () => number;
}

/**
 * Cached, coalesced Vertex access check. countTokens exercises ADC, IAM, API,
 * location, and model routing without generating model output.
 */
export class CachedVertexReadiness {
  readonly #model: string;
  readonly #projectId: string;
  readonly #location: string;
  readonly #cacheMs: number;
  readonly #probe: () => Promise<void>;
  readonly #clockMs: () => number;
  #cache: {readonly checkedAt: number; readonly ready: boolean} | undefined;
  #inFlight: Promise<boolean> | undefined;

  constructor(options: VertexReadinessOptions) {
    this.#model = options.model;
    this.#projectId = options.projectId;
    this.#location = options.location;
    this.#cacheMs = options.cacheMs ?? 300_000;
    if (!Number.isSafeInteger(this.#cacheMs) || this.#cacheMs < 0) {
      throw new Error('Vertex readiness cache duration must be a non-negative safe integer');
    }
    this.#clockMs = options.clockMs ?? Date.now;
    this.#probe = options.probe ?? (async () => {
      const client = new GoogleGenAI({
        vertexai: true,
        project: this.#projectId,
        location: this.#location,
        apiVersion: 'v1',
        httpOptions: {timeout: 5_000},
      });
      const response = await client.models.countTokens({
        model: this.#model,
        contents: 'mandate-pool-readiness',
        config: {httpOptions: {timeout: 5_000}},
      });
      if (response.totalTokens === undefined || response.totalTokens < 1) {
        throw new Error('Vertex countTokens readiness probe returned no token count');
      }
    });
  }

  async check(): Promise<boolean> {
    if (
      this.#model.trim().length === 0 ||
      this.#projectId.trim().length === 0 ||
      this.#location.trim().length === 0
    ) {
      return false;
    }
    const now = this.#clockMs();
    if (
      this.#cache !== undefined &&
      now >= this.#cache.checkedAt &&
      now - this.#cache.checkedAt < this.#cacheMs
    ) {
      return this.#cache.ready;
    }
    if (this.#inFlight !== undefined) return this.#inFlight;

    const probe = (async (): Promise<boolean> => {
      try {
        await this.#probe();
        this.#cache = {checkedAt: this.#clockMs(), ready: true};
        return true;
      } catch {
        this.#cache = {checkedAt: this.#clockMs(), ready: false};
        return false;
      }
    })();
    this.#inFlight = probe;
    try {
      return await probe;
    } finally {
      this.#inFlight = undefined;
    }
  }
}
