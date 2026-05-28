"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { useTransferHistory } from "@/hooks/useTransferHistory";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  formatTimestamp,
  getExplorerUrl,
  shortenAddress,
  shortenHash,
} from "@/lib/utils";
import type { Transfer, TransferStatus, TransferType } from "@/types";
import { cn } from "@/lib/utils";

type FilterType = "all" | TransferType;
type FilterStatus = "all" | TransferStatus;

function TypeBadge({ type }: { type: TransferType }) {
  const cfg = {
    shield: { label: "Shield", variant: "info" as const },
    unshield: { label: "Unshield", variant: "warning" as const },
    confidential: { label: "Confidential", variant: "confidential" as const },
  };
  const { label, variant } = cfg[type];
  return <Badge variant={variant}>{label}</Badge>;
}

function StatusBadge({ status }: { status: TransferStatus }) {
  const cfg: Record<TransferStatus, { label: string; variant: "success" | "warning" | "danger" | "info" | "purple" | "default" }> = {
    confirmed: { label: "Confirmed", variant: "success" },
    confirming: { label: "Confirming", variant: "warning" },
    pending: { label: "Pending", variant: "info" },
    failed: { label: "Failed", variant: "danger" },
  };
  const { label, variant } = cfg[status] ?? { label: status, variant: "default" };
  return <Badge variant={variant} dot>{label}</Badge>;
}

function AmountCell({ tx, address }: { tx: Transfer; address: string }) {
  const isSent = tx.from.toLowerCase() === address.toLowerCase();
  const isPrivate = tx.type === "confidential";

  return (
    <div className="text-right">
      {isPrivate ? (
        <Tooltip content="Amount encrypted by fhEVM — only you can re-encrypt and read it">
          <span className="font-mono text-sm text-gray-400 cursor-help">
            *** {tx.tokenSymbol}
          </span>
        </Tooltip>
      ) : (
        <span className={cn("font-mono text-sm font-semibold", isSent ? "text-red-400" : "text-brand-400")}>
          {isSent ? "−" : "+"}
          {tx.amountFormatted} {tx.tokenSymbol}
        </span>
      )}
    </div>
  );
}

export function TransactionTable() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { transfers, isLoading } = useTransferHistory();

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const filtered = transfers.filter((tx) => {
    if (filterType !== "all" && tx.type !== filterType) return false;
    if (filterStatus !== "all" && tx.status !== filterStatus) return false;
    return true;
  });

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-12 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-surface-500 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-white font-semibold">Connect your wallet</p>
        <p className="text-gray-400 text-sm mt-1">Your transfer history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Type:</span>
          {(["all", "confidential", "shield", "unshield"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilterType(f); setPage(0); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterType === f
                  ? "bg-brand-500/15 text-brand-400 border border-brand-500/20"
                  : "bg-surface-600 text-gray-400 hover:text-gray-200 border border-surface-400/30"
              )}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Status:</span>
          {(["all", "confirmed", "confirming", "pending", "failed"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(0); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterStatus === s
                  ? "bg-surface-500 text-white border border-surface-300"
                  : "bg-surface-600 text-gray-400 hover:text-gray-200 border border-surface-400/30"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-surface-400/50 bg-surface-700 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2">
                <div className="h-4 w-28 rounded bg-surface-500 animate-pulse" />
                <div className="h-4 w-32 rounded bg-surface-500 animate-pulse" />
                <div className="h-4 w-24 rounded bg-surface-500 animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No transactions match your filters
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-500/60 text-left">
                    {["Time", "Type", "From", "To", "Amount", "Status", "Tx Hash"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-500/30">
                  {paged.map((tx) => (
                    <tr key={tx.id} className="hover:bg-surface-600/20 transition-colors group">
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                        {formatTimestamp(tx.timestamp)}
                      </td>
                      <td className="px-5 py-4">
                        <TypeBadge type={tx.type} />
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-400">
                        {shortenAddress(tx.from)}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-400">
                        {shortenAddress(tx.to)}
                      </td>
                      <td className="px-5 py-4">
                        <AmountCell tx={tx} address={address ?? ""} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="px-5 py-4">
                        {tx.txHash ? (
                          <a
                            href={getExplorerUrl(chainId, "tx", tx.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-gray-400 hover:text-brand-400 transition-colors"
                          >
                            {shortenHash(tx.txHash)}↗
                          </a>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-surface-500/30">
              {paged.map((tx) => (
                <div key={tx.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <TypeBadge type={tx.type} />
                    <StatusBadge status={tx.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{formatTimestamp(tx.timestamp)}</span>
                    <AmountCell tx={tx} address={address ?? ""} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">From</p>
                      <p className="font-mono text-gray-300">{shortenAddress(tx.from)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">To</p>
                      <p className="font-mono text-gray-300">{shortenAddress(tx.to)}</p>
                    </div>
                  </div>
                  {tx.txHash && (
                    <a
                      href={getExplorerUrl(chainId, "tx", tx.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-mono text-xs text-gray-500 hover:text-brand-400 transition-colors"
                    >
                      Tx: {shortenHash(tx.txHash)}↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-surface-500/40">
            <span className="text-xs text-gray-400">
              Page {page + 1} of {totalPages} · {filtered.length} results
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
