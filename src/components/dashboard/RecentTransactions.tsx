"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useChainId } from "wagmi";
import { useTransferHistory } from "@/hooks/useTransferHistory";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  formatRelativeTime,
  getExplorerUrl,
  shortenAddress,
  shortenHash,
} from "@/lib/utils";
import type { Transfer, TransferStatus, TransferType } from "@/types";

function typeLabel(type: TransferType): string {
  if (type === "shield") return "Shield";
  if (type === "unshield") return "Unshield";
  return "Confidential";
}

function statusBadge(status: TransferStatus) {
  const map: Record<TransferStatus, { variant: "success" | "warning" | "danger" | "info" | "purple" | "confidential" | "default"; label: string }> = {
    confirmed: { variant: "success", label: "Confirmed" },
    confirming: { variant: "warning", label: "Confirming" },
    pending: { variant: "info", label: "Pending" },
    failed: { variant: "danger", label: "Failed" },
  };
  const { variant, label } = map[status] ?? { variant: "default", label: status };
  return <Badge variant={variant} dot>{label}</Badge>;
}

function TransferRow({ tx, address, chainId }: { tx: Transfer; address: string; chainId: number }) {
  const isSent = tx.from.toLowerCase() === address.toLowerCase();
  const isConfidential = tx.type === "confidential";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-500/50 last:border-0 hover:bg-surface-600/20 -mx-2 px-2 rounded-lg transition-colors">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm
        ${tx.type === "shield" ? "bg-blue-500/10 text-blue-400" :
          tx.type === "unshield" ? "bg-orange-500/10 text-orange-400" :
          "bg-brand-500/10 text-brand-400"}`}>
        {tx.type === "shield" ? "↓" : tx.type === "unshield" ? "↑" : "🔒"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{typeLabel(tx.type)}</span>
          {isConfidential && (
            <Badge variant="confidential" className="text-[10px]">Private</Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {isSent ? `To ${shortenAddress(tx.to)}` : `From ${shortenAddress(tx.from)}`}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${isSent ? "text-red-400" : "text-brand-400"}`}>
          {isSent ? "−" : "+"}
          {isConfidential ? "***" : tx.amountFormatted}
          {" "}{tx.tokenSymbol}
        </p>
        <p className="text-xs text-gray-500">{formatRelativeTime(tx.timestamp)}</p>
      </div>

      <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
        {statusBadge(tx.status)}
        {tx.txHash && (
          <a
            href={getExplorerUrl(chainId, "tx", tx.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-500 hover:text-brand-400 font-mono transition-colors"
          >
            {shortenHash(tx.txHash)}↗
          </a>
        )}
      </div>
    </div>
  );
}

export function RecentTransactions() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { transfers, isLoading } = useTransferHistory();

  const recent = transfers.slice(0, 5);

  if (!isConnected) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-base font-semibold text-white mb-4">Recent Activity</h3>
        <div className="py-8 text-center text-gray-500 text-sm">
          Connect your wallet to view transactions
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">Recent Activity</h3>
        <Link href="/history">
          <Button variant="ghost" size="sm">View all →</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-3">
              <div className="h-9 w-9 rounded-xl bg-surface-500 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-surface-500 animate-pulse" />
                <div className="h-2 w-24 rounded bg-surface-500 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="py-8 text-center text-gray-500 text-sm">
          No transactions yet
        </div>
      ) : (
        <div>
          {recent.map((tx) => (
            <TransferRow
              key={tx.id}
              tx={tx}
              address={address ?? ""}
              chainId={chainId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
