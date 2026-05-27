import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia, base, sepolia } from "wagmi/chains";
import { defineChain } from "viem";

/**
 * wagmi.ts — Chain configuration
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  THREE-LAYER ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Layer 1 – USER / SETTLEMENT (Base Sepolia, Base Mainnet)
 *  ─────────────────────────────────────────────────────────
 *  • Default wallet connection chain
 *  • Public token deposits and withdrawals
 *  • Future: BaseVault contract for locking/releasing funds
 *  • Fast finality, low gas, Coinbase ecosystem
 *  • Status: wallet connected, BaseVault contract TODO
 *
 *  Layer 2 – CONFIDENTIAL COMPUTE (Zama fhEVM)
 *  ────────────────────────────────────────────
 *  • ConfidentialToken (shielded balances, euint64)
 *  • ConfidentialStrategyAgent (encrypted parameters, TFHE arithmetic)
 *  • Gateway decryption for reveals
 *  • Status: contracts defined, require Zama precompile deployment
 *
 *  Layer 3 – BRIDGE / RELAYER (TODO)
 *  ────────────────────────────────────────────
 *  • Cross-chain message passing from Base → Zama fhEVM
 *  • Lock tokens on Base, mint shielded equivalent on Zama
 *  • Options: LayerZero, Hyperlane, custom oracle + relayer
 *  • Status: NOT IMPLEMENTED — architecture placeholder
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  TECHNICAL HONESTY NOTE
 * ═══════════════════════════════════════════════════════════════════════
 *  Zama fhEVM precompiles do NOT run natively on Base or Base Sepolia.
 *  Base is an OP Stack L2 and does not include Zama's TFHE executor
 *  precompile contracts. All TFHE operations happen on Zama's network.
 *  The bridge connecting them is a future work item.
 */

// ── Zama Devnet ──────────────────────────────────────────────────────────────

export const zamaDevnet = defineChain({
  id: 9000,
  name: "Zama Devnet",
  nativeCurrency: { name: "ZAMA", symbol: "ZAMA", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ZAMA_DEVNET_RPC ?? "https://devnet.zama.ai"],
    },
  },
  blockExplorers: {
    default: { name: "Zama Explorer", url: "https://main.explorer.zama.ai" },
  },
  testnet: true,
});

// ── wagmiConfig ───────────────────────────────────────────────────────────────
//
// Chain order controls RainbowKit's default network suggestion.
// Base Sepolia is listed first — it is the user-facing settlement chain.
// Zama Devnet and Sepolia are listed for encrypted operations.

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo_project_id";

export const wagmiConfig = getDefaultConfig({
  appName: "ConfidentialFi — Private Agentic DeFi on Base",
  projectId,
  chains: [
    baseSepolia, // ← DEFAULT: user settlement layer (Base Sepolia testnet)
    base,        // Base mainnet (for production)
    zamaDevnet,  // Zama fhEVM computation layer (chain 9000)
    sepolia,     // Ethereum Sepolia (Zama also deploys precompiles here)
  ],
  ssr: true,
});

export { baseSepolia, base, sepolia };
