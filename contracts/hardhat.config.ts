import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

/**
 * Hardhat configuration for the full three-layer stack.
 *
 * Layer 1 — Base (settlement):
 *   baseSepolia : Base Sepolia testnet (chain 84532) — primary testnet
 *   base        : Base mainnet (chain 8453)
 *
 * Layer 2 — Zama fhEVM (confidential compute):
 *   zamaDevnet  : Zama Devnet (chain 9000) — fhEVM with real precompiles
 *   sepolia     : Ethereum Sepolia (chain 11155111) — Zama also deploys here
 *
 * Local:
 *   hardhat     : Standard Hardhat local node (no fhEVM precompiles)
 *                 Suitable for BaseVault.sol tests (no TFHE calls).
 *                 NOT suitable for ConfidentialToken / ConfidentialStrategyAgent
 *                 without the fhEVM mock (which requires v2 SDK).
 *
 * NOTES:
 *  • BaseVault.sol does NOT use TFHE — all its tests run on local Hardhat.
 *  • ConfidentialToken / ConfidentialStrategyAgent require Zama precompiles.
 *    Run those tests with FHEVM_NETWORK=zamaDevnet after live deployment.
 */

const PRIVATE_KEY     = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const ETHERSCAN_KEY   = process.env.ETHERSCAN_API_KEY    ?? "";
const BASESCAN_KEY    = process.env.BASESCAN_API_KEY     ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 500 },
      // cancun required for EIP-1153 transient storage used by TFHE.allowTransient
      evmVersion: "cancun",
    },
  },

  networks: {
    // ── Local ──────────────────────────────────────────────────────────────
    hardhat: {
      // No fhEVM precompiles. BaseVault tests run here; TFHE tests skip.
    },

    // ── Base (Layer 1 — Settlement) ──────────────────────────────────────
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
      chainId: 84532,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    base: {
      url: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
      chainId: 8453,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },

    // ── Zama fhEVM (Layer 2 — Confidential Compute) ──────────────────────
    zamaDevnet: {
      url: process.env.ZAMA_DEVNET_RPC ?? "https://devnet.zama.ai",
      chainId: 9000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },

  etherscan: {
    apiKey: {
      sepolia:     ETHERSCAN_KEY,
      baseSepolia: BASESCAN_KEY,
      base:        BASESCAN_KEY,
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL:     "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL:     "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;
