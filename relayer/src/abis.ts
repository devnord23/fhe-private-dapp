/**
 * abis.ts — Minimal ABIs for the contracts the relayer interacts with.
 *
 * These must match the deployed contracts exactly.
 * The relayer reads events from BaseVault and ConfidentialStrategyAgent,
 * and writes to BaseVault (relayerCompleteWithdrawal).
 *
 * NOTE: The relayer does NOT interact with ConfidentialToken.sol directly.
 *       Calling shield() / requestUnshield() requires fhevmjs (browser WASM).
 *       Those calls are TODO and must be initiated by the user from the frontend
 *       or via a dedicated FHE-capable service.
 */

// ── BaseVault.sol (Base Sepolia) ──────────────────────────────────────────────

export const BASE_VAULT_ABI = [
  // Read
  {
    type: "function",
    name: "getAvailableBalance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getPendingWithdrawal",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getLinkedStrategy",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "relayer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },

  // Write (relayer only)
  {
    type: "function",
    name: "relayerCompleteWithdrawal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user",   type: "address" },
      { name: "token",  type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },

  // Events
  {
    type: "event",
    name: "DepositCreated",
    inputs: [
      { name: "user",       type: "address", indexed: true  },
      { name: "token",      type: "address", indexed: true  },
      { name: "amount",     type: "uint256", indexed: false },
      { name: "strategyId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WithdrawalRequested",
    inputs: [
      { name: "user",   type: "address", indexed: true  },
      { name: "token",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StrategyLinked",
    inputs: [
      { name: "user",       type: "address", indexed: true  },
      { name: "strategyId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WithdrawalCompleted",
    inputs: [
      { name: "user",   type: "address", indexed: true  },
      { name: "token",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// ── ConfidentialStrategyAgent.sol (Zama fhEVM) ────────────────────────────────
//
// The relayer READS from this contract to check strategy evaluation state.
// It does NOT write encrypted inputs — that requires fhevmjs (browser WASM).

export const STRATEGY_AGENT_ABI = [
  // Read
  {
    type: "function",
    name: "getStrategyMetadata",
    stateMutability: "view",
    inputs: [{ name: "strategyId", type: "uint256" }],
    outputs: [
      { name: "owner",                    type: "address" },
      { name: "isActive",                 type: "bool"    },
      { name: "createdAt",                type: "uint256" },
      { name: "lastEvaluatedAt",          type: "uint256" },
      { name: "apyTargetHandle",          type: "uint256" },
      { name: "rebalanceThresholdHandle", type: "uint256" },
      { name: "stopLossBufferHandle",     type: "uint256" },
      { name: "liquidationBufferHandle",  type: "uint256" },
      { name: "maxLeverageHandle",        type: "uint256" },
      { name: "evaluationCountHandle",    type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "authorizedAgents",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "bool" }],
  },

  // Events (read only — relayer monitors these)
  {
    type: "event",
    name: "EvaluationPerformed",
    inputs: [
      { name: "strategyId", type: "uint256", indexed: true },
      { name: "blockNumber", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "EvaluationRevealed",
    inputs: [
      { name: "strategyId",     type: "uint256", indexed: true  },
      { name: "shouldRebalance", type: "bool",   indexed: false },
      { name: "stopLossHit",    type: "bool",    indexed: false },
    ],
  },
] as const;

// ── ConfidentialToken.sol (Zama fhEVM) ────────────────────────────────────────
//
// The relayer only reads the Unshielded event.
// TODO (production): After monitoring this event, the relayer would call
//   BaseVault.relayerCompleteWithdrawal() to release funds on Base.

export const CONFIDENTIAL_TOKEN_ABI = [
  {
    type: "event",
    name: "Unshielded",
    inputs: [
      { name: "sender",    type: "address", indexed: true  },
      { name: "recipient", type: "address", indexed: true  },
      { name: "amount",    type: "uint64",  indexed: false },
    ],
  },
  {
    type: "event",
    name: "Shielded",
    inputs: [
      { name: "account", type: "address", indexed: true  },
      { name: "amount",  type: "uint64",  indexed: false },
    ],
  },
] as const;
