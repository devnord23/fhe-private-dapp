/**
 * chains.ts — viem public and wallet clients for Base Sepolia and Zama fhEVM.
 *
 * The relayer uses TWO clients:
 *   basePublicClient  — reads events and state from Base Sepolia
 *   baseWalletClient  — signs and submits transactions on Base Sepolia
 *   zamaPublicClient  — reads events from Zama fhEVM (read-only)
 *
 * The relayer does NOT submit transactions to Zama fhEVM.
 * All Zama-side writes (shield, requestUnshield) require fhevmjs encryption
 * and must be initiated from the user's browser.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia }          from "viem/chains";
import { Config }               from "./config.js";

// ── Zama Devnet chain definition ─────────────────────────────────────────────

export const zamaDevnet = defineChain({
  id:             9000,
  name:           "Zama Devnet",
  nativeCurrency: { name: "ZAMA", symbol: "ZAMA", decimals: 18 },
  rpcUrls: {
    default: { http: [Config.zamaFhevm.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Zama Explorer", url: "https://main.explorer.zama.ai" },
  },
  testnet: true,
});

// ── Public clients (read-only) ────────────────────────────────────────────────

export const basePublicClient = createPublicClient({
  chain:     baseSepolia,
  transport: http(Config.baseSepolia.rpcUrl),
});

export const zamaPublicClient = createPublicClient({
  chain:     zamaDevnet,
  transport: http(Config.zamaFhevm.rpcUrl),
});

// ── Wallet client (signing, Base Sepolia only) ────────────────────────────────

/**
 * Creates a wallet client for the relayer to sign Base Sepolia transactions.
 * Throws if RELAYER_PRIVATE_KEY is not set.
 *
 * Call this lazily — only when the relayer actually needs to sign a tx.
 */
export function getBaseWalletClient() {
  if (!Config.relayer.privateKey) {
    throw new Error(
      "[chains] Cannot create wallet client: RELAYER_PRIVATE_KEY is not set."
    );
  }
  const account = privateKeyToAccount(Config.relayer.privateKey);
  return createWalletClient({
    account,
    chain:     baseSepolia,
    transport: http(Config.baseSepolia.rpcUrl),
  });
}

/** Returns the relayer's public address (derived from private key). */
export function getRelayerAddress(): `0x${string}` | null {
  if (!Config.relayer.privateKey) return null;
  return privateKeyToAccount(Config.relayer.privateKey).address;
}
