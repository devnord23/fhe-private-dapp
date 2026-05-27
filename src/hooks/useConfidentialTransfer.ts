"use client";

/**
 * useConfidentialTransfer
 *
 * Provides three actions for interacting with ConfidentialToken.sol:
 *
 *   shield(amount)                       – Deposit public ERC-20 into the confidential pool.
 *                                          Amount is PUBLIC at this step.
 *
 *   confidentialTransfer(to, amount)     – Transfer within the pool.
 *                                          Amount is ENCRYPTED via fhevmjs before the call.
 *                                          REAL fhEVM: amount never appears in plaintext on-chain.
 *
 *   requestUnshield(amount, recipient)   – Withdraw from pool back to public ERC-20.
 *                                          Amount is ENCRYPTED. Gateway decrypts asynchronously
 *                                          and fires callbackUnshield on the contract.
 *
 * Prerequisites for confidentialTransfer and requestUnshield:
 *   - Connected to a fhEVM-compatible network (Zama Devnet, chain ID 9000).
 *   - fhevmjs WASM module loaded and FHE public key fetched (useFhevm returns isReady=true).
 *   - User has a shielded balance in the contract.
 *
 * TODO:
 *   - ERC-20 approval flow: call underlying.approve(contractAddress, amount) before shield().
 *     Currently the user must approve separately (e.g. via their wallet or a dedicated UI step).
 */

import { useCallback, useState } from "react";
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  CONFIDENTIAL_TOKEN_ABI,
  CONTRACT_ADDRESSES,
  TX_CONFIRMATION_BLOCKS,
  TOKEN_DECIMALS,
  type SupportedChainId,
} from "@/lib/constants";
import { encodeEncryptedInput } from "@/lib/fhevm";
import { isValidAddress, isValidAmount } from "@/lib/utils";
import type { ConfidentialTransferParams, ShieldParams, Transfer, UnshieldParams } from "@/types";
import { useFhevm } from "./useFhevm";
import { useTransferHistory } from "./useTransferHistory";

