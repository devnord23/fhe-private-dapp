/**
 * types.ts — Shared types for relayer state and event processing.
 */

// ── State ─────────────────────────────────────────────────────────────────────

/**
 * Persistent relayer state, stored as JSON in state/state.json.
 * All amounts are stored as decimal strings (bigint serialization).
 */
export interface RelayerState {
  /**
   * Last block number fully processed on Base Sepolia.
   * On restart, processing begins from this block + 1.
   */
  lastProcessedBlock: number;

  /**
   * Set of event IDs (txHash + "-" + logIndex) that have been processed.
   * Used for idempotency — prevents double-processing on restart.
   */
  processedEvents: Record<string, true>;

  /**
   * Mapping of Base Sepolia user address → Zama fhEVM strategy info.
   * Populated by StrategyLinked events.
   */
  userMappings: Record<string, UserMapping>;

  /**
   * Pending withdrawal requests awaiting relayer completion.
   * key = "${userAddress}_${tokenAddress}"
   * Multiple withdrawals by the same user for the same token accumulate.
   */
  pendingWithdrawals: Record<string, PendingWithdrawal>;

  /** Metadata about the relayer run. */
  meta: {
    startedAt:   number;
    updatedAt:   number;
    version:     string;
  };
}

export interface UserMapping {
  /** Base Sepolia address of the user */
  baseAddress: `0x${string}`;
  /**
   * Zama fhEVM strategy ID linked to this user.
   * Corresponds to a strategyId in ConfidentialStrategyAgent.
   */
  strategyId:  string;
  /**
   * Total amounts deposited per token address (decimal string).
   * Not cross-chain verified — this is a local accounting record only.
   */
  deposited:   Record<string, string>;
  linkedAt:    number;
  updatedAt:   number;
}

export type WithdrawalStatus =
  | "pending"          // recorded, not yet completed
  | "completing"       // completeWithdrawal tx submitted, awaiting confirmation
  | "completed"        // relayerCompleteWithdrawal confirmed on Base
  | "failed";          // completion tx failed after retries

export interface PendingWithdrawal {
  user:            `0x${string}`;
  token:           `0x${string}`;
  /** Decimal string amount */
  amount:          string;
  requestTxHash:   `0x${string}`;
  requestBlock:    number;
  requestedAt:     number;
  status:          WithdrawalStatus;
  /** Block at which we last attempted or confirmed completion */
  completedBlock?: number;
  completedTxHash?: `0x${string}`;
  failureReason?:  string;
}

// ── Event payloads ────────────────────────────────────────────────────────────

export interface DepositCreatedPayload {
  user:       `0x${string}`;
  token:      `0x${string}`;
  amount:     bigint;
  strategyId: bigint;
}

export interface WithdrawalRequestedPayload {
  user:   `0x${string}`;
  token:  `0x${string}`;
  amount: bigint;
}

export interface StrategyLinkedPayload {
  user:       `0x${string}`;
  strategyId: bigint;
}

export interface EvaluationRevealedPayload {
  strategyId:      bigint;
  shouldRebalance: boolean;
  stopLossHit:     boolean;
}

export interface UnshieldedPayload {
  sender:    `0x${string}`;
  recipient: `0x${string}`;
  amount:    bigint;
}

// ── Processing context ────────────────────────────────────────────────────────

export interface ProcessedEvent {
  /** Unique key: txHash + "-" + logIndex */
  id:          string;
  txHash:      `0x${string}`;
  logIndex:    number;
  blockNumber: number;
  name:        string;
}
