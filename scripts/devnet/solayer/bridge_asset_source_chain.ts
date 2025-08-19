import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
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
} from "../../constants";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const SIGNER_KEYPAIR = loadKeypairFromFile("./keys/devnet/recipient.json");
const FEE_VAULT = loadKeypairFromFile("./keys/devnet/fee_vault.json");
// const SOLAYER_MINT_PUBKEY = new PublicKey(
//   "CZ2pSxdateFMgytyGaVVujGNbrhLaeHCfRFkYgvhwhxb"
// );
const SOLAYER_MINT_PUBKEY = loadKeypairFromFile("./keys/devnet/solayer_mint.json").publicKey;

const RECIPIENT = loadKeypairFromFile("./keys/devnet/sender.json");
const BRIDGE_AMOUNT = new anchor.BN(1_000000000);
const ADDITIONAL_SOL_GAS = new anchor.BN(0);

async function main() {
  const url = process.argv[2] || "https://devnet-rpc.solayer.org";
  const connection = new Connection(url);
  console.log(`Using RPC URL: ${url}`);
  console.log(`signer wallet public key is: ${SIGNER_KEYPAIR.publicKey}`);
  console.log(
    `signer wallet balance is: ${
      (await connection.getBalance(SIGNER_KEYPAIR.publicKey)) / LAMPORTS_PER_SOL
    } SOL`
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(SIGNER_KEYPAIR),
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

  const signerVault = getAssociatedTokenAddressSync(
    SOLAYER_MINT_PUBKEY,
    SIGNER_KEYPAIR.publicKey,
    true
  );

  const bridgeHandlerVault = getAssociatedTokenAddressSync(
    SOLAYER_MINT_PUBKEY,
    bridgeHandler,
    true
  );

  const bridgeProofNonce = new anchor.BN(Math.random() * 100_000_000);

  const [bridgeProof, bridgeProofBump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("bridge_proof"),
      bridgeHandler.toBuffer(),
      SIGNER_KEYPAIR.publicKey.toBuffer(),
      bridgeProofNonce.toArrayLike(Buffer, "be", 8),
    ],
    program.programId
  );

  const [tokenInfo, tokenInfoBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_info"), bridgeHandler.toBuffer(), SOLAYER_MINT_PUBKEY.toBuffer()],
    program.programId
  );

  console.log(`bridge handler is: ${bridgeHandler.toString()}`);

  const [targetMint, targetMintBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint"), bridgeHandler.toBuffer(), SOLAYER_MINT_PUBKEY.toBuffer()],
    program.programId
  );


  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const bridgeAssetSourceChainInst = await program.methods
    .bridgeAssetSourceChain(
      bridgeProofNonce,
      BRIDGE_AMOUNT,
      RECIPIENT.publicKey,
      targetMint,
      ADDITIONAL_SOL_GAS
    )
    .accounts({
      signer: SIGNER_KEYPAIR.publicKey,
      mint: SOLAYER_MINT_PUBKEY,
      signerVault,
      bridgeHandler,
      bridgeHandlerVault,
      bridgeProof,
      tokenInfo,
      feeVault: FEE_VAULT.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(bridgeAssetSourceChainInst);

  try {
    const sig = await connection.sendTransaction(tx, [SIGNER_KEYPAIR], {
      skipPreflight: true,
    });

    console.log(`tx sent: ${sig}`);


    // await sendAndConfirmTransaction(connection, tx, [SIGNER_KEYPAIR], {
    //   skipPreflight: false,
    // }).then(log);
  } catch (error) {
    console.error(error);
  }

  // const SOLANA_MANAGER = loadKeypairFromFile(
  //   "./keys/devnet/solana_manager.json"
  // );

  // await  getOrCreateAssociatedTokenAccount(connection, SIGNER_KEYPAIR, SOLANA_MINT.publicKey, SIGNER_KEYPAIR.publicKey)

  // const SIGNER_PUBKEY = new PublicKey("DKtVoYxuJyHi8mibwKB7fq22Yj1whnYTWNzpqWhajXf");

  // const signerVault1 = await getOrCreateAssociatedTokenAccount(
  //   connection,
  //   SIGNER_KEYPAIR,
  //   SOLAYER_MINT_PUBKEY,
  //   SIGNER_PUBKEY
  // );

  // console.log(`signer vault 1 is: ${signerVault1.address.toString()}`);

  // const SENDER = loadKeypairFromFile("./keys/devnet/recipient.json");
  // await mintTo(
  //   connection,
  //   SENDER,
  //   SOLAYER_MINT_PUBKEY,
  //   signerVault1.address,
  //   SENDER.publicKey,
  //   1000000_000_000_000
  // );
}

main().then(() => process.exit());
