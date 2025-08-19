import { sha256 } from '@noble/hashes/sha256';
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
  getMessageHash,
  loadKeypairFromFile,
  log,
  newTransactionWithComputeUnitPriceAndLimit,
} from "../../utils";
import BridgeHandlerProgramIDL from "../../../target/idl/bridge_program.json";
import {
  BRIDGE_HANDLER_SOLANA_NONCE,
  BRIDGE_HANDLER_SOLAYER_NONCE,
  BRIDGE_PROGRAM_ID,
} from "../../constants";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const SOLANA_OPERATOR = loadKeypairFromFile(
  "./keys/devnet/solana_operator.json"
);
const SOLAYER_OPERATOR = loadKeypairFromFile(
  "./keys/devnet/solayer_operator.json"
);
const SOLANA_MINT = loadKeypairFromFile("./keys/devnet/solana_mint.json");
const SOLAYER_MINT = loadKeypairFromFile("./keys/devnet/solayer_mint.json");
const RECIPIENT = loadKeypairFromFile("./keys/devnet/recipient.json");
const SENDER = loadKeypairFromFile("./keys/devnet/sender.json");
const RECEIVE_AMOUNT = new anchor.BN(996000000);
const NONCE = new anchor.BN(5);
const SOURCE_TX_ID = bs58.decode(
  "d7dmqXnY47RVMZ6PUAKWuSfBUgzFiGCYSxpZGpCMoatpaGYYhT6XgbfYw4KqQHXZrUdnBHAi6zxk3JE7SZhyHhr"
);
const ADDITIONAL_SOL_GAS = new anchor.BN(0);

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

  const bridgeHandlerVault = getAssociatedTokenAddressSync(
    SOLAYER_MINT.publicKey,
    bridgeHandler,
    true
  );

  const recipientVault = getAssociatedTokenAddressSync(
    SOLAYER_MINT.publicKey,
    RECIPIENT.publicKey,
    true
  );

  const msgHash = await getMessageHash(
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLAYER_MINT.publicKey,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
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

  const [tokenInfo, tokenInfoBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_info"), bridgeHandler.toBuffer(), SOLAYER_MINT.publicKey.toBuffer()],
    program.programId
  );

  console.log(`bridge handler is: ${bridgeHandler.toString()}`);
  console.log(`guardian info is: ${guardianInfo.toString()}`);
  console.log(`bridge proof is: ${bridgeProof.toString()}`);

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const bridgeAssetTargetChainInst = await program.methods
    .bridgeAssetTargetChain(
      Buffer.from(msgHash),
      SOURCE_TX_ID,
      SENDER.publicKey,
      SOLAYER_MINT.publicKey, // source mint
      RECEIVE_AMOUNT,
      NONCE,
      ADDITIONAL_SOL_GAS
    )
    .accounts({
      operator: SOLAYER_OPERATOR.publicKey,
      mint: SOLAYER_MINT.publicKey,
      recipient: RECIPIENT.publicKey,
      recipientVault,
      bridgeHandler,
      bridgeHandlerVault,
      bridgeProof,
      guardianInfo,
      verifiedSignatures,
      tokenInfo,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  tx.add(bridgeAssetTargetChainInst);

  try {
    await sendAndConfirmTransaction(connection, tx, [SOLAYER_OPERATOR]).then(
      log
    );
  } catch (error) {
    console.error(error);
  }
}

main().then(() => process.exit());
