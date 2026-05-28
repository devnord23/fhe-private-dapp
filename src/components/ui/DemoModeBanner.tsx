"use client";

import { useState } from "react";
import { useContractConfig } from "@/hooks/useContractConfig";
import { cn } from "@/lib/utils";

/**
 * DemoModeBanner — shown at the top of the app when no contracts are deployed.
 *
 * Dismissible per session. Reappears on page refresh until contracts are live.
 */
export function DemoModeBanner() {
  const { isDemoMode, vault, confidentialToken, strategyAgent } = useContractConfig();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemoMode || dismissed) return null;

  const configured = [
    vault              && "BaseVault",
    confidentialToken  && "ConfidentialToken",
    strategyAgent      && "StrategyAgent",
  ].filter(Boolean);

  return (
    <div className="sticky top-16 z-30 w-full bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border-b border-yellow-500/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 flex items-center gap-1.5 rounded-full bg-yellow-500/15 border border-yellow-500/25 px-2.5 py-0.5 text-[10px] font-bold text-yellow-400 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse-slow" />
              Demo UI Mode
            </span>
            <p className="text-xs text-yellow-300/80 truncate">
              {configured.length === 0
                ? "No contracts deployed. UI is fully functional — connect wallet, explore pages, read documentation."
                : `Partial: ${configured.join(", ")} deployed. Other features show disabled state.`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="https://github.com/devnord23/fhe-private-dapp/blob/cursor/confidential-transfer-dapp-7533/TESTNET_DEPLOYMENT.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline text-[10px] text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors"
            >
              Deploy guide ↗
            </a>
            <button
              onClick={() => setDismissed(true)}
              className="text-yellow-400/60 hover:text-yellow-400 transition-colors p-1 rounded"
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

/**
 * NotDeployedCard — replaces a section when its contract isn't configured.
 */
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
      className={cn(
        "rounded-2xl border border-yellow-500/15 bg-yellow-500/5 p-8 flex flex-col items-center justify-center gap-3 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10">
        <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">
          {contractName} not deployed
        </p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          {description ??
            "Deploy this contract to a testnet to enable this feature. See TESTNET_DEPLOYMENT.md."}
        </p>
      </div>
      <a
        href="https://github.com/devnord23/fhe-private-dapp/blob/cursor/confidential-transfer-dapp-7533/TESTNET_DEPLOYMENT.md"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-yellow-400 hover:text-yellow-300 underline underline-offset-2"
      >
        View deployment guide ↗
      </a>
    </div>
  );
}
