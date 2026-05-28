"use client";

/**
 * useVaultEvents
 *
 * Watches BaseVault events on Base Sepolia using wagmi's useWatchContractEvent.
 * When events fire for the connected user, callbacks are invoked.
 *
 * This is the browser-side "local relayer simulation":
 *   - DepositCreated  → prompt user to switch to Ethereum Sepolia and shield
 *   - WithdrawalRequested → prompt user to switch and call requestUnshield
 *
 * A real relayer (in /relayer) would handle this automatically off-chain.
 */

import { useCallback, useRef } from "react";
import { useWatchContractEvent, useAccount, useChainId } from "wagmi";
import { type Log } from "viem";
import { BASE_VAULT_ABI, BASE_VAULT_ADDRESSES, type BaseChainId } from "@/lib/constants";
import { isContractConfigured } from "@/lib/contracts";

export interface DepositEventPayload {
  user:       `0x${string}`;
  token:      `0x${string}`;
  amount:     bigint;
  strategyId: bigint;
  txHash?:    `0x${string}`;
}

export interface WithdrawalEventPayload {
  user:    `0x${string}`;
  token:   `0x${string}`;
  amount:  bigint;
  txHash?: `0x${string}`;
}

interface UseVaultEventsOptions {
  onDeposit?:    (e: DepositEventPayload)    => void;
  onWithdrawal?: (e: WithdrawalEventPayload) => void;
}

export function useVaultEvents({ onDeposit, onWithdrawal }: UseVaultEventsOptions) {
  const { address } = useAccount();
  const chainId      = useChainId() as BaseChainId;
  const vaultAddress = BASE_VAULT_ADDRESSES[chainId] ?? BASE_VAULT_ADDRESSES[84532];
  const configured   = isContractConfigured(vaultAddress);

  const onDepositRef    = useRef(onDeposit);
  const onWithdrawalRef = useRef(onWithdrawal);
  onDepositRef.current    = onDeposit;
  onWithdrawalRef.current = onWithdrawal;

  const handleDeposit = useCallback((logs: Log[]) => {
    if (!onDepositRef.current) return;
    for (const log of logs) {
      const args = (log as Log & { args?: Record<string, unknown> }).args ?? {};
      const user = args["user"] as `0x${string}` | undefined;
      const token = args["token"] as `0x${string}` | undefined;
      const amount = args["amount"] as bigint | undefined;
      const strategyId = args["strategyId"] as bigint | undefined;
      if (!user || !token || amount === undefined) continue;
      if (address && user.toLowerCase() !== address.toLowerCase()) continue;
      onDepositRef.current({
        user,
        token,
        amount,
        strategyId: strategyId ?? 0n,
        txHash: log.transactionHash ?? undefined,
      });
    }
  }, [address]);

  const handleWithdrawal = useCallback((logs: Log[]) => {
    if (!onWithdrawalRef.current) return;
    for (const log of logs) {
      const args = (log as Log & { args?: Record<string, unknown> }).args ?? {};
      const user = args["user"] as `0x${string}` | undefined;
      const token = args["token"] as `0x${string}` | undefined;
      const amount = args["amount"] as bigint | undefined;
      if (!user || !token || amount === undefined) continue;
      if (address && user.toLowerCase() !== address.toLowerCase()) continue;
      onWithdrawalRef.current({
        user,
        token,
        amount,
        txHash: log.transactionHash ?? undefined,
      });
    }
  }, [address]);

  useWatchContractEvent({
    address:   vaultAddress,
    abi:       BASE_VAULT_ABI,
    eventName: "DepositCreated",
    onLogs:    handleDeposit,
    enabled:   configured,
  });

  useWatchContractEvent({
    address:   vaultAddress,
    abi:       BASE_VAULT_ABI,
    eventName: "WithdrawalRequested",
    onLogs:    handleWithdrawal,
    enabled:   configured,
  });
}
