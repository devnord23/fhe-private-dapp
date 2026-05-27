import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { defineChain } from "viem";

/**
 * Zama Devnet – the primary testnet running real fhEVM precompiles.
 *
 * Chain ID: 9000
 * RPC:      https://devnet.zama.ai
 * Explorer: https://main.explorer.zama.ai
 *
 * This is a custom chain not included in wagmi's default chain list.
 * Check https://docs.zama.ai/fhevm for the latest RPC and block explorer URLs.
 */
export const zamaDevnet = defineChain({
  id: 9000,
  name: "Zama Devnet",
  nativeCurrency: {
    name: "ZAMA",
    symbol: "ZAMA",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ZAMA_DEVNET_RPC ?? "https://devnet.zama.ai",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Zama Explorer",
      url: "https://main.explorer.zama.ai",
    },
  },
  testnet: true,
});

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo_project_id";

/**
 * wagmiConfig
 *
 * Zama Devnet is listed first so RainbowKit defaults to it.
 * Sepolia is included for wallets that don't support custom chains natively.
 *
 * Note: fhEVM-specific features (encrypted transfers, balance re-encryption)
 * only work on Zama Devnet. On Sepolia, the ConfidentialToken contract will not
 * function unless Zama's precompiles are deployed there.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "ConfidentialFi",
  projectId,
  chains: [zamaDevnet, sepolia],
  ssr: true,
});

export { sepolia };
