/**
 * constants.ts — Chain IDs, addresses, ABIs, and explorer URLs.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  MULTI-LAYER CHAIN MODEL  ("Private Agentic DeFi on Base")
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Layer 1 — SETTLEMENT (Base / Base Sepolia)
 *  ───────────────────────────────────────────
 *  Chain IDs: 8453 (Base mainnet) | 84532 (Base Sepolia testnet)
 *  Role: Default wallet, user deposits, token settlement, gas payment.
 *  Contracts: BaseVault.sol (TODO – not yet deployed)
 *  Status: ⚠️  Wallet connection works; vault contract is a future TODO.
 *
 *  Layer 2 — CONFIDENTIAL COMPUTE (Zama fhEVM)
 *  ─────────────────────────────────────────────
 *  Chain IDs: 9000 (Zama Devnet) | 11155111 (Sepolia, Zama deployment)
 *  Role: Encrypted balances, homomorphic strategy evaluation, Gateway reveals.
 *  Contracts: ConfidentialToken.sol | ConfidentialStrategyAgent.sol
 *  Status: ✅  Contracts defined and compiled; require fhEVM precompile deployment.
 *
 *  Layer 3 — BRIDGE / RELAYER (TODO)
 *  ───────────────────────────────────
 *  Connects Base deposits to Zama computation.
 *  Options: LayerZero, Hyperlane, custom oracle + relayer.
 *  Status: ❌  NOT IMPLEMENTED — architecture placeholder only.
 *
 *  TECHNICAL HONESTY:
 *  Zama fhEVM precompiles do NOT exist on Base or Base Sepolia (OP Stack).
 *  All TFHE operations run on Zama's network. The bridge is future work.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ── Layer 1: Settlement chain IDs (Base) ─────────────────────────────────────

export type BaseChainId = 8453 | 84532;

export const BASE_CHAIN_IDS: BaseChainId[] = [8453, 84532];

export const BASE_NETWORK_NAMES: Record<BaseChainId, string> = {
  8453:  "Base",
  84532: "Base Sepolia",
};

/**
 * BaseVault contract addresses on Base (settlement layer).
 * TODO: Deploy BaseVault.sol on Base Sepolia and Base mainnet.
 *       These are zero-address placeholders until deployment.
 */
