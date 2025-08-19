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

const SOLAYER_MANAGER = loadKeypairFromFile(
  "./keys/devnet/solayer_manager.json"
);
const SOLAYER_OPERATOR = loadKeypairFromFile(
  "./keys/devnet/solayer_operator.json"
);
const FEE_VAULT = loadKeypairFromFile("./keys/devnet/fee_vault.json");

async function main() {
  // Get URL from command line arguments, default to devnet if not provided
  const url = process.argv[2] || "https://devnet-rpc.solayer.org";
  const connection = new Connection(url);
  console.log(`Using RPC URL: ${url}`);
  console.log(`signer wallet public key is: ${SOLAYER_MANAGER.publicKey}`);
  console.log(
    `signer wallet balance is: ${
      (await connection.getBalance(SOLAYER_MANAGER.publicKey)) /
      LAMPORTS_PER_SOL
    } SOL`
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(SOLAYER_MANAGER),
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

  const [guardianInfo, guardianBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("guardian_info"), bridgeHandler.toBuffer()],
    program.programId
  );

  console.log(`bridge handler is: ${bridgeHandler.toString()}`);
  console.log(`guardian info is: ${guardianInfo.toString()}`);

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const initInst = await program.methods
    .initialize(init_nonce, 2) // 1 for Solana, 2 for Solayer
    .accounts({
      signer: SOLAYER_MANAGER.publicKey,
      bridgeHandler,
      guardianInfo,
      feeVault: FEE_VAULT.publicKey,
      manager: SOLAYER_MANAGER.publicKey,
      operator: SOLAYER_OPERATOR.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(initInst);

  try {
    const signature = await connection.sendTransaction(tx, [SOLAYER_MANAGER], {
      skipPreflight: true,
    });
    console.log(`signature is: ${signature}`);

    await connection.confirmTransaction(signature);

    // await sendAndConfirmTransaction(connection, tx, [MANAGER_KEYPAIR]).then(
    //   log
    // );
  } catch (error) {
    console.error(error);
  }
}

main().then(() => process.exit());
