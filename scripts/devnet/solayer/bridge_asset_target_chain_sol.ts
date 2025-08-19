import { sha256 } from "@noble/hashes/sha256";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getMessageHash,
  getMessageHashForBridgeAssetTargetChainSol,
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
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const SOLAYER_OPERATOR = loadKeypairFromFile(
  "./keys/devnet/solayer_operator.json"
);
const SOL_MINT_PUBKEY = new PublicKey(
  "So11111111111111111111111111111111111111111"
);
const RECIPIENT = loadKeypairFromFile("./keys/devnet/recipient.json");
const SENDER = loadKeypairFromFile("./keys/devnet/sender.json");
const RECEIVE_AMOUNT = new anchor.BN(996000000);
const NONCE = new anchor.BN(2);
const SOURCE_TX_ID = bs58.decode(
  "3JZV3HRfeHSR9HmSn3AKek3qb1SWzkApWex4nRsMNAX4CfgzdhyhkqKk1PmPo1t7VxeSNBqz76XX24P4gXPMZot4"
);

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

  const msgHash = await getMessageHashForBridgeAssetTargetChainSol(
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOL_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID
  );

  let hashedSourceTxId = sha256(SOURCE_TX_ID);
  const [bridgeProof, bridgeProofBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bridge_proof"), bridgeHandler.toBuffer(), Buffer.from(hashedSourceTxId)],
    program.programId
  );

  const [guardianInfo, guardianBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("guardian_info"), bridgeHandler.toBuffer()],
    program.programId
  );

  const verifiedSignatures = PublicKey.findProgramAddressSync(
    [
      Buffer.from("verified_signatures"),
      bridgeHandler.toBuffer(),
      Buffer.from(msgHash),
    ],
    program.programId
  )[0];

  console.log(`bridge handler is: ${bridgeHandler.toString()}`);
  console.log(`guardian info is: ${guardianInfo.toString()}`);
  console.log(`bridge proof is: ${bridgeProof.toString()}`);

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const bridgeAssetTargetChainSolInst = await program.methods
    .bridgeAssetTargetChainSol(
      Buffer.from(msgHash),
      SOURCE_TX_ID,
      SENDER.publicKey,
      RECEIVE_AMOUNT,
      NONCE
    )
    .accounts({
      operator: SOLAYER_OPERATOR.publicKey,
      recipient: RECIPIENT.publicKey,
      bridgeHandler,
      bridgeProof,
      guardianInfo,
      verifiedSignatures,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(bridgeAssetTargetChainSolInst);

  try {
    const signature = await connection.sendTransaction(tx, [SOLAYER_OPERATOR], {
      skipPreflight: true,
    });
    console.log(`signature is: ${signature}`);

    // await sendAndConfirmTransaction(connection, tx, [SOLAYER_OPERATOR]).then(
    //   log
    // );
  } catch (error) {
    console.error(error);
  }
}

main().then(() => process.exit());
