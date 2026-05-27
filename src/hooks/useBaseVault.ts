"use client";

/**
 * useBaseVault — Hooks for interacting with BaseVault.sol on Base Sepolia.
 *
 * REAL (works today on Base Sepolia):
 *   • deposit()                  — ERC-20 approval + vault deposit
 *   • requestWithdrawal()        — moves funds to pending
 *   • cancelPendingWithdrawal()  — returns funds to available
 *   • emergencyWithdraw()        — bypass relayer (testnet only)
 *   • linkStrategy()             — link to a Zama fhEVM strategy ID
 *   • useVaultBalance()          — read available + pending balances
 *
 * TODO before production:
 *   • Relayer integration — currently withdrawals require manual relayer call
 *   • Token whitelist UX — currently accepts any ERC-20 address
 *   • Transaction status polling for long-running approval + deposit flows
 *   • Cross-chain strategy linking — verify strategyId exists on Zama fhEVM
 */

import { useCallback, useState } from "react";
import {
  useAccount,
  useChainId,
  useWriteContract,
  useReadContract,
} from "wagmi";
import {
  BASE_VAULT_ADDRESSES,
  BASE_VAULT_ABI,
  ERC20_APPROVE_ABI,
  type BaseChainId,
} from "@/lib/constants";
import { isBaseChain } from "@/lib/utils";
import { parseUnits, formatUnits } from "viem";

function useVaultAddress() {
  const chainId = useChainId() as BaseChainId;
  return BASE_VAULT_ADDRESSES[chainId] ?? BASE_VAULT_ADDRESSES[84532];
}

// ── useDeposit ────────────────────────────────────────────────────────────────
//
// Two-transaction flow: approve → deposit.
// Step 1: Approve the vault to spend the token.
// Step 2: Call vault.deposit().

export type DepositStep = "idle" | "approving" | "approved" | "depositing" | "confirmed" | "error";

export interface UseDepositResult {
  step: DepositStep;
  approve: (token: `0x${string}`, amount: bigint) => Promise<boolean>;
  deposit: (token: `0x${string}`, amount: bigint, strategyId: bigint) => Promise<string | null>;
  error: string | null;
  clearError: () => void;
  reset: () => void;
}

export function useDeposit(): UseDepositResult {
  const { address } = useAccount();
  const chainId = useChainId();
  const vaultAddress = useVaultAddress();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<DepositStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const reset = useCallback(() => { setStep("idle"); setError(null); }, []);

  const approve = useCallback(
    async (token: `0x${string}`, amount: bigint): Promise<boolean> => {
      if (!address) { setError("Connect your wallet first."); return false; }
      if (!isBaseChain(chainId)) {
        setError(`BaseVault is on Base Sepolia (chain 84532). You are on chain ${chainId}. Please switch networks.`);
        return false;
      }

      setError(null);
      setStep("approving");

      try {
        await writeContractAsync({
          address: token,
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [vaultAddress, amount],
        });
        setStep("approved");
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        setStep("error");
        return false;
      }
    },
    [address, chainId, vaultAddress, writeContractAsync]
  );

  const deposit = useCallback(
    async (
      token: `0x${string}`,
      amount: bigint,
      strategyId: bigint
    ): Promise<string | null> => {
      if (!address) { setError("Connect your wallet first."); return null; }
      if (!isBaseChain(chainId)) {
        setError(`BaseVault is on Base Sepolia. You are on chain ${chainId}.`);
        return null;
      }

      setError(null);
      setStep("depositing");

      try {
        const hash = await writeContractAsync({
          address: vaultAddress,
          abi: BASE_VAULT_ABI,
          functionName: "deposit",
          args: [token, amount, strategyId],
        });
        setStep("confirmed");
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        setStep("error");
        return null;
      }
    },
    [address, chainId, vaultAddress, writeContractAsync]
  );

  return { step, approve, deposit, error, clearError, reset };
}

// ── useWithdrawal ─────────────────────────────────────────────────────────────

