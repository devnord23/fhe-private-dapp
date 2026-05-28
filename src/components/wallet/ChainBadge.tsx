"use client";

import { useChainId } from "wagmi";
import { isBaseChain, isFhevmChain } from "@/lib/utils";

/**
 * ChainBadge — Shows which layer the user's wallet is currently connected to.
 *
 * Base Sepolia / Base  → Settlement layer (blue)
 * Zama Devnet / Sepolia → Compute layer (green)
 * Other               → Warning
 */
export function ChainBadge() {
  const chainId = useChainId();

  if (isBaseChain(chainId)) {
    return (
      <div className="hidden lg:flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
        <span className="text-blue-400 font-medium">Settlement Layer</span>
        <span className="text-blue-400/60 text-[10px]">(Base)</span>
      </div>
    );
  }

  if (isFhevmChain(chainId)) {
    return (
      <div className="hidden lg:flex items-center gap-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 px-2.5 py-1.5 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow shrink-0" />
        <span className="text-brand-400 font-medium">Compute Layer</span>
        <span className="text-brand-400/60 text-[10px]">(Zama fhEVM)</span>
      </div>
    );
  }

  return null;
}
