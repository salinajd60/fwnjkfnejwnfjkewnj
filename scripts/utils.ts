import * as fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { sha256 } from "@noble/hashes/sha256";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  Ed25519Signature,
  Ed25519SignatureOffsets,
  ED25519_INSTRUCTION_OFFSET_LAYOUT,
} from "./types";
import * as ed from "@noble/ed25519";
import {
  SIGNATURE_OFFSETS_SERIALIZED_SIZE,
  SIGNATURE_OFFSETS_START,
  PUBKEY_SERIALIZED_SIZE,
  SIGNATURE_SERIALIZED_SIZE,
} from "./constants";

export function loadKeypairFromFile(filepath: string): anchor.web3.Keypair {
  try {
    // Read the JSON keypair file
    const keypairFile = fs.readFileSync(filepath, "utf-8");
    const keypairData = JSON.parse(keypairFile);

    // Convert the keypair data to a Uint8Array
    const secretKey = Uint8Array.from(keypairData);

    // Create a Keypair object from the secret key
    const keypair = anchor.web3.Keypair.fromSecretKey(secretKey);

    return keypair;
  } catch (error) {
    console.error("Error loading keypair:", error);
    throw error;
  }
}

export function newTransactionWithComputeUnitPriceAndLimit(): Transaction {
  return new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 500_000,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1_000_000,
    })
  );
}

export function newTransactionInstWithComputeUnitPriceAndLimit(): Array<TransactionInstruction> {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 600000,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 200000,
    }),
  ];
}

