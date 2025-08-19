import { PublicKey } from "@solana/web3.js";

export const BRIDGE_PROGRAM_ID = new PublicKey(
  "6kpxYKjqe8z66hnDHbbjhEUxha46cnz2UqrneGECmFBg"
);

export const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export const SIGNATURE_OFFSETS_SERIALIZED_SIZE = 14;
export const SIGNATURE_SERIALIZED_SIZE = 64;
export const SIGNATURE_OFFSETS_START = 2;
export const PUBKEY_SERIALIZED_SIZE = 32;
export const U16_MAX = 65535;
export const BRIDGE_HANDLER_SOLANA_NONCE = 78901;
export const BRIDGE_HANDLER_SOLAYER_NONCE = 78901;

export enum Chain {
    Solana = 1,
    Solayer = 2
  }
