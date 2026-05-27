/**
 * once.ts — Single-run mode: process pending events and exit.
 *
 * Useful for:
 *   - Cron-job based relayer execution
 *   - CI/CD testing
 *   - Manual catch-up after downtime
 *
 * Start: npm run once
 */

import { StateManager }       from "./state.js";
import { Config, isFullyConfigured } from "./config.js";
import { logger }             from "./logger.js";
import { runOnce }            from "./processor.js";

async function main(): Promise<void> {
  logger.info("╔═══════════════════════════════════════════════════════╗");
  logger.info("║  ConfidentialFi Relayer  —  Single Run Mode           ║");
  logger.info("╚═══════════════════════════════════════════════════════╝");

  if (!isFullyConfigured()) {
    logger.warn(
      "Contract addresses are placeholders. " +
        "Events will be read but no on-chain actions taken."
    );
  }

  const state = new StateManager(Config.stateFilePath);
  logger.info("State", { lastBlock: state.getLastProcessedBlock() });

  try {
    const count = await runOnce(state);
    logger.info("[once] Done", {
      eventsProcessed: count,
      lastBlock:       state.getLastProcessedBlock(),
    });
    process.exit(0);
  } catch (err) {
    logger.error("[once] Failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

main();
