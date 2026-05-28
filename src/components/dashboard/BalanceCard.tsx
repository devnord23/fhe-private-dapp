"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { shortenAddress } from "@/lib/utils";
import { useContractConfig } from "@/hooks/useContractConfig";

export function BalanceCard() {
  const { address, isConnected } = useAccount();
  const { confidentialToken: ctConfigured } = useContractConfig();
  const { encryptedBalance, isLoading } = useTokenBalance();

  if (!ctConfigured) {
    return (
      <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/5 p-6 text-center min-h-[180px] flex flex-col items-center justify-center gap-3">
        <p className="text-sm font-semibold text-white">ConfidentialToken not deployed</p>
        <p className="text-xs text-gray-400 max-w-xs">
          Deploy to Ethereum Sepolia to display encrypted balance handles.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-surface-400/50 bg-gradient-to-br from-surface-700 to-surface-800 p-8 flex flex-col items-center justify-center gap-4 text-center min-h-[200px]">
        <div className="h-14 w-14 rounded-2xl bg-surface-500 flex items-center justify-center">
          <svg
            className="h-7 w-7 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold">Wallet not connected</p>
          <p className="text-gray-400 text-sm mt-1">
            Connect your wallet to view balances
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-surface-700 via-surface-700 to-brand-500/5 p-6 relative overflow-hidden">
      <div aria-hidden className="absolute -top-12 -right-12 w-40 h-40 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

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
            <svg
              className="h-5 w-5 text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
        </div>

        {/* Encrypted balance display */}
        <div className="rounded-xl bg-brand-500/5 border border-brand-500/15 p-4 mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs text-gray-400">Shielded Balance</p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-medium">
              TODO: Re-encryption
            </span>
          </div>

          {isLoading ? (
            <div className="h-6 w-32 rounded bg-surface-400 animate-pulse" />
          ) : encryptedBalance ? (
            <div>
              <p className="text-xl font-bold text-brand-400 font-mono">ENCRYPTED</p>
              <Tooltip content={`Handle: 0x${encryptedBalance.handle.toString(16).padStart(64, "0")}`}>
                <p className="text-xs text-gray-500 mt-1 font-mono cursor-help truncate">
                  Handle: 0x{encryptedBalance.handle.toString(16).slice(0, 16)}…
                </p>
              </Tooltip>
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                To view your balance, fhevmjs must re-encrypt it to your local keypair.
                A &ldquo;Reveal Balance&rdquo; button (wallet signature required) is planned.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xl font-bold text-gray-500">0</p>
              <p className="text-xs text-gray-500 mt-0.5">No shielded balance found</p>
            </div>
          )}
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
