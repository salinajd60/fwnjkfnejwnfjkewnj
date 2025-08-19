import * as anchor from "@coral-xyz/anchor";
import {
  clusterApiUrl,
  Connection,
  Ed25519Program,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  constructSig,
  getMessageHash,
  loadKeypairFromFile,
  log,
  makeEd25519InstDataPacked,
  newTransactionWithComputeUnitPriceAndLimit,
} from "../../utils";
import BridgeHandlerProgramIDL from "../../../target/idl/bridge_program.json";
import {
  BRIDGE_HANDLER_SOLANA_NONCE,
  BRIDGE_PROGRAM_ID,
  U16_MAX,
} from "../../constants";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Ed25519Signature } from "../../types";

const SOLANA_OPERATOR = loadKeypairFromFile(
  "./keys/devnet/solana_operator.json"
);
const SOLANA_MINT_PUBKEY = new PublicKey("So11111111111111111111111111111111111111112");
const RECIPIENT = loadKeypairFromFile("./keys/devnet/recipient.json");
const SENDER = loadKeypairFromFile("./keys/devnet/sender.json");
const RECEIVE_AMOUNT = new anchor.BN(996000000);
const NONCE = new anchor.BN(8);
const SOURCE_TX_ID = bs58.decode(
  "3eRGHPhnL8WCpNgiEThqkBjU52VRFHAd6B7YxsrTzSwiGDA4sN23KNarZfSwrHDPw3ZohNKoFi5ohMtr4FtiFUCX"
);
const ADDITIONAL_SOL_GAS = new anchor.BN(0);

const GUARDIAN1_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian1.json");
const GUARDIAN2_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian2.json");
const GUARDIAN3_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian3.json");
const GUARDIAN4_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian4.json");
const GUARDIAN5_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian5.json");
const GUARDIAN6_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian6.json");
const GUARDIAN7_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian7.json");
const GUARDIAN8_KEYPAIR = loadKeypairFromFile("./keys/devnet/guardian8.json");

async function constructInputSigs(): Promise<Ed25519Signature[]> {
  const ed25519sig1 = await constructSig(
    GUARDIAN1_KEYPAIR,
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
  );

  const ed25519sig2 = await constructSig(
    GUARDIAN2_KEYPAIR,
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
  );

  const ed25519sig3 = await constructSig(
    GUARDIAN3_KEYPAIR,
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
  );

  const ed25519sig4 = await constructSig(
    GUARDIAN4_KEYPAIR,
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
  );

  const ed25519sig5 = await constructSig(
    GUARDIAN5_KEYPAIR,
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
  );

  const ed25519sig6 = await constructSig(
    GUARDIAN6_KEYPAIR,
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
  );

  const ed25519sig7 = await constructSig(
    GUARDIAN7_KEYPAIR,
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
  );

  const ed25519sig8 = await constructSig(
    GUARDIAN8_KEYPAIR,
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
  );

  return [ed25519sig1];//, ed25519sig2, ed25519sig3, ed25519sig4, ed25519sig5, ed25519sig6];
}

async function main() {
  const url = process.argv[2] || "https://api.devnet.solana.com";
  const connection = new Connection(url);
  console.log(`Using RPC URL: ${url}`);
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

  const init_nonce = new anchor.BN(BRIDGE_HANDLER_SOLANA_NONCE);

  const [bridgeHandler, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("bridge_handler"), init_nonce.toArrayLike(Buffer, "be", 8)],
    program.programId
  );

  const [guardianInfo, guardianBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("guardian_info"), bridgeHandler.toBuffer()],
    program.programId
  );

  const msgHash = await getMessageHash(
    SENDER.publicKey,
    RECIPIENT.publicKey,
    SOLANA_MINT_PUBKEY,
    RECEIVE_AMOUNT,
    NONCE,
    SOURCE_TX_ID,
    ADDITIONAL_SOL_GAS
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
  console.log("verified signatures is: ", verifiedSignatures.toString());
  console.log(`guardian info is: ${guardianInfo.toString()}`);

  const inputSigs = await constructInputSigs();

  let tx = newTransactionWithComputeUnitPriceAndLimit();

  const ed25519Inst = new TransactionInstruction({
    keys: [],
    programId: Ed25519Program.programId,
    data: Buffer.from(await makeEd25519InstDataPacked(inputSigs, U16_MAX)),
  });

  tx.add(ed25519Inst);

  const verifySignatureInst = await program.methods
    .verifySignature(Buffer.from(msgHash), Buffer.from([0]))
    .accounts({
      operator: SOLANA_OPERATOR.publicKey,
      bridgeHandler,
      guardianInfo,
      verifiedSignatures,
      systemProgram: SystemProgram.programId,
      ixSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  tx.add(verifySignatureInst);

  try {
    const signature = await connection.sendTransaction(tx, [SOLANA_OPERATOR], {
      skipPreflight: true,
    });
    console.log(`signature is: ${signature}`);

    // await sendAndConfirmTransaction(connection, tx, [SOLAYER_OPERATOR]).then(
    //   log
    // );
  } catch (error) {
    console.error(error);
    throw error;
  }
}

main().then(() => process.exit());