function genId() {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Convert a decimal string like "1.5" to the raw uint64 in the token's smallest unit. */
function toTokenUnits(amount: string): bigint {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return 0n;
  return BigInt(Math.round(num * 10 ** TOKEN_DECIMALS));
}

export function useConfidentialTransfer() {
  const { address } = useAccount();
  const chainId = useChainId() as SupportedChainId;
  const { addTransfer, updateTransfer } = useTransferHistory();
  const { instance: fhevmInstance, isReady: fhevmReady } = useFhevm();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contractAddress =
    CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[9000];

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
  //
  // shield() takes a plain uint64. The amount is PUBLIC.
  // The user must have approved the contract on the underlying ERC-20 first.
  const shield = useCallback(
    async (params: ShieldParams): Promise<string | null> => {
      if (!address) {
        setError("Connect your wallet first.");
        return null;
      }
      if (!isValidAmount(params.amount)) {
        setError("Enter a valid amount.");
        return null;
      }

      setError(null);
      const id = genId();
      const amountUnits = toTokenUnits(params.amount);

      const draft: Transfer = {
        id,
        txHash: null,
        from: address,
        to: contractAddress,
        amount: amountUnits,
        amountFormatted: params.amount,
        tokenSymbol: "cUSDC",
        type: "shield",
        status: "pending",
        timestamp: Date.now(),
      };
      addTransfer(draft);
      setPendingId(id);

      try {
        // shield() takes a plain uint64 – no fhEVM encryption needed here.
        const hash = await writeContractAsync({
          address: contractAddress,
          abi: CONFIDENTIAL_TOKEN_ABI,
          functionName: "shield",
          args: [amountUnits],
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
  //
  // REAL fhEVM encryption via fhevmjs.
  // The amount is encrypted client-side before the transaction is built.
  // The contract receives an encrypted handle + proof and performs TFHE arithmetic.
  const confidentialTransfer = useCallback(
    async (params: ConfidentialTransferParams): Promise<string | null> => {
      if (!address) {
        setError("Connect your wallet first.");
        return null;
      }
      if (!isValidAmount(params.amount)) {
        setError("Enter a valid amount.");
        return null;
      }
      if (!isValidAddress(params.to)) {
        setError("Invalid recipient address.");
        return null;
      }
      if (params.to.toLowerCase() === address.toLowerCase()) {
        setError("Cannot send to your own address.");
        return null;
      }
      if (!fhevmReady || !fhevmInstance) {
        setError(
          "fhEVM encryption module is not ready. " +
            "Make sure you are connected to Zama Devnet (chain ID 9000) and try again."
        );
        return null;
      }

      setError(null);
      const id = genId();
      const amountUnits = toTokenUnits(params.amount);

      const draft: Transfer = {
        id,
        txHash: null,
        from: address,
        to: params.to as `0x${string}`,
        amount: amountUnits,
        amountFormatted: params.amount,
        tokenSymbol: "cUSDC",
        type: "confidential",
        status: "pending",
        timestamp: Date.now(),
      };
      addTransfer(draft);
      setPendingId(id);

      try {
        // ── Real fhEVM encryption ──────────────────────────────────────────
        // createEncryptedInput binds the ciphertext to (contractAddress, userAddress)
        // so it cannot be replayed by or for a different party.
        const encInput = fhevmInstance.createEncryptedInput(contractAddress, address);
        encInput.add64(amountUnits);
        const encrypted = await encInput.encrypt();
        // encrypted.handles[0] = Uint8Array (32 bytes) → bytes32 handle for the contract
        // encrypted.inputProof  = Uint8Array             → bytes proof for the contract

        const { handle, proof } = encodeEncryptedInput(
          encrypted.handles as Uint8Array[],
          encrypted.inputProof as Uint8Array
        );

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: CONFIDENTIAL_TOKEN_ABI,
          functionName: "transfer",
          args: [params.to as `0x${string}`, handle, proof],
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
    [
      address,
      contractAddress,
      fhevmInstance,
      fhevmReady,
      addTransfer,
      updateTransfer,
      writeContractAsync,
    ]
  );

  // ── Request Unshield ─────────────────────────────────────────────────────────
  //
  // Encrypts the withdrawal amount, submits to requestUnshield().
  // The Gateway decrypts asynchronously and triggers callbackUnshield() on-chain
  // which sends the ERC-20 to the recipient.  On Zama Devnet this takes ~1-2 blocks.
  const requestUnshield = useCallback(
    async (params: UnshieldParams): Promise<string | null> => {
      if (!address) {
        setError("Connect your wallet first.");
        return null;
      }
      if (!isValidAmount(params.amount)) {
        setError("Enter a valid amount.");
        return null;
      }
      if (!isValidAddress(params.recipient)) {
        setError("Invalid recipient address.");
        return null;
      }
      if (!fhevmReady || !fhevmInstance) {
        setError(
          "fhEVM encryption module is not ready. " +
            "Make sure you are connected to Zama Devnet (chain ID 9000) and try again."
        );
        return null;
      }

      setError(null);
      const id = genId();
      const amountUnits = toTokenUnits(params.amount);

      const draft: Transfer = {
        id,
        txHash: null,
        from: address,
        to: params.recipient,
        amount: amountUnits,
        amountFormatted: params.amount,
        tokenSymbol: "cUSDC",
        type: "unshield",
        status: "pending",
        timestamp: Date.now(),
      };
      addTransfer(draft);
      setPendingId(id);

      try {
        // Encrypt the unshield amount – the contract checks balance homomorphically.
        const encInput = fhevmInstance.createEncryptedInput(contractAddress, address);
        encInput.add64(amountUnits);
        const encrypted = await encInput.encrypt();

        const { handle, proof } = encodeEncryptedInput(
          encrypted.handles as Uint8Array[],
          encrypted.inputProof as Uint8Array
        );

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: CONFIDENTIAL_TOKEN_ABI,
          functionName: "requestUnshield",
          args: [handle, proof, params.recipient],
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
    [
      address,
      contractAddress,
      fhevmInstance,
      fhevmReady,
      addTransfer,
      updateTransfer,
      writeContractAsync,
    ]
  );

  return {
    shield,
    confidentialTransfer,
    requestUnshield,
    fhevmReady,
    isPending: isWritePending || isConfirming,
    pendingId,
    error,
    clearError,
    resetWrite,
  };
}
