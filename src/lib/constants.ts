/**
 * constants.ts
 *
 * Chain IDs, contract addresses, and the ABI for ConfidentialToken.sol.
 *
 * The ABI here MUST match contracts/contracts/ConfidentialToken.sol exactly.
 * If you update the Solidity contract, re-run `npm run compile` in contracts/
 * and regenerate this ABI from the resulting artifact JSON.
 *
 * REAL vs TODO status of each ABI entry is noted below.
 */

// ── Chain IDs ────────────────────────────────────────────────────────────────

export type SupportedChainId = 9000 | 11155111;

/**
 * Zama Devnet (chain ID 9000) is the primary fhEVM testnet.
 * Ethereum Sepolia (11155111) requires Zama's fhEVM precompiles to be live there
 * before the ConfidentialToken will work.
 */
export const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [9000, 11155111];

export const NETWORK_NAMES: Record<SupportedChainId, string> = {
  9000: "Zama Devnet",
  11155111: "Sepolia",
};

export const CONTRACT_ADDRESSES: Record<SupportedChainId, `0x${string}`> = {
  9000: (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_ZAMA_DEVNET ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  11155111: (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

// ── fhEVM RPC endpoints ──────────────────────────────────────────────────────

export const FHEVM_RPC_URLS: Record<SupportedChainId, string> = {
  9000: process.env.NEXT_PUBLIC_ZAMA_DEVNET_RPC ?? "https://devnet.zama.ai",
  11155111:
    process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA ??
    "https://rpc.sepolia.org",
};

export const GATEWAY_URL = "https://gateway.zama.ai";

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
