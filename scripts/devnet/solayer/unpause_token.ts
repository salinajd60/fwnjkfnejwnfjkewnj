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
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const SOLAYER_MANAGER = loadKeypairFromFile(
  "./keys/devnet/solayer_manager.json"
);
const SOLAYER_MINT_PUBKEY = new PublicKey("LAYER4xPpTCb3QL8S9u41EAhAX7mhBn8Q6xMTwY2Yzc");

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

  const [tokenInfo, tokenInfoBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_info"), bridgeHandler.toBuffer(), SOLAYER_MINT_PUBKEY.toBuffer()],
    program.programId
  );

  console.log(`bridge handler is: ${bridgeHandler.toString()}`);

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const unpauseTokenInst = await program.methods
    .unpauseToken()
    .accounts({
      manager: SOLAYER_MANAGER.publicKey,
      bridgeHandler,
      mint: SOLAYER_MINT_PUBKEY,
      tokenInfo,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  tx.add(unpauseTokenInst);

  try {
    const signature = await connection.sendTransaction(tx, [SOLAYER_MANAGER]);
    console.log(`signature is: ${signature}`);

    // await connection.confirmTransaction(signature);

    // await sendAndConfirmTransaction(connection, tx, [SOLAYER_MANAGER]).then(log);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

main().then(() => process.exit());
