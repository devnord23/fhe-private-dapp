/**
 * index.ts — Relayer dev mode: continuous polling loop.
 *
 * Runs `runOnce()` on a configurable interval (POLLING_INTERVAL_MS).
 * Gracefully shuts down on SIGINT / SIGTERM.
 *
 * Start: npm run dev
 */

import { StateManager }      from "./state.js";
import { Config, isFullyConfigured } from "./config.js";
import { logger }            from "./logger.js";
import { runOnce }           from "./processor.js";
import { getRelayerAddress } from "./chains.js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  logger.info("╔═══════════════════════════════════════════════════════╗");
  logger.info("║  ConfidentialFi Relayer  —  MVP Testnet               ║");
  logger.info("╚═══════════════════════════════════════════════════════╝");
  logger.info("Trust model: CENTRALIZED (see README.md)");
  logger.info("Mode: continuous polling");

  const relayerAddr = getRelayerAddress();
  logger.info("Relayer address", { address: relayerAddr ?? "(not configured)" });
  logger.info("Base Sepolia vault", { address: Config.baseSepolia.vaultAddress });
  logger.info("Zama fhEVM agent",   { address: Config.zamaFhevm.strategyAgentAddress });

  if (!isFullyConfigured()) {
    logger.warn(
      "Contract addresses are zero-address placeholders. " +
        "Update BASE_VAULT_ADDRESS and CONFIDENTIAL_STRATEGY_AGENT_ADDRESS in .env."
    );
  }

  if (!Config.relayer.privateKey) {
    logger.warn(
      "RELAYER_PRIVATE_KEY not set. The relayer can READ events but cannot " +
        "call relayerCompleteWithdrawal. Set the key to enable write operations."
    );
  }

  const state = new StateManager(Config.stateFilePath);
  logger.info("State loaded", {
    lastBlock: state.getLastProcessedBlock(),
  });

  let running = true;

  // Graceful shutdown
  const shutdown = () => {
    logger.info("[main] Shutting down gracefully…");
    running = false;
  };
  process.once("SIGINT",  shutdown);
  process.once("SIGTERM", shutdown);

  logger.info("[main] Starting poll loop", {
    intervalMs: Config.relayer.pollingIntervalMs,
  });

  while (running) {
    try {
      await runOnce(state);
    } catch (err) {
      logger.error("[main] Unhandled error in runOnce", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (running) {
      logger.debug("[main] Sleeping until next poll", {
        ms: Config.relayer.pollingIntervalMs,
      });
      await sleep(Config.relayer.pollingIntervalMs);
    }
  }

  logger.info("[main] Relayer stopped.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
