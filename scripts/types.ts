import * as BufferLayout from '@solana/buffer-layout';

export type Ed25519Signature = {
    pubkey: Uint8Array;
    signature: Uint8Array;
    msg: Uint8Array;
}

export type Ed25519SignatureOffsets = {
    signature_offset: number; // u16
    signature_instruction_index: number; // u16
    public_key_offset: number;  //u16
    public_key_instruction_index: number;  //u16
    message_data_offset: number;  //u16
    message_data_size: number;  //u16
    message_instruction_index: number;  //u16
}

export const ED25519_INSTRUCTION_OFFSET_LAYOUT = BufferLayout.struct<
  Readonly<{
    messageDataOffset: number;
    messageDataSize: number;
    messageInstructionIndex: number;
    publicKeyInstructionIndex: number;
    publicKeyOffset: number;
    signatureInstructionIndex: number;
    signatureOffset: number;
  }>
>([
  BufferLayout.u16('signatureOffset'),
  BufferLayout.u16('signatureInstructionIndex'),
  BufferLayout.u16('publicKeyOffset'),
  BufferLayout.u16('publicKeyInstructionIndex'),
  BufferLayout.u16('messageDataOffset'),
  BufferLayout.u16('messageDataSize'),
  BufferLayout.u16('messageInstructionIndex'),
]);
