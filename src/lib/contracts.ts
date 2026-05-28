/**
 * contracts.ts — Helpers for detecting unconfigured / zero-address contracts.
 *
 * In Demo Mode (Vercel deployment before real contracts are deployed) every
 * contract address env var resolves to the zero address (0x000...000).
 * Components use these helpers to show graceful disabled states instead of
 * attempting RPC calls that will fail.
 */

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Returns true when an address is absent, empty, or the zero address. */
export function isZeroAddress(address: string | undefined | null): boolean {
  if (!address) return true;
  return address.toLowerCase() === ZERO_ADDRESS;
}

/** Returns true when the address looks like a real deployed contract. */
export function isContractConfigured(address: string | undefined | null): boolean {
  return !isZeroAddress(address);
}

// ── Per-contract configured checks ─────────────────────────────────────────

export function isVaultConfigured(): boolean {
  return isContractConfigured(
    process.env.NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA
  );
}

export function isConfidentialTokenConfigured(): boolean {
  return isContractConfigured(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA
  );
}

export function isStrategyAgentConfigured(): boolean {
  return isContractConfigured(
    process.env.NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_SEPOLIA
  );
}

export function isFhevmSystemConfigured(): boolean {
  return (
    isContractConfigured(process.env.NEXT_PUBLIC_FHEVM_ACL_ADDRESS) &&
    isContractConfigured(process.env.NEXT_PUBLIC_FHEVM_KMS_ADDRESS)
  );
}

/**
 * Returns true when NO contracts are deployed yet.
 * Used to show the "Demo Mode" banner across the whole app.
 */
export function isDemoMode(): boolean {
  return (
    !isVaultConfigured() &&
    !isConfidentialTokenConfigured() &&
    !isStrategyAgentConfigured()
  );
}

/**
 * Returns a human-readable label for an unconfigured contract.
 * Shown in disabled buttons and empty states.
 */
export function notDeployedLabel(contractName: string): string {
  return `${contractName} not deployed — see TESTNET_DEPLOYMENT.md`;
}
