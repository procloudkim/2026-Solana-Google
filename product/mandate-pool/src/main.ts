import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {serve} from '@hono/node-server';
import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
} from '@solana-program/token';
import {address, createSolanaRpc, type Address} from '@solana/kit';

import {FixtureAgentRuntime} from './agents/fixture-runtime.js';
import {loadConfig, type AppConfig, type LiveAppConfig} from './config.js';
import {
  DEMO_ADDRESSES,
  SIGNAL_DESK_CATALOG,
  USDC_DECIMALS,
  parseAtomicAmount,
  splitAtomicAmount,
  type CatalogSkuV1,
} from './domain/index.js';
import {createHttpApp} from './http/index.js';
import {InMemoryWorkflowRepository} from './persistence/in-memory-repository.js';
import {
  DEVNET_GENESIS_HASH,
  signerFromSecret,
  type SettlementSignerSet,
} from './runtime/solana-kit.js';
import {MandatePoolService, type BuyerIdentity} from './service/mandate-pool-service.js';
import {
  FixtureSettlementRuntime,
  LiveSolanaSettlementRuntime,
} from './service/settlement-runtime.js';

const MINIMUM_BUYER_BALANCE_ATOMIC = SIGNAL_DESK_CATALOG
  .flatMap((sku) => splitAtomicAmount(sku.totalAmountAtomic, 3))
  .reduce((maximum, amount) => {
    const value = parseAtomicAmount(amount);
    return value > maximum ? value : maximum;
  }, 0n);
const MINIMUM_SPONSOR_LAMPORTS = 50_000n;

interface ApplicationComposition {
  readonly mode: AppConfig['mode'];
  readonly service: MandatePoolService;
  close(): Promise<void>;
}

