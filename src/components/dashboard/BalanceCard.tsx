"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { GlassCard, GlassCardAccentBar } from "@/components/ui/GlassCard";
import { shortenAddress } from "@/lib/utils";
import { useContractConfig } from "@/hooks/useContractConfig";

export function BalanceCard() {
  const { address, isConnected } = useAccount();
  const { confidentialToken: ctConfigured } = useContractConfig();
  const { encryptedBalance, isLoading } = useTokenBalance();

  if (!ctConfigured) {
    return (
      <GlassCard padding="lg" className="text-center min-h-[180px] flex flex-col items-center justify-center gap-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-wider">ConfidentialToken</p>
        <p className="text-sm text-white/50">Not deployed</p>
        <p className="text-[10px] text-gray-600 max-w-xs">
          Deploy to Ethereum Sepolia to read encrypted balances.
        </p>
      </GlassCard>
    );
  }

  if (!isConnected) {
    return (
      <GlassCard padding="lg" className="min-h-[200px] flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-12 w-12 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center">
          <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6m18 0V6m0 0V3.75M3 6V3.75" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">No wallet connected</p>
          <p className="text-xs text-gray-500 mt-1">Connect to view your encrypted balance</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard accent="green" padding="lg" className="relative overflow-hidden">
      <GlassCardAccentBar color="green" />

      {/* Ambient glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="section-label mb-1">Zama fhEVM Balance</p>
            <Tooltip content={address ?? ""}>
              <p className="font-mono text-xs text-gray-500 cursor-help hover:text-gray-400 transition-colors">
                {shortenAddress(address ?? "", 6)}
              </p>
            </Tooltip>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20">
            <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Balance display */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] text-gray-500">Shielded Balance</p>
            <span className="rounded bg-brand-500/10 border border-brand-500/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-400 uppercase tracking-wide">
              Encrypted
            </span>
          </div>

          {isLoading ? (
            <div className="h-8 w-32 rounded-lg bg-white/[0.05] animate-pulse" />
          ) : encryptedBalance ? (
            <div>
              <p className="text-2xl font-bold text-brand-400 font-mono leading-none mb-1">
                ENCRYPTED
              </p>
              <Tooltip content={`Handle: 0x${encryptedBalance.handle.toString(16).padStart(64, "0")}`}>
                <p className="font-mono text-[10px] text-gray-600 cursor-help">
                  0x{encryptedBalance.handle.toString(16).slice(0, 12)}…
                </p>
              </Tooltip>
              <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                TODO: Reveal via EIP-712 + fhevmjs.reencrypt()
              </p>
            </div>
          ) : (
            <p className="text-xl font-bold text-gray-500 font-mono">0</p>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <Link href="/transfer" className="flex-1">
            <Button variant="primary" size="sm" className="w-full">Shield</Button>
          </Link>
          <Link href="/history" className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">History</Button>
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
