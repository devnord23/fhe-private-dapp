"use client";

import { useAccount, useChainId, useReadContract } from "wagmi";
import { useMemo } from "react";
import { CONFIDENTIAL_TOKEN_ABI, CONTRACT_ADDRESSES } from "@/lib/constants";
import { formatTokenAmount } from "@/lib/utils";
import type { ChainId, TokenBalance } from "@/types";

export function useTokenBalance(): {
  balance: TokenBalance | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { address, isConnected } = useAccount();
  const chainId = useChainId() as ChainId;

  const contractAddress = CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[11155111];

  const { data: publicBal, isLoading: l1, refetch: r1 } = useReadContract({
    address: contractAddress,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: "publicBalanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  const { data: symbol, isLoading: l2 } = useReadContract({
    address: contractAddress,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: "symbol",
    query: { enabled: isConnected },
  });

  const { data: decimals, isLoading: l3 } = useReadContract({
    address: contractAddress,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: "decimals",
    query: { enabled: isConnected },
  });

  const { data: tokenName, isLoading: l4 } = useReadContract({
    address: contractAddress,
    abi: CONFIDENTIAL_TOKEN_ABI,
    functionName: "name",
    query: { enabled: isConnected },
  });

  const balance = useMemo<TokenBalance | null>(() => {
    if (!isConnected || !address) return null;

    const pub = (publicBal as bigint | undefined) ?? 0n;
    const dec = (decimals as number | undefined) ?? 18;
    const sym = (symbol as string | undefined) ?? "CTOK";
    const name = (tokenName as string | undefined) ?? "Confidential Token";

    // Shielded balance is derived from the commitment stored on-chain.
    // Until we integrate a real view-key decryption SDK, we show a demo value.
    const shielded = pub > 0n ? (pub * 3n) / 10n : 0n;

    return {
      public: pub,
      shielded,
      symbol: sym,
      decimals: dec,
      name,
      formatted: {
        public: formatTokenAmount(pub, dec),
        shielded: formatTokenAmount(shielded, dec),
      },
    };
  }, [isConnected, address, publicBal, symbol, decimals, tokenName]);

  return {
    balance,
    isLoading: l1 || l2 || l3 || l4,
    refetch: r1,
  };
}
