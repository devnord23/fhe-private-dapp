import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

/**
 * Hardhat configuration for ConfidentialToken.
 *
 * NOTE: The fhEVM Hardhat mock plugin (previously `fhevm/hardhat`) does NOT exist
 * in fhevm@0.6.x.  A separate plugin ecosystem (@fhevm/hardhat-plugin v0.4+) exists
 * for fhEVM v2 (@fhevm/solidity), but it is not compatible with the Solidity library
 * version used here (fhevm@0.6.2 / TFHE.sol).
 *
 * As a result:
 *  - Local Hardhat tests can compile and run the contract but TFHE precompile
 *    calls will behave as calls to empty addresses (see test comments).
 *  - Full end-to-end FHE tests must run on Zama Devnet (chainId 9000) or
 *    Ethereum Sepolia with Zama's fhEVM precompiles deployed.
 *
 * Supported networks:
 *   hardhat      – local; Solidity compiles, basic unit tests pass, TFHE ops are stubs
 *   zamaDevnet   – Zama Devnet (real fhEVM, real encrypted operations)
 *   sepolia      – Ethereum Sepolia (requires Zama precompiles deployed there)
 */

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
      // cancun is required for EIP-1153 transient storage used by TFHE.allowTransient
      evmVersion: "cancun",
    },
  },

  networks: {
    hardhat: {
      // No fhEVM precompiles here. TFHE calls silently succeed or fail
      // depending on how Solidity handles calls to empty addresses.
      // Use only for compilation checks and input-validation tests.
    },

    zamaDevnet: {
      url: process.env.ZAMA_DEVNET_RPC ?? "https://devnet.zama.ai",
      chainId: 9000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },

    sepolia: {
      url: process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },

  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;
