import {
  getCompiledTransactionMessageDecoder,
  getCompiledTransactionMessageEncoder,
} from '@solana/kit';

import {
  CLASSIC_TOKEN_PROGRAM_ADDRESS,
  MEMO_PROGRAM_ADDRESS,
} from './intent.js';
import type {
  DecodedAccountMeta,
  DecodedSettlementInstruction,
  DecodedTransactionIntent,
  TransactionMessageDecoder,
} from './intent.js';

const TRANSFER_CHECKED_DISCRIMINATOR = 12;
const TRANSFER_CHECKED_DATA_LENGTH = 10;

interface ByteSequence {
  readonly byteLength: number;
  readonly length: number;
  readonly [index: number]: number;
}

function bytesEqual(left: ByteSequence, right: ByteSequence): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function accountMetaAt(
  staticAccounts: readonly string[],
  index: number,
  context: string,
): string {
  const account = staticAccounts[index];
  if (account === undefined) {
    throw new Error(`${context} references an unresolved or out-of-range account index`);
  }
  return account;
}

function dataAsBytes(data: ByteSequence | undefined): Uint8Array {
  if (data === undefined) return new Uint8Array();
  const bytes = new Uint8Array(data.length);
  for (let index = 0; index < data.length; index += 1) {
    const value = data[index];
    if (value === undefined) {
      throw new Error('Instruction data contains a missing byte');
    }
    bytes[index] = value;
  }
  return bytes;
}

function unknownInstruction(
  programAddress: string,
  accountAddresses: readonly string[],
  data: Uint8Array,
): DecodedSettlementInstruction {
  return {
    kind: 'unknown',
    programAddress,
    accountAddresses,
    dataBase64: Buffer.from(data).toString('base64'),
  };
}

/**
 * Strict @solana/kit adapter for the verifier's security projection.
 *
 * It consumes the entire byte array, rejects non-canonical re-encodings, and
 * refuses unresolved lookup-table indices. The verifier independently rejects
 * every message containing an address-table lookup.
 */
export class SolanaKitTransactionMessageDecoder implements TransactionMessageDecoder {
  public decodeTransactionMessage(serializedMessage: Uint8Array): DecodedTransactionIntent {
    const decoder = getCompiledTransactionMessageDecoder();
    const [compiled, offset] = decoder.read(serializedMessage, 0);
    if (offset !== serializedMessage.byteLength) {
      throw new Error('Transaction message contains trailing bytes');
    }

    const canonicalBytes = getCompiledTransactionMessageEncoder().encode(compiled);
    if (!bytesEqual(serializedMessage, canonicalBytes)) {
      throw new Error('Transaction message encoding is not canonical');
    }

    const staticAddresses = compiled.staticAccounts.map(String);
    const {numSignerAccounts, numReadonlySignerAccounts, numReadonlyNonSignerAccounts} =
      compiled.header;
    if (
      numSignerAccounts < 1 ||
      numSignerAccounts > staticAddresses.length ||
      numReadonlySignerAccounts > numSignerAccounts ||
      numReadonlyNonSignerAccounts > staticAddresses.length - numSignerAccounts
    ) {
      throw new Error('Transaction message header account counts are inconsistent');
    }

    const firstReadonlySigner = numSignerAccounts - numReadonlySignerAccounts;
    const firstReadonlyNonSigner = staticAddresses.length - numReadonlyNonSignerAccounts;
    const staticAccounts: DecodedAccountMeta[] = staticAddresses.map((address, index) => {
      const isSigner = index < numSignerAccounts;
      const isWritable = isSigner
        ? index < firstReadonlySigner
        : index < firstReadonlyNonSigner;
      return {address, isSigner, isWritable};
    });

    const instructions: DecodedSettlementInstruction[] = compiled.instructions.map(
      (instruction, instructionIndex) => {
        const programAddress = accountMetaAt(
          staticAddresses,
          instruction.programAddressIndex,
          `Instruction ${String(instructionIndex)} program`,
        );
        const accountAddresses = (instruction.accountIndices ?? []).map((accountIndex) =>
          accountMetaAt(
            staticAddresses,
            accountIndex,
            `Instruction ${String(instructionIndex)}`,
          ),
        );
        const data = dataAsBytes(instruction.data);

        if (
          (programAddress === CLASSIC_TOKEN_PROGRAM_ADDRESS || data[0] === TRANSFER_CHECKED_DISCRIMINATOR) &&
          data.byteLength === TRANSFER_CHECKED_DATA_LENGTH &&
          data[0] === TRANSFER_CHECKED_DISCRIMINATOR &&
          accountAddresses.length >= 4
        ) {
          const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
          const sourceAta = accountAddresses[0];
          const mint = accountAddresses[1];
          const destinationAta = accountAddresses[2];
          const authorityAddress = accountAddresses[3];
          if (
            sourceAta === undefined ||
            mint === undefined ||
            destinationAta === undefined ||
            authorityAddress === undefined
          ) {
            return unknownInstruction(programAddress, accountAddresses, data);
          }
          return {
            kind: 'transferChecked',
            programAddress,
            sourceAta,
            mint,
            destinationAta,
            authorityAddress,
            amountAtomic: view.getBigUint64(1, true).toString(10),
            decimals: view.getUint8(9),
            multisignerAddresses: accountAddresses.slice(4),
          };
        }

        if (programAddress === MEMO_PROGRAM_ADDRESS) {
          let memo: string;
          try {
            memo = new TextDecoder('utf-8', {fatal: true}).decode(data);
          } catch (error) {
            throw new Error('Memo instruction is not valid UTF-8', {cause: error});
          }
          return {kind: 'memo', programAddress, memo, accountAddresses};
        }

        return unknownInstruction(programAddress, accountAddresses, data);
      },
    );

    const addressTableLookups =
      compiled.version === 0
        ? (compiled.addressTableLookups ?? []).map((lookup) => String(lookup.lookupTableAddress))
        : [];

    return {
      messageVersion: compiled.version,
      recentBlockhash: String(compiled.lifetimeToken),
      feePayerAddress: staticAddresses[0] as string,
      addressTableLookups,
      requiredSignerAddresses: staticAddresses.slice(0, numSignerAccounts),
      staticAccounts,
      instructions,
    };
  }
}
