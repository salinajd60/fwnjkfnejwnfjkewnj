import * as anchor from "@coral-xyz/anchor";
import {
  clusterApiUrl,
  ConfirmOptions,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  loadKeypairFromFile,
  log,
  newTransactionWithComputeUnitPriceAndLimit,
} from "../../utils";
import BridgeHandlerProgramIDL from "../../../target/idl/bridge_program.json";
import {
  BRIDGE_HANDLER_SOLAYER_NONCE,
  BRIDGE_PROGRAM_ID,
  METADATA_PROGRAM_ID,
} from "../../constants";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMint,
  createMintToInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  getOrCreateAssociatedTokenAccount,
  MINT_SIZE,
  mintTo,
  TOKEN_PROGRAM_ID,
  transfer,
} from "@solana/spl-token";
import { DataV2, Metadata, createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

const SOLAYER_OPERATOR = loadKeypairFromFile(
  "./keys/devnet/solayer_operator.json"
);
// const SOLANA_MINT = loadKeypairFromFile("./keys/devnet/solana_mint.json");
const SOLANA_MINT = Keypair.generate();
const DECIMAL = 9;

async function main() {
  const url = process.argv[2] || "https://devnet-rpc.solayer.org";
  const connection = new Connection(url);
  console.log(`Using RPC URL: ${url}`);
  console.log(`signer wallet public key is: ${SOLAYER_OPERATOR.publicKey}`);
  console.log(
    `signer wallet balance is: ${
      (await connection.getBalance(SOLAYER_OPERATOR.publicKey)) /
      LAMPORTS_PER_SOL
    } SOL`
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(SOLAYER_OPERATOR),
    { commitment: "confirmed" }
  );

  const program = new anchor.Program(
    BridgeHandlerProgramIDL as anchor.Idl,
    BRIDGE_PROGRAM_ID,
    provider
  );

  const init_nonce = new anchor.BN(BRIDGE_HANDLER_SOLAYER_NONCE);

  const [bridgeHandler, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bridge_handler"), init_nonce.toArrayLike(Buffer, "be", 8)],
    program.programId
  );

  const [mint, _] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("mint"),
      bridgeHandler.toBuffer(),
      SOLANA_MINT.publicKey.toBuffer(),
    ],
    program.programId
  );

  const bridgeHandlerVault = getAssociatedTokenAddressSync(
    mint,
    bridgeHandler,
    true
  );

  const [feeVault, feeVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault"), bridgeHandler.toBuffer(), mint.toBuffer()],
    program.programId
  );

  const [tokenInfo, tokenInfoBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_info"), bridgeHandler.toBuffer(), mint.toBuffer()],
    program.programId
  );

  const [metadata, metadataBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );

  console.log(`bridge handler is: ${bridgeHandler.toString()}`);
  console.log(`mint is: ${mint.toString()}`);
  console.log(`bridge handler vault is: ${bridgeHandlerVault.toString()}`);
  console.log(`fee vault is: ${feeVault.toString()}`);
  console.log(`metadata is: ${metadata.toString()}`);

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const addTokenInst = await program.methods
    .addToken(DECIMAL, null, null, null)
    .accounts({
      operator: SOLAYER_OPERATOR.publicKey,
      bridgeHandler,
      mint,
      sourceMint: SOLANA_MINT.publicKey,
      bridgeHandlerVault,
      metadata,
      tokenInfo,
      tokenMetadataProgram: METADATA_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  tx.add(addTokenInst);

  try {
    const signature = await connection.sendTransaction(tx, [SOLAYER_OPERATOR], {
      skipPreflight: true,
    });
    console.log(`signature is: ${signature}`);

    // await sendAndConfirmTransaction(connection, tx, [SOLAYER_MANAGER, SOLAYER_FEE_VAULT]).then(
    //   log
    // );
  } catch (error) {
    console.error(error);
    throw error;
  }

  // const SENDER = loadKeypairFromFile("./keys/devnet/recipient.json");
  // const RECIPIENT = loadKeypairFromFile("./keys/devnet/sender.json");
  // const SOLAYER_MINT = loadKeypairFromFile("./keys/devnet/solayer_mint.json");
  // await createMintAndMetadata1(
  //   connection,
  //   SENDER,
  //   SENDER.publicKey,
  //   SENDER.publicKey,
  //   9,
  //   SOLAYER_MINT
  // );

  // await queryMetadata(connection, SOLAYER_MINT.publicKey);

  // const secretKey = Uint8Array.from([
  //   0, 0, 0, 0, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66,
  //   66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 66, 84, 202, 77, 84, 158, 141,
  //   164, 188, 178, 44, 143, 242, 187, 71, 227, 153, 117, 28, 40, 75, 222, 140,
  //   103, 151, 211, 217, 167, 100, 251, 222, 94, 166,
  // ]);

  // // // Create a Keypair object from the secret key
  // const keypair = Keypair.fromSecretKey(secretKey);
  // const keypairVault = getAssociatedTokenAddressSync(
  //   SOLAYER_MINT_PUBKEY,
  //   keypair.publicKey,
  //   true
  // );

  // console.log(`keypair vault is: ${keypairVault.toString()}`);

  // const transaction = new Transaction().add(
  //   createTransferInstruction(keypairVault, bridgeHandlerVault, keypair.publicKey, 80000_000000000, [], TOKEN_PROGRAM_ID)
  // );

  // const sender = loadKeypairFromFile("./keys/devnet/sender.json");
  // const senderVault = getAssociatedTokenAddressSync(
  //   SOLAYER_MINT.publicKey,
  //   SENDER.publicKey,
  //   false
  // );

  // // console.log(`keypair vault is: ${keypairVault.toString()}`);
  // console.log(`sender vault is: ${senderVault.toString()}`);

  // const USER_PUBKEY = new PublicKey("SahScoe6eHCbC4a8M6BPp27bHqFVaQiDPqYpFeDCwFb");
  // const userVault = getAssociatedTokenAddressSync(
  //   SOLAYER_MINT.publicKey,
  //   USER_PUBKEY,
  //   false
  // );

  // const transaction = new Transaction().add(
  //   createAssociatedTokenAccountInstruction(SENDER.publicKey, senderVault, SENDER.publicKey, SOLAYER_MINT.publicKey),
  //   // createTransferInstruction(keypairVault, senderVault, keypair.publicKey, 1000_000000000, [], TOKEN_PROGRAM_ID)
  // );

  // console.log(await connection.sendTransaction(transaction, [SENDER], {
  //   skipPreflight: true,
  // }));

  // await mintTo1(connection, SENDER, SOLAYER_MINT.publicKey, senderVault, SENDER, 1000_000000000);
  // await transferToken(connection, SENDER, senderVault, userVault, 10_000000000);
}

main().then(() => process.exit());

export async function createMintAndMetadata1(
  connection: Connection,
  payer: Signer,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  keypair = Keypair.generate(),
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const lamports = await getMinimumBalanceForRentExemptMint(connection);

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId,
    }),
    createInitializeMint2Instruction(
      keypair.publicKey,
      decimals,
      mintAuthority,
      freezeAuthority,
      programId
    )
  );

  // const [metadataPda] = PublicKey.findProgramAddressSync(
  //   [
  //     Buffer.from("metadata"),
  //     METADATA_PROGRAM_ID.toBuffer(),
  //     keypair.publicKey.toBuffer(),
  //   ],
  //   METADATA_PROGRAM_ID
  // );

  // const data: DataV2 = {
  //   name:                   "test",
  //   symbol:                 "test",
  //   uri:                    "test",
  //   sellerFeeBasisPoints:   0,
  //   creators:               null,
  //   collection:             null,
  //   uses:                   null,
  // };

  // console.log(`metadata pda is: ${metadataPda.toString()}`);

  // const ix = createCreateMetadataAccountV3Instruction(
  //   {
  //     metadata:         metadataPda,
  //     mint:             keypair.publicKey,
  //     mintAuthority:    payer.publicKey,
  //     payer:            payer.publicKey,
  //     updateAuthority:  payer.publicKey,
  //   },
  //   {
  //     createMetadataAccountArgsV3: {
  //       data,
  //       isMutable: true,
  //       collectionDetails: null,
  //     }
  //   },
  //   METADATA_PROGRAM_ID
  // );

  // transaction.add(ix);

  const signature = await connection.sendTransaction(transaction, [
    payer,
    keypair,
  ], { skipPreflight: true });
  console.log(`signature is: ${signature}`);

  return keypair.publicKey;
}

