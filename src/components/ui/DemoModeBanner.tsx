"use client";

import { useState } from "react";
import { useContractConfig } from "@/hooks/useContractConfig";

export function DemoModeBanner() {
  const { isDemoMode } = useContractConfig();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemoMode || dismissed) return null;

  return (
    <div className="sticky top-16 z-30 w-full">
      <div className="bg-[#0a0a12]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Demo Mode</span>
              </div>
              <p className="text-xs text-gray-400 truncate">
                Contract addresses not configured — connect wallet and set addresses in Vercel to activate deposits.
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-600 hover:text-gray-400 transition-colors p-1 rounded shrink-0"
              aria-label="Dismiss"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Premium "not deployed" card — no external links */
export function NotDeployedCard({
  contractName,
  description,
  className,
}: {
  contractName: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-lg p-8 flex flex-col items-center justify-center gap-4 text-center overflow-hidden ${className ?? ""}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/8 border border-orange-500/15">
        <svg className="h-5 w-5 text-orange-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div className="relative">
        <p className="text-sm font-semibold text-white/80 mb-1">{contractName}</p>
        <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
          {description ?? "Set this contract address in your Vercel environment variables to activate this feature."}
        </p>
      </div>
    </div>
  );
}
