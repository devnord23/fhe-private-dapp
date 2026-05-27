"use client";

/**
 * useStrategy – Hooks for interacting with ConfidentialStrategyAgent.sol.
 *
 * REAL (uses actual fhevmjs + wagmi):
 *   • createStrategy:  encrypts 5 params, calls contract
 *   • updateStrategy:  encrypts 5 params, updates contract
 *   • evaluateStrategy: encrypts current feed values, calls contract
 *   • deactivateStrategy: plain call
 *   • requestParameterReveal: plain call → Gateway decrypts
 *   • requestEvaluationReveal: plain call → Gateway decrypts
 *
 * TODO before production:
 *   • Re-encryption of handles for balance display (EIP-712 + reencrypt())
 *   • Listen to EvaluationRevealed / ParameterRevealed events and surface results
 *   • Error handling for Gateway timeout
 *   • Strategy indexing (currently reads from contract per call)
 */

import { useCallback, useState } from "react";
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import {
  STRATEGY_AGENT_ABI,
  STRATEGY_AGENT_ADDRESSES,
  TX_CONFIRMATION_BLOCKS,
  type SupportedChainId,
} from "@/lib/constants";
import { useFhevm } from "./useFhevm";

export interface StrategyParams {
  /** Target APY in basis points, e.g. 800 = 8.00% */
  apyTargetBps: number;
  /** Rebalance trigger APY in basis points, e.g. 500 = 5.00% */
  rebalanceThresholdBps: number;
  /** Stop-loss health factor × 100, e.g. 120 = HF 1.20 */
  stopLossBufferX100: number;
  /** Extra safety margin × 100, e.g. 20 = 0.20 HF */
  liquidationBufferX100: number;
  /** Max leverage × 100, e.g. 150 = 1.5× */
  maxLeverageX100: number;
}

export interface EvaluationParams {
  strategyId: bigint;
  currentApyBps: number;
  currentHealthX100: number;
}

function useContractAddress() {
  const chainId = useChainId() as SupportedChainId;
  return STRATEGY_AGENT_ADDRESSES[chainId] ?? STRATEGY_AGENT_ADDRESSES[9000];
}

// ── createStrategy ────────────────────────────────────────────────────────────

export function useCreateStrategy() {
  const { address } = useAccount();
  const contractAddress = useContractAddress();
  const { instance: fhevmInstance, isReady: fhevmReady } = useFhevm();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    confirmations: TX_CONFIRMATION_BLOCKS,
  });

  const createStrategy = useCallback(
    async (params: StrategyParams): Promise<`0x${string}` | null> => {
      setError(null);

      if (!address) { setError("Connect your wallet first."); return null; }
      if (!fhevmReady || !fhevmInstance) {
        setError("fhEVM encryption not ready. Connect to Zama Devnet (chain 9000).");
        return null;
      }

      try {
        // ── Real fhevmjs encryption – single input builder for all 5 params ──
        //
        // Using a single createEncryptedInput call produces ONE proof covering
        // all five ciphertexts. The contract uses this proof for all asEuint64()
        // calls in createStrategy(). This is the correct fhEVM pattern.
        const input = fhevmInstance.createEncryptedInput(contractAddress, address);
        input.add64(BigInt(params.apyTargetBps));
        input.add64(BigInt(params.rebalanceThresholdBps));
        input.add64(BigInt(params.stopLossBufferX100));
        input.add64(BigInt(params.liquidationBufferX100));
        input.add64(BigInt(params.maxLeverageX100));
        const encrypted = await input.encrypt();

        const handles = encrypted.handles as Uint8Array[];
        const proof   = encrypted.inputProof as Uint8Array;

        const h = (i: number) =>
          `0x${Buffer.from(handles[i]).toString("hex").padStart(64, "0")}` as `0x${string}`;
        const proofHex = `0x${Buffer.from(proof).toString("hex")}` as `0x${string}`;

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: STRATEGY_AGENT_ABI,
          functionName: "createStrategy",
          args: [h(0), h(1), h(2), h(3), h(4), proofHex],
        });

        setTxHash(hash);
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [address, contractAddress, fhevmInstance, fhevmReady, writeContractAsync]
  );

  return {
    createStrategy,
    isPending: isPending || isConfirming,
    fhevmReady,
    error,
    txHash,
    clearError: () => setError(null),
  };
}

// ── updateStrategy ────────────────────────────────────────────────────────────

