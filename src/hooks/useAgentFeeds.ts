"use client";

/**
 * useAgentFeeds – Simulated market feed hook for the Agent Dashboard.
 *
 * The feeds are purely simulated (random walk). They are used client-side to:
 *   1. Display current market conditions in the UI.
 *   2. Encrypt values via fhevmjs when the user triggers an evaluation.
 *   3. Provide a LOCAL estimate of whether strategy conditions would fire.
 *
 * SIMULATION LABEL: All values from this hook must be displayed with a
 * "SIMULATED" badge. They do not come from a real oracle.
 *
 * In production, replace stepFeed() with:
 *   - Chainlink Price Feeds (APY from protocol adapters)
 *   - Aave health factor API / on-chain read
 *   - Uniswap V3 TWAP oracle
 *
 * The ENCRYPTION step is real regardless of feed source — the values are
 * encrypted client-side using fhevmjs before being sent to the contract.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { initialFeed, stepFeed, type AgentFeed } from "@/lib/agent";

const FEED_INTERVAL_MS = 5_000;

export function useAgentFeeds() {
  const [feed, setFeed] = useState<AgentFeed>(initialFeed);
  const [history, setHistory] = useState<AgentFeed[]>([initialFeed()]);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    setFeed((prev) => {
      const next = stepFeed(prev);
      setHistory((h) => [...h.slice(-29), next]); // keep last 30 ticks
      return next;
    });
  }, []);

  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(tick, FEED_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, tick]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const forceTick = useCallback(() => tick(), [tick]);

  return { feed, history, isPaused, pause, resume, forceTick };
}
