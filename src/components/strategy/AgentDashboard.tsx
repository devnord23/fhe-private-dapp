"use client";

import { useAccount } from "wagmi";
import { FeedDisplay } from "./FeedDisplay";
import { StrategyCard } from "./StrategyCard";
import { useAgentFeeds } from "@/hooks/useAgentFeeds";
import { useOwnerStrategies } from "@/hooks/useStrategy";
import { Badge } from "@/components/ui/Badge";

export function AgentDashboard() {
  const { isConnected } = useAccount();
  const { feed, isPaused, pause, resume, forceTick } = useAgentFeeds();
  const { strategyIds, isLoading } = useOwnerStrategies();

  return (
    <div className="space-y-5">
      {/* Agent header */}
      <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-white">Agent Engine</h3>
              <Badge variant="warning">Feeds Simulated</Badge>
              <Badge variant="success">Encryption Real</Badge>
            </div>
            <p className="text-xs text-gray-400">
              The feed values below are simulated (random walk). When you click
              &ldquo;Evaluate Strategy&rdquo;, fhevmjs encrypts the current APY and health
              factor and sends them to the contract. The contract evaluates them
              homomorphically against your encrypted thresholds — no plaintext on-chain.
            </p>
          </div>
        </div>

        {/* Architecture callout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          {[
            {
              label: "Oblivious Evaluation",
              desc: "Agent knows feed values. Owner knows thresholds. Neither knows the outcome. Only Gateway can decrypt.",
              tag: "Real",
              ok: true,
            },
            {
              label: "Feed Source",
              desc: "Random walk simulation. Production: replace with Chainlink / Aave / Uniswap TWAP.",
              tag: "Simulated",
              ok: false,
            },
            {
              label: "Balance Display",
              desc: "Encrypted handles shown. Re-encryption (EIP-712 + reencrypt()) needed to view values.",
              tag: "TODO",
              ok: false,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-surface-600/40 border border-surface-400/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border
                  ${item.ok
                    ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                    : item.tag === "TODO"
                    ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    : "bg-orange-500/10 text-orange-400 border-orange-500/20"}`}>
                  {item.tag}
                </span>
              </div>
              <p className="text-xs font-semibold text-white mb-0.5">{item.label}</p>
              <p className="text-[10px] text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live feed panel */}
      <FeedDisplay
        feed={feed}
        isPaused={isPaused}
        onPause={pause}
        onResume={resume}
        onTick={forceTick}
      />

      {/* Strategy list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Your Strategies</h3>
          {isLoading && (
            <span className="text-xs text-gray-500 animate-pulse">Loading…</span>
          )}
        </div>

        {!isConnected ? (
          <div className="rounded-2xl border border-surface-400/40 bg-surface-700/50 p-8 text-center">
            <p className="text-sm text-gray-400">Connect your wallet to view strategies</p>
          </div>
        ) : strategyIds.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-surface-400/40 bg-surface-700/50 p-8 text-center">
            <p className="text-sm text-gray-400">No strategies yet.</p>
            <p className="text-xs text-gray-500 mt-1">
              Create one using the form above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {strategyIds.map((id) => (
              <StrategyCard
                key={id.toString()}
                strategyId={id}
                feed={feed}
                localParams={null} // TODO: read from localStorage keyed by strategyId
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
