import {DEVNET_USDC_MINT} from './domain/catalog.js';

export interface BaseAppConfig {
  readonly port: number;
  readonly demoKey: string;
  readonly publicDir: string;
  readonly entitlementSecret: string;
  readonly entitlementPreviousSecrets: readonly string[];
}

export interface FixtureAppConfig extends BaseAppConfig {
  readonly mode: 'fixture';
}

export interface LiveAppConfig extends BaseAppConfig {
  readonly mode: 'live';
  readonly gcpProjectId: string;
  readonly vertexLocation: string;
  readonly geminiModel: string;
  readonly firestoreDatabaseId: string;
  readonly firestoreNamespace: string;
  readonly solanaRpcUrl: string;
  readonly usdcMint: typeof DEVNET_USDC_MINT;
  readonly merchantOwner: string;
  readonly merchantAta: string;
  readonly sponsorSecretKey: string;
  readonly buyerSecretKeys: Readonly<Record<'A' | 'B' | 'C', string>>;
}

export type AppConfig = FixtureAppConfig | LiveAppConfig;

function optional(env: NodeJS.ProcessEnv, name: string): string | null {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? null : value;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '8080');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  return port;
}

function assertSecretLength(value: string, name: string, minimum: number): void {
  if (value.length < minimum) {
    throw new Error(`${name} must contain at least ${minimum} characters`);
  }
}

function previousEntitlementSecrets(env: NodeJS.ProcessEnv): readonly string[] {
  const value = optional(env, 'ENTITLEMENT_PREVIOUS_SECRETS');
  if (value === null) return [];
  const secrets = value.split(',').map((secret) => secret.trim()).filter(Boolean);
  if (new Set(secrets).size !== secrets.length) {
    throw new Error('ENTITLEMENT_PREVIOUS_SECRETS must not contain duplicates');
  }
  return secrets;
}

function assertRpcUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SOLANA_RPC_URL must be an absolute HTTP(S) URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Live SOLANA_RPC_URL must use HTTPS');
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('SOLANA_RPC_URL must not contain URL userinfo credentials');
  }
}

function requiredLiveValues(env: NodeJS.ProcessEnv): Record<string, string> {
  const names = [
    'GOOGLE_CLOUD_PROJECT',
    'SOLANA_RPC_URL',
    'MERCHANT_OWNER',
    'MERCHANT_USDC_ATA',
    'ENTITLEMENT_SECRET',
    'SPONSOR_SECRET_KEY',
    'BUYER_A_SECRET_KEY',
    'BUYER_B_SECRET_KEY',
    'BUYER_C_SECRET_KEY',
  ] as const;
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = optional(env, name);
    if (value === null) missing.push(name);
    else values[name] = value;
  }
  if (missing.length > 0) {
    throw new Error(`Missing live configuration: ${missing.join(', ')}`);
  }
  return values;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const modeValue = env['APP_MODE']?.trim() ?? 'fixture';
  if (modeValue !== 'fixture' && modeValue !== 'live') {
    throw new Error('APP_MODE must be fixture or live');
  }

  const common = {
    port: parsePort(env['PORT']),
    demoKey: optional(env, 'DEMO_KEY') ?? 'local-demo-key-1234',
    publicDir: optional(env, 'PUBLIC_DIR') ?? 'public',
    entitlementSecret:
      optional(env, 'ENTITLEMENT_SECRET') ??
      'fixture-only-entitlement-secret-not-for-production',
    entitlementPreviousSecrets: previousEntitlementSecrets(env),
  } satisfies BaseAppConfig;

  if (modeValue === 'fixture') {
    assertSecretLength(common.demoKey, 'DEMO_KEY', 16);
    assertSecretLength(common.entitlementSecret, 'ENTITLEMENT_SECRET', 24);
    common.entitlementPreviousSecrets.forEach((secret, index) =>
      assertSecretLength(secret, `ENTITLEMENT_PREVIOUS_SECRETS[${index}]`, 24),
    );
    return {mode: 'fixture', ...common};
  }

  assertSecretLength(common.demoKey, 'Live DEMO_KEY', 24);
  const values = requiredLiveValues(env);
  const entitlementSecret = values['ENTITLEMENT_SECRET'] as string;
  assertSecretLength(entitlementSecret, 'Live ENTITLEMENT_SECRET', 32);
  common.entitlementPreviousSecrets.forEach((secret, index) =>
    assertSecretLength(secret, `ENTITLEMENT_PREVIOUS_SECRETS[${index}]`, 32),
  );
  if (common.entitlementPreviousSecrets.includes(entitlementSecret)) {
    throw new Error('Active ENTITLEMENT_SECRET must not appear in the previous keyring');
  }
  if (entitlementSecret === common.demoKey) {
    throw new Error('ENTITLEMENT_SECRET must differ from DEMO_KEY');
  }
  if ((optional(env, 'GOOGLE_GENAI_USE_VERTEXAI') ?? '').toUpperCase() !== 'TRUE') {
    throw new Error('Live mode requires GOOGLE_GENAI_USE_VERTEXAI=TRUE');
  }
  if ((optional(env, 'SOLANA_CLUSTER') ?? 'devnet') !== 'devnet') {
    throw new Error('Live mode is locked to SOLANA_CLUSTER=devnet');
  }
  const configuredMint = optional(env, 'SOLANA_USDC_MINT') ?? DEVNET_USDC_MINT;
  if (configuredMint !== DEVNET_USDC_MINT) {
    throw new Error('Live mode permits only Circle Solana Devnet USDC');
  }
  const solanaRpcUrl = values['SOLANA_RPC_URL'] as string;
  assertRpcUrl(solanaRpcUrl);
  const firestoreNamespace = optional(env, 'FIRESTORE_NAMESPACE') ?? 'v0';
  if (!/^[A-Za-z0-9._:-]{1,160}$/u.test(firestoreNamespace)) {
    throw new Error('FIRESTORE_NAMESPACE must be a 1-160 character safe identifier');
  }

  return {
    mode: 'live',
    ...common,
    entitlementSecret,
    gcpProjectId: values['GOOGLE_CLOUD_PROJECT'] as string,
    vertexLocation: optional(env, 'GOOGLE_CLOUD_LOCATION') ?? 'global',
    geminiModel: optional(env, 'GEMINI_MODEL') ?? 'gemini-2.5-flash',
    firestoreDatabaseId: optional(env, 'FIRESTORE_DATABASE_ID') ?? '(default)',
    firestoreNamespace,
    solanaRpcUrl,
    usdcMint: DEVNET_USDC_MINT,
    merchantOwner: values['MERCHANT_OWNER'] as string,
    merchantAta: values['MERCHANT_USDC_ATA'] as string,
    sponsorSecretKey: values['SPONSOR_SECRET_KEY'] as string,
    buyerSecretKeys: {
      A: values['BUYER_A_SECRET_KEY'] as string,
      B: values['BUYER_B_SECRET_KEY'] as string,
      C: values['BUYER_C_SECRET_KEY'] as string,
    },
  };
}
