import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "fhevm/hardhat";
import dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";

/**
 * Network configuration for Zama fhEVM deployments.
 *
 * Supported targets:
 *   - hardhat   : Local mocked fhEVM (no real nodes; uses fhevm/hardhat mock plugin)
 *   - zamaDevnet: Zama's public devnet (chain ID 9000)
 *   - sepolia   : Ethereum Sepolia – only valid if Zama has deployed fhEVM precompiles there
 *
 * Check https://docs.zama.ai/fhevm for the latest network details and chain IDs.
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
      // cancun EVM version enables transient storage (EIP-1153) used by fhEVM ACL
      evmVersion: "cancun",
    },
  },

  networks: {
    // ── Local ──────────────────────────────────────────────────────────────────
    hardhat: {
      // The fhevm/hardhat plugin automatically installs the mock precompile contracts.
      // No extra configuration needed here.
    },

    // ── Zama Devnet ────────────────────────────────────────────────────────────
    zamaDevnet: {
      url: process.env.ZAMA_DEVNET_RPC ?? "https://devnet.zama.ai",
      chainId: 9000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },

    // ── Ethereum Sepolia ───────────────────────────────────────────────────────
    // Only use this if Zama's fhEVM precompiles are deployed on Sepolia.
    // Check the official docs before deploying here.
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
  },

  // ── Type generation ───────────────────────────────────────────────────────────
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },

  // ── Etherscan verification ────────────────────────────────────────────────────
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      // Zama Devnet does not currently support Etherscan verification.
    },
  },

  // ── Gas reporter ─────────────────────────────────────────────────────────────
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;
