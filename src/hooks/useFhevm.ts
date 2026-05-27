"use client";

/**
 * useFhevm – React hook for the fhevmjs client instance.
 *
 * Returns the fhEVM instance once it has loaded the network's FHE public key.
 * Any component that needs to encrypt inputs or re-encrypt balances should call
 * this hook and check `isReady` before proceeding.
 *
 * The instance is cached per chain ID so switching networks triggers a reload
 * but repeated calls within the same network are free.
 *
 * Errors:
 *   - "FHEVM_UNSUPPORTED_CHAIN"  : The current chain does not have a known fhEVM RPC.
 *   - "FHEVM_INIT_FAILED"        : WASM failed to load or network unreachable.
 */

import { useState, useEffect, useCallback } from "react";
import { useChainId } from "wagmi";
import {
  initFhevm,
  createFhevmInstance,
  clearFhevmCache,
  type FhevmInstance,
} from "@/lib/fhevm";
import { SUPPORTED_CHAIN_IDS, type SupportedChainId } from "@/lib/constants";

type FhevmStatus = "idle" | "loading" | "ready" | "error" | "unsupported";

interface UseFhevmResult {
  instance: FhevmInstance | null;
  isReady: boolean;
  isLoading: boolean;
  status: FhevmStatus;
  error: string | null;
  /** Call this to retry after an error. */
  retry: () => void;
}

function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as number[]).includes(chainId);
}

export function useFhevm(): UseFhevmResult {
  const chainId = useChainId();

  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [status, setStatus] = useState<FhevmStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    clearFhevmCache();
    setRetryCount((c) => c + 1);
    setStatus("idle");
    setError(null);
    setInstance(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isSupportedChain(chainId)) {
        setStatus("unsupported");
        setError(
          `Chain ${chainId} does not support fhEVM. Switch to Zama Devnet (9000) or Sepolia (11155111).`
        );
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        // Step 1: Load the WASM module (idempotent)
        await initFhevm();

        // Step 2: Create / retrieve cached instance (fetches FHE public key from node)
        const fhevmInstance = await createFhevmInstance(chainId);

        if (!cancelled) {
          setInstance(fhevmInstance);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to initialise fhEVM. Is the network reachable?";
          setError(message);
          setStatus("error");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [chainId, retryCount]);

  return {
    instance,
    isReady: status === "ready",
    isLoading: status === "loading",
    status,
    error,
    retry,
  };
}
