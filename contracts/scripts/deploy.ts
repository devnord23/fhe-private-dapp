/**
 * deploy.ts – Deploy ConfidentialToken (and optionally MockERC20) to any supported network.
 *
 * Usage:
 *   npm run deploy:local         – Hardhat local node (fhEVM mock)
 *   npm run deploy:zamaDevnet    – Zama Devnet (chain ID 9000, real fhEVM)
 *   npm run deploy:sepolia       – Ethereum Sepolia (only if fhEVM precompiles are live)
 *
 * Environment variables (from .env):
 *   DEPLOYER_PRIVATE_KEY         – Deployer's private key
 *   UNDERLYING_TOKEN_ADDRESS     – Existing ERC-20 to wrap (leave empty to deploy MockERC20)
 *
 * After deployment, copy the printed contract address to the frontend .env.local:
 *   NEXT_PUBLIC_CONTRACT_ADDRESS_ZAMA_DEVNET=<ConfidentialToken address>
 */

import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await deployer.provider.getNetwork()).chainId;

  console.log("=".repeat(60));
  console.log("ConfidentialToken Deployment");
  console.log("=".repeat(60));
  console.log(`Network    : ${network.name} (chain ID ${chainId})`);
  console.log(`Deployer   : ${deployer.address}`);
  console.log(
    `Balance    : ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`
  );
  console.log();

  // ── Step 1: Resolve underlying ERC-20 ──────────────────────────────────────
  let underlyingAddress: string = process.env.UNDERLYING_TOKEN_ADDRESS ?? "";

  if (!underlyingAddress || underlyingAddress === "0x0000000000000000000000000000000000000000") {
    console.log("UNDERLYING_TOKEN_ADDRESS not set → deploying MockERC20 for testing...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mock = await MockERC20.deploy(
      "Mock USDC",
      "mUSDC",
      6, // 6 decimals like USDC
      deployer.address
    );
    await mock.waitForDeployment();
    underlyingAddress = await mock.getAddress();

    // Mint 1,000,000 mUSDC to deployer for testing
    const mintAmount = ethers.parseUnits("1000000", 6);
    await mock.mint(deployer.address, mintAmount);

    console.log(`✓ MockERC20 deployed  : ${underlyingAddress}`);
    console.log(`✓ Minted 1,000,000 mUSDC to deployer`);
  } else {
    console.log(`✓ Using existing ERC-20: ${underlyingAddress}`);
  }

  // ── Step 2: Deploy ConfidentialToken ────────────────────────────────────────
  const ConfidentialToken = await ethers.getContractFactory("ConfidentialToken");
  const confidentialToken = await ConfidentialToken.deploy(
    underlyingAddress,
    "Confidential USDC",
    "cUSDC",
    deployer.address
  );
  await confidentialToken.waitForDeployment();
  const contractAddress = await confidentialToken.getAddress();

  console.log(`✓ ConfidentialToken    : ${contractAddress}`);
  console.log();

  // ── Step 3: Print next steps ────────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("Next steps:");
  console.log("=".repeat(60));
  console.log();
  console.log("1. Add to frontend .env.local:");
  if (network.name === "zamaDevnet") {
    console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS_ZAMA_DEVNET=${contractAddress}`);
  } else if (network.name === "sepolia") {
    console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA=${contractAddress}`);
  } else {
    console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS_LOCAL=${contractAddress}`);
  }
  console.log();
  console.log("2. Approve ConfidentialToken to spend your ERC-20:");
  console.log(`   underlying.approve("${contractAddress}", amount)`);
  console.log();
  console.log("3. Call shield(amount) to move tokens into the confidential pool.");
  console.log();
  console.log("4. Use fhevmjs in the frontend to encrypt amounts for transfer().");
  console.log("   See src/lib/fhevm.ts for the integration helper.");

  return { contractAddress, underlyingAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
