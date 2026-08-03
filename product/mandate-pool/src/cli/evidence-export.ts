import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';

import {
  EvidenceExportError,
  exportOrderEvidence,
  exportPreflightEvidence,
  type EvidenceExporterOptions,
} from '../evidence/exporter.js';

type EvidenceCommand =
  | {
      readonly kind: 'preflight';
      readonly baseUrl: string;
      readonly outputPath?: string;
    }
  | {
      readonly kind: 'order';
      readonly expectation: 'normal' | 'reject';
      readonly baseUrl: string;
      readonly orderId: string;
      readonly outputPath?: string;
    };

const USAGE = `Usage:
  npm run evidence:export -- preflight --base-url <origin>
  npm run evidence:export -- order normal --base-url <origin> --order-id <id>
  npm run evidence:export -- order reject --base-url <origin> --order-id <id>
  npm run evidence:export -- --mode=preflight --base-url <origin> --output <new.json>
  npm run evidence:export -- --mode=normal --base-url <origin> --order-id <id> --output <new.json>

Set EVIDENCE_ID_TOKEN in the process environment for a private Cloud Run service.
The exporter issues GET requests only and writes the verified JSON bundle to stdout.`;

function option(args: readonly string[], name: string): string | undefined {
  const inline = args.find((argument) => argument.startsWith(`${name}=`));
  if (inline !== undefined) {
    const value = inline.slice(name.length + 1);
    if (value === '') throw new EvidenceExportError(`${name} requires a value`);
    return value;
  }
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new EvidenceExportError(`${name} requires a value`);
  }
  return value;
}

export function parseEvidenceCommand(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): EvidenceCommand {
  const baseUrl = option(args, '--base-url') ?? env['EVIDENCE_BASE_URL'];
  if (baseUrl === undefined || baseUrl.trim() === '') {
    throw new EvidenceExportError(`A base URL is required\n${USAGE}`);
  }
  const outputPath = option(args, '--output');
  const allowedOptions = new Set(['--base-url', '--order-id', '--mode', '--output']);
  for (const argument of args) {
    const optionName = argument.split('=', 1)[0] as string;
    if (argument.startsWith('--') && !allowedOptions.has(optionName)) {
      throw new EvidenceExportError(`Unknown option ${argument}\n${USAGE}`);
    }
  }
  const compatibilityMode = option(args, '--mode');
  const command = compatibilityMode ?? args[0];
  if (command === 'preflight') {
    if (args[1]?.startsWith('--') === false || option(args, '--order-id') !== undefined) {
      throw new EvidenceExportError(`Invalid preflight arguments\n${USAGE}`);
    }
    return {
      kind: 'preflight',
      baseUrl,
      ...(outputPath === undefined ? {} : {outputPath}),
    };
  }
  if (command === 'normal' || command === 'reject') {
    const orderId = option(args, '--order-id');
    if (orderId === undefined) {
      throw new EvidenceExportError(`--order-id is required\n${USAGE}`);
    }
    return {
      kind: 'order',
      expectation: command,
      baseUrl,
      orderId,
      ...(outputPath === undefined ? {} : {outputPath}),
    };
  }
  if (command === 'order') {
    const expectation = args[1];
    if (expectation !== 'normal' && expectation !== 'reject') {
      throw new EvidenceExportError(`Order expectation must be normal or reject\n${USAGE}`);
    }
    const orderId = option(args, '--order-id');
    if (orderId === undefined) {
      throw new EvidenceExportError(`--order-id is required\n${USAGE}`);
    }
    return {
      kind: 'order',
      expectation,
      baseUrl,
      orderId,
      ...(outputPath === undefined ? {} : {outputPath}),
    };
  }
  throw new EvidenceExportError(`Unknown evidence command\n${USAGE}`);
}

export async function runEvidenceExport(
  args: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const command = parseEvidenceCommand(args, env);
  const options: EvidenceExporterOptions = {
    baseUrl: command.baseUrl,
    ...(env['EVIDENCE_ID_TOKEN'] === undefined
      ? {}
      : {identityToken: env['EVIDENCE_ID_TOKEN']}),
  };
  const output =
    command.kind === 'preflight'
      ? await exportPreflightEvidence(options)
      : await exportOrderEvidence(command.expectation, command.orderId, options);
  const rendered = `${JSON.stringify(output, null, 2)}\n`;
  if (command.outputPath === undefined) {
    process.stdout.write(rendered);
    return;
  }
  const outputPath = resolve(command.outputPath);
  await writeFile(outputPath, rendered, {encoding: 'utf8', flag: 'wx'});
  process.stderr.write(`Evidence written without overwrite: ${outputPath}\n`);
}

const entryPath = process.argv[1];
if (entryPath !== undefined && resolve(entryPath) === fileURLToPath(import.meta.url)) {
  void runEvidenceExport().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unknown evidence export failure';
    process.stderr.write(`Evidence export failed: ${message}\n`);
    process.exitCode = 1;
  });
}