export function useWithdrawal() {
  const { address } = useAccount();
  const chainId = useChainId();
  const vaultAddress = useVaultAddress();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);

  const requestWithdrawal = useCallback(
    async (token: `0x${string}`, amount: bigint): Promise<string | null> => {
      if (!address) { setError("Connect your wallet first."); return null; }
      if (!isBaseChain(chainId)) { setError(`Switch to Base Sepolia (chain 84532).`); return null; }
      setError(null);
      try {
        return await writeContractAsync({
          address: vaultAddress,
          abi: BASE_VAULT_ABI,
          functionName: "requestWithdrawal",
          args: [token, amount],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [address, chainId, vaultAddress, writeContractAsync]
  );

  const cancelWithdrawal = useCallback(
    async (token: `0x${string}`, amount: bigint): Promise<string | null> => {
      if (!address) { setError("Connect your wallet first."); return null; }
      setError(null);
      try {
        return await writeContractAsync({
          address: vaultAddress,
          abi: BASE_VAULT_ABI,
          functionName: "cancelPendingWithdrawal",
          args: [token, amount],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [address, vaultAddress, writeContractAsync]
  );

  const emergencyWithdraw = useCallback(
    async (token: `0x${string}`): Promise<string | null> => {
      if (!address) { setError("Connect your wallet first."); return null; }
      setError(null);
      try {
        return await writeContractAsync({
          address: vaultAddress,
          abi: BASE_VAULT_ABI,
          functionName: "emergencyWithdraw",
          args: [token],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [address, vaultAddress, writeContractAsync]
  );

  return { requestWithdrawal, cancelWithdrawal, emergencyWithdraw, isPending, error, clearError: () => setError(null) };
}

// ── useVaultBalance ────────────────────────────────────────────────────────────

export interface VaultBalanceResult {
  available: bigint;
  pending: bigint;
  linkedStrategy: bigint;
  tokenBalance: bigint;         // user's wallet balance
  tokenDecimals: number;
  tokenSymbol: string;
  formattedAvailable: string;
  formattedPending: string;
  formattedWallet: string;
  isLoading: boolean;
  refetch: () => void;
}

export function useVaultBalance(tokenAddress: `0x${string}` | null): VaultBalanceResult {
  const { address, isConnected } = useAccount();
  const vaultAddress = useVaultAddress();
  const enabled = isConnected && !!address && !!tokenAddress;

  const { data: available, isLoading: l1, refetch: r1 } = useReadContract({
    address: vaultAddress,
    abi: BASE_VAULT_ABI,
    functionName: "getAvailableBalance",
    args: enabled ? [address!, tokenAddress!] : undefined,
    query: { enabled },
  });

  const { data: pending, isLoading: l2 } = useReadContract({
    address: vaultAddress,
    abi: BASE_VAULT_ABI,
    functionName: "getPendingWithdrawal",
    args: enabled ? [address!, tokenAddress!] : undefined,
    query: { enabled },
  });

  const { data: linked, isLoading: l3 } = useReadContract({
    address: vaultAddress,
    abi: BASE_VAULT_ABI,
    functionName: "getLinkedStrategy",
    args: enabled ? [address!] : undefined,
    query: { enabled },
  });

  const { data: walletBalance, isLoading: l4 } = useReadContract({
    address: tokenAddress ?? "0x0000000000000000000000000000000000000000",
    abi: ERC20_APPROVE_ABI,
    functionName: "balanceOf",
    args: enabled ? [address!] : undefined,
    query: { enabled },
  });

  const { data: decimals } = useReadContract({
    address: tokenAddress ?? "0x0000000000000000000000000000000000000000",
    abi: ERC20_APPROVE_ABI,
    functionName: "decimals",
    query: { enabled: !!tokenAddress },
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress ?? "0x0000000000000000000000000000000000000000",
    abi: ERC20_APPROVE_ABI,
    functionName: "symbol",
    query: { enabled: !!tokenAddress },
  });

  const dec = (decimals as number | undefined) ?? 6;
  const sym = (symbol as string | undefined) ?? "TOKEN";
  const fmt = (v: bigint) => parseFloat(formatUnits(v, dec)).toLocaleString("en-US", { maximumFractionDigits: 4 });

  const av = (available as bigint | undefined) ?? 0n;
  const pend = (pending as bigint | undefined) ?? 0n;
  const wb = (walletBalance as bigint | undefined) ?? 0n;
  const ls = (linked as bigint | undefined) ?? 0n;

  return {
    available: av,
    pending: pend,
    linkedStrategy: ls,
    tokenBalance: wb,
    tokenDecimals: dec,
    tokenSymbol: sym,
    formattedAvailable: fmt(av),
    formattedPending: fmt(pend),
    formattedWallet: fmt(wb),
    isLoading: l1 || l2 || l3 || l4,
    refetch: r1,
  };
}

/** Parse a decimal string into bigint using the given decimals. */
export function parseVaultAmount(value: string, decimals: number): bigint {
  const clean = value.trim().replace(/,/g, "");
  if (!clean || isNaN(Number(clean)) || Number(clean) <= 0) return 0n;
  try { return parseUnits(clean, decimals); } catch { return 0n; }
}
