"use client";

import { useChainId } from "wagmi";
import { NETWORK_NAMES, type SupportedChainId } from "@/lib/constants";

const DEMO_STATS = {
  totalShielded: "4,281,900",
  totalTransfers: "182,443",
  activeUsers: "9,211",
  avgGasGwei: "12.4",
};

export function NetworkStats() {
  const chainId = useChainId() as SupportedChainId;
  const networkName = NETWORK_NAMES[chainId] ?? "Testnet";

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-white">Protocol Stats</h3>
        <span className="text-xs px-2.5 py-1 rounded-full bg-surface-500 text-gray-400">
          {networkName}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Shielded", value: DEMO_STATS.totalShielded, unit: "CTOK" },
          { label: "Total Transfers", value: DEMO_STATS.totalTransfers, unit: "txs" },
          { label: "Active Users", value: DEMO_STATS.activeUsers, unit: "wallets" },
          { label: "Avg Gas Price", value: DEMO_STATS.avgGasGwei, unit: "gwei" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-surface-600/60 border border-surface-400/30 p-3"
          >
            <p className="text-[11px] text-gray-400 font-medium">{stat.label}</p>
            <p className="text-lg font-bold text-white mt-0.5">{stat.value}</p>
            <p className="text-[10px] text-gray-500">{stat.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
