"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  CONFIDENTIAL_TOKEN_ABI,
  CONTRACT_ADDRESSES,
  TX_CONFIRMATION_BLOCKS,
} from "@/lib/constants";
import {
  isValidAddress,
  isValidAmount,
  mockCommitment,
  mockProof,
  parseTokenAmount,
} from "@/lib/utils";
import type {
  ChainId,
  ConfidentialTransferParams,
  ShieldParams,
  Transfer,
  UnshieldParams,
} from "@/types";
import { useTransferHistory } from "./useTransferHistory";

function genId() {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useConfidentialTransfer() {
  const { address } = useAccount();
  const chainId = useChainId() as ChainId;
  const { addTransfer, updateTransfer } = useTransferHistory();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contractAddress =
    CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[11155111];

  const {
    writeContractAsync,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    confirmations: TX_CONFIRMATION_BLOCKS,
  });

  const clearError = useCallback(() => setError(null), []);

  // ── Shield ──────────────────────────────────────────────────────────────────
  const shield = useCallback(
    async (params: ShieldParams): Promise<string | null> => {
      if (!address) { setError("Connect your wallet first."); return null; }
      if (!isValidAmount(params.amount)) { setError("Enter a valid amount."); return null; }

      setError(null);
      const id = genId();
      const amountBig = parseTokenAmount(params.amount);

      const draft: Transfer = {
        id,
        txHash: null,
        from: address,
        to: contractAddress,
        amount: amountBig,
        amountFormatted: params.amount,
        tokenSymbol: "CTOK",
        type: "shield",
        status: "pending",
        timestamp: Date.now(),
      };
      addTransfer(draft);
      setPendingId(id);

      try {
        const hash = await writeContractAsync({
          address: contractAddress,
          abi: CONFIDENTIAL_TOKEN_ABI,
          functionName: "shield",
          args: [amountBig],
        });

        updateTransfer(id, { txHash: hash, status: "confirming" });
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction rejected.";
        updateTransfer(id, { status: "failed" });
        setError(msg.includes("User rejected") ? "Transaction was rejected." : msg);
        return null;
      } finally {
        setPendingId(null);
      }
    },
    [address, contractAddress, addTransfer, updateTransfer, writeContractAsync]
  );

  // ── Unshield ────────────────────────────────────────────────────────────────
  const unshield = useCallback(
    async (params: UnshieldParams): Promise<string | null> => {
      if (!address) { setError("Connect your wallet first."); return null; }
      if (!isValidAmount(params.amount)) { setError("Enter a valid amount."); return null; }
      if (!isValidAddress(params.recipient)) { setError("Invalid recipient address."); return null; }

      setError(null);
      const id = genId();
      const amountBig = parseTokenAmount(params.amount);

      const draft: Transfer = {
        id,
        txHash: null,
        from: address,
        to: params.recipient,
        amount: amountBig,
        amountFormatted: params.amount,
        tokenSymbol: "CTOK",
        type: "unshield",
        status: "pending",
        timestamp: Date.now(),
      };
      addTransfer(draft);
      setPendingId(id);

      try {
        const hash = await writeContractAsync({
          address: contractAddress,
          abi: CONFIDENTIAL_TOKEN_ABI,
          functionName: "unshield",
          args: [amountBig, params.recipient],
        });

        updateTransfer(id, { txHash: hash, status: "confirming" });
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction rejected.";
        updateTransfer(id, { status: "failed" });
        setError(msg.includes("User rejected") ? "Transaction was rejected." : msg);
        return null;
      } finally {
        setPendingId(null);
      }
    },
    [address, contractAddress, addTransfer, updateTransfer, writeContractAsync]
  );

  // ── Confidential Transfer ────────────────────────────────────────────────────
  const confidentialTransfer = useCallback(
    async (params: ConfidentialTransferParams): Promise<string | null> => {
      if (!address) { setError("Connect your wallet first."); return null; }
      if (!isValidAmount(params.amount)) { setError("Enter a valid amount."); return null; }
      if (!isValidAddress(params.to)) { setError("Invalid recipient address."); return null; }
      if (params.to.toLowerCase() === address.toLowerCase()) {
        setError("Cannot send to your own address.");
        return null;
      }

      setError(null);
      const id = genId();
      const amountBig = parseTokenAmount(params.amount);
      const encryptedAmount = mockCommitment(params.amount);
      const proof = mockProof();
      const noteBytes = params.note
        ? (`0x${Buffer.from(params.note, "utf8").toString("hex")}` as `0x${string}`)
        : ("0x" as `0x${string}`);

      const draft: Transfer = {
        id,
        txHash: null,
        from: address,
        to: params.to as `0x${string}`,
        amount: amountBig,
        amountFormatted: params.amount,
        tokenSymbol: "CTOK",
        type: "confidential",
        status: "pending",
        timestamp: Date.now(),
        encryptedAmount,
        proof: null,
        note: params.note,
      };
      addTransfer(draft);
      setPendingId(id);

      try {
        const hash = await writeContractAsync({
          address: contractAddress,
          abi: CONFIDENTIAL_TOKEN_ABI,
          functionName: "confidentialTransfer",
          args: [params.to as `0x${string}`, encryptedAmount as `0x${string}`, proof, noteBytes],
        });

        updateTransfer(id, { txHash: hash, status: "confirming", proof });
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction rejected.";
        updateTransfer(id, { status: "failed" });
        setError(msg.includes("User rejected") ? "Transaction was rejected." : msg);
        return null;
      } finally {
        setPendingId(null);
      }
    },
    [address, contractAddress, addTransfer, updateTransfer, writeContractAsync]
  );

  return {
    shield,
    unshield,
    confidentialTransfer,
    isPending: isWritePending || isConfirming,
    pendingId,
    error,
    clearError,
    resetWrite,
  };
}
