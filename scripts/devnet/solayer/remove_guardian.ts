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
import { BRIDGE_HANDLER_SOLAYER_NONCE, BRIDGE_PROGRAM_ID } from "../../constants";

const SOLAYER_MANAGER = loadKeypairFromFile("./keys/devnet/solayer_manager.json");
const GUARDIAN1_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian1.json");
const GUARDIAN2_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian2.json");
const GUARDIAN3_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian3.json");
const GUARDIAN4_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian4.json");
const GUARDIAN5_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian5.json");
const GUARDIAN6_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian6.json");
const GUARDIAN7_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian7.json");
const GUARDIAN8_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian8.json");
const GUARDIAN_KEYPAIRS = [
  // GUARDIAN1_KEYPAIR,
  // GUARDIAN2_KEYPAIR,
  // GUARDIAN3_KEYPAIR,
  // GUARDIAN4_KEYPAIR,
  // GUARDIAN5_KEYPAIR,
  GUARDIAN6_KEYPAIR,
  GUARDIAN7_KEYPAIR,
  GUARDIAN8_KEYPAIR,
];

async function main() {
  const url = process.argv[2] || "https://devnet-rpc.solayer.org";
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

  for (let i = 0; i < GUARDIAN_KEYPAIRS.length; i++) {
    const guardianKeypair = GUARDIAN_KEYPAIRS[i];
    const removeGuardianInst = await program.methods
      .removeGuardian()
      .accounts({
        manager: SOLAYER_MANAGER.publicKey,
        bridgeHandler,
        guardianInfo,
        guardian: guardianKeypair.publicKey,
      })
      .instruction();

    tx.add(removeGuardianInst);
  }
  try {
    await sendAndConfirmTransaction(connection, tx, [SOLAYER_MANAGER]).then(log);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

main().then(() => process.exit());
