// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  BaseVault
 * @notice Settlement layer contract for the "Private Agentic DeFi on Base" stack.
 *         Deployed on Base Sepolia (chain 84532) or Base mainnet (chain 8453).
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  ROLE IN THE THREE-LAYER ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │  Layer 1 — USER / SETTLEMENT (BASE SEPOLIA)        │
 *   │                                                    │
 *   │  1. User approves BaseVault to spend their ERC-20  │
 *   │  2. User calls deposit(token, amount, strategyId)  │
 *   │  3. BaseVault locks tokens and emits DepositCreated│
 *   │  4. User can link to a Zama fhEVM strategy         │
 *   │  5. User requests withdrawal → funds locked        │
 *   │  6. Relayer completes withdrawal (TODO)            │
 *   └──────────────────────┬─────────────────────────────┘
 *                          │  DepositCreated event
 *                          │  WithdrawalRequested event
 *                          ▼
 *   ┌────────────────────────────────────────────────────┐
 *   │  Layer 2 — BRIDGE / RELAYER (TODO — off-chain)     │
 *   │                                                    │
 *   │  • Watches Base for DepositCreated events          │
 *   │  • Calls ConfidentialToken.shield() on Zama fhEVM │
 *   │  • Watches Zama for Unshielded events              │
 *   │  • Calls relayerCompleteWithdrawal() on Base       │
 *   │                                                    │
 *   │  Status: NOT IMPLEMENTED. See IRelayer.sol.        │
 *   └──────────────────────┬─────────────────────────────┘
 *                          │
 *                          ▼
 *   ┌────────────────────────────────────────────────────┐
 *   │  Layer 3 — CONFIDENTIAL COMPUTE (ZAMA fhEVM)       │
 *   │                                                    │
 *   │  • ConfidentialToken.shield(amount) → euint64      │
 *   │  • ConfidentialStrategyAgent encrypted evaluation  │
 *   │  • TFHE homomorphic operations                     │
 *   │                                                    │
 *   │  Note: Zama fhEVM does NOT run on Base. It is a    │
 *   │  separate network (chain 9000 or Sepolia).         │
 *   └────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  WHAT THIS CONTRACT DOES
 * ═══════════════════════════════════════════════════════════════════════
 *  • Accepts ERC-20 deposits from users
 *  • Tracks per-user, per-token available and pending balances
 *  • Emits events for the off-chain relayer to consume
 *  • Processes withdrawals once the relayer confirms Zama unshield
 *  • Links user accounts to Zama fhEVM strategy IDs
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  WHAT THIS CONTRACT DOES NOT DO
 * ═══════════════════════════════════════════════════════════════════════
 *  • No FHE / TFHE operations of any kind
 *  • No cross-chain message passing (that is the relayer's responsibility)
 *  • No knowledge of encrypted strategy parameters
 *  • No interaction with Zama's ACL or Gateway contracts
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  WITHDRAWAL STATE MACHINE
 * ═══════════════════════════════════════════════════════════════════════
 *  available balance
 *      │
 *      │  requestWithdrawal()
 *      ▼
 *  pending withdrawal
 *      │                   │
 *      │  relayerComplete  │  cancelPendingWithdrawal()
 *      ▼                   ▼
 *  released to user     back to available balance
 *
 *  Emergency path (any user, for their own available balance — testnet/dev):
 *      emergencyWithdraw() — bypasses relayer, transfers directly to msg.sender
 */

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BaseVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ─────────────────────────────────────────────────────────────────

    /**
     * @notice Address of the authorized relayer that can complete withdrawals.
     *
     * TODO: Set this to the deployed relayer contract address once the
     *       cross-chain bridge is implemented.
     *       For now, the owner acts as the relayer during development.
     */
    address public relayer;

    /**
     * @notice Available (deposited, not pending withdrawal) balance per user per token.
     * key: user address → token address → amount
     */
    mapping(address => mapping(address => uint256)) private _available;

    /**
     * @notice Funds locked awaiting relayer confirmation of Zama unshield.
     * key: user address → token address → amount
     */
    mapping(address => mapping(address => uint256)) private _pending;

    /**
     * @notice The Zama fhEVM strategy ID each user has linked.
     * 0 means no strategy linked.
     * This is an opaque identifier — BaseVault does not validate it.
     * The relayer uses it to know which strategy to interact with on Zama.
     */
    mapping(address => uint256) private _linkedStrategy;

    // ── Events ────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a user deposits tokens into the vault.
     *
     * @dev The off-chain relayer MUST listen for this event and call
     *      ConfidentialToken.shield(amount) on Zama fhEVM.
     *      Until the relayer is implemented, funds remain in the vault
     *      but are NOT shielded on Zama.
     *
     * @param user       The depositing user
     * @param token      ERC-20 token address on Base
     * @param amount     Amount deposited (in token's smallest unit)
     * @param strategyId Linked Zama fhEVM strategy (0 if none)
     */
    event DepositCreated(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 strategyId
    );

    /**
     * @notice Emitted when a user requests withdrawal from the vault.
     *
     * @dev The relayer MUST listen for this event and initiate
     *      ConfidentialToken.requestUnshield() on Zama fhEVM.
     *      Funds are locked (moved to _pending) until the relayer
     *      calls relayerCompleteWithdrawal() or the user cancels.
     */
    event WithdrawalRequested(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    /**
     * @notice Emitted when the relayer confirms withdrawal completion.
     * @dev    At this point the ERC-20 tokens are transferred to the user.
     */
    event WithdrawalCompleted(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    /**
     * @notice Emitted when a user cancels a pending withdrawal.
     */
    event WithdrawalCancelled(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    /**
     * @notice Emitted when a user links their account to a Zama fhEVM strategy.
     *
     * @dev The relayer uses strategyId to find the correct encrypted strategy
     *      on the Zama fhEVM network when bridging deposits.
     */
    event StrategyLinked(address indexed user, uint256 strategyId);

    /**
     * @notice Emitted when the owner updates the relayer address.
     */
    event RelayerSet(address indexed relayer);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    /**
     * @dev Security fix (SECURITY.md finding 1.4):
     *      Owner fallback removed. Only the designated `relayer` address may
     *      call relayerCompleteWithdrawal(). In production the relayer address
     *      should be a bridge contract with on-chain proof verification, not an EOA.
     *
     *      To perform admin withdrawals during development, set the relayer to
     *      the deployer address via setRelayer() before deployment.
     */
    modifier onlyRelayer() {
        require(
            msg.sender == relayer,
            "BaseVault: caller is not the relayer"
        );
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param _owner   Protocol owner (can set relayer, execute emergency withdraw)
     * @param _relayer Initial relayer address (use owner address until bridge deployed)
     */
    constructor(address _owner, address _relayer) Ownable(_owner) {
        require(_owner != address(0), "BaseVault: zero owner");
        // Relayer may be address(0) at deploy time (set later via setRelayer)
        relayer = _relayer;
        emit RelayerSet(_relayer);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Set the relayer address.
     *
     * @dev TODO: Set to the deployed cross-chain bridge/relayer contract once
     *      the LayerZero / Hyperlane / custom relayer is implemented.
     *
     * @param _relayer New relayer address
     */
    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
        emit RelayerSet(_relayer);
    }

    // ── Deposit ───────────────────────────────────────────────────────────────

    /**
     * @notice Deposit ERC-20 tokens into the vault.
     *
     * @dev Caller must have called token.approve(address(this), amount) first.
     *
     *      The DepositCreated event signals the off-chain relayer to call
     *      ConfidentialToken.shield(amount) on Zama fhEVM.
     *
     *      Until the relayer bridge is live, funds are safely held here
     *      and can be withdrawn at any time via requestWithdrawal.
     *
     * @param token      ERC-20 token address on Base Sepolia
     * @param amount     Amount to deposit (token smallest unit, must be > 0)
     * @param strategyId Zama fhEVM strategy ID to link this deposit to (0 = none)
     */
    function deposit(
        address token,
        uint256 amount,
        uint256 strategyId
    ) external nonReentrant {
        require(token != address(0), "BaseVault: zero token address");
        require(amount > 0, "BaseVault: amount must be > 0");

        // ── Security fix (SECURITY.md finding 1.1): fee-on-transfer tokens ───────
        // Measure the actual tokens received rather than trusting `amount`.
        // For standard ERC-20 tokens `received == amount`; for tokens with a
        // transfer fee `received < amount`. Using `received` ensures the vault's
        // internal accounting never exceeds its real token balance.
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balanceBefore;
        require(received > 0, "BaseVault: received zero tokens");

        _available[msg.sender][token] += received;

        // Auto-link strategy if provided and not yet linked
        if (strategyId != 0 && _linkedStrategy[msg.sender] == 0) {
            _linkedStrategy[msg.sender] = strategyId;
            emit StrategyLinked(msg.sender, strategyId);
        }

        // Emit `received` (not `amount`) so downstream systems know the exact credit
        emit DepositCreated(msg.sender, token, received, strategyId);
    }

    // ── Strategy Linking ──────────────────────────────────────────────────────

    /**
     * @notice Link this account to a Zama fhEVM strategy ID.
     *
     * @dev The strategyId is opaque to BaseVault. It must correspond to
     *      a valid strategy in ConfidentialStrategyAgent on Zama fhEVM.
     *
     *      The relayer uses this link to know which strategy to shield into
     *      when processing a DepositCreated event.
     *
     *      Calling this again replaces the previous link.
     *
     * @param strategyId Zama fhEVM strategy ID (returned from createStrategy())
     */
    function linkStrategy(uint256 strategyId) external {
        _linkedStrategy[msg.sender] = strategyId;
        emit StrategyLinked(msg.sender, strategyId);
    }

    // ── Withdrawal ────────────────────────────────────────────────────────────

    /**
     * @notice Request withdrawal of `amount` tokens from the vault.
     *
     * @dev Moves `amount` from _available to _pending.
     *
     *      The WithdrawalRequested event signals the off-chain relayer to:
     *       1. Call ConfidentialToken.requestUnshield() on Zama fhEVM.
     *       2. Wait for the Zama Gateway callback (Unshielded event).
     *       3. Call relayerCompleteWithdrawal() on this contract.
     *
     *      If the relayer does not respond, the user can call
     *      cancelPendingWithdrawal() to reclaim their funds.
     *
     *      NOTE: Until the bridge is deployed, users should call
     *      cancelPendingWithdrawal() immediately to reclaim funds.
     *
     * @param token  ERC-20 token address
     * @param amount Amount to withdraw
     */
    function requestWithdrawal(
        address token,
        uint256 amount
    ) external nonReentrant {
        require(token != address(0), "BaseVault: zero token address");
        require(amount > 0, "BaseVault: amount must be > 0");
        require(
            _available[msg.sender][token] >= amount,
            "BaseVault: insufficient available balance"
        );

        _available[msg.sender][token] -= amount;
        _pending[msg.sender][token] += amount;

        emit WithdrawalRequested(msg.sender, token, amount);
    }

    /**
     * @notice Complete a pending withdrawal (relayer only).
     *
     * @dev Called by the relayer after confirming that the corresponding
     *      Zama fhEVM unshield has been processed and the ERC-20 has been
     *      locked on the Zama side (or burned/accounted for).
     *
     *      TODO: In production this would be called by the bridge contract
     *      automatically after the cross-chain message is verified.
     *
     * @param user   The user who requested withdrawal
     * @param token  ERC-20 token address
     * @param amount Amount to release
     */
    function relayerCompleteWithdrawal(
        address user,
        address token,
        uint256 amount
    ) external onlyRelayer nonReentrant {
        require(user != address(0), "BaseVault: zero user");
        require(
            _pending[user][token] >= amount,
            "BaseVault: insufficient pending balance"
        );

        _pending[user][token] -= amount;
        IERC20(token).safeTransfer(user, amount);

        emit WithdrawalCompleted(user, token, amount);
    }

    /**
     * @notice Cancel a pending withdrawal and return funds to available balance.
     *
     * @dev Use this if the relayer does not respond within a reasonable time,
     *      or if the bridge is not yet deployed and you need to recover funds.
     *
     *      Once the production bridge is deployed, this function should only
     *      be callable after a timeout (e.g. 24 hours) to prevent abuse.
     *      That timeout logic is left as a TODO.
     *
     * @param token  ERC-20 token address
     * @param amount Amount to cancel
     */
    function cancelPendingWithdrawal(
        address token,
        uint256 amount
    ) external nonReentrant {
        require(
            _pending[msg.sender][token] >= amount,
            "BaseVault: no pending withdrawal to cancel"
        );

        _pending[msg.sender][token] -= amount;
        _available[msg.sender][token] += amount;

        emit WithdrawalCancelled(msg.sender, token, amount);
    }

    /**
     * @notice Emergency withdrawal of ALL available balance for a token.
     *
     * @dev ⚠️  TESTNET / DEVELOPMENT SAFETY VALVE ONLY.
     *      This bypasses the relayer and transfers directly to msg.sender.
     *      It should be removed or timelocked before mainnet deployment.
     *
     *      Useful during development when the bridge is not yet deployed
     *      and a user needs to recover their funds without waiting for a relayer.
     *
     * @param token ERC-20 token address to withdraw
     */
    function emergencyWithdraw(address token) external nonReentrant {
        uint256 available = _available[msg.sender][token];
        require(available > 0, "BaseVault: nothing to withdraw");

        _available[msg.sender][token] = 0;
        IERC20(token).safeTransfer(msg.sender, available);

        emit WithdrawalCompleted(msg.sender, token, available);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Returns the available (not pending withdrawal) balance.
     */
    function getAvailableBalance(
        address user,
        address token
    ) external view returns (uint256) {
        return _available[user][token];
    }

    /**
     * @notice Returns the balance locked in pending withdrawal.
     */
    function getPendingWithdrawal(
        address user,
        address token
    ) external view returns (uint256) {
        return _pending[user][token];
    }

    /**
     * @notice Returns the Zama fhEVM strategy ID linked to this user.
     *         0 = no strategy linked.
     */
    function getLinkedStrategy(address user) external view returns (uint256) {
        return _linkedStrategy[user];
    }

    /**
     * @notice Returns the total vault balance for a given token
     *         (available + pending across all users).
     *
     * @dev    This is the actual ERC-20 balance held by the contract.
     *         It should always equal the sum of all _available + _pending values.
     */
    function vaultBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
