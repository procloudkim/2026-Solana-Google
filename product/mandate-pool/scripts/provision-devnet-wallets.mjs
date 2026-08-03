#!/usr/bin/env node

import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

import {TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda} from '@solana-program/token';
import {
  address,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
} from '@solana/kit';

const DEVNET_USDC_MINT = address('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u;

const walletSpecs = [
  {role: 'sponsor', secret: 'mandate-pool-fee-sponsor', runtime: true},
  {role: 'buyerA', secret: 'mandate-pool-buyer-a', runtime: true},
  {role: 'buyerB', secret: 'mandate-pool-buyer-b', runtime: true},
  {role: 'buyerC', secret: 'mandate-pool-buyer-c', runtime: true},
  {role: 'merchant', secret: 'mandate-pool-merchant', runtime: false},
];

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function powerShellQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runGcloud(gcloudPath, args, input) {
  const command = `& ${powerShellQuote(gcloudPath)} ${args.map(powerShellQuote).join(' ')}`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    input,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `gcloud exited with status ${String(result.status)}`);
  }
  return result.stdout.trim();
}

async function generateWallet(spec) {
  const seed = new Uint8Array(randomBytes(32));
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const publicKey = new Uint8Array(
    await globalThis.crypto.subtle.exportKey('raw', signer.keyPair.publicKey),
  );
  const secretBytes = new Uint8Array(64);
  secretBytes.set(seed, 0);
  secretBytes.set(publicKey, 32);
  seed.fill(0);

  const roundTrip = await createKeyPairSignerFromBytes(secretBytes);
  if (roundTrip.address !== signer.address) {
    secretBytes.fill(0);
    throw new Error(`Generated ${spec.role} key failed address round-trip validation`);
  }

  const [usdcAta] = await findAssociatedTokenPda({
    owner: signer.address,
    mint: DEVNET_USDC_MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return {...spec, address: signer.address, usdcAta, secretBytes};
}

async function verifyStoredWallets(projectId, gcloudPath) {
  const manifest = JSON.parse(
    readFileSync(new URL('../devnet-wallets.public.json', import.meta.url), 'utf8'),
  );
  const verified = [];
  for (const spec of walletSpecs) {
    const payload = runGcloud(gcloudPath, [
      'secrets', 'versions', 'access', '1',
      `--secret=${spec.secret}`,
      `--project=${projectId}`,
    ]).trim();
    const decoded = Buffer.from(payload, 'base64');
    if (decoded.byteLength !== 64 || decoded.toString('base64') !== payload) {
      decoded.fill(0);
      throw new Error(`${spec.secret}:1 is not canonical Base64 for a 64-byte Solana keypair`);
    }
    const signer = await createKeyPairSignerFromBytes(new Uint8Array(decoded));
    const [usdcAta] = await findAssociatedTokenPda({
      owner: signer.address,
      mint: DEVNET_USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    decoded.fill(0);
    const expected = manifest.wallets?.[spec.role];
    if (
      expected?.address !== signer.address ||
      expected?.usdcAta !== undefined && expected.usdcAta !== usdcAta ||
      expected?.secretResource !== spec.secret
    ) {
      throw new Error(`${spec.secret}:1 does not match the public wallet manifest`);
    }
    verified.push({role: spec.role, address: signer.address, usdcAta});
  }
  console.log(JSON.stringify({status: 'verified', network: manifest.network, wallets: verified}, null, 2));
}

async function main() {
  const execute = process.argv.includes('--execute');
  const verify = process.argv.includes('--verify');
  if (execute === verify) {
    throw new Error('Choose exactly one explicit mode: --execute or --verify');
  }
  const projectId = requiredEnvironment('GCP_PROJECT_ID');
  const gcloudPath = requiredEnvironment('GCLOUD_CMD_WINDOWS');
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new Error('GCP_PROJECT_ID is not valid');
  if (/[\r\n]/u.test(gcloudPath)) throw new Error('GCLOUD_CMD_WINDOWS contains a newline');

  if (verify) {
    await verifyStoredWallets(projectId, gcloudPath);
    return;
  }

  for (const spec of walletSpecs) {
    runGcloud(gcloudPath, [
      'secrets', 'describe', spec.secret,
      `--project=${projectId}`,
      '--format=value(name)',
    ]);
    const existingVersion = runGcloud(gcloudPath, [
      'secrets', 'versions', 'list', spec.secret,
      `--project=${projectId}`,
      '--filter=state:ENABLED',
      '--limit=1',
      '--format=value(name)',
    ]);
    if (existingVersion) {
      throw new Error(`Refusing to rotate ${spec.secret}; it already has an enabled version`);
    }
  }

  const wallets = await Promise.all(walletSpecs.map(generateWallet));
  if (new Set(wallets.map((wallet) => wallet.address)).size !== wallets.length) {
    wallets.forEach((wallet) => wallet.secretBytes.fill(0));
    throw new Error('Generated wallet addresses are not distinct');
  }

  const completed = [];
  try {
    for (const wallet of wallets) {
      const payload = Buffer.from(wallet.secretBytes).toString('base64');
      runGcloud(
        gcloudPath,
        [
          'secrets', 'versions', 'add', wallet.secret,
          '--data-file=-',
          `--project=${projectId}`,
          '--quiet',
        ],
        payload,
      );
      wallet.secretBytes.fill(0);
      completed.push({
        role: wallet.role,
        address: wallet.address,
        usdcAta: wallet.usdcAta,
        secret: wallet.secret,
        secretVersion: '1',
        runtimeAccessRequired: wallet.runtime,
      });
    }
  } catch (error) {
    wallets.forEach((wallet) => wallet.secretBytes.fill(0));
    console.error(JSON.stringify({status: 'partial', wallets: completed}, null, 2));
    throw error;
  }

  console.log(JSON.stringify({
    status: 'created',
    network: 'solana-devnet-only',
    mint: DEVNET_USDC_MINT,
    wallets: completed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
