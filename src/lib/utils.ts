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

/**
 * Simulate a Pedersen commitment for demonstration purposes.
 * In production this would be a real ZK commitment computed client-side.
 */
export function mockCommitment(amount: string, nonce?: string): `0x${string}` {
  const seed = `${amount}-${nonce ?? Date.now()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0").repeat(8);
  return `0x${hex.slice(0, 64)}` as `0x${string}`;
}

/**
 * Mock a ZK proof blob for UI demonstration.
 * A real implementation would call a WASM prover (e.g. snarkjs / noir).
 */
export function mockProof(): `0x${string}` {
  const bytes = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  ).join("");
  return `0x${bytes}` as `0x${string}`;
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
    1: "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    8453: "https://basescan.org",
    84532: "https://sepolia.basescan.org",
  };
  const base = explorers[chainId] ?? "https://etherscan.io";
  return `${base}/${type}/${value}`;
}
