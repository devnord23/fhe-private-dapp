"use client";

import { useAccount } from "wagmi";
import { useTransferHistory } from "@/hooks/useTransferHistory";

export function HistoryStats() {
  const { isConnected } = useAccount();
  const { stats, isLoading } = useTransferHistory();

  if (!isConnected) return null;

  const items = [
    { label: "Total Transactions", value: isLoading ? "—" : String(stats.count) },
    { label: "Confidential Sends", value: isLoading ? "—" : String(stats.confidentialCount) },
    { label: "Total Sent", value: isLoading ? "—" : `${stats.formattedSent} CTOK` },
    { label: "Total Received", value: isLoading ? "—" : `${stats.formattedReceived} CTOK` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-surface-400/50 bg-surface-700 p-4"
        >
          <p className="text-xs text-gray-400 font-medium">{item.label}</p>
          <p className="mt-1.5 text-xl font-bold text-white truncate">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