async function deriveClassicTokenAta(owner: string, mint: string): Promise<Address> {
  const [associatedTokenAddress] = await findAssociatedTokenPda({
    owner: address(owner),
    mint: address(mint),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return associatedTokenAddress;
}

function fixtureBuyerIdentities(): Readonly<Record<'A' | 'B' | 'C', BuyerIdentity>> {
  return {
    A: {signerAddress: DEMO_ADDRESSES.buyerA, sourceAta: DEMO_ADDRESSES.sourceAtaA},
    B: {signerAddress: DEMO_ADDRESSES.buyerB, sourceAta: DEMO_ADDRESSES.sourceAtaB},
    C: {signerAddress: DEMO_ADDRESSES.buyerC, sourceAta: DEMO_ADDRESSES.sourceAtaC},
  };
}

function createFixtureComposition(config: AppConfig & {readonly mode: 'fixture'}): ApplicationComposition {
  return {
    mode: 'fixture',
    service: new MandatePoolService({
      repository: new InMemoryWorkflowRepository(),
      agentRuntime: new FixtureAgentRuntime(),
      settlementRuntime: new FixtureSettlementRuntime(DEMO_ADDRESSES.sponsor),
      catalog: SIGNAL_DESK_CATALOG,
      buyerIdentities: fixtureBuyerIdentities(),
      entitlementSecret: config.entitlementSecret,
      entitlementPreviousSecrets: config.entitlementPreviousSecrets,
    }),
    async close(): Promise<void> {},
  };
}

async function loadSignerSet(config: LiveAppConfig): Promise<SettlementSignerSet> {
  const [sponsor, buyerA, buyerB, buyerC] = await Promise.all([
    signerFromSecret(config.sponsorSecretKey),
    signerFromSecret(config.buyerSecretKeys.A),
    signerFromSecret(config.buyerSecretKeys.B),
    signerFromSecret(config.buyerSecretKeys.C),
  ]);
  const addresses = [sponsor.address, buyerA.address, buyerB.address, buyerC.address];
  if (new Set(addresses).size !== addresses.length) {
    throw new Error('Sponsor and buyer signer keys must resolve to four distinct addresses');
  }
  return {sponsor, buyers: {A: buyerA, B: buyerB, C: buyerC}};
}

async function validateClassicTokenAccount(
  rpc: ReturnType<typeof createSolanaRpc>,
  tokenAddress: Address,
  expectedOwner: Address,
  expectedMint: Address,
  minimumBalance: bigint,
  label: string,
): Promise<void> {
  const account = await fetchToken(rpc, tokenAddress, {commitment: 'finalized'});
  if (account.programAddress !== TOKEN_PROGRAM_ADDRESS) {
    throw new Error(`${label} is not owned by the classic SPL Token program`);
  }
  if (account.data.owner !== expectedOwner || account.data.mint !== expectedMint) {
    throw new Error(`${label} owner or mint does not match its derived ATA intent`);
  }
  if (account.data.state !== AccountState.Initialized) {
    throw new Error(`${label} must be an initialized, unfrozen token account`);
  }
  if (account.data.amount < minimumBalance) {
    throw new Error(`${label} has insufficient Devnet USDC for the fixed demo`);
  }
}

async function validateLiveSolanaSetup(
  config: LiveAppConfig,
  signers: SettlementSignerSet,
): Promise<Readonly<Record<'A' | 'B' | 'C', BuyerIdentity>>> {
  const rpc = createSolanaRpc(config.solanaRpcUrl);
  const genesisHash = await rpc.getGenesisHash().send();
  if (String(genesisHash) !== DEVNET_GENESIS_HASH) {
    throw new Error('SOLANA_RPC_URL is not connected to Solana Devnet');
  }

  const mint = address(config.usdcMint);
  const mintAccount = await fetchMint(rpc, mint, {commitment: 'finalized'});
  if (
    mintAccount.programAddress !== TOKEN_PROGRAM_ADDRESS ||
    !mintAccount.data.isInitialized ||
    mintAccount.data.decimals !== USDC_DECIMALS
  ) {
    throw new Error('Configured USDC mint is not an initialized classic-token 6-decimal mint');
  }

  const merchantOwner = address(config.merchantOwner);
  const configuredMerchantAta = address(config.merchantAta);
  const derivedMerchantAta = await deriveClassicTokenAta(merchantOwner, mint);
  if (configuredMerchantAta !== derivedMerchantAta) {
    throw new Error('MERCHANT_USDC_ATA is not the classic-token ATA derived from MERCHANT_OWNER');
  }

  const buyerAddresses = {
    A: signers.buyers.A.address,
    B: signers.buyers.B.address,
    C: signers.buyers.C.address,
  } as const;
  const buyerAtas = {
    A: await deriveClassicTokenAta(buyerAddresses.A, mint),
    B: await deriveClassicTokenAta(buyerAddresses.B, mint),
    C: await deriveClassicTokenAta(buyerAddresses.C, mint),
  } as const;

  await Promise.all([
    validateClassicTokenAccount(
      rpc,
      configuredMerchantAta,
      merchantOwner,
      mint,
      0n,
      'Merchant USDC ATA',
    ),
    ...(['A', 'B', 'C'] as const).map((buyerId) =>
      validateClassicTokenAccount(
        rpc,
        buyerAtas[buyerId],
        buyerAddresses[buyerId],
        mint,
        MINIMUM_BUYER_BALANCE_ATOMIC,
        `Buyer ${buyerId} USDC ATA`,
      ),
    ),
  ]);

  const sponsorBalance = await rpc
    .getBalance(signers.sponsor.address, {commitment: 'finalized'})
    .send();
  if (sponsorBalance.value < MINIMUM_SPONSOR_LAMPORTS) {
    throw new Error('Fee sponsor has insufficient Devnet SOL for a four-signer transaction');
  }

  return {
    A: {signerAddress: buyerAddresses.A, sourceAta: buyerAtas.A},
    B: {signerAddress: buyerAddresses.B, sourceAta: buyerAtas.B},
    C: {signerAddress: buyerAddresses.C, sourceAta: buyerAtas.C},
  };
}

function liveCatalog(config: LiveAppConfig): readonly CatalogSkuV1[] {
  return SIGNAL_DESK_CATALOG.map((sku) => ({
    ...sku,
    merchantOwner: config.merchantOwner,
    merchantUsdcAta: config.merchantAta,
    mint: config.usdcMint,
  }));
}

async function createLiveComposition(config: LiveAppConfig): Promise<ApplicationComposition> {
  const [{Firestore}, {GoogleAdkAgentRuntime}, {FirestoreWorkflowRepository}] =
    await Promise.all([
      import('@google-cloud/firestore'),
      import('./agents/adk-runtime.js'),
      import('./persistence/firestore-repository.js'),
    ]);
  const signers = await loadSignerSet(config);
  const buyerIdentities = await validateLiveSolanaSetup(config, signers);
  // ADK reads Vertex routing from the process environment. Keep this explicit
  // when composition is invoked programmatically instead of through loadConfig.
  process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'TRUE';
  process.env['GOOGLE_CLOUD_PROJECT'] = config.gcpProjectId;
  process.env['GOOGLE_CLOUD_LOCATION'] = config.vertexLocation;
  const firestore = new Firestore({
    projectId: config.gcpProjectId,
    databaseId: config.firestoreDatabaseId,
    ignoreUndefinedProperties: false,
  });
  try {
    // Validate ADC, IAM, project, and database before accepting HTTP traffic.
    await firestore
      .collection('mandatePoolRuntime')
      .doc(config.firestoreNamespace)
      .collection('orders')
      .limit(1)
      .get();
    const repository = new FirestoreWorkflowRepository(firestore, {
      namespace: config.firestoreNamespace,
    });
    const agentRuntime = new GoogleAdkAgentRuntime({
      model: config.geminiModel,
      projectId: config.gcpProjectId,
      location: config.vertexLocation,
    });
    if (!(await agentRuntime.readiness())) {
      throw new Error(
        'Vertex AI credentials, IAM, location, API, or Gemini model failed the countTokens readiness probe',
      );
    }
    return {
      mode: 'live',
      service: new MandatePoolService({
        repository,
        agentRuntime,
        settlementRuntime: new LiveSolanaSettlementRuntime(config.solanaRpcUrl, signers),
        catalog: liveCatalog(config),
        buyerIdentities,
        entitlementSecret: config.entitlementSecret,
        entitlementPreviousSecrets: config.entitlementPreviousSecrets,
      }),
      async close(): Promise<void> {
        await firestore.terminate();
      },
    };
  } catch (error) {
    await firestore.terminate();
    throw error;
  }
}

export async function composeApplication(config: AppConfig): Promise<ApplicationComposition> {
  return config.mode === 'fixture'
    ? createFixtureComposition(config)
    : createLiveComposition(config);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown startup failure';
}

export async function startServer(config: AppConfig = loadConfig()): Promise<void> {
  const composition = await composeApplication(config);
  const app = createHttpApp(composition.service, {
    demoKey: config.demoKey,
    settlementMode: composition.mode,
    staticRoot: config.publicDir,
  });
  const fetchHandler =
    composition.mode === 'fixture'
      ? async (request: Request): Promise<Response> => {
          const response = await app.fetch(request);
          const headers = new Headers(response.headers);
          headers.set('X-Mandate-Pool-Settlement', 'FIXTURE-NOT-ON-CHAIN');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        }
      : app.fetch;

  let shuttingDown = false;
  const server = serve(
    {fetch: fetchHandler, hostname: '0.0.0.0', port: config.port},
    ({port}) => {
      if (composition.mode === 'fixture') {
        console.warn('FIXTURE MODE — NOT ON-CHAIN — deterministic local simulation only');
      } else {
        console.info('LIVE MODE — SOLANA DEVNET — finalized settlement required');
      }
      console.info(`Mandate Pool listening on port ${port}`);
    },
  );

  server.once('error', (error) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`HTTP server failed: ${error.message}`);
    process.exitCode = 1;
    void composition.close().catch((closeError: unknown) => {
      console.error(`Resource shutdown failed: ${errorMessage(closeError)}`);
    });
  });

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`Received ${signal}; closing Mandate Pool`);
    server.close((error) => {
      void composition.close().then(
        () => {
          if (error !== undefined) {
            console.error(`HTTP shutdown failed: ${error.message}`);
            process.exitCode = 1;
          }
        },
        (closeError: unknown) => {
          console.error(`Resource shutdown failed: ${errorMessage(closeError)}`);
          process.exitCode = 1;
        },
      );
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

const entryPath = process.argv[1];
if (entryPath !== undefined && resolve(entryPath) === fileURLToPath(import.meta.url)) {
  void startServer().catch((error: unknown) => {
    console.error(`Mandate Pool startup aborted: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
