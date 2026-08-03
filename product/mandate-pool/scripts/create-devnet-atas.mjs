#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

import {
  AccountState,
  TOKEN_PROGRAM_ADDRESS,
  fetchMint,
  fetchToken,
  getCreateAssociatedTokenIdempotentInstruction,
} from '@solana-program/token';
import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithinSizeLimit,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signature,
  signTransactionMessageWithSigners,
} from '@solana/kit';

const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const MINIMUM_SPONSOR_LAMPORTS = 50_000n;

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function powerShellQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function accessSecret(gcloudPath, projectId, secretName) {
  const args = [
    'secrets', 'versions', 'access', '1',
    `--secret=${secretName}`,
    `--project=${projectId}`,
  ];
  const command = `& ${powerShellQuote(gcloudPath)} ${args.map(powerShellQuote).join(' ')}`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `gcloud exited with status ${String(result.status)}`);
  }
  return result.stdout.trim();
}

async function validateTokenAccount(rpc, entry, mint) {
  const token = await fetchToken(rpc, address(entry.usdcAta), {commitment: 'finalized'});
  if (
    token.programAddress !== TOKEN_PROGRAM_ADDRESS ||
    token.data.owner !== address(entry.address) ||
    token.data.mint !== mint ||
    token.data.state !== AccountState.Initialized
  ) {
    throw new Error(`${entry.role} ATA failed classic-token owner/mint/state validation`);
  }
  return {role: entry.role, address: entry.address, usdcAta: entry.usdcAta};
}

async function main() {
  if (!process.argv.includes('--execute')) {
    throw new Error('Refusing to create Devnet accounts without the explicit --execute flag');
  }
  const projectId = requiredEnvironment('GCP_PROJECT_ID');
  const gcloudPath = requiredEnvironment('GCLOUD_CMD_WINDOWS');
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || 'https://api.devnet.solana.com';
  const manifest = JSON.parse(
    readFileSync(new URL('../devnet-wallets.public.json', import.meta.url), 'utf8'),
  );
  if (manifest.network !== 'solana-devnet-only') throw new Error('Wallet manifest is not Devnet-only');

  const rpc = createSolanaRpc(rpcUrl);
  const genesis = await rpc.getGenesisHash().send();
  if (genesis !== DEVNET_GENESIS_HASH) throw new Error('RPC is not Solana Devnet');

  const mint = address(manifest.usdcMint);
  const mintAccount = await fetchMint(rpc, mint, {commitment: 'finalized'});
  if (
    mintAccount.programAddress !== TOKEN_PROGRAM_ADDRESS ||
    !mintAccount.data.isInitialized ||
    mintAccount.data.decimals !== 6
  ) {
    throw new Error('Configured mint is not initialized classic-token Devnet USDC');
  }

  const sponsorManifest = manifest.wallets.sponsor;
  const sponsorPayload = accessSecret(
    gcloudPath,
    projectId,
    sponsorManifest.secretResource,
  );
  const sponsorBytes = Buffer.from(sponsorPayload, 'base64');
  if (sponsorBytes.byteLength !== 64 || sponsorBytes.toString('base64') !== sponsorPayload) {
    sponsorBytes.fill(0);
    throw new Error('Sponsor secret is not canonical Base64 for a 64-byte Solana keypair');
  }
  const sponsor = await createKeyPairSignerFromBytes(new Uint8Array(sponsorBytes));
  sponsorBytes.fill(0);
  if (sponsor.address !== sponsorManifest.address) {
    throw new Error('Sponsor secret does not match the public manifest');
  }

  const owners = ['buyerA', 'buyerB', 'buyerC', 'merchant'].map((role) => ({
    role,
    ...manifest.wallets[role],
  }));
  const existence = await Promise.all(owners.map(async (entry) => {
    const response = await rpc.getAccountInfo(address(entry.usdcAta), {
      commitment: 'finalized',
      encoding: 'base64',
    }).send();
    return response.value !== null;
  }));

  const balanceBefore = (await rpc.getBalance(sponsor.address, {commitment: 'finalized'}).send()).value;
  if (balanceBefore < MINIMUM_SPONSOR_LAMPORTS) {
    throw new Error('Sponsor has insufficient Devnet SOL');
  }

  let transactionSignature = null;
  if (!existence.every(Boolean)) {
    const instructions = owners.map((entry) => getCreateAssociatedTokenIdempotentInstruction({
      payer: sponsor,
      ata: address(entry.usdcAta),
      owner: address(entry.address),
      mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }));
    const lifetime = (await rpc.getLatestBlockhash({commitment: 'finalized'}).send()).value;
    const message = pipe(
      createTransactionMessage({version: 0}),
      (tx) => setTransactionMessageFeePayerSigner(sponsor, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(lifetime, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
    );
    const transaction = await signTransactionMessageWithSigners(message);
    assertIsTransactionWithinSizeLimit(transaction);
    const expectedSignature = getSignatureFromTransaction(transaction);
    const returnedSignature = await rpc.sendTransaction(
      getBase64EncodedWireTransaction(transaction),
      {
        encoding: 'base64',
        maxRetries: 2n,
        preflightCommitment: 'confirmed',
        skipPreflight: false,
      },
    ).send();
    if (returnedSignature !== expectedSignature) {
      throw new Error('RPC returned a signature different from the signed ATA transaction');
    }
    transactionSignature = expectedSignature;
    console.error(JSON.stringify({status: 'submitted', signature: transactionSignature}));

    let finalized = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await rpc.getSignatureStatuses([signature(transactionSignature)], {
        searchTransactionHistory: true,
      }).send();
      const status = response.value[0];
      if (status?.err) throw new Error(`ATA transaction failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === 'finalized') {
        finalized = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    if (!finalized) {
      throw new Error(`ATA transaction finality timed out; reconcile signature ${transactionSignature}`);
    }
  }

  const accounts = await Promise.all(owners.map((entry) => validateTokenAccount(rpc, entry, mint)));
  const balanceAfter = (await rpc.getBalance(sponsor.address, {commitment: 'finalized'}).send()).value;
  console.log(JSON.stringify({
    status: 'verified',
    network: 'solana-devnet',
    genesis,
    mint,
    transactionCreated: transactionSignature !== null,
    signature: transactionSignature,
    explorerUrl: transactionSignature === null
      ? null
      : `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`,
    sponsorBalanceBeforeLamports: balanceBefore.toString(),
    sponsorBalanceAfterLamports: balanceAfter.toString(),
    accounts,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
