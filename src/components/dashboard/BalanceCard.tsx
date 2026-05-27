"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { shortenAddress } from "@/lib/utils";

export function BalanceCard() {
  const { address, isConnected } = useAccount();
  const { balance, isLoading } = useTokenBalance();

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-surface-400/50 bg-gradient-to-br from-surface-700 to-surface-800 p-8 flex flex-col items-center justify-center gap-4 text-center min-h-[200px]">
        <div className="h-14 w-14 rounded-2xl bg-surface-500 flex items-center justify-center">
          <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold">Wallet not connected</p>
          <p className="text-gray-400 text-sm mt-1">Connect your wallet to view balances</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-surface-700 via-surface-700 to-brand-500/5 p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Your Account
            </p>
            <Tooltip content={address ?? ""}>
              <p className="mt-1 font-mono text-sm text-gray-300">
                {shortenAddress(address ?? "", 6)}
              </p>
            </Tooltip>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/20">
            <svg className="h-5 w-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl bg-surface-600/50 border border-surface-400/30 p-4">
            <p className="text-xs text-gray-400 mb-1">Public Balance</p>
            {isLoading ? (
              <div className="h-6 w-24 rounded bg-surface-400 animate-pulse" />
            ) : (
              <>
                <p className="text-xl font-bold text-white">
                  {balance?.formatted.public ?? "—"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{balance?.symbol ?? "CTOK"}</p>
              </>
            )}
          </div>

          <div className="rounded-xl bg-brand-500/5 border border-brand-500/15 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-xs text-gray-400">Shielded Balance</p>
              <svg className="h-3 w-3 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
            {isLoading ? (
              <div className="h-6 w-24 rounded bg-surface-400 animate-pulse" />
            ) : (
              <>
                <p className="text-xl font-bold text-brand-400">
                  {balance?.formatted.shielded ?? "—"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{balance?.symbol ?? "CTOK"}</p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/transfer" className="flex-1">
            <Button variant="primary" size="sm" className="w-full">
              Shield / Send
            </Button>
          </Link>
          <Link href="/history" className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              View History
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
