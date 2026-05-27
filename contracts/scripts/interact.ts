/**
 * interact.ts – Example interaction with ConfidentialToken on Zama Devnet.
 *
 * This script demonstrates the COMPLETE shield → transfer → requestUnshield flow.
 * It must be run against a LIVE DEPLOYMENT on Zama Devnet (or Sepolia with fhEVM).
 *
 * Prerequisites:
 *   1. Deploy the contracts:     npm run deploy:zamaDevnet
 *   2. Set env vars in .env:     LOCAL_CONTRACT_ADDRESS, LOCAL_UNDERLYING_ADDRESS
 *   3. Run:                      npx hardhat run scripts/interact.ts --network zamaDevnet
 *
 * For the encrypted transfer and unshield steps the script shows the exact calls
 * to make.  Client-side fhevmjs encryption must be performed in the browser
 * (see src/hooks/useConfidentialTransfer.ts) or a Node.js script that imports
 * fhevmjs and the @zama-fhe/relayer-sdk.
 *
 * NOTE: This script does NOT import fhevmjs because it is a frontend dependency.
 *       For a self-contained Node.js encryption example, add fhevmjs to
 *       contracts/package.json and follow the fhevmjs docs.
 */

import { ethers } from "hardhat";

const CONFIDENTIAL_TOKEN = process.env.LOCAL_CONTRACT_ADDRESS ?? "";
const MOCK_ERC20 = process.env.LOCAL_UNDERLYING_ADDRESS ?? "";

async function main() {
  if (!CONFIDENTIAL_TOKEN || !MOCK_ERC20) {
    throw new Error(
      "Set LOCAL_CONTRACT_ADDRESS and LOCAL_UNDERLYING_ADDRESS in .env first.\n" +
        "Run `npm run deploy:zamaDevnet` (or deploy:local) to get these addresses."
    );
  }

  const [owner, alice, bob] = await ethers.getSigners();
  const chainId = (await owner.provider.getNetwork()).chainId;

  console.log("=".repeat(60));
  console.log("ConfidentialToken Interaction Demo");
  console.log("=".repeat(60));
  console.log(`Network:   ${chainId}`);
  console.log(`Deployer:  ${owner.address}`);
  console.log(`Alice:     ${alice.address}`);
  console.log(`Bob:       ${bob.address}`);
  console.log();

  const underlying = await ethers.getContractAt("MockERC20", MOCK_ERC20);
  const ct = await ethers.getContractAt("ConfidentialToken", CONFIDENTIAL_TOKEN);

  // ── Step 1: Mint MockERC20 tokens to Alice ──────────────────────────────────
  console.log("[1] Minting 1,000 mUSDC to Alice...");
  const mintAmount = ethers.parseUnits("1000", 6);
  await (await underlying.mint(alice.address, mintAmount)).wait();
  console.log(
    `    Alice public balance: ${ethers.formatUnits(
      await underlying.balanceOf(alice.address),
      6
    )} mUSDC`
  );

  // ── Step 2: Approve + Shield ────────────────────────────────────────────────
  console.log("\n[2] Alice approves and shields 500 mUSDC...");
  const shieldAmount = ethers.parseUnits("500", 6);
  await (
    await underlying.connect(alice).approve(await ct.getAddress(), shieldAmount)
  ).wait();
  const shieldTx = await ct.connect(alice).shield(BigInt(shieldAmount));
  await shieldTx.wait();
  console.log(`    Shield tx: ${shieldTx.hash}`);
  console.log(
    `    Contract holds: ${ethers.formatUnits(
      await underlying.balanceOf(await ct.getAddress()),
      6
    )} mUSDC`
  );
  console.log(
    `    Alice encrypted balance handle: 0x${(await ct.encryptedBalanceOf(alice.address)).toString(16)}`
  );

  // ── Step 3: Confidential Transfer (requires fhevmjs encryption) ──────────────
  console.log("\n[3] Confidential Transfer: Alice → Bob (250 mUSDC)");
  console.log("    NOTE: This step requires fhevmjs to encrypt the amount.");
  console.log("    In the frontend, fhevmjs calls:");
  console.log("      const input = instance.createEncryptedInput(contractAddress, alice.address)");
  console.log("      input.add64(250_000_000n) // 250 mUSDC in smallest unit");
  console.log("      const { handles, inputProof } = await input.encrypt()");
  console.log("      await ct.transfer(bob.address, handles[0], inputProof)");
  console.log();
  console.log("    Skipping encrypted transfer in this script.");
  console.log("    Use the frontend dapp at localhost:3000/transfer to perform this step.");

  // ── Step 4: Unshield ─────────────────────────────────────────────────────────
  console.log("\n[4] Unshield: Alice withdraws 100 mUSDC back to public (encrypted request)");
  console.log("    NOTE: requestUnshield() also requires fhevmjs encryption.");
  console.log("    The Zama Gateway decrypts the amount and calls callbackUnshield().");
  console.log("    On Zama Devnet, the callback fires within ~1-2 blocks (~2-4 seconds).");
  console.log();
  console.log("    Skipping encrypted unshield in this script.");
  console.log("    Use the frontend dapp at localhost:3000/transfer (Unshield tab).");

  console.log("\n=".repeat(60));
  console.log("Interaction demo complete.");
  console.log("Next: open the frontend dapp to perform encrypted operations.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