export async function log(signature: string): Promise<string> {
  console.log(
    `Your transaction details:
        - https://explorer.solana.com/tx/${signature}?cluster=devnet
        - https://solana.fm/tx/${signature}?cluster=devnet`
  );
  return signature;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getMessageHash(
  sender: PublicKey,
  recipient: PublicKey,
  mint: PublicKey,
  receiveAmount: anchor.BN,
  nonce: anchor.BN,
  sourceTxId: Buffer,
  additionalSolGas: anchor.BN
): Promise<Uint8Array> {
  const rawMessage = Uint8Array.from(
    Buffer.concat([
      sender.toBuffer(),
      recipient.toBuffer(),
      mint.toBuffer(),
      Buffer.from(receiveAmount.toArrayLike(Buffer, "be", 8)),
      Buffer.from(nonce.toArrayLike(Buffer, "be", 8)),
      sourceTxId,
      Buffer.from(additionalSolGas.toArrayLike(Buffer, "be", 8)),
    ])
  );

  const hash = sha256(rawMessage);
  return new Uint8Array(hash);
}

export async function getMessageHashForBridgeAssetTargetChainSol(
  sender: PublicKey,
  recipient: PublicKey,
  mint: PublicKey,
  receiveAmount: anchor.BN,
  nonce: anchor.BN,
  sourceTxId: Buffer,
): Promise<Uint8Array> {
  const rawMessage = Uint8Array.from(
    Buffer.concat([
      sender.toBuffer(),
      recipient.toBuffer(),
      mint.toBuffer(),
      Buffer.from(receiveAmount.toArrayLike(Buffer, "be", 8)),
      Buffer.from(nonce.toArrayLike(Buffer, "be", 8)),
      sourceTxId,
    ])
  );

  const hash = sha256(rawMessage);
  return new Uint8Array(hash);
}

export async function getMessageHashForBridgingMessage(
  sender: PublicKey,
  recipient: PublicKey,
  message: Buffer,
  nonce: anchor.BN,
  sourceTxId: Buffer
): Promise<Uint8Array> {
  const rawMessage = Uint8Array.from(
    Buffer.concat([
      sender.toBuffer(),
      recipient.toBuffer(),
      message,
      Buffer.from(nonce.toArrayLike(Buffer, "be", 8)),
      sourceTxId,
    ])
  );

  const hash = sha256(rawMessage);
  return new Uint8Array(hash);
}

export async function getMessageHashForCrossChainCall(
  sender: PublicKey,
  call: Buffer,
  nonce: anchor.BN,
  sourceTxId: Buffer
): Promise<Uint8Array> {
  const rawMessage = Uint8Array.from(
    Buffer.concat([
      sender.toBuffer(),
      call,
      Buffer.from(nonce.toArrayLike(Buffer, "be", 8)),
      sourceTxId,
    ])
  );

  const hash = sha256(rawMessage);
  return new Uint8Array(hash);
}

export async function constructSig(
  keypair: Keypair,
  sender: PublicKey,
  recipient: PublicKey,
  mint: PublicKey,
  receiveAmount: anchor.BN,
  nonce: anchor.BN,
  sourceTxId: Buffer,
  additionalSolGas: anchor.BN
): Promise<Ed25519Signature> {
  const msg = await getMessageHash(
    sender,
    recipient,
    mint,
    receiveAmount,
    nonce,
    sourceTxId,
    additionalSolGas
  );

  const signature = await ed.sign(msg, keypair.secretKey.slice(0, 32));
  return {
    pubkey: Uint8Array.from(keypair.publicKey.toBuffer()),
    signature,
    msg,
  };
}

export async function constructSigForBridgeAssetTargetChainSol(
  keypair: Keypair,
  sender: PublicKey,
  recipient: PublicKey,
  mint: PublicKey,
  receiveAmount: anchor.BN,
  nonce: anchor.BN,
  sourceTxId: Buffer,
): Promise<Ed25519Signature> {
  const msg = await getMessageHashForBridgeAssetTargetChainSol(
    sender,
    recipient,
    mint,
    receiveAmount,
    nonce,
    sourceTxId
  );

  const signature = await ed.sign(msg, keypair.secretKey.slice(0, 32));
  return {
    pubkey: Uint8Array.from(keypair.publicKey.toBuffer()),
    signature,
    msg,
  };
}

export async function constructSigForBridgingMessage(
  keypair: Keypair,
  sender: PublicKey,
  recipient: PublicKey,
  message: Buffer,
  nonce: anchor.BN,
  sourceTxId: Buffer
): Promise<Ed25519Signature> {
  const msg = await getMessageHashForBridgingMessage(
    sender,
    recipient,
    message,
    nonce,
    sourceTxId
  );

  const signature = await ed.sign(msg, keypair.secretKey.slice(0, 32));
  return {
    pubkey: Uint8Array.from(keypair.publicKey.toBuffer()),
    signature,
    msg,
  };
}

export async function makeEd25519InstDataPacked(
  sigs: Ed25519Signature[],
  instruction_index: number
): Promise<Uint8Array> {
  let data_start =
    sigs.length * SIGNATURE_OFFSETS_SERIALIZED_SIZE + SIGNATURE_OFFSETS_START;
  let data_start_after_msg = data_start + sigs[0].msg.length; // 32 is message length
  let signature_offsets: Ed25519SignatureOffsets[] = [];
  let signature_buffer = new Uint8Array();

  for (const sig of sigs) {
    let pub_key_offset = data_start_after_msg + signature_buffer.length;
    let signature_offset = pub_key_offset + PUBKEY_SERIALIZED_SIZE;

    signature_offsets.push({
      signature_offset,
      signature_instruction_index: instruction_index,
      public_key_offset: pub_key_offset,
      public_key_instruction_index: instruction_index,
      message_data_offset: data_start,
      message_data_size: sig.msg.length, // always 32 bytes
      message_instruction_index: instruction_index,
    });

    signature_buffer = Buffer.concat([
      signature_buffer,
      sig.pubkey,
      sig.signature,
    ]);
  }

  let inst_data = new Uint8Array();
  const numSignaturesBuffer = Buffer.alloc(1);
  numSignaturesBuffer.writeUInt8(sigs.length, 0);
  const paddingBuffer = Buffer.alloc(1);
  paddingBuffer.writeUint8(0, 0);
  inst_data = Buffer.concat([inst_data, numSignaturesBuffer, paddingBuffer]);

  for (const offset of signature_offsets) {
    let encodedOffset = Buffer.alloc(SIGNATURE_OFFSETS_SERIALIZED_SIZE);

    ED25519_INSTRUCTION_OFFSET_LAYOUT.encode(
      {
        signatureOffset: offset.signature_offset,
        signatureInstructionIndex: offset.signature_instruction_index,
        publicKeyOffset: offset.public_key_offset,
        publicKeyInstructionIndex: offset.public_key_instruction_index,
        messageDataOffset: offset.message_data_offset,
        messageDataSize: offset.message_data_size,
        messageInstructionIndex: offset.message_instruction_index,
      },
      encodedOffset
    );

    inst_data = Buffer.concat([inst_data, encodedOffset]);
  }

  inst_data = Buffer.concat([inst_data, sigs[0].msg]); // only add message data once
  inst_data = Buffer.concat([inst_data, signature_buffer]);
  return inst_data;
}

async function makeEd25519InstData(
  sigs: Ed25519Signature[],
  instruction_index: number
): Promise<Uint8Array> {
  let data_start =
    sigs.length * SIGNATURE_OFFSETS_SERIALIZED_SIZE + SIGNATURE_OFFSETS_START;
  let signature_offsets: Ed25519SignatureOffsets[] = [];
  let signature_buffer = new Uint8Array();

  for (const sig of sigs) {
    let start = data_start + signature_buffer.length;
    let pub_key_offset = start;
    let signature_offset = start + PUBKEY_SERIALIZED_SIZE;
    let message_data_offset = signature_offset + SIGNATURE_SERIALIZED_SIZE;

    console.log(
      "sig offset",
      start,
      pub_key_offset,
      signature_offset,
      message_data_offset
    );

    signature_offsets.push({
      signature_offset,
      signature_instruction_index: instruction_index,
      public_key_offset: pub_key_offset,
      public_key_instruction_index: instruction_index,
      message_data_offset,
      message_data_size: sig.msg.length,
      message_instruction_index: instruction_index,
    });

    signature_buffer = Buffer.concat([
      signature_buffer,
      sig.pubkey,
      sig.signature,
      sig.msg,
    ]);

    console.log("sigs", Buffer.from(sig.pubkey), sig.signature, sig.msg);
  }

  console.log("sig buffer size", signature_buffer.length);

  let inst_data = new Uint8Array();
  const numSignaturesBuffer = Buffer.alloc(1);
  numSignaturesBuffer.writeUInt8(sigs.length, 0);
  const paddingBuffer = Buffer.alloc(1);
  paddingBuffer.writeUint8(0, 0);
  inst_data = Buffer.concat([inst_data, numSignaturesBuffer, paddingBuffer]);

  for (const offset of signature_offsets) {
    let encodedOffset = Buffer.alloc(14);

    ED25519_INSTRUCTION_OFFSET_LAYOUT.encode(
      {
        signatureOffset: offset.signature_offset,
        signatureInstructionIndex: offset.signature_instruction_index,
        publicKeyOffset: offset.public_key_offset,
        publicKeyInstructionIndex: offset.public_key_instruction_index,
        messageDataOffset: offset.message_data_offset,
        messageDataSize: offset.message_data_size,
        messageInstructionIndex: offset.message_instruction_index,
      },
      encodedOffset
    );

    console.log("offset", offset);
    inst_data = Buffer.concat([inst_data, encodedOffset]);
  }

  console.log("inst_data after offsets", inst_data, inst_data.length);

  console.log("last offset", inst_data.slice(30, 44));

  inst_data = Buffer.concat([inst_data, signature_buffer]);

  console.log("inst data after sigs", inst_data, inst_data.length);

  console.log("last sig", inst_data.slice(460, 524));
  console.log("last pubkey", inst_data.slice(428, 460));
  console.log("last msg", inst_data.slice(524, 556));

  return inst_data;
}
