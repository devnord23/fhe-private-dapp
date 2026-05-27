import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUnits, parseUnits } from "viem";
import { TOKEN_DECIMALS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTokenAmount(
  amount: bigint,
  decimals = TOKEN_DECIMALS,
  displayDecimals = 4
): string {
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (num < 0.0001) return "< 0.0001";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  });
}

export function parseTokenAmount(value: string, decimals = TOKEN_DECIMALS): bigint {
  const clean = value.trim().replace(/,/g, "");
  if (!clean || isNaN(Number(clean))) return 0n;
  try {
    return parseUnits(clean, decimals);
  } catch {
    return 0n;
  }
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function shortenHash(hash: string, chars = 6): string {
  if (!hash) return "";
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`;
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isValidAddress(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function isValidAmount(value: string): boolean {
  const num = Number(value);
  return !isNaN(num) && num > 0 && value.trim() !== "";
}

export function getExplorerUrl(
  chainId: number,
  type: "tx" | "address",
  value: string
): string {
  const explorers: Record<number, string> = {
    1:        "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    8453:     "https://basescan.org",         // Base mainnet
    84532:    "https://sepolia.basescan.org", // Base Sepolia
    9000:     "https://main.explorer.zama.ai", // Zama Devnet
  };
  const base = explorers[chainId] ?? "https://etherscan.io";
  return `${base}/${type}/${value}`;
}

/**
 * Returns the canonical explorer name for a given chain.
 */
export function getExplorerName(chainId: number): string {
  const names: Record<number, string> = {
    1:        "Etherscan",
    11155111: "Sepolia Etherscan",
    8453:     "Basescan",
    84532:    "Basescan (Sepolia)",
    9000:     "Zama Explorer",
  };
  return names[chainId] ?? "Block Explorer";
}

/**
 * Returns true if the given chain is a Base chain (settlement layer).
 * Base chains do NOT have Zama fhEVM precompiles.
 */
export function isBaseChain(chainId: number): boolean {
  return chainId === 8453 || chainId === 84532;
}

/**
 * Returns true if the given chain supports Zama fhEVM operations.
 */
export function isFhevmChain(chainId: number): boolean {
  return chainId === 9000 || chainId === 11155111;
}
