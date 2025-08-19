import * as anchor from "@coral-xyz/anchor";
import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  loadKeypairFromFile,
  log,
  newTransactionWithComputeUnitPriceAndLimit,
} from "../../utils";
import BridgeHandlerProgramIDL from "../../../target/idl/bridge_program.json";
import { BRIDGE_HANDLER_SOLANA_NONCE, BRIDGE_HANDLER_SOLAYER_NONCE, BRIDGE_PROGRAM_ID } from "../../constants";

const SOLANA_MANAGER = loadKeypairFromFile("./keys/devnet/solana_manager.json");
const SOLAYER_MANAGER = loadKeypairFromFile("./keys/devnet/solayer_manager.json");

async function main() {
  const url = process.argv[2] || "https://internalnet-rpc.solayer.org";
  const connection = new Connection(url);
  console.log(`Using RPC URL: ${url}`);
  console.log(`signer wallet public key is: ${SOLAYER_MANAGER.publicKey}`);
  console.log(
    `signer wallet balance is: ${
      (await connection.getBalance(SOLAYER_MANAGER.publicKey)) / LAMPORTS_PER_SOL
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

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const updateGuardianThresholdInst = await program.methods
    .updateGuardianThreshold(1)
    .accounts({
      manager: SOLAYER_MANAGER.publicKey,
      bridgeHandler,
      guardianInfo,
    })
    .instruction();

  tx.add(updateGuardianThresholdInst);

  try {
    const signature = await connection.sendTransaction(tx, [SOLAYER_MANAGER], {
      skipPreflight: true,
    });
    console.log(`signature is: ${signature}`);

    // await connection.confirmTransaction(signature);

    // await sendAndConfirmTransaction(connection, tx, [SOLAYER_MANAGER]).then(log);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

main().then(() => process.exit());
