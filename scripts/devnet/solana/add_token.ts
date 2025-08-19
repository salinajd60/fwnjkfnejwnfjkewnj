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

const SOLANA_OPERATOR = loadKeypairFromFile(
  "./keys/devnet/solana_operator.json"
);
const SOLAYER_MINT = Keypair.generate();
const DECIMAL = 9;
const NAME = "Test Token";
const SYMBOL = "TTT";
const URI = "https://test.com";

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));
  console.log(`signer wallet public key is: ${SOLANA_OPERATOR.publicKey}`);
  console.log(
    `signer wallet balance is: ${
      (await connection.getBalance(SOLANA_OPERATOR.publicKey)) /
      LAMPORTS_PER_SOL
    } SOL`
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(SOLANA_OPERATOR),
    { commitment: "confirmed" }
  );

  const program = new anchor.Program(
    BridgeHandlerProgramIDL as anchor.Idl,
    BRIDGE_PROGRAM_ID,
    provider
  );

  // const init_nonce = new anchor.BN(BRIDGE_HANDLER_SOLAYER_NONCE);
  const init_nonce = new anchor.BN(66666);

  const [bridgeHandler, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bridge_handler"), init_nonce.toArrayLike(Buffer, "be", 8)],
    program.programId
  );

  const [mint, _] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("mint"),
      bridgeHandler.toBuffer(),
      SOLAYER_MINT.publicKey.toBuffer(),
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
      operator: SOLANA_OPERATOR.publicKey,
      bridgeHandler,
      mint,
      sourceMint: SOLAYER_MINT.publicKey,
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
    await sendAndConfirmTransaction(connection, tx, [SOLANA_OPERATOR]).then(log);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

main().then(() => process.exit());
