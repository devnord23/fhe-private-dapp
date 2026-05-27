/**
 * interact.ts – Example interaction script for ConfidentialToken on a local Hardhat node.
 *
 * Demonstrates the full shield → transfer → requestUnshield flow.
 * Run: npm run interact:local
 *
 * NOTE: This script runs in a Node.js / Hardhat context.
 *       The `fhevmjs` client-side encryption (createEncryptedInput) is done here
 *       using the Hardhat fhEVM mock which lets you encrypt values in tests/scripts
 *       the same way a browser wallet would.
 */

import { ethers } from "hardhat";
import { createInstances } from "fhevm/lib/fhevmjsMock";
// ^ The mock version of fhevmjs, provided by the fhevm Hardhat plugin.
//   In the browser you use `createInstance` from 'fhevmjs' instead.

const CONFIDENTIAL_TOKEN = process.env.LOCAL_CONTRACT_ADDRESS ?? "";
const MOCK_ERC20 = process.env.LOCAL_UNDERLYING_ADDRESS ?? "";

async function main() {
  const [owner, alice, bob] = await ethers.getSigners();

  if (!CONFIDENTIAL_TOKEN || !MOCK_ERC20) {
    throw new Error(
      "Set LOCAL_CONTRACT_ADDRESS and LOCAL_UNDERLYING_ADDRESS in .env before running interact.ts.\n" +
        "Run `npm run deploy:local` first."
    );
  }

  const underlying = await ethers.getContractAt("MockERC20", MOCK_ERC20);
  const ct = await ethers.getContractAt("ConfidentialToken", CONFIDENTIAL_TOKEN);

  // ── Setup: mint tokens and approve ─────────────────────────────────────────
  const shieldAmount = ethers.parseUnits("1000", 6); // 1,000 mUSDC (6 decimals)
  await underlying.mint(alice.address, shieldAmount);
  await underlying.connect(alice).approve(CONFIDENTIAL_TOKEN, shieldAmount);

  console.log(`Alice's public mUSDC before shield: ${ethers.formatUnits(
    await underlying.balanceOf(alice.address), 6
  )}`);

  // ── Step 1: Shield – deposit into confidential pool ─────────────────────────
  console.log("\n[1] Shielding 1,000 mUSDC for Alice...");
  const shieldTx = await ct.connect(alice).shield(shieldAmount);
  await shieldTx.wait();
  console.log(`    Tx: ${shieldTx.hash}`);

  // ── Step 2: Confidential transfer Alice → Bob ────────────────────────────────
  console.log("\n[2] Alice sends 250 mUSDC to Bob (confidentially)...");

  // Create a mock fhEVM instance for Alice.
  // In the browser this would be: const instance = await createInstance({ chainId, networkUrl })
  const { instance: aliceInstance } = await createInstances(alice.address, ethers, alice);

  // Encrypt the transfer amount using Alice's instance.
  // In the browser: instance.createEncryptedInput(contractAddress, userAddress).add64(amount)
  const transferAmountPlain = BigInt(250 * 10 ** 6); // 250 mUSDC in smallest unit
  const encryptedInput = aliceInstance.createEncryptedInput(CONFIDENTIAL_TOKEN, alice.address);
  encryptedInput.add64(transferAmountPlain);
  const { handles, inputProof } = await encryptedInput.encrypt();

  const transferTx = await ct.connect(alice).transfer(
    bob.address,
    handles[0], // bytes32 encrypted handle
    inputProof  // bytes proof
  );
  await transferTx.wait();
  console.log(`    Tx: ${transferTx.hash}`);
  console.log("    Amount is encrypted – observers cannot see 250 mUSDC in this tx.");

  // ── Step 3: Re-encrypt Bob's balance to verify ───────────────────────────────
  console.log("\n[3] Re-encrypting Bob's shielded balance to verify receipt...");

  const { instance: bobInstance, publicKey: bobPubKey } = await createInstances(
    bob.address, ethers, bob
  );

  const encryptedBobBalance = await ct.encryptedBalanceOf(bob.address);
  // reencrypt decrypts the ciphertext using Bob's key pair (mocked in tests)
  const bobBalance = await bobInstance.reencrypt(
    encryptedBobBalance,
    bobPubKey,
    CONFIDENTIAL_TOKEN,
    bob.address
  );
  console.log(`    Bob's shielded balance: ${Number(bobBalance) / 10 ** 6} mUSDC`);

  // ── Step 4: Request unshield ─────────────────────────────────────────────────
  console.log("\n[4] Bob requests unshield of 100 mUSDC...");

  const { instance: bobInstance2 } = await createInstances(bob.address, ethers, bob);
  const unshieldInput = bobInstance2.createEncryptedInput(CONFIDENTIAL_TOKEN, bob.address);
  unshieldInput.add64(BigInt(100 * 10 ** 6));
  const { handles: unshieldHandles, inputProof: unshieldProof } = await unshieldInput.encrypt();

  const unshieldTx = await ct.connect(bob).requestUnshield(
    unshieldHandles[0],
    unshieldProof,
    bob.address
  );
  const unshieldReceipt = await unshieldTx.wait();
  console.log(`    requestUnshield Tx: ${unshieldTx.hash}`);

  // In the mock, the Gateway callback fires synchronously within the same block.
  // On a real network, the Gateway decrypts asynchronously (may take 1-2 blocks).
  console.log(`    Bob's public mUSDC after unshield: ${ethers.formatUnits(
    await underlying.balanceOf(bob.address), 6
  )} mUSDC`);

  console.log("\n✓ Interaction complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
