/**
 * withdrawalRequested.ts — Handler for BaseVault.WithdrawalRequested event.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  FULL PRODUCTION FLOW (not fully implemented)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  1. User calls BaseVault.requestWithdrawal(token, amount) on Base Sepolia.
 *     → Funds locked in _pending in BaseVault.
 *     → WithdrawalRequested event emitted (handled here).
 *
 *  2. User calls ConfidentialToken.requestUnshield(encAmt, proof, relayerAddr)
 *     on Zama fhEVM from the frontend.
 *     → The relayer address is set as recipient so it can match the event.
 *
 *  3. Zama Gateway decrypts the amount and calls callbackUnshield.
 *     → ConfidentialToken emits Unshielded(sender, recipient=relayer, amount).
 *
 *  4. The relayer detects the Unshielded event on Zama (matching the user).
 *     → Calls BaseVault.relayerCompleteWithdrawal(user, token, amount) on Base.
 *     → ERC-20 released to user on Base.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  MVP TESTNET BEHAVIOR (what this handler actually does)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Steps 2 and 3 require user action from the browser (fhevmjs WASM).
 *  The relayer cannot perform them.
 *
 *  For MVP, the handler:
 *    - Records the pending withdrawal in state
 *    - Schedules auto-completion after WITHDRAWAL_AUTO_COMPLETE_DELAY_BLOCKS
 *    - Calls relayerCompleteWithdrawal WITHOUT verifying Zama unshield
 *
 *  This is TESTNET-ONLY behavior. It releases funds without confirming the
 *  Zama side. It is safe for testing because both sides are testnets with
 *  no real value. A production relayer MUST verify the Zama unshield first.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  SECURITY NOTE
 * ═══════════════════════════════════════════════════════════════════════
 *  Auto-completing withdrawals without Zama verification means:
 *  - The Zama-side shielded balance is NOT automatically reduced
 *  - A user could withdraw from Base AND still have the shielded balance on Zama
 *  - This double-spend is ONLY possible in this MVP testnet mode
 *  - Production MUST gate completeWithdrawal on confirmed Zama Unshielded event
 */

import type { StateManager }               from "../state.js";
import type { WithdrawalRequestedPayload } from "../types.js";
import { Config }                           from "../config.js";
import { basePublicClient, getBaseWalletClient } from "../chains.js";
import { BASE_VAULT_ABI }                   from "../abis.js";
import { withRetry }                        from "../retry.js";
import { logger }                           from "../logger.js";

export async function handleWithdrawalRequested(
  payload: WithdrawalRequestedPayload,
  txHash:  `0x${string}`,
  state:   StateManager
): Promise<void> {
  const { user, token, amount } = payload;

  logger.info("[withdrawalRequested] Withdrawal request recorded", {
    user,
    token,
    amount: amount.toString(),
    txHash,
  });

  // Check if user has a linked strategy (informational only)
  const mapping = state.getUserMapping(user);
  if (!mapping) {
    logger.warn("[withdrawalRequested] No strategy mapping found for user", { user });
  } else {
    logger.debug("[withdrawalRequested] User linked to strategy", {
      user,
      strategyId: mapping.strategyId,
    });
  }

  // Record in state as pending
  state.addPendingWithdrawal({
    user,
    token,
    amount:       amount.toString(),
    requestTxHash: txHash,
    requestBlock:  0, // will be set by processor
    requestedAt:   Date.now(),
    status:        "pending",
  });

  logger.info(
    "[withdrawalRequested] Withdrawal recorded. " +
      `Will auto-complete after ${Config.relayer.withdrawalAutoCompleteDelayBlocks} blocks. ` +
      "TODO (production): Wait for Zama Unshielded event before completing.",
    { user, token, amount: amount.toString() }
  );
}

