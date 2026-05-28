"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { ConfirmModal, useConfirmModal } from "@/components/ui/ConfirmModal";
import { useStrategyMetadata, useStrategyActions } from "@/hooks/useStrategy";
import { useEvaluateStrategy } from "@/hooks/useStrategy";
import { formatRelativeTime, shortenAddress } from "@/lib/utils";
import { localEstimate, type AgentFeed } from "@/lib/agent";
import { cn } from "@/lib/utils";

interface LocalParams {
  apyTargetBps: number;
  rebalanceThresholdBps: number;
  stopLossBufferX100: number;
}

interface StrategyCardProps {
  strategyId: bigint;
  feed: AgentFeed;
  localParams: LocalParams | null;
}

function HandleDisplay({ handle, label }: { handle: bigint; label: string }) {
  const hex = handle.toString(16).padStart(64, "0");
  return (
    <Tooltip content={`0x${hex}`}>
      <div className="flex items-center gap-1.5 cursor-help">
        <svg className="h-3 w-3 text-brand-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span className="text-xs text-gray-400">{label}:</span>
        <span className="font-mono text-xs text-gray-500">
          0x{hex.slice(0, 8)}…
        </span>
      </div>
    </Tooltip>
  );
}

export function StrategyCard({ strategyId, feed, localParams }: StrategyCardProps) {
  const { metadata, isLoading, refetch } = useStrategyMetadata(strategyId);
  const { evaluateStrategy, isPending: evalPending, fhevmReady, error: evalError } = useEvaluateStrategy();
  const { requestEvalReveal, isPending: revealPending } = useStrategyActions();
  const [expanded, setExpanded] = useState(false);
  const [lastEvalTx, setLastEvalTx] = useState<string | null>(null);

  // ── Reveal confirmation modal (security fix: UI finding 3.2) ────────────────
  // requestEvaluationReveal permanently exposes the evaluation outcome on-chain.
  // The user must type "CONFIRM" before the transaction is submitted.
  const revealConfirm = useConfirmModal();

  const estimate = localEstimate(feed, localParams);

  async function handleEvaluate() {
    const hash = await evaluateStrategy({
      strategyId,
      currentApyBps: feed.currentApyBps,
      currentHealthX100: feed.currentHealthX100,
    });
    if (hash) {
      setLastEvalTx(hash);
      setTimeout(() => refetch(), 4000);
    }
  }

  async function handleRevealConfirmed() {
    revealConfirm.close();
    await requestEvalReveal(strategyId);
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-surface-400/40 bg-surface-700 p-5 animate-pulse">
        <div className="h-4 w-32 bg-surface-500 rounded mb-3" />
        <div className="h-3 w-48 bg-surface-500 rounded" />
      </div>
    );
  }

  if (!metadata) return null;

  const evalNever = metadata.lastEvaluatedAt === 0n;

  return (
    <div className={cn(
      "rounded-2xl border bg-surface-700 p-5 transition-all",
      metadata.isActive ? "border-surface-400/50" : "border-surface-400/20 opacity-60"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">Strategy #{strategyId.toString()}</span>
            <Badge variant={metadata.isActive ? "success" : "default"} dot>
              {metadata.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-xs text-gray-500">
            Owner: <span className="font-mono">{shortenAddress(metadata.owner)}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "▲" : "▼"}
        </Button>
      </div>

      {/* Local estimate (plaintext – not from contract) */}
      {localParams && (
        <div className="mb-3 rounded-xl bg-surface-600/40 border border-surface-400/30 p-3">
          <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wide">
            Local estimate (not from contract)
          </p>
          <div className="flex flex-wrap gap-2">
            <span className={cn("text-xs px-2 py-0.5 rounded-full border",
              estimate.rebalance
                ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                : "bg-surface-500 text-gray-400 border-surface-400/30")}>
              Rebalance: {estimate.rebalance ? "⚠ Would trigger" : "✓ OK"}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border",
              estimate.stopLoss
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-surface-500 text-gray-400 border-surface-400/30")}>
              Stop-loss: {estimate.stopLoss ? "🛑 Would trigger" : "✓ OK"}
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1.5">
            Based on locally stored params. Actual contract result requires Gateway reveal.
          </p>
        </div>
      )}

      {/* Evaluation controls */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          variant="primary"
          size="sm"
          onClick={handleEvaluate}
          isLoading={evalPending}
          disabled={!metadata.isActive || !fhevmReady}
        >
          {!fhevmReady ? "fhEVM Loading…" : "Evaluate Strategy"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={revealConfirm.open}
          isLoading={revealPending}
          disabled={evalNever || !metadata.isActive}
        >
          Request Eval Reveal
        </Button>
      </div>

      {evalError && (
        <p className="text-xs text-red-400 mb-2">{evalError}</p>
      )}

      {lastEvalTx && (
        <p className="text-xs text-brand-400 mb-2 font-mono truncate">
          Eval submitted: {lastEvalTx.slice(0, 20)}…
        </p>
      )}

      {/* Public metadata */}
      <div className="text-xs text-gray-500 space-y-0.5">
        <p>Created: {new Date(Number(metadata.createdAt) * 1000).toLocaleString()}</p>
        <p>Last evaluated: {evalNever ? "Never" : formatRelativeTime(Number(metadata.lastEvaluatedAt) * 1000)}</p>
      </div>

      {/* Reveal confirmation modal */}
      <ConfirmModal
        isOpen={revealConfirm.isOpen}
        title="Reveal Evaluation Result?"
        description={`Strategy #${strategyId.toString()} — last evaluation outcome`}
        warning={
          "This action is PERMANENT and IRREVERSIBLE.\n\n" +
          "Once confirmed, whether your strategy conditions were triggered will be " +
          "permanently visible to ALL blockchain observers in the EvaluationRevealed " +
          "event log. It cannot be undone, deleted, or hidden."
        }
        confirmKeyword="CONFIRM"
        confirmLabel="Reveal Permanently"
        onConfirm={handleRevealConfirmed}
        onCancel={revealConfirm.close}
        isLoading={revealPending}
      />

      {/* Encrypted handles (expanded view) */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-surface-500/40 space-y-1.5">
          <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wide">
            Encrypted handles (use fhevmjs.reencrypt() to view values)
          </p>
          {/* TODO: Wire re-encryption UI. Requires EIP-712 signature from owner. */}
          <HandleDisplay handle={metadata.apyTargetHandle}          label="APY Target" />
          <HandleDisplay handle={metadata.rebalanceThresholdHandle} label="Rebalance Threshold" />
          <HandleDisplay handle={metadata.stopLossBufferHandle}     label="Stop Loss Buffer" />
          <HandleDisplay handle={metadata.liquidationBufferHandle}  label="Liquidation Buffer" />
          <HandleDisplay handle={metadata.maxLeverageHandle}        label="Max Leverage" />
          <HandleDisplay handle={metadata.evaluationCountHandle}    label="Eval Count" />
          <p className="text-[10px] text-yellow-400/70 mt-2">
            TODO: Re-encryption UI (requires EIP-712 signed keypair + fhevmjs.reencrypt())
          </p>
        </div>
      )}
    </div>
  );
}
