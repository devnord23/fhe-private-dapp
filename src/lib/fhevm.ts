"use client";

/**
 * fhevm.ts – Client-side fhEVM integration via fhevmjs (Zama, v0.6.x).
 *
 * fhevmjs requires two system contract addresses that are pre-deployed by Zama
 * on the fhEVM-compatible network.  Get the correct addresses for your target
 * network from https://docs.zama.ai/fhevm/references/contracts.
 *
 * For Zama Devnet (chain ID 9000), set in .env.local:
 *   NEXT_PUBLIC_FHEVM_ACL_ADDRESS=<address from Zama docs>
 *   NEXT_PUBLIC_FHEVM_KMS_ADDRESS=<address from Zama docs>
 *
 * This file is imported ONLY in "use client" modules.  It uses dynamic
 * import() so the WASM module is not bundled into the SSR build.
 *
 * =============================================================================
 * TODO: Re-encryption (balance viewing)
 * =============================================================================
 *  Reading an encrypted balance requires:
 *  1. instance.generateKeypair()                  → { publicKey, privateKey }
 *  2. instance.createEIP712(publicKey, contractAddress) → eip712 object
 *  3. walletClient.signTypedData(eip712)           → signature (user wallet prompt)
 *  4. instance.reencrypt(handle, privateKey, publicKey, signature, contract, user)
 *     → resolves to plaintext bigint
 *
 *  The `handle` is the uint256 returned by encryptedBalanceOf().
 *  Re-encryption is the ONLY way to see a plaintext balance in fhEVM.
 *  This flow is wired in useTokenBalance.ts but gated behind a "Reveal" action.
 * =============================================================================
 */

import type { FhevmInstance } from "fhevmjs";
import { FHEVM_RPC_URLS, GATEWAY_URL, type SupportedChainId } from "./constants";

export type { FhevmInstance };

const FHEVM_ACL_ADDRESS =
  process.env.NEXT_PUBLIC_FHEVM_ACL_ADDRESS ?? "";

const FHEVM_KMS_ADDRESS =
  process.env.NEXT_PUBLIC_FHEVM_KMS_ADDRESS ?? "";

/** Singleton per chain – avoids re-fetching the FHE public key on every render. */
const instanceCache = new Map<number, FhevmInstance>();
let wasmInitDone = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Load the fhevmjs WASM module.
 * Safe to call multiple times (idempotent).
 */
export async function initFhevm(): Promise<void> {
  if (wasmInitDone) return;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    const { initFhevm: _init } = await import("fhevmjs/web");
    await _init();
    wasmInitDone = true;
  })();

  return wasmInitPromise;
}

/**
 * Create (or return the cached) fhEVM instance for a given chain.
 *
 * Requires NEXT_PUBLIC_FHEVM_ACL_ADDRESS and NEXT_PUBLIC_FHEVM_KMS_ADDRESS to
 * be set to the correct Zama system contract addresses for the target chain.
 * See https://docs.zama.ai/fhevm/references/contracts for values.
 *
 * @throws If the ACL or KMS addresses are not configured.
 */
export async function createFhevmInstance(chainId: SupportedChainId): Promise<FhevmInstance> {
  if (instanceCache.has(chainId)) {
    return instanceCache.get(chainId)!;
  }

  if (!FHEVM_ACL_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_FHEVM_ACL_ADDRESS is not set. " +
        "Get the ACL contract address for your network from https://docs.zama.ai/fhevm/references/contracts " +
        "and add it to .env.local."
    );
  }
  if (!FHEVM_KMS_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_FHEVM_KMS_ADDRESS is not set. " +
        "Get the KMS Verifier contract address for your network from https://docs.zama.ai/fhevm/references/contracts " +
        "and add it to .env.local."
    );
  }

  const { createInstance } = await import("fhevmjs/web");

  const instance = await createInstance({
    kmsContractAddress: FHEVM_KMS_ADDRESS,
    aclContractAddress: FHEVM_ACL_ADDRESS,
    networkUrl: FHEVM_RPC_URLS[chainId],
    gatewayUrl: GATEWAY_URL,
  });

  instanceCache.set(chainId, instance);
  return instance;
}

/**
 * Encode a fhevmjs encrypted input result as hex strings for wagmi/viem.
 *
 * fhevmjs returns Uint8Arrays; wagmi expects `0x${string}`.
 */
export function encodeEncryptedInput(
  handles: Uint8Array[],
  inputProof: Uint8Array
): { handle: `0x${string}`; proof: `0x${string}` } {
  const handle = `0x${Buffer.from(handles[0]).toString("hex").padStart(64, "0")}` as `0x${string}`;
  const proof = `0x${Buffer.from(inputProof).toString("hex")}` as `0x${string}`;
  return { handle, proof };
}

/** Clear the instance cache (e.g. when the user switches networks). */
export function clearFhevmCache(): void {
  instanceCache.clear();
  wasmInitDone = false;
  wasmInitPromise = null;
}