export const BASE_VAULT_ADDRESSES: Record<BaseChainId, `0x${string}`> = {
  8453:  (process.env.NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE   || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  84532: (process.env.NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA || "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

export const BASE_RPC_URLS: Record<BaseChainId, string> = {
  8453:  process.env.NEXT_PUBLIC_BASE_RPC_URL         ?? "https://mainnet.base.org",
  84532: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
};

export const BASE_EXPLORER_URLS: Record<BaseChainId, string> = {
  8453:  "https://basescan.org",
  84532: "https://sepolia.basescan.org",
};

// ── Layer 2: Computation chain IDs (Zama fhEVM) ──────────────────────────────

export type SupportedChainId = 9000 | 11155111;

/**
 * fhEVM computation chains.
 * Zama Devnet (chain 9000) = primary fhEVM testnet with real precompiles.
 * Ethereum Sepolia (11155111) = Zama has deployed fhEVM precompiles here too.
 */
export const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [9000, 11155111];

export const NETWORK_NAMES: Record<SupportedChainId, string> = {
  9000:     "Zama Devnet",
  11155111: "Sepolia",
};

export const CONTRACT_ADDRESSES: Record<SupportedChainId, `0x${string}`> = {
  9000:     (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_ZAMA_DEVNET || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  11155111: (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA     || "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

export const STRATEGY_AGENT_ADDRESSES: Record<SupportedChainId, `0x${string}`> = {
  9000:     (process.env.NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_ZAMA_DEVNET || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  11155111: (process.env.NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_SEPOLIA     || "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

// ── fhEVM RPC & Gateway ───────────────────────────────────────────────────────

export const FHEVM_RPC_URLS: Record<SupportedChainId, string> = {
  9000:     process.env.NEXT_PUBLIC_ZAMA_DEVNET_RPC  ?? "https://devnet.zama.ai",
  11155111: process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA  ?? "https://rpc.sepolia.org",
};

export const GATEWAY_URL = "https://gateway.zama.ai";

// ── Explorer helpers (all chains) ────────────────────────────────────────────

// ── ABI ──────────────────────────────────────────────────────────────────────
//
// Type mapping between Solidity (fhEVM) and the standard ABI encoder:
//
//   Solidity type  │ ABI encoding │ Notes
//   ───────────────┼──────────────┼─────────────────────────────────────────
//   einput         │ bytes32      │ Ciphertext handle produced by fhevmjs
//   bytes (proof)  │ bytes        │ Input proof produced by fhevmjs alongside handle
//   euint64        │ uint256      │ Handle pointing to ciphertext on Zama nodes
//   ebool          │ uint256      │ Same – encrypted boolean handle
//
// The Solidity compiler emits these standard ABI types for the precompile-based
// fhEVM types, so wagmi/viem can call the contract with no special encoding.
// The CALLER is responsible for producing the encrypted inputs via fhevmjs.

export const CONFIDENTIAL_TOKEN_ABI = [
  // ── Metadata (plain reads, no encryption needed) ──────────────────────────
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
    name: "underlying",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },

  // ── Encrypted reads ──────────────────────────────────────────────────────
  //
  // encryptedBalanceOf returns a euint64 which the ABI encodes as uint256.
  // This is a HANDLE – you cannot read the plaintext directly.
  //
  // TODO: Wire fhevmjs.reencrypt() in useTokenBalance.ts to show the user
  //       their actual balance.  The handle is obtained here; the decryption
  //       requires the user to sign an EIP-712 message to prove ownership,
  //       after which the Gateway re-encrypts to their temporary NaCl key.
  {
    type: "function",
    name: "encryptedBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }], // euint64 encoded as uint256 handle
  },
  {
    type: "function",
    name: "encryptedTotalShielded",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }], // euint64 handle – only owner can reencrypt
  },

  // ── Pending unshields ────────────────────────────────────────────────────
  {
    type: "function",
    name: "pendingUnshields",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "recipient", type: "address" },
    ],
  },

  // ── Write: shield ─────────────────────────────────────────────────────────
  //
  // shield() takes a PLAIN uint64. The deposited amount is PUBLIC because it
  // comes from the user's public ERC-20 wallet. Privacy starts after shielding.
  // Caller must approve(contractAddress, amount) on the underlying ERC-20 first.
  {
    type: "function",
    name: "shield",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint64" }],
    outputs: [],
  },

  // ── Write: transfer (fully confidential) ──────────────────────────────────
  //
  // REAL fhEVM function. The amount is encrypted using fhevmjs before the call.
  //
  //   const input = fhevmInstance.createEncryptedInput(contractAddress, signerAddress);
  //   input.add64(amountBigInt);
  //   const { handles, inputProof } = await input.encrypt();
  //   // handles[0] → encryptedAmount (bytes32)
  //   // inputProof → inputProof (bytes)
  //
  // The contract verifies the proof and performs homomorphic arithmetic internally.
  // No amount ever appears in plaintext on-chain.
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" }, // einput encoded as bytes32
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },

  // ── Write: recoverExpiredUnshield (security fix 2.1) ─────────────────────
  //
  // Callable by the original sender after the Gateway maxTimestamp has passed
  // without callbackUnshield firing. Re-credits the encrypted amount.
  {
    type: "function",
    name: "recoverExpiredUnshield",
    stateMutability: "nonpayable",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [],
  },

  // ── Write: requestUnshield (two-step via Gateway) ─────────────────────────
  //
  // REAL fhEVM function. Encrypted amount is provided the same way as transfer().
  // The Gateway decrypts the amount asynchronously and calls callbackUnshield().
  // On Zama Devnet the callback fires within 1-2 blocks (~2-4 seconds).
  {
    type: "function",
    name: "requestUnshield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" }, // einput
      { name: "inputProof", type: "bytes" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },

  // ── Events ───────────────────────────────────────────────────────────────
  //
  // Note: Transfer event has NO amount – amount is encrypted and never logged.
  {
    type: "event",
    name: "Shielded",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint64", indexed: false }, // public at shield time
    ],
  },
  {
    type: "event",
    name: "UnshieldRequested",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "requestId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Unshielded",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint64", indexed: false }, // revealed at unshield time
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      // No amount field – this is intentional. Amount stays encrypted.
    ],
  },
  // Emitted by recoverExpiredUnshield (security fix 2.1)
  {
    type: "event",
    name: "UnshieldRecovered",
    inputs: [
      { name: "sender",    type: "address", indexed: true  },
      { name: "requestId", type: "uint256", indexed: true  },
      // No amount — balance remains encrypted after recovery.
    ],
  },
] as const;

// ── Token ────────────────────────────────────────────────────────────────────

/**
 * The ConfidentialToken wraps the underlying ERC-20 at 1:1.
 * Use the same decimals as the underlying token (e.g. 6 for USDC).
 * Update this if your underlying token has different decimals.
 */
export const TOKEN_DECIMALS = 6;

export const POLLING_INTERVAL = 4_000;
export const TX_CONFIRMATION_BLOCKS = 2;

// ── ConfidentialStrategyAgent ABI ────────────────────────────────────────────
//
// Matches contracts/contracts/ConfidentialStrategyAgent.sol exactly.
//
// einput  → bytes32  in standard ABI (fhevmjs handle)
// euint64 → uint256  in standard ABI (encrypted handle, read-only)

export const STRATEGY_AGENT_ABI = [
  // ── Constants ─────────────────────────────────────────────────────────────
  { type: "function", name: "PARAM_APY_TARGET",          stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "PARAM_REBALANCE_THRESHOLD", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "PARAM_STOP_LOSS_BUFFER",    stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "PARAM_LIQUIDATION_BUFFER",  stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "PARAM_MAX_LEVERAGE",        stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "PARAM_EVAL_COUNT",          stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },

  // ── Read ──────────────────────────────────────────────────────────────────
  {
    type: "function", name: "protocolOwner",
    stateMutability: "view", inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "nextStrategyId",
    stateMutability: "view", inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "authorizedAgents",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function", name: "getOwnerStrategies",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function", name: "getStrategyMetadata",
    stateMutability: "view",
    inputs: [{ name: "strategyId", type: "uint256" }],
    outputs: [
      { name: "owner",                    type: "address" },
      { name: "isActive",                 type: "bool"    },
      { name: "createdAt",                type: "uint256" },
      { name: "lastEvaluatedAt",          type: "uint256" },
      { name: "apyTargetHandle",          type: "uint256" }, // euint64 handle
      { name: "rebalanceThresholdHandle", type: "uint256" },
      { name: "stopLossBufferHandle",     type: "uint256" },
      { name: "liquidationBufferHandle",  type: "uint256" },
      { name: "maxLeverageHandle",        type: "uint256" },
      { name: "evaluationCountHandle",    type: "uint256" },
    ],
  },
  {
    type: "function", name: "pendingReveals",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "strategyId", type: "uint256" },
      { name: "requester",  type: "address" },
      { name: "paramType",  type: "uint8"   },
    ],
  },

  // ── Write: Authorization ──────────────────────────────────────────────────
  {
    type: "function", name: "authorizeAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent",  type: "address" },
      { name: "status", type: "bool"    },
    ],
    outputs: [],
  },

  // ── Write: Strategy Lifecycle ─────────────────────────────────────────────
  //
  // All einput parameters are bytes32 in the ABI (fhevmjs handles).
  // inputProof covers ALL five handles (single batch proof from fhevmjs).
  {
    type: "function", name: "createStrategy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "encApyTarget",           type: "bytes32" },
      { name: "encRebalanceThreshold",  type: "bytes32" },
      { name: "encStopLossBuffer",      type: "bytes32" },
      { name: "encLiquidationBuffer",   type: "bytes32" },
      { name: "encMaxLeverage",         type: "bytes32" },
      { name: "inputProof",             type: "bytes"   },
    ],
    outputs: [{ name: "strategyId", type: "uint256" }],
  },
  {
    type: "function", name: "updateStrategy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "strategyId",             type: "uint256" },
      { name: "encApyTarget",           type: "bytes32" },
      { name: "encRebalanceThreshold",  type: "bytes32" },
      { name: "encStopLossBuffer",      type: "bytes32" },
      { name: "encLiquidationBuffer",   type: "bytes32" },
      { name: "encMaxLeverage",         type: "bytes32" },
      { name: "inputProof",             type: "bytes"   },
    ],
    outputs: [],
  },
  {
    type: "function", name: "deactivateStrategy",
    stateMutability: "nonpayable",
    inputs: [{ name: "strategyId", type: "uint256" }],
    outputs: [],
  },

  // ── Write: Evaluation ─────────────────────────────────────────────────────
  //
  // Agent encrypts current market values (same fhevmjs pattern).
  // inputProof covers BOTH encCurrentApy and encCurrentHealth.
  {
    type: "function", name: "evaluateStrategy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "strategyId",     type: "uint256" },
      { name: "encCurrentApy",  type: "bytes32" }, // einput
      { name: "encCurrentHealth", type: "bytes32" }, // einput
      { name: "inputProof",     type: "bytes"   },
    ],
    outputs: [],
  },

  // ── Write: Reveal ─────────────────────────────────────────────────────────
  {
    type: "function", name: "requestParameterReveal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "strategyId", type: "uint256" },
      { name: "paramType",  type: "uint8"   },
    ],
    outputs: [],
  },
  {
    type: "function", name: "requestEvaluationReveal",
    stateMutability: "nonpayable",
    inputs: [{ name: "strategyId", type: "uint256" }],
    outputs: [],
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: "event", name: "StrategyCreated",
    inputs: [
      { name: "strategyId", type: "uint256", indexed: true },
      { name: "owner",      type: "address", indexed: true },
    ],
  },
  {
    type: "event", name: "StrategyUpdated",
    inputs: [{ name: "strategyId", type: "uint256", indexed: true }],
  },
  {
    type: "event", name: "StrategyDeactivated",
    inputs: [{ name: "strategyId", type: "uint256", indexed: true }],
  },
  {
    type: "event", name: "EvaluationPerformed",
    inputs: [
      { name: "strategyId", type: "uint256", indexed: true  },
      { name: "blockNumber", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event", name: "RevealRequested",
    inputs: [
      { name: "strategyId", type: "uint256", indexed: true  },
      { name: "paramType",  type: "uint8",   indexed: false },
      { name: "requestId",  type: "uint256", indexed: true  },
    ],
  },
  {
    type: "event", name: "ParameterRevealed",
    inputs: [
      { name: "strategyId",    type: "uint256", indexed: true  },
      { name: "paramType",     type: "uint8",   indexed: false },
      { name: "revealedValue", type: "uint64",  indexed: false },
    ],
  },
  {
    type: "event", name: "EvaluationRevealed",
    inputs: [
      { name: "strategyId",     type: "uint256", indexed: true  },
      { name: "shouldRebalance", type: "bool",   indexed: false },
      { name: "stopLossHit",    type: "bool",    indexed: false },
    ],
  },
  {
    type: "event", name: "AgentAuthorized",
    inputs: [
      { name: "agent",  type: "address", indexed: true  },
      { name: "status", type: "bool",    indexed: false },
    ],
  },
] as const;

// ── BaseVault ABI ─────────────────────────────────────────────────────────────
//
// Matches contracts/contracts/BaseVault.sol exactly.
// Deployed on Base Sepolia (84532) or Base mainnet (8453).
// NO TFHE or FHE operations — pure ERC-20 settlement layer.

export const BASE_VAULT_ABI = [
  // ── Read ──────────────────────────────────────────────────────────────────
  {
    type: "function", name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "relayer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "getAvailableBalance",
    stateMutability: "view",
    inputs: [
      { name: "user",  type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "getPendingWithdrawal",
    stateMutability: "view",
    inputs: [
      { name: "user",  type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "getLinkedStrategy",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "vaultBalance",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },

  // ── Write ─────────────────────────────────────────────────────────────────
  {
    type: "function", name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token",      type: "address" },
      { name: "amount",     type: "uint256" },
      { name: "strategyId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "linkStrategy",
    stateMutability: "nonpayable",
    inputs: [{ name: "strategyId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "requestWithdrawal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token",  type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "cancelPendingWithdrawal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token",  type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "emergencyWithdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function", name: "setRelayer",
    stateMutability: "nonpayable",
    inputs: [{ name: "_relayer", type: "address" }],
    outputs: [],
  },
  // relayerCompleteWithdrawal — callable only by relayer/owner
  {
    type: "function", name: "relayerCompleteWithdrawal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user",   type: "address" },
      { name: "token",  type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: "event", name: "DepositCreated",
    inputs: [
      { name: "user",       type: "address", indexed: true  },
      { name: "token",      type: "address", indexed: true  },
      { name: "amount",     type: "uint256", indexed: false },
      { name: "strategyId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "WithdrawalRequested",
    inputs: [
      { name: "user",   type: "address", indexed: true  },
      { name: "token",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "WithdrawalCompleted",
    inputs: [
      { name: "user",   type: "address", indexed: true  },
      { name: "token",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "WithdrawalCancelled",
    inputs: [
      { name: "user",   type: "address", indexed: true  },
      { name: "token",  type: "address", indexed: true  },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "StrategyLinked",
    inputs: [
      { name: "user",       type: "address", indexed: true  },
      { name: "strategyId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "RelayerSet",
    inputs: [{ name: "relayer", type: "address", indexed: true }],
  },
] as const;

// ── Minimal ERC-20 ABI (approve + balanceOf + decimals) ───────────────────────
// Used by the vault deposit flow to approve BaseVault before calling deposit().

export const ERC20_APPROVE_ABI = [
  {
    type: "function", name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function", name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function", name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
