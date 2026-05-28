"use client";

/**
 * useTokenBalance
 *
 * Reads the user's balance from ConfidentialToken.sol.
 *
 * REAL (works today):
 *   - Reads the euint64 handle via encryptedBalanceOf() – the handle is a uint256
 *     pointer to a ciphertext on the Zama node network.
 *   - The handle itself is public; knowing it does NOT reveal the balance.
 *
 * TODO: Re-encryption (balance decryption)
 *   To show the user their actual balance, the app must:
 *   1. instance.generateKeypair()               → { publicKey, privateKey }
 *   2. instance.createEIP712(publicKey, contractAddress)
 *   3. walletClient.signTypedData(eip712)        → signature (user wallet prompt)
 *   4. instance.reencrypt(handle, privateKey, publicKey, signature, contract, user)
 *      → resolves to the plaintext bigint
 *   This requires user interaction (wallet signature) so it is not done automatically.
 *   The UI currently shows "-- (encrypted)" for the shielded balance until wired.
 *
 *   Implementation plan:
 *     - Add a "Reveal Balance" button that triggers steps 1-4.
 *     - Cache the decrypted value in sessionStorage (or in-memory) until the tab closes.
 *     - The session key pair should be regenerated each session for forward secrecy.
 */

import { useAccount, useChainId, useReadContract } from "wagmi";
import { CONFIDENTIAL_TOKEN_ABI, CONTRACT_ADDRESSES, type SupportedChainId } from "@/lib/constants";
import { isContractConfigured } from "@/lib/contracts";

export interface EncryptedBalanceHandle {
  /** The raw euint64 handle (uint256 value returned by the contract). */
  handle: bigint;
  /**
   * Whether the current user has ACL access to this handle.
   * On Zama fhEVM, the contract grants access via TFHE.allow() during shield/transfer.
   * If false, re-encryption will fail even with a valid keypair.
   */
  hasAccess: boolean;
}

export interface TokenBalanceResult {
  /**
   * The encrypted balance handle. Use fhevmjs.reencrypt() to get the actual value.
   * null if the user has no shielded balance or is not connected.
   */
  encryptedBalance: EncryptedBalanceHandle | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useTokenBalance(): TokenBalanceResult {
  const { address, isConnected } = useAccount();
  const chainId = useChainId() as SupportedChainId;

  const contractAddress =
    CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[9000];

  const contractConfigured = isContractConfigured(contractAddress);

  const {
    data: rawHandle,
    isLoading,
    refetch,
  } = useReadContract({
    address: contractAddress,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: "encryptedBalanceOf",
    args: address ? [address] : undefined,
    query: {
      // Skip the RPC call entirely when the contract is not deployed (zero address)
      enabled: isConnected && !!address && contractConfigured,
    },
  });

  const handle = rawHandle as bigint | undefined;
  const hasHandle = handle !== undefined && handle !== 0n;

  return {
    encryptedBalance: hasHandle
      ? {
          handle: handle,
          // The contract grants ACL access (TFHE.allow) during shield() and transfer().
          // If the user has a handle != 0, they were granted access.
          hasAccess: true,
        }
      : null,
    isLoading,
    refetch,
  };
}