/**
 * Check all pending withdrawals and complete those that are ready.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  SECURITY: TESTNET_ONLY_AUTO_COMPLETE guard                         ║
 * ║                                                                      ║
 * ║  Auto-completing withdrawals WITHOUT verifying the Zama-side         ║
 * ║  Unshielded event creates a DOUBLE-SPEND:                            ║
 * ║    user withdraws on Base AND retains shielded balance on Zama.      ║
 * ║                                                                      ║
 * ║  Default: DISABLED (TESTNET_ONLY_AUTO_COMPLETE is not set).          ║
 * ║  Enable only on testnets where tokens have no real value.            ║
 * ║                                                                      ║
 * ║  Production path (TODO): Listen for Zama ConfidentialToken.          ║
 * ║  Unshielded(sender, recipient=relayerAddress, amount) event and      ║
 * ║  only then call relayerCompleteWithdrawal() on Base.                 ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
export async function processPendingWithdrawals(
  currentBlock: bigint,
  state: StateManager
): Promise<void> {
  const pending = state.getWithdrawalsByStatus("pending");
  if (pending.length === 0) return;

  // ── Auto-complete guard ────────────────────────────────────────────────────

  if (!Config.relayer.testnetOnlyAutoComplete) {
    if (pending.length > 0) {
      logger.info(
        "[processPending] Auto-complete is DISABLED (TESTNET_ONLY_AUTO_COMPLETE not set). " +
          `${pending.length} withdrawal(s) pending. ` +
          "TODO (production): implement Zama Unshielded event verification to complete these.",
        { pendingCount: pending.length }
      );
    }
    return;
  }

  // ── Testnet-only auto-complete path (double-spend risk — use only on testnet) ─

  logger.warn(
    "⚠️  [processPending] TESTNET_ONLY_AUTO_COMPLETE=true. " +
      "Auto-completing withdrawals WITHOUT Zama verification. " +
      "NEVER use in production — this creates a double-spend vulnerability.",
    { pendingCount: pending.length }
  );

  logger.debug("[processPending] Checking pending withdrawals", { count: pending.length });

  for (const w of pending) {
    const blocksSinceRequest = Number(currentBlock) - w.requestBlock;
    const delayRequired      = Config.relayer.withdrawalAutoCompleteDelayBlocks;

    if (blocksSinceRequest < delayRequired) {
      logger.debug("[processPending] Not yet ready", {
        user:   w.user,
        blocks: blocksSinceRequest,
        needed: delayRequired,
      });
      continue;
    }

    logger.warn(
      "[processPending] Auto-completing (testnet only). " +
        "TODO: Verify Zama Unshielded event before completing in production.",
      { user: w.user, amount: w.amount }
    );

    await completeWithdrawal(
      w.user,
      w.token as `0x${string}`,
      BigInt(w.amount),
      w.requestTxHash as `0x${string}`,
      state
    );
  }
}

async function completeWithdrawal(
  user:     `0x${string}`,
  token:    `0x${string}`,
  amount:   bigint,
  requestTxHash: `0x${string}`,
  state:    StateManager
): Promise<void> {
  state.updateWithdrawalStatus(user, token, requestTxHash, "completing");

  // Verify the pending withdrawal still exists on-chain (idempotency check)
  const onChainPending = await basePublicClient.readContract({
    address:      Config.baseSepolia.vaultAddress,
    abi:          BASE_VAULT_ABI,
    functionName: "getPendingWithdrawal",
    args:         [user, token],
  }) as bigint;

  if (onChainPending < amount) {
    logger.warn("[completeWithdrawal] On-chain pending balance < expected amount. Skipping.", {
      user,
      token,
      expected:  amount.toString(),
      onChain:   onChainPending.toString(),
    });
    state.updateWithdrawalStatus(user, token, requestTxHash, "failed", {
      failureReason: `On-chain pending (${onChainPending}) < expected (${amount})`,
    });
    return;
  }

  logger.info("[completeWithdrawal] Submitting relayerCompleteWithdrawal", {
    user,
    token,
    amount: amount.toString(),
  });

  try {
    const walletClient = getBaseWalletClient();

    const txHash = await withRetry(
      async () => walletClient.writeContract({
        address:      Config.baseSepolia.vaultAddress,
        abi:          BASE_VAULT_ABI,
        functionName: "relayerCompleteWithdrawal",
        args:         [user, token, amount],
      }),
      "relayerCompleteWithdrawal",
      { maxAttempts: 3 }
    );

    logger.info("[completeWithdrawal] Transaction submitted", {
      user,
      token,
      amount: amount.toString(),
      txHash,
    });

    // Wait for confirmation
    const receipt = await basePublicClient.waitForTransactionReceipt({
      hash:         txHash,
      confirmations: Config.relayer.confirmationBlocks,
    });

    if (receipt.status === "success") {
      logger.info("[completeWithdrawal] Withdrawal completed on-chain", {
        user,
        txHash,
        blockNumber: receipt.blockNumber.toString(),
      });
      state.updateWithdrawalStatus(user, token, requestTxHash, "completed", {
        completedTxHash: txHash,
        completedBlock:  Number(receipt.blockNumber),
      });
    } else {
      logger.error("[completeWithdrawal] Transaction reverted", { user, txHash });
      state.updateWithdrawalStatus(user, token, requestTxHash, "failed", {
        failureReason: "Transaction reverted on-chain",
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[completeWithdrawal] Failed after retries", { user, error: msg });
    state.updateWithdrawalStatus(user, token, requestTxHash, "failed", {
      failureReason: msg,
    });
  }
}
