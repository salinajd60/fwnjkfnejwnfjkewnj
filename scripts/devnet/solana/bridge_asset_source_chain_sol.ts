import * as anchor from "@coral-xyz/anchor";
import {
  clusterApiUrl,
  Connection,
  Keypair,
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
  BRIDGE_HANDLER_SOLANA_NONCE,
  BRIDGE_PROGRAM_ID,
} from "../../constants";

const SIGNER_KEYPAIR = loadKeypairFromFile("./keys/devnet/sender.json");
const FEE_VAULT = loadKeypairFromFile("./keys/devnet/fee_vault.json");

const RECIPIENT = Keypair.generate();
const BRIDGE_AMOUNT = new anchor.BN(5000000);

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));
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

  const init_nonce = new anchor.BN(BRIDGE_HANDLER_SOLANA_NONCE);

  const [bridgeHandler, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bridge_handler"), init_nonce.toArrayLike(Buffer, "be", 8)],
    program.programId
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

  console.log(`bridge handler is: ${bridgeHandler.toString()}`);

  console.log(`recipient is: ${RECIPIENT.publicKey.toString()}`);

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const bridgeAssetSourceChainSolInst = await program.methods
    .bridgeAssetSourceChainSol(
      bridgeProofNonce,
      BRIDGE_AMOUNT,
      RECIPIENT.publicKey
    )
    .accounts({
      signer: SIGNER_KEYPAIR.publicKey,
      bridgeHandler,
      bridgeProof,
      feeVault: FEE_VAULT.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(bridgeAssetSourceChainSolInst);

  try {
    await sendAndConfirmTransaction(connection, tx, [SIGNER_KEYPAIR], {
      skipPreflight: false,
    }).then(log);
  } catch (error) {
    console.error(error);
  }
}

main().then(() => process.exit());
