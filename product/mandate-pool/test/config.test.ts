import {describe, expect, it} from 'vitest';

import {loadConfig} from '../src/config.js';

describe('configuration safety', () => {
  const liveEnvironment = (): NodeJS.ProcessEnv => ({
    APP_MODE: 'live',
    DEMO_KEY: 'd'.repeat(32),
    ENTITLEMENT_SECRET: 'e'.repeat(32),
    GOOGLE_GENAI_USE_VERTEXAI: 'TRUE',
    GOOGLE_CLOUD_PROJECT: 'mandate-pool-test',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    MERCHANT_OWNER: 'merchant-owner-placeholder',
    MERCHANT_USDC_ATA: 'merchant-ata-placeholder',
    SPONSOR_SECRET_KEY: 'sponsor-placeholder',
    BUYER_A_SECRET_KEY: 'buyer-a-placeholder',
    BUYER_B_SECRET_KEY: 'buyer-b-placeholder',
    BUYER_C_SECRET_KEY: 'buyer-c-placeholder',
  });

  it('defaults to an explicitly labeled local fixture', () => {
    const config = loadConfig({});
    expect(config.mode).toBe('fixture');
    expect(config.demoKey).toBe('local-demo-key-1234');
  });

  it('refuses live mode without keys and endpoints', () => {
    expect(() =>
      loadConfig({APP_MODE: 'live', DEMO_KEY: 'x'.repeat(24)}),
    ).toThrow(/Missing live configuration/);
  });

  it('refuses a weak live mutation key', () => {
    expect(() => loadConfig({APP_MODE: 'live', DEMO_KEY: 'short'})).toThrow(
      /at least 24/,
    );
  });

  it('refuses plaintext HTTP RPC endpoints in live mode', () => {
    expect(() =>
      loadConfig({...liveEnvironment(), SOLANA_RPC_URL: 'http://api.devnet.solana.com'}),
    ).toThrow(/must use HTTPS/);
  });

  it('accepts distinct prior entitlement keys and rejects the active key in that keyring', () => {
    const prior = 'p'.repeat(32);
    const config = loadConfig({
      ...liveEnvironment(),
      ENTITLEMENT_PREVIOUS_SECRETS: prior,
    });
    expect(config.entitlementPreviousSecrets).toEqual([prior]);
    expect(() => loadConfig({
      ...liveEnvironment(),
      ENTITLEMENT_PREVIOUS_SECRETS: 'e'.repeat(32),
    })).toThrow(/must not appear/);
  });
});
