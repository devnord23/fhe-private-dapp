/**
 * config.ts — Environment variable loading and validation.
 *
 * All configuration comes from environment variables (see .env.example).
 * The relayer refuses to start if required vars are missing.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val || val === "0x" + "0".repeat(64) || val === "0x" + "0".repeat(40)) {
    throw new Error(
      `[config] Required env var "${key}" is missing or set to a zero address. ` +
        `Check .env (copy .env.example and fill in values).`
    );
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) throw new Error(`[config] "${key}" must be an integer, got: ${val}`);
  return parsed;
}

/**
 * Validated relayer configuration.
 *
 * TESTNET MVP NOTE:
 *   - RELAYER_PRIVATE_KEY must be funded with ETH on Base Sepolia for gas.
 *   - The relayer wallet must be authorized on BaseVault via setRelayer().
 *   - This wallet should NEVER hold user funds — it only calls contract functions.
 */
export const Config = {
  baseSepolia: {
    rpcUrl:       optional("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org"),
    chainId:      84532 as const,
    vaultAddress: optional("BASE_VAULT_ADDRESS", "0x0000000000000000000000000000000000000000") as `0x${string}`,
  },

  zamaFhevm: {
    rpcUrl:                optional("ZAMA_DEVNET_RPC_URL", "https://devnet.zama.ai"),
    chainId:               9000 as const,
    strategyAgentAddress:  optional("CONFIDENTIAL_STRATEGY_AGENT_ADDRESS", "0x0000000000000000000000000000000000000000") as `0x${string}`,
    confidentialTokenAddress: optional("CONFIDENTIAL_TOKEN_ADDRESS", "0x0000000000000000000000000000000000000000") as `0x${string}`,
  },

  relayer: {
    privateKey: process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined,
    pollingIntervalMs:          optionalInt("POLLING_INTERVAL_MS", 12_000),
    confirmationBlocks:         optionalInt("CONFIRMATION_BLOCKS", 2),
    /**
     * TESTNET ONLY: auto-complete withdrawals after this many blocks
     * without verifying the Zama-side unshield.
     *
     * TODO (production): Replace with actual Zama Unshielded event verification.
     */
    withdrawalAutoCompleteDelayBlocks: optionalInt("WITHDRAWAL_AUTO_COMPLETE_DELAY_BLOCKS", 10),
  },

  stateFilePath: optional("STATE_FILE_PATH", "./state/state.json"),
  logLevel:      optional("LOG_LEVEL", "info") as "debug" | "info" | "warn" | "error",
} as const;

/** Validate that the relayer can actually sign transactions. Call before starting. */
export function requireSigningCapability(): void {
  if (!Config.relayer.privateKey) {
    throw new Error(
      "[config] RELAYER_PRIVATE_KEY is not set. " +
        "The relayer cannot sign transactions without it."
    );
  }
}

/** True if contracts are configured (non-zero addresses). */
export function isFullyConfigured(): boolean {
  return (
    Config.baseSepolia.vaultAddress !== "0x0000000000000000000000000000000000000000" &&
    Config.zamaFhevm.strategyAgentAddress !== "0x0000000000000000000000000000000000000000"
  );
}