export function useUpdateStrategy() {
  const { address } = useAccount();
  const contractAddress = useContractAddress();
  const { instance: fhevmInstance, isReady: fhevmReady } = useFhevm();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);

  const updateStrategy = useCallback(
    async (strategyId: bigint, params: StrategyParams): Promise<`0x${string}` | null> => {
      setError(null);
      if (!address) { setError("Connect your wallet first."); return null; }
      if (!fhevmReady || !fhevmInstance) {
        setError("fhEVM encryption not ready.");
        return null;
      }

      try {
        const input = fhevmInstance.createEncryptedInput(contractAddress, address);
        input.add64(BigInt(params.apyTargetBps));
        input.add64(BigInt(params.rebalanceThresholdBps));
        input.add64(BigInt(params.stopLossBufferX100));
        input.add64(BigInt(params.liquidationBufferX100));
        input.add64(BigInt(params.maxLeverageX100));
        const encrypted = await input.encrypt();

        const handles = encrypted.handles as Uint8Array[];
        const proof   = encrypted.inputProof as Uint8Array;
        const h = (i: number) =>
          `0x${Buffer.from(handles[i]).toString("hex").padStart(64, "0")}` as `0x${string}`;
        const proofHex = `0x${Buffer.from(proof).toString("hex")}` as `0x${string}`;

        return await writeContractAsync({
          address: contractAddress,
          abi: STRATEGY_AGENT_ABI,
          functionName: "updateStrategy",
          args: [strategyId, h(0), h(1), h(2), h(3), h(4), proofHex],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [address, contractAddress, fhevmInstance, fhevmReady, writeContractAsync]
  );

  return { updateStrategy, isPending, fhevmReady, error, clearError: () => setError(null) };
}

// ── evaluateStrategy ──────────────────────────────────────────────────────────

export function useEvaluateStrategy() {
  const { address } = useAccount();
  const contractAddress = useContractAddress();
  const { instance: fhevmInstance, isReady: fhevmReady } = useFhevm();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);
  const [lastEvalHash, setLastEvalHash] = useState<`0x${string}` | null>(null);

  const evaluateStrategy = useCallback(
    async (params: EvaluationParams): Promise<`0x${string}` | null> => {
      setError(null);
      if (!address) { setError("Connect your wallet first."); return null; }
      if (!fhevmReady || !fhevmInstance) {
        setError("fhEVM encryption not ready. Connect to Zama Devnet.");
        return null;
      }

      try {
        // ── Encrypt both current market values in one input ───────────────────
        //
        // OBLIVIOUS EVALUATION: The agent knows these plaintext values.
        // The strategy thresholds are unknown to the agent (encrypted on-chain).
        // TFHE.lt compares them homomorphically — neither party knows the result.
        const input = fhevmInstance.createEncryptedInput(contractAddress, address);
        input.add64(BigInt(params.currentApyBps));
        input.add64(BigInt(params.currentHealthX100));
        const encrypted = await input.encrypt();

        const handles = encrypted.handles as Uint8Array[];
        const proof   = encrypted.inputProof as Uint8Array;
        const h = (i: number) =>
          `0x${Buffer.from(handles[i]).toString("hex").padStart(64, "0")}` as `0x${string}`;
        const proofHex = `0x${Buffer.from(proof).toString("hex")}` as `0x${string}`;

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: STRATEGY_AGENT_ABI,
          functionName: "evaluateStrategy",
          args: [params.strategyId, h(0), h(1), proofHex],
        });

        setLastEvalHash(hash);
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [address, contractAddress, fhevmInstance, fhevmReady, writeContractAsync]
  );

  return {
    evaluateStrategy,
    isPending,
    fhevmReady,
    lastEvalHash,
    error,
    clearError: () => setError(null),
  };
}

// ── deactivate / reveal ───────────────────────────────────────────────────────

export function useStrategyActions() {
  const contractAddress = useContractAddress();
  const { writeContractAsync, isPending } = useWriteContract();
  const [error, setError] = useState<string | null>(null);

  const deactivate = useCallback(
    async (strategyId: bigint) => {
      setError(null);
      try {
        return await writeContractAsync({
          address: contractAddress,
          abi: STRATEGY_AGENT_ABI,
          functionName: "deactivateStrategy",
          args: [strategyId],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [contractAddress, writeContractAsync]
  );

  const requestParamReveal = useCallback(
    async (strategyId: bigint, paramType: number) => {
      setError(null);
      try {
        return await writeContractAsync({
          address: contractAddress,
          abi: STRATEGY_AGENT_ABI,
          functionName: "requestParameterReveal",
          args: [strategyId, paramType],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [contractAddress, writeContractAsync]
  );

  const requestEvalReveal = useCallback(
    async (strategyId: bigint) => {
      setError(null);
      try {
        return await writeContractAsync({
          address: contractAddress,
          abi: STRATEGY_AGENT_ABI,
          functionName: "requestEvaluationReveal",
          args: [strategyId],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("User rejected") ? "Transaction rejected." : msg);
        return null;
      }
    },
    [contractAddress, writeContractAsync]
  );

  return { deactivate, requestParamReveal, requestEvalReveal, isPending, error, clearError: () => setError(null) };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function useOwnerStrategies() {
  const { address, isConnected } = useAccount();
  const contractAddress = useContractAddress();

  const { data, isLoading, refetch } = useReadContract({
    address: contractAddress,
    abi: STRATEGY_AGENT_ABI,
    functionName: "getOwnerStrategies",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address, refetchInterval: 15_000 },
  });

  return {
    strategyIds: (data as bigint[] | undefined) ?? [],
    isLoading,
    refetch,
  };
}

export function useStrategyMetadata(strategyId: bigint | null) {
  const contractAddress = useContractAddress();

  const { data, isLoading, refetch } = useReadContract({
    address: contractAddress,
    abi: STRATEGY_AGENT_ABI,
    functionName: "getStrategyMetadata",
    args: strategyId !== null ? [strategyId] : undefined,
    query: { enabled: strategyId !== null, refetchInterval: 15_000 },
  });

  type MetaResult = [
    string,   // owner
    boolean,  // isActive
    bigint,   // createdAt
    bigint,   // lastEvaluatedAt
    bigint,   // apyTargetHandle
    bigint,   // rebalanceThresholdHandle
    bigint,   // stopLossBufferHandle
    bigint,   // liquidationBufferHandle
    bigint,   // maxLeverageHandle
    bigint,   // evaluationCountHandle
  ];

  const meta = data as MetaResult | undefined;

  return {
    metadata: meta
      ? {
          owner:                    meta[0] as `0x${string}`,
          isActive:                 meta[1],
          createdAt:                meta[2],
          lastEvaluatedAt:          meta[3],
          apyTargetHandle:          meta[4],
          rebalanceThresholdHandle: meta[5],
          stopLossBufferHandle:     meta[6],
          liquidationBufferHandle:  meta[7],
          maxLeverageHandle:        meta[8],
          evaluationCountHandle:    meta[9],
        }
      : null,
    isLoading,
    refetch,
  };
}
