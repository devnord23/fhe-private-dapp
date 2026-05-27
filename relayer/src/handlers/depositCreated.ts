/**
 * depositCreated.ts — Handler for BaseVault.DepositCreated event.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  WHAT THIS HANDLER DOES
 * ═══════════════════════════════════════════════════════════════════════
 *  1. Records the deposit in the local user mapping for accounting.
 *  2. If a strategyId is provided, links the user to that strategy
 *     (equivalent to a StrategyLinked event, but via deposit).
 *  3. Logs the event with full details.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  WHAT THIS HANDLER DOES NOT DO (TODO)
 * ═══════════════════════════════════════════════════════════════════════
 *  TODO: Call ConfidentialToken.shield(amount) on Zama fhEVM.
 *
 *  This is intentionally NOT implemented in the relayer because:
 *    1. shield() requires fhevmjs to encrypt the amount (browser WASM only).
 *    2. The relayer would need the user's Zama-side address and ACL grants.
 *    3. The relayer should not hold or move user funds on Zama.
 *
 *  PRODUCTION DESIGN for shield:
 *    Option A: User initiates the shield themselves from the browser
 *              after depositing on Base (two separate transactions).
 *    Option B: A trusted FHE-capable service (separate from the relayer)
 *              performs the shield with a delegated key.
 *    Option C: Use a cross-chain bridge protocol (LayerZero, Hyperlane)
 *              with on-chain proof verification instead of a relayer.
 *
 *  For MVP testnet: Users must manually call shield() on the frontend
 *  after depositing in BaseVault. The relayer logs a reminder.
 * ═══════════════════════════════════════════════════════════════════════
 */

import type { StateManager }          from "../state.js";
import type { DepositCreatedPayload }  from "../types.js";
import { logger }                      from "../logger.js";

export async function handleDepositCreated(
  payload: DepositCreatedPayload,
  state:   StateManager
): Promise<void> {
  const { user, token, amount, strategyId } = payload;

  logger.info("[depositCreated] Deposit recorded", {
    user,
    token,
    amount:     amount.toString(),
    strategyId: strategyId.toString(),
  });

  // Update local accounting record
  if (strategyId > 0n) {
    state.linkUserStrategy(user, strategyId);
    logger.debug("[depositCreated] Auto-linked strategy from deposit", {
      user,
      strategyId: strategyId.toString(),
    });
  }

  state.recordDeposit(user, token, amount);

  // ── TODO: Bridge to Zama fhEVM ────────────────────────────────────────────
  //
  // The steps below are NOT implemented. See module docstring for reasoning.
  //
  // Step 1 (TODO): Encrypt amount using fhevmjs
  //   const input = fhevmInstance.createEncryptedInput(confidentialTokenAddress, relayerAddress);
  //   input.add64(amount);
  //   const { handles, inputProof } = await input.encrypt();
  //
  // Step 2 (TODO): Approve + call ConfidentialToken.shield() on Zama fhEVM
  //   await zamaWalletClient.writeContract({
  //     address: confidentialTokenAddress,
  //     abi: CONFIDENTIAL_TOKEN_ABI,
  //     functionName: "shield",
  //     args: [amount],  // amount is PUBLIC here (shield step is not private)
  //   });
  //
  // Until the bridge is implemented, the user must:
  //   1. Deposit on Base Sepolia (via BaseVault.deposit)
  //   2. Manually call ConfidentialToken.shield() on Zama fhEVM from the frontend
  //      (go to /transfer → Shield tab → connect to Zama Devnet → shield)

  logger.warn(
    "[depositCreated] TODO: Funds are locked in BaseVault but NOT yet shielded on Zama fhEVM. " +
      "User must manually shield via the frontend (/transfer → Shield) on Zama Devnet.",
    { user, amount: amount.toString() }
  );
}
