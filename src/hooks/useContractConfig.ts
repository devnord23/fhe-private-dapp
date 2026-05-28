"use client";

/**
 * useContractConfig — Reactive hook version of the contracts.ts helpers.
 *
 * Returns the configured state for every contract the frontend interacts with.
 * Components call this hook to conditionally disable UI elements and show
 * appropriate "not deployed" messages instead of crashing or showing
 * confusing RPC errors.
 *
 * Because all values come from NEXT_PUBLIC_ env vars baked in at build time,
 * they are stable and never change at runtime — but wrapping them in a hook
 * keeps the component API consistent and easy to upgrade later.
 */

import {
  isVaultConfigured,
  isConfidentialTokenConfigured,
  isStrategyAgentConfigured,
  isFhevmSystemConfigured,
  isDemoMode,
} from "@/lib/contracts";

export interface ContractConfig {
  /** BaseVault on Base Sepolia */
  vault: boolean;
  /** ConfidentialToken on Ethereum Sepolia */
  confidentialToken: boolean;
  /** ConfidentialStrategyAgent on Ethereum Sepolia */
  strategyAgent: boolean;
  /** Zama ACL + KMS system contracts (needed for fhevmjs) */
  fhevmSystem: boolean;
  /**
   * True when NONE of the three main contracts are deployed.
   * Used to show the global "Demo Mode" banner.
   */
  isDemoMode: boolean;
  /** Any contract is deployed */
  anyConfigured: boolean;
}

export function useContractConfig(): ContractConfig {
  const vault              = isVaultConfigured();
  const confidentialToken  = isConfidentialTokenConfigured();
  const strategyAgent      = isStrategyAgentConfigured();
  const fhevmSystem        = isFhevmSystemConfigured();
  const demo               = isDemoMode();

  return {
    vault,
    confidentialToken,
    strategyAgent,
    fhevmSystem,
    isDemoMode:     demo,
    anyConfigured:  vault || confidentialToken || strategyAgent,
  };
}
