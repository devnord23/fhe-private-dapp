/**
 * deployAgent.ts – Deploy ConfidentialStrategyAgent to any supported network.
 *
 * Usage:
 *   npm run deploy:agent:local        – Hardhat local node
 *   npm run deploy:agent:zamaDevnet   – Zama Devnet (chain ID 9000, real fhEVM)
 *   npm run deploy:agent:sepolia      – Ethereum Sepolia
 *
 * After deployment:
 *   1. Copy STRATEGY_AGENT_ADDRESS to frontend .env.local
 *   2. Call authorizeAgent(agentAddress, true) from the protocol owner
 *   3. Use the frontend at /strategy to create strategies
 */

import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await deployer.provider.getNetwork()).chainId;

  console.log("=".repeat(60));
  console.log("ConfidentialStrategyAgent Deployment");
  console.log("=".repeat(60));
  console.log(`Network:  ${network.name} (chain ID ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(
    `Balance:  ${ethers.formatEther(
      await deployer.provider.getBalance(deployer.address)
    )} ETH`
  );
  console.log();

  // Deploy ConfidentialStrategyAgent
  const Factory = await ethers.getContractFactory("ConfidentialStrategyAgent");
  console.log("Deploying ConfidentialStrategyAgent...");
  const csa = await Factory.deploy(deployer.address);
  await csa.waitForDeployment();
  const contractAddress = await csa.getAddress();

  console.log(`✓ ConfidentialStrategyAgent: ${contractAddress}`);
  console.log();

  // Authorize the deployer as the initial agent (for testing)
  console.log("Authorizing deployer as initial agent...");
  const tx = await csa.authorizeAgent(deployer.address, true);
  await tx.wait();
  console.log(`✓ Agent authorized: ${deployer.address}`);
  console.log();

  // Print next steps
  console.log("=".repeat(60));
  console.log("Next Steps");
  console.log("=".repeat(60));
  console.log();
  console.log("1. Add to frontend .env.local:");
  if (network.name === "zamaDevnet") {
    console.log(
      `   NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_ZAMA_DEVNET=${contractAddress}`
    );
  } else if (network.name === "sepolia") {
    console.log(
      `   NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_SEPOLIA=${contractAddress}`
    );
  } else {
    console.log(`   NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_LOCAL=${contractAddress}`);
  }
  console.log();
  console.log(
    "2. Authorize additional agent addresses using authorizeAgent(addr, true)."
  );
  console.log(
    "3. Open the frontend at /strategy to create encrypted strategies."
  );
  console.log(
    "4. The agent dashboard at /strategy will let you simulate evaluations."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
