"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { bpsToPercent, healthX100ToHF, VOLATILITY_COLORS, type AgentFeed } from "@/lib/agent";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FeedDisplayProps {
  feed: AgentFeed;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onTick: () => void;
}

export function FeedDisplay({ feed, isPaused, onPause, onResume, onTick }: FeedDisplayProps) {
  const healthColor =
    feed.currentHealthX100 < 115 ? "text-red-400" :
    feed.currentHealthX100 < 130 ? "text-orange-400" :
    feed.currentHealthX100 < 150 ? "text-yellow-400" : "text-brand-400";

  const apyColor =
    feed.currentApyBps < 400 ? "text-red-400" :
    feed.currentApyBps < 600 ? "text-orange-400" : "text-brand-400";

  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Live Feeds</h3>
          <Badge variant="warning">SIMULATED</Badge>
          {!isPaused && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onTick}>↻</Button>
          {isPaused ? (
            <Button variant="outline" size="sm" onClick={onResume}>Resume</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onPause}>Pause</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-xl bg-surface-600/50 border border-surface-400/30 p-3">
          <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Current APY</p>
          <p className={cn("text-xl font-bold font-mono", apyColor)}>
            {bpsToPercent(feed.currentApyBps)}
          </p>
          <p className="text-[10px] text-gray-500">{feed.currentApyBps} bps</p>
        </div>

        <div className="rounded-xl bg-surface-600/50 border border-surface-400/30 p-3">
          <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Health Factor</p>
          <p className={cn("text-xl font-bold font-mono", healthColor)}>
            {healthX100ToHF(feed.currentHealthX100)}
          </p>
          <p className="text-[10px] text-gray-500">×100 = {feed.currentHealthX100}</p>
        </div>

        <div className="rounded-xl bg-surface-600/50 border border-surface-400/30 p-3">
          <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Volatility</p>
          <p className={cn("text-lg font-bold capitalize", VOLATILITY_COLORS[feed.volatility])}>
            {feed.volatility}
          </p>
          <p className="text-[10px] text-gray-500">APY variance</p>
        </div>
      </div>

      <p className="text-[10px] text-gray-600">
        Updated {formatRelativeTime(feed.timestamp)} · These values are simulated.
        In production, replace with Chainlink / Aave / Uniswap TWAP oracles.
      </p>
    </div>
  );
}
