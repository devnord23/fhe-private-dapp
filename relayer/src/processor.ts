/**
 * processor.ts — Core event polling and dispatch loop.
 *
 * Each call to `runOnce()` performs a single poll cycle:
 *   1. Get the current block on Base Sepolia.
 *   2. Fetch all BaseVault events from (lastBlock + 1) to (current - confirmations).
 *   3. For each event, check idempotency and dispatch to the correct handler.
 *   4. Process any pending withdrawals that are ready.
 *   5. Update lastProcessedBlock and save state.
 *
 * `runOnce()` is designed to be called repeatedly (by index.ts) or just once
 * (by once.ts). It is safe to call on restart — idempotency prevents double-processing.
 *
 * IDEMPOTENCY:
 *   Every event is identified by (txHash, logIndex). Before processing,
 *   the processor checks if this ID is in state.processedEvents.
 *   On restart, previously processed events are skipped automatically.
 */

import { parseEventLogs } from "viem";
import { StateManager }   from "./state.js";
import { Config }         from "./config.js";
import { basePublicClient } from "./chains.js";
import { BASE_VAULT_ABI } from "./abis.js";
import { logger }         from "./logger.js";
import { withRetry }      from "./retry.js";

import { handleDepositCreated }      from "./handlers/depositCreated.js";
import { handleStrategyLinked }      from "./handlers/strategyLinked.js";
import { handleWithdrawalRequested, processPendingWithdrawals } from "./handlers/withdrawalRequested.js";

/** Run one complete poll cycle. Returns the number of events processed. */
export async function runOnce(state: StateManager): Promise<number> {
  const lastBlock = state.getLastProcessedBlock();

  // ── Get current block ──────────────────────────────────────────────────────

  const currentBlock = await withRetry(
    () => basePublicClient.getBlockNumber(),
    "getBlockNumber"
  );

  const safeBlock = currentBlock - BigInt(Config.relayer.confirmationBlocks);

  if (safeBlock <= BigInt(lastBlock)) {
    logger.debug("[processor] No new blocks to process", {
      lastBlock,
      safeBlock: safeBlock.toString(),
    });
    await processPendingWithdrawals(currentBlock, state);
    return 0;
  }

  const fromBlock = BigInt(lastBlock + 1);
  const toBlock   = safeBlock;

  logger.info("[processor] Scanning blocks", {
    from: fromBlock.toString(),
    to:   toBlock.toString(),
    span: (toBlock - fromBlock + 1n).toString(),
  });

  // ── Fetch all BaseVault events ─────────────────────────────────────────────

  // Fetch all logs from BaseVault in the block range.
  // We pass the vault address without an event filter so we get ALL events,
  // then filter by known event signatures after decoding.
  const rawLogs = await withRetry(
    () => basePublicClient.getLogs({
      address:  Config.baseSepolia.vaultAddress,
      fromBlock,
      toBlock,
    }),
    "getLogs"
  );

  if (rawLogs.length === 0) {
    logger.debug("[processor] No events in range");
    state.setLastProcessedBlock(Number(toBlock));
    await processPendingWithdrawals(currentBlock, state);
    state.save();
    return 0;
  }

  logger.info("[processor] Found events", { count: rawLogs.length });

  // ── Parse and dispatch ─────────────────────────────────────────────────────

  const parsed = parseEventLogs({
    abi:  BASE_VAULT_ABI,
    logs: rawLogs,
  });

  let processed = 0;

  for (const log of parsed) {
    const txHash   = log.transactionHash ?? ("0x" as `0x${string}`);
    const logIndex = log.logIndex ?? 0;
    const eventId  = StateManager.eventId(txHash, logIndex);

    // ── Idempotency check ────────────────────────────────────────────────────

    if (state.isEventProcessed(eventId)) {
      logger.debug("[processor] Skipping already-processed event", {
        eventId,
        name: log.eventName,
      });
      continue;
    }

    logger.info("[processor] Processing event", {
      name:        log.eventName,
      txHash,
      blockNumber: log.blockNumber?.toString(),
    });

    // ── Dispatch ─────────────────────────────────────────────────────────────

    try {
      switch (log.eventName) {
        case "DepositCreated": {
          const { user, token, amount, strategyId } = log.args as {
            user: `0x${string}`; token: `0x${string}`; amount: bigint; strategyId: bigint;
          };
          await handleDepositCreated({ user, token, amount, strategyId }, state);
          break;
        }

        case "StrategyLinked": {
          const { user, strategyId } = log.args as {
            user: `0x${string}`; strategyId: bigint;
          };
          await handleStrategyLinked({ user, strategyId }, state);
          break;
        }

        case "WithdrawalRequested": {
          const { user, token, amount } = log.args as {
            user: `0x${string}`; token: `0x${string}`; amount: bigint;
          };

          // Attach the block number to the pending withdrawal record
          const blockNumber = Number(log.blockNumber ?? 0n);
          await handleWithdrawalRequested({ user, token, amount }, txHash, state);

          // Update the requestBlock now that we know it
          state.updateWithdrawalStatus(user, token, txHash, "pending", {
            requestBlock: blockNumber,
          });
          break;
        }

        default:
          logger.warn("[processor] Unknown event name", { name: log.eventName });
      }

      state.markEventProcessed(eventId);
      processed++;
    } catch (err) {
      logger.error("[processor] Handler threw, event NOT marked processed", {
        eventId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Do NOT mark as processed — will retry on next poll
    }
  }

  // ── Update block pointer and flush state ──────────────────────────────────

  state.setLastProcessedBlock(Number(toBlock));
  await processPendingWithdrawals(currentBlock, state);
  state.save();

  logger.info("[processor] Cycle complete", {
    processed,
    lastBlock: Number(toBlock),
  });

  return processed;
}
