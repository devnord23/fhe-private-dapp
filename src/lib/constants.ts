import type { ChainId } from "@/types";

export const SUPPORTED_CHAIN_IDS: ChainId[] = [11155111, 84532];

export const CONTRACT_ADDRESSES: Record<ChainId, `0x${string}`> = {
  11155111: (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  84532: (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BASE_SEPOLIA ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

export const NETWORK_NAMES: Record<ChainId, string> = {
  11155111: "Sepolia",
  84532: "Base Sepolia",
};

/**
 * ABI for the ConfidentialToken contract.
 *
 * This contract wraps an ERC-20 token with a privacy pool that allows users to:
 *   - shield()          – deposit public tokens into the confidential pool
 *   - unshield()        – withdraw from the pool to a public address
 *   - confidentialTransfer() – transfer within the pool (amounts hidden on-chain)
 *
 * The amounts inside the pool are stored as Pedersen commitments; only the
 * sender/receiver can decrypt them using their private keys.
 */
export const CONFIDENTIAL_TOKEN_ABI = [
  // ── Read ────────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "publicBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "shieldedBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "commitment", type: "bytes32" }],
  },
  {
    type: "function",
    name: "decryptBalance",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "viewKey", type: "bytes" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalShielded",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transferCount",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getTransferRecord",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "encryptedAmount", type: "bytes32" },
          { name: "counterparty", type: "address" },
          { name: "direction", type: "uint8" },
          { name: "timestamp", type: "uint256" },
          { name: "txHash", type: "bytes32" },
        ],
      },
    ],
  },

  // ── Write ───────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "shield",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "unshield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "confidentialTransfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "proof", type: "bytes" },
      { name: "note", type: "bytes" },
    ],
    outputs: [],
  },

  // ── Events ──────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Shielded",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Unshielded",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ConfidentialTransfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "encryptedAmount", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const TOKEN_DECIMALS = 18;
export const POLLING_INTERVAL = 4_000;
export const TX_CONFIRMATION_BLOCKS = 2;
