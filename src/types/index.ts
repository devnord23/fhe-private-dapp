export type TransferStatus =
  | "pending"
  | "confirming"
  | "confirmed"
  | "failed"
  | "shielded";

export type TransferType = "shield" | "unshield" | "confidential";

export interface Transfer {
  id: string;
  txHash: `0x${string}` | null;
  from: `0x${string}`;
  to: `0x${string}`;
  /** Raw amount in the token's smallest unit (e.g. 18-decimal ETH-like) */
  amount: bigint;
  /** Human-readable amount string, e.g. "1.5" */
  amountFormatted: string;
  tokenSymbol: string;
  type: TransferType;
  status: TransferStatus;
  timestamp: number;
  /** Encrypted / masked representation shown publicly on-chain */
  encryptedAmount?: string;
  /** ZK proof bytes (hex) – null until generated */
  proof?: `0x${string}` | null;
  blockNumber?: bigint;
  gasUsed?: bigint;
  note?: string;
}

export interface TokenBalance {
  /** Public ERC-20 balance */
  public: bigint;
  /** Shielded / confidential balance inside the contract pool */
  shielded: bigint;
  symbol: string;
  decimals: number;
  name: string;
  formatted: {
    public: string;
    shielded: string;
  };
}

export interface NetworkStats {
  totalShielded: bigint;
  totalTransfers: bigint;
  activeUsers: number;
  avgGasPrice: bigint;
}

export interface ConfidentialTransferParams {
  to: `0x${string}`;
  amount: string;
  note?: string;
}

export interface ShieldParams {
  amount: string;
}

export interface UnshieldParams {
  amount: string;
  recipient: `0x${string}`;
}

export type ChainId = 11155111 | 84532;
