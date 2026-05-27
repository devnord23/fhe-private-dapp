/**
 * strategyLinked.ts — Handler for BaseVault.StrategyLinked event.
 *
 * When a user links their Base account to a Zama fhEVM strategy ID, the
 * relayer records the mapping in persistent state.
 *
 * This mapping is used by the DepositCreated handler (to know which Zama
 * strategy a deposit should go to) and the WithdrawalRequested handler
 * (to verify the strategy exists before completing a withdrawal).
 */

import type { StateManager } from "../state.js";
import type { StrategyLinkedPayload } from "../types.js";
import { logger } from "../logger.js";

export async function handleStrategyLinked(
  payload: StrategyLinkedPayload,
  state:   StateManager
): Promise<void> {
  const { user, strategyId } = payload;

  const prev = state.getUserMapping(user);

  if (prev && prev.strategyId === strategyId.toString()) {
    logger.debug("[strategyLinked] No change — user already linked to this strategy", {
      user,
      strategyId: strategyId.toString(),
    });
    return;
  }

  if (prev) {
    logger.info("[strategyLinked] User re-linked to new strategy", {
      user,
      oldStrategyId: prev.strategyId,
      newStrategyId: strategyId.toString(),
    });
  } else {
    logger.info("[strategyLinked] New user strategy link", {
      user,
      strategyId: strategyId.toString(),
    });
  }

  state.linkUserStrategy(user, strategyId);
}
