export type TransferStatus =
  | "pending"
  | "confirming"
  | "confirmed"
  | "failed";

export type TransferType = "shield" | "unshield" | "confidential";

export interface Transfer {
  id: string;
  txHash: `0x${string}` | null;
  from: `0x${string}`;
  to: `0x${string}`;
  /**
   * Amount in the token's smallest unit.
   * For confidential transfers this is the value the USER entered locally –
   * the on-chain transaction never reveals it.
   */
  amount: bigint;
  /** Human-readable amount string, e.g. "1.5" */
  amountFormatted: string;
  tokenSymbol: string;
  type: TransferType;
  status: TransferStatus;
  timestamp: number;
  blockNumber?: bigint;
  note?: string;
}

export interface ConfidentialTransferParams {
  to: string;
  amount: string;
}

export interface ShieldParams {
  amount: string;
}

export interface UnshieldParams {
  amount: string;
  recipient: `0x${string}`;
}