export function getSigners(
  signerOrMultisig: Signer | PublicKey,
  multiSigners: Signer[]
): [PublicKey, Signer[]] {
  return signerOrMultisig instanceof PublicKey
    ? [signerOrMultisig, multiSigners]
    : [signerOrMultisig.publicKey, [signerOrMultisig]];
}

export async function transferToken(
  connection: Connection,
  payer: Signer,
  source: PublicKey,
  destination: PublicKey,
  amount: number | bigint,
): Promise<TransactionSignature> {

  const transaction = new Transaction().add(
    createTransferInstruction(
      source,
      destination,
      payer.publicKey,
      amount,
    )
  );

  const signature = await connection.sendTransaction(transaction, [
    payer,
  ]);
  console.log(`signature is: ${signature}`);

  return signature;
}

export async function mintTo1(
  connection: Connection,
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: Signer | PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID
): Promise<TransactionSignature> {
  console.log("destination is: ", destination.toString());
  const [authorityPublicKey, signers] = getSigners(authority, multiSigners);

  const transaction = new Transaction().add(
    createMintToInstruction(
      mint,
      destination,
      authorityPublicKey,
      amount,
      multiSigners,
      programId
    )
  );

  // return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);

  const signature = await connection.sendTransaction(transaction, [
    payer,
    ...signers,
  ], { skipPreflight: true });
  console.log(`signature is: ${signature}`);

  return signature;
}

export async function queryMetadata(
  connection: Connection,
  mint: PublicKey,
) {
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );

  const metadataInfo = await connection.getAccountInfo(metadataPda);

  const [metadata] = Metadata.deserialize(metadataInfo.data);

  console.log(`metadata is: ${metadata.data.name} ${metadata.data.symbol} ${metadata.data.uri}`);

}
