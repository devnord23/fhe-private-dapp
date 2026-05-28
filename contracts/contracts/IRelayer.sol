// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  IRelayer
 * @notice TODO: Interface for the off-chain relayer service that bridges
 *         BaseVault (Base Sepolia) ↔ ConfidentialToken (Zama fhEVM).
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  STATUS: NOT IMPLEMENTED
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  This interface defines the contract that the relayer would implement
 *  or call into. It is included here to document the intended architecture.
 *
 *  A production relayer would:
 *    1. Watch Base Sepolia for BaseVault.DepositCreated events.
 *    2. Call ConfidentialToken.shield(amount) on Zama fhEVM side.
 *    3. Watch Zama fhEVM for ConfidentialToken.Unshielded events.
 *    4. Call BaseVault.relayerCompleteWithdrawal() on Base to release funds.
 *
 *  Candidate bridge protocols: LayerZero OFT, Hyperlane, Wormhole, custom.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  BRIDGE FLOW (DEPOSIT)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Base Sepolia                        Zama fhEVM
 *  ─────────────────────────────────   ────────────────────────────
 *  user.deposit(token, amount, stId)
 *  → BaseVault emits DepositCreated
 *                │
 *                │  Off-chain relayer reads event
 *                ▼
 *                relayer.bridgeDeposit(user, token, amount, stId)
 *                                        │
 *                                        ▼
 *                            ConfidentialToken.shield(amount)
 *                            ACL granted to user on Zama
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  BRIDGE FLOW (WITHDRAWAL)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Base Sepolia                        Zama fhEVM
 *  ─────────────────────────────────   ────────────────────────────
 *  user.requestWithdrawal(token, amt)
 *  → BaseVault emits WithdrawalRequested
 *  (funds locked in _pendingWithdrawals)
 *                │
 *                │  Off-chain relayer reads event
 *                ▼
 *                relayer.bridgeWithdrawal(user, token, amount)
 *                                        │
 *                                        ▼
 *                     ConfidentialToken.requestUnshield(encAmt, proof, relay)
 *                     Gateway decrypts → callbackUnshield fires
 *                     ERC-20 transferred to relayer on Zama
 *                                        │
 *                │  Relayer confirms back on Base
 *                ◄───────────────────────┘
 *                ▼
 *  BaseVault.relayerCompleteWithdrawal(user, token, amount)
 *  (releases ERC-20 to user on Base)
 */
interface IRelayer {
    /**
     * TODO: Trigger the deposit bridge: lock tokens observed on Base,
     *       then call shield() on Zama fhEVM.
     *
     * @param user        User who deposited on Base
     * @param token       ERC-20 token address on Base
     * @param amount      Amount deposited
     * @param strategyId  Zama fhEVM strategy ID to link to (0 = none)
     */
    function bridgeDeposit(
        address user,
        address token,
        uint256 amount,
        uint256 strategyId
    ) external;

    /**
     * TODO: Trigger the withdrawal bridge: initiate unshield on Zama fhEVM,
     *       then call relayerCompleteWithdrawal() on Base after confirmation.
     *
     * @param user    User who requested withdrawal on Base
     * @param token   ERC-20 token address on Base
     * @param amount  Amount to withdraw
     */
    function bridgeWithdrawal(
        address user,
        address token,
        uint256 amount
    ) external;

    /**
     * TODO: Returns the current operational status of the relayer.
     * Used by the frontend to show the relayer health indicator.
     */
    function isOperational() external view returns (bool);
}
