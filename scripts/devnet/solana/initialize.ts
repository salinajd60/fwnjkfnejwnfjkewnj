import * as anchor from "@coral-xyz/anchor";
import {
  clusterApiUrl,
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
  BRIDGE_HANDLER_SOLANA_NONCE,
  BRIDGE_PROGRAM_ID,
} from "../../constants";

const SOLANA_MANAGER = loadKeypairFromFile("./keys/devnet/solana_manager.json");
const SOLANA_OPERATOR = loadKeypairFromFile(
  "./keys/devnet/solana_operator.json"
);
const FEE_VAULT = loadKeypairFromFile("./keys/devnet/fee_vault.json");

async function main() {
  const connection = new Connection(clusterApiUrl("devnet"));
  console.log(`signer wallet public key is: ${SOLANA_MANAGER.publicKey}`);
  console.log(
    `signer wallet balance is: ${
      (await connection.getBalance(SOLANA_MANAGER.publicKey)) / LAMPORTS_PER_SOL
    } SOL`
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(SOLANA_MANAGER),
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

  const [guardianInfo, guardianBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("guardian_info"), bridgeHandler.toBuffer()],
    program.programId
  );

  console.log(`bridge handler is: ${bridgeHandler.toString()}`);
  console.log(`guardian info is: ${guardianInfo.toString()}`);

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const initInst = await program.methods
    .initialize(init_nonce, 1) // 1 for Solana, 2 for Solayer
    .accounts({
      signer: SOLANA_MANAGER.publicKey,
      bridgeHandler,
      guardianInfo,
      feeVault: FEE_VAULT.publicKey,
      manager: SOLANA_MANAGER.publicKey,
      operator: SOLANA_OPERATOR.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(initInst);

  try {
    await sendAndConfirmTransaction(connection, tx, [SOLANA_MANAGER]).then(log);
  } catch (error) {
    console.error(error);
  }
}

main().then(() => process.exit());
