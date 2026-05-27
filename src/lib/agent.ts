/**
 * agent.ts – Simulated off-chain feed engine for the ConfidentialStrategyAgent demo.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  SIMULATION STATUS
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  SIMULATED (these do not touch a real protocol):
 *    • APY feed       – random walk around 7–12% APY
 *    • Health factor  – random walk around HF 1.30–2.00
 *    • Volatility     – qualitative label derived from APY variance
 *
 *  REAL (these interact with the actual fhEVM contract):
 *    • Client-side encryption of feed values via fhevmjs
 *    • evaluateStrategy() transaction to ConfidentialStrategyAgent
 *    • Encrypted comparison results stored on Zama nodes
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  HOW THE AGENT WORKS
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  1. Agent generates simulated feed values (APY, health factor).
 *  2. Agent calls fhevmjs to encrypt those values:
 *       input.add64(currentApyBps)     → handle[0]
 *       input.add64(currentHealthX100) → handle[1]
 *  3. Agent calls evaluateStrategy(strategyId, handle[0], handle[1], proof).
 *  4. Contract computes TFHE.lt(currentApy, rebalanceThreshold) homomorphically.
 *  5. Result (ebool) is stored encrypted. Agent does NOT know if it triggered.
 *  6. If owner calls requestEvaluationReveal(), the Gateway decrypts and reveals.
 *
 *  This demonstrates the "oblivious evaluation" property: the agent provides
 *  the current values without knowing the strategy thresholds; the contract
 *  knows the thresholds but can't read the current values; neither party
 *  knows the outcome without the Gateway.
 */

export type Volatility = "low" | "medium" | "high" | "extreme";

export interface AgentFeed {
  /** Current APY estimate, in basis points (e.g. 750 = 7.50%) */
  currentApyBps: number;
  /**
   * Current health factor × 100 (e.g. 145 = HF 1.45).
   * Below 100 = liquidated. Below ~105–110 = danger zone.
   */
  currentHealthX100: number;
  volatility: Volatility;
  /** Unix ms timestamp of this feed snapshot */
  timestamp: number;
}

export interface StrategyLocalState {
  strategyId: bigint;
  /** Local UI estimate: would current APY trigger rebalance? (NOT from contract) */
  localEstimateRebalance: boolean | null;
  /** Local UI estimate: would current health trigger stop-loss? (NOT from contract) */
  localEstimateStopLoss: boolean | null;
  lastEvaluatedBlock: number | null;
}

/**
 * SIMULATION ONLY: step the feed values one tick.
 * In production this would read from Chainlink, Aave, Uniswap V3 TWAP, etc.
 */
export function stepFeed(prev: AgentFeed): AgentFeed {
  const apyDelta = (Math.random() - 0.48) * 60; // slight negative drift
  const healthDelta = (Math.random() - 0.50) * 15;

  const newApy = Math.max(100, Math.min(2500, prev.currentApyBps + apyDelta));
  const newHealth = Math.max(105, Math.min(300, prev.currentHealthX100 + healthDelta));

  const apyVariance = Math.abs(apyDelta);
  const volatility: Volatility =
    apyVariance > 50 ? "extreme" :
    apyVariance > 30 ? "high" :
    apyVariance > 15 ? "medium" : "low";

  return {
    currentApyBps:    Math.round(newApy),
    currentHealthX100: Math.round(newHealth),
    volatility,
    timestamp: Date.now(),
  };
}

export function initialFeed(): AgentFeed {
  return {
    currentApyBps: 750,      // 7.50%
    currentHealthX100: 160,  // HF 1.60
    volatility: "low",
    timestamp: Date.now(),
  };
}

/**
 * Format basis points as a percentage string.
 * e.g. bpsToPercent(750) → "7.50%"
 */
export function bpsToPercent(bps: number, decimals = 2): string {
  return `${(bps / 100).toFixed(decimals)}%`;
}

/**
 * Format healthX100 as a health factor string.
 * e.g. healthX100ToHF(160) → "1.60"
 */
export function healthX100ToHF(hx: number): string {
  return (hx / 100).toFixed(2);
}

/**
 * Local estimate of whether a condition would trigger.
 *
 * ⚠️  This is a CLIENT-SIDE APPROXIMATION only.
 * The strategy owner's thresholds are encrypted and not visible to the agent.
 * This function uses PLAINTEXT input parameters (from the strategy creation
 * form) stored in the user's browser — NOT decrypted from the contract.
 *
 * If the user navigates away or clears storage, this estimate is lost.
 * The actual result is only knowable via requestEvaluationReveal().
 */
export function localEstimate(
  feed: AgentFeed,
  localParams: { apyTargetBps: number; rebalanceThresholdBps: number; stopLossBufferX100: number } | null
): { rebalance: boolean | null; stopLoss: boolean | null } {
  if (!localParams) return { rebalance: null, stopLoss: null };
  return {
    rebalance: feed.currentApyBps < localParams.rebalanceThresholdBps,
    stopLoss:  feed.currentHealthX100 < localParams.stopLossBufferX100,
  };
}

export const VOLATILITY_COLORS: Record<Volatility, string> = {
  low:     "text-brand-400",
  medium:  "text-yellow-400",
  high:    "text-orange-400",
  extreme: "text-red-400",
};

export const PARAM_LABELS: Record<string, { label: string; unit: string; hint: string }> = {
  apyTargetBps: {
    label: "APY Target",
    unit: "bps",
    hint: "Target annual yield in basis points (e.g. 800 = 8.00%). The agent will evaluate whether current APY meets this target.",
  },
  rebalanceThresholdBps: {
    label: "Rebalance Threshold",
    unit: "bps",
    hint: "If current APY falls below this level (e.g. 500 = 5.00%), the strategy should rebalance.",
  },
  stopLossBufferX100: {
    label: "Stop-Loss Buffer (HF×100)",
    unit: "",
    hint: "Minimum acceptable health factor × 100 (e.g. 120 = HF 1.20). Below this, the strategy executes a stop-loss.",
  },
  liquidationBufferX100: {
    label: "Liquidation Buffer (HF×100)",
    unit: "",
    hint: "Extra safety margin above the stop-loss floor (e.g. 20 = 0.20 extra HF).",
  },
  maxLeverageX100: {
    label: "Max Leverage (×100)",
    unit: "",
    hint: "Maximum leverage multiplier × 100 (e.g. 150 = 1.5×). Agent will not recommend positions exceeding this.",
  },
};
