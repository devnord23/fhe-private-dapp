/**
 * deployBaseVault.ts — Deploy BaseVault.sol to Base Sepolia or Base mainnet.
 *
 * BaseVault is the Layer 1 settlement contract. It:
 *   • Accepts ERC-20 deposits from users on Base
 *   • Emits events (DepositCreated, WithdrawalRequested) for the relayer
 *   • Holds funds until the relayer bridges them to/from Zama fhEVM
 *
 * Usage:
 *   npm run deploy:vault:baseSepolia   ← testnet (recommended first)
 *   npm run deploy:vault:base          ← mainnet (ONLY after full testing)
 *
 * Prerequisites:
 *   1. Set DEPLOYER_PRIVATE_KEY in contracts/.env
 *   2. Ensure deployer has ETH on the target chain for gas
 *
 * After deployment:
 *   1. Copy BASEVAULT_ADDRESS to frontend .env.local:
 *      NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA=<address>
 *   2. Test with MockERC20 (deploy via npm run deploy:local first to get address)
 *   3. Set relayer address once bridge is implemented: vault.setRelayer(bridgeAddr)
 */

import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await deployer.provider.getNetwork()).chainId;

  // Safety check: prevent accidental mainnet deploy during development
  if (chainId === 8453n) {
    const confirm = process.env.CONFIRM_MAINNET_DEPLOY;
    if (confirm !== "yes-i-am-sure") {
      throw new Error(
        "Refusing to deploy to Base mainnet without CONFIRM_MAINNET_DEPLOY=yes-i-am-sure.\n" +
          "This is a safety guard. Test on Base Sepolia first."
      );
    }
  }

  console.log("=".repeat(60));
  console.log("BaseVault Deployment — Layer 1 Settlement Contract");
  console.log("=".repeat(60));
  console.log(`Network  : ${network.name} (chain ID ${chainId})`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(
    `Balance  : ${ethers.formatEther(
      await deployer.provider.getBalance(deployer.address)
    )} ETH`
  );
  console.log();

  // ── Step 1: Deploy a MockERC20 if no underlying token configured ────────────
  let testTokenAddress = process.env.TEST_TOKEN_ADDRESS ?? "";

  if (!testTokenAddress || testTokenAddress === "0x0000000000000000000000000000000000000000") {
    console.log("TEST_TOKEN_ADDRESS not set → deploying MockERC20 for testing…");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mock = await MockERC20.deploy(
      "Mock USDC",
      "mUSDC",
      6,
      deployer.address
    );
    await mock.waitForDeployment();
    testTokenAddress = await mock.getAddress();

    // Mint 1 million mUSDC to deployer
    await mock.mint(deployer.address, ethers.parseUnits("1000000", 6));
    console.log(`✓ MockERC20 deployed     : ${testTokenAddress}`);
    console.log(`✓ Minted 1,000,000 mUSDC to deployer`);
  } else {
    console.log(`✓ Using test token       : ${testTokenAddress}`);
  }

  // ── Step 2: Deploy BaseVault ─────────────────────────────────────────────────
  //
  // Initially the deployer acts as the relayer. Once the cross-chain bridge
  // is deployed, call vault.setRelayer(bridgeContractAddress).
  const BaseVault = await ethers.getContractFactory("BaseVault");
  const vault = await BaseVault.deploy(
    deployer.address, // owner
    deployer.address  // relayer (initially the deployer; update after bridge deployment)
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log(`✓ BaseVault deployed     : ${vaultAddress}`);
  console.log(`  Owner                  : ${deployer.address}`);
  console.log(`  Relayer (initial)      : ${deployer.address}`);
  console.log(`  → Update relayer once bridge is deployed via setRelayer(bridgeAddr)`);
  console.log();

  // ── Step 3: Print next steps ─────────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("Next Steps");
  console.log("=".repeat(60));
  console.log();

  if (network.name === "baseSepolia") {
    console.log("1. Add to frontend .env.local:");
    console.log(`   NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA=${vaultAddress}`);
  } else if (network.name === "base") {
    console.log("1. Add to frontend .env.local:");
    console.log(`   NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE=${vaultAddress}`);
  } else {
    console.log("1. For local testing, update vault address in your test config.");
  }

  console.log();
  console.log("2. Test the deposit flow:");
  console.log(`   MockERC20 : ${testTokenAddress}`);
  console.log(`   BaseVault : ${vaultAddress}`);
  console.log(`   a. Approve: mUSDC.approve(vaultAddress, amount)`);
  console.log(`   b. Deposit: vault.deposit(mUSDCAddress, amount, strategyId)`);
  console.log(`   c. Check:   vault.getAvailableBalance(wallet, mUSDCAddress)`);
  console.log();
  console.log("3. Deploy relayer bridge (TODO) and call vault.setRelayer(bridgeAddr).");
  console.log("4. Deploy ConfidentialToken on Zama fhEVM side (npm run deploy:zamaDevnet).");
  console.log();
  console.log(
    "5. Verify on Basescan (after deployment):\n" +
      `   npx hardhat verify --network ${network.name} ${vaultAddress} ` +
      `${deployer.address} ${deployer.address}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
