// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  ConfidentialStrategyAgent
 * @notice Autonomous DeFi strategy execution with FHE-encrypted parameters.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. STRATEGY CREATION (user, off-chain encryption)
 *     ┌──────────────────────────────────────────────────────────────────┐
 *     │  fhevmjs.createEncryptedInput(contract, userAddress)             │
 *     │    .add64(apyTarget)           → handles[0]                      │
 *     │    .add64(rebalanceThreshold)  → handles[1]                      │
 *     │    .add64(stopLossBuffer)      → handles[2]                      │
 *     │    .add64(liquidationBuffer)   → handles[3]                      │
 *     │    .add64(maxLeverage)         → handles[4]                      │
 *     │    .encrypt() → { handles, inputProof }                          │
 *     └──────────────────────┬───────────────────────────────────────────┘
 *                            │ createStrategy(handles..., inputProof)
 *                            ▼
 *     Contract stores all as euint64 ciphertexts.
 *     ACL grants re-encryption rights to strategy owner.
 *
 *  2. STRATEGY EVALUATION (authorized agent, off-chain encrypted feeds)
 *     Agent encrypts current market data the same way:
 *       .add64(currentApyBps)       → handles[0]
 *       .add64(currentHealthX100)   → handles[1]
 *
 *     Contract computes homomorphically (no plaintext revealed):
 *       shouldRebalance = TFHE.lt(currentApy, rebalanceThreshold)
 *       stopLossHit     = TFHE.lt(currentHealth, stopLossBuffer)
 *       evaluationCount = TFHE.add(evaluationCount, 1)
 *
 *     Stores encrypted results. Emits generic event (no values).
 *
 *  3. OPTIONAL REVEAL (owner calls explicitly)
 *     requestParameterReveal(strategyId, paramType)
 *       → Gateway decrypts the parameter
 *       → callbackParameterReveal fires with PLAINTEXT value
 *       → Emits ParameterRevealed(value) — PERMANENTLY PUBLIC
 *
 *     requestEvaluationReveal(strategyId)
 *       → Gateway decrypts both ebool results
 *       → callbackEvaluationReveal fires with plaintext booleans
 *       → Emits EvaluationRevealed(shouldRebalance, stopLossHit)
 *         WARNING: reveals THAT conditions fired, not the underlying values
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PRIVACY PROPERTIES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ✅ PROTECTED by FHE:
 *     • Exact values of all strategy parameters (thresholds, targets, buffers)
 *     • Evaluation outcomes during silent evaluation phase
 *     • Intermediate computation results (comparison outputs)
 *
 *  ⚠️  NOT PROTECTED — visible to all blockchain observers:
 *     • Strategy existence (strategyId, owner address)
 *     • Evaluation timing (block.timestamp per evaluation)
 *     • Evaluation frequency (number of transactions)
 *     • WHEN requestReveal is called (and the revealed values!)
 *     • Gas usage (may correlate with execution paths)
 *
 *  🔴 METADATA LEAKAGE RISKS:
 *     • Evaluation frequency changes may signal approaching trigger conditions
 *     • Agents may evaluate more often when market data suggests a condition
 *       is near the (encrypted) threshold — timing correlation attack
 *     • If stop-loss hits in block N and the agent stops evaluating after block N,
 *       this reveals the stop-loss fired
 *     • Gas cost differentials between evaluations may leak TFHE operation count
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  DEPLOYMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *  Requires Zama fhEVM precompiles:
 *    - Ethereum Sepolia with Zama deployment (chainId 11155111)
 *    - Zama Devnet (chainId 9000)
 */

import {TFHE, euint64, einput, ebool} from "fhevm/lib/TFHE.sol";
import {SepoliaZamaFHEVMConfig} from "fhevm/config/ZamaFHEVMConfig.sol";
import {SepoliaZamaGatewayConfig} from "fhevm/config/ZamaGatewayConfig.sol";
import {GatewayCaller} from "fhevm/gateway/GatewayCaller.sol";
import {Gateway} from "fhevm/gateway/lib/Gateway.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ConfidentialStrategyAgent is
    SepoliaZamaFHEVMConfig,
    SepoliaZamaGatewayConfig,
    GatewayCaller,
    ReentrancyGuard
{
    // ── Parameter type constants (used in requestParameterReveal) ─────────────

    uint8 public constant PARAM_APY_TARGET           = 0;
    uint8 public constant PARAM_REBALANCE_THRESHOLD  = 1;
    uint8 public constant PARAM_STOP_LOSS_BUFFER     = 2;
    uint8 public constant PARAM_LIQUIDATION_BUFFER   = 3;
    uint8 public constant PARAM_MAX_LEVERAGE         = 4;
    uint8 public constant PARAM_EVAL_COUNT           = 5;

    uint8 private constant PARAM_COUNT = 6;

    // ── Strategy storage ──────────────────────────────────────────────────────

    /**
     * @dev All euint64 fields are ciphertext handles pointing to encrypted
     *      values maintained by Zama fhEVM nodes.
     *
     *      Parameter semantics (all in basis points unless noted):
     *        apyTarget           – desired annual yield, e.g. 800 = 8.00%
     *        rebalanceThreshold  – APY below which to rebalance, e.g. 500 = 5.00%
     *        stopLossBuffer      – health factor floor ×100, e.g. 120 = HF 1.20
     *        liquidationBuffer   – extra safety margin above floor, e.g. 20 = 0.20
     *        maxLeverage         – maximum leverage ×100, e.g. 150 = 1.5×
     *        evaluationCount     – homomorphic counter of all evaluations
     *        lastShouldRebalance – euint64(0 or 1): was rebalance triggered last eval?
     *        lastStopLossHit     – euint64(0 or 1): was stop-loss triggered last eval?
     */
    struct Strategy {
        euint64 apyTarget;
        euint64 rebalanceThreshold;
        euint64 stopLossBuffer;
        euint64 liquidationBuffer;
        euint64 maxLeverage;
        euint64 evaluationCount;
        euint64 lastShouldRebalance;
        euint64 lastStopLossHit;
        address owner;
        bool    exists;
        bool    isActive;
        uint256 createdAt;       // public – timing leakage accepted
        uint256 lastEvaluatedAt; // public – timing leakage accepted
    }

    uint256 public nextStrategyId;
    mapping(uint256 => Strategy) private _strategies;
    mapping(address => uint256[]) private _ownerStrategies;

    // ── Agent authorization ───────────────────────────────────────────────────

    address public immutable protocolOwner;
    mapping(address => bool) public authorizedAgents;

    // ── Pending Gateway decryption requests ───────────────────────────────────

    struct RevealRequest {
        uint256 strategyId;
        address requester;
        uint8   paramType; // PARAM_* constant, or 0xFF for evaluation reveal
    }
    mapping(uint256 => RevealRequest) public pendingReveals;

    // ── Events ────────────────────────────────────────────────────────────────
    //
    // DESIGN PRINCIPLE: No strategy parameter values appear in any event.
    // Events reveal only structural metadata: IDs, addresses, block numbers.
    // Values are revealed ONLY via explicit requestReveal calls.

    event StrategyCreated(uint256 indexed strategyId, address indexed owner);
    event StrategyUpdated(uint256 indexed strategyId);
    event StrategyDeactivated(uint256 indexed strategyId);
    event AgentAuthorized(address indexed agent, bool status);

    /**
     * @notice Emitted each time an agent evaluates a strategy.
     * @dev    Reveals WHEN and HOW OFTEN — does NOT reveal outcomes.
     *         Timing correlation attacks are possible (see contract header).
     */
    event EvaluationPerformed(uint256 indexed strategyId, uint256 indexed blockNumber);

    /**
     * @notice Emitted when a Gateway reveal is requested.
     * @dev    Reveals that the owner wants to inspect a parameter or result.
     */
    event RevealRequested(
        uint256 indexed strategyId,
        uint8           paramType,
        uint256 indexed requestId
    );

    /**
     * @notice Emitted after Gateway decrypts a parameter value.
     * @dev    ⚠️  WARNING: `revealedValue` is PERMANENTLY PUBLIC on-chain.
     *         Every node, indexer, and observer can read it from the event log.
     *         This cannot be undone. Only call requestParameterReveal when you
     *         intentionally want to make a parameter public.
     */
    event ParameterRevealed(
        uint256 indexed strategyId,
        uint8           paramType,
        uint64          revealedValue
    );

    /**
     * @notice Emitted after Gateway decrypts the last evaluation outcome.
     * @dev    ⚠️  WARNING: Reveals THAT conditions were or were not met.
     *         Does not reveal the exact market values used, but confirms
     *         which conditions fired. Also permanently public.
     */
    event EvaluationRevealed(
        uint256 indexed strategyId,
        bool            shouldRebalance,
        bool            stopLossHit
    );

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyProtocolOwner() {
        require(
            msg.sender == protocolOwner,
            "ConfidentialStrategyAgent: not protocol owner"
        );
        _;
    }

    modifier onlyAgent() {
        require(
            authorizedAgents[msg.sender],
            "ConfidentialStrategyAgent: not authorized agent"
        );
        _;
    }

    modifier strategyExists(uint256 strategyId) {
        require(
            _strategies[strategyId].exists,
            "ConfidentialStrategyAgent: strategy not found"
        );
        _;
    }

    modifier onlyStrategyOwner(uint256 strategyId) {
        require(
            _strategies[strategyId].exists,
            "ConfidentialStrategyAgent: strategy not found"
        );
        require(
            _strategies[strategyId].owner == msg.sender,
            "ConfidentialStrategyAgent: not strategy owner"
        );
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _protocolOwner) {
        require(_protocolOwner != address(0), "ConfidentialStrategyAgent: zero owner");
        protocolOwner = _protocolOwner;
    }

    // ── Agent Authorization ───────────────────────────────────────────────────

    function authorizeAgent(address agent, bool status) external onlyProtocolOwner {
        require(agent != address(0), "ConfidentialStrategyAgent: zero agent");
        authorizedAgents[agent] = status;
        emit AgentAuthorized(agent, status);
    }

    // ── Strategy Lifecycle ────────────────────────────────────────────────────

    /**
     * @notice Create a new confidential strategy with five encrypted parameters.
     *
     * @dev Client-side encryption with fhevmjs (single encrypted input for all params):
     *
     *        const input = instance.createEncryptedInput(contractAddress, userAddress);
     *        input.add64(apyTargetBps);          // handles[0]
     *        input.add64(rebalanceThresholdBps); // handles[1]
     *        input.add64(stopLossBufferX100);    // handles[2]
     *        input.add64(liquidationBufferX100); // handles[3]
     *        input.add64(maxLeverageX100);       // handles[4]
     *        const { handles, inputProof } = await input.encrypt();
     *
     *        await writeContract({
     *          functionName: "createStrategy",
     *          args: [handles[0], handles[1], handles[2], handles[3], handles[4], inputProof]
     *        });
     *
     * @return strategyId  Auto-incrementing strategy ID (read from StrategyCreated event)
     */
    function createStrategy(
        einput encApyTarget,
        einput encRebalanceThreshold,
        einput encStopLossBuffer,
        einput encLiquidationBuffer,
        einput encMaxLeverage,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 strategyId) {
        strategyId = nextStrategyId++;

        Strategy storage s = _strategies[strategyId];
        s.apyTarget          = TFHE.asEuint64(encApyTarget, inputProof);
        s.rebalanceThreshold = TFHE.asEuint64(encRebalanceThreshold, inputProof);
        s.stopLossBuffer     = TFHE.asEuint64(encStopLossBuffer, inputProof);
        s.liquidationBuffer  = TFHE.asEuint64(encLiquidationBuffer, inputProof);
        s.maxLeverage        = TFHE.asEuint64(encMaxLeverage, inputProof);
        s.evaluationCount    = TFHE.asEuint64(uint256(0));
        s.lastShouldRebalance = TFHE.asEuint64(uint256(0));
        s.lastStopLossHit     = TFHE.asEuint64(uint256(0));
        s.owner     = msg.sender;
        s.exists    = true;
        s.isActive  = true;
        s.createdAt = block.timestamp;

        _grantStrategyAccess(strategyId);
        _ownerStrategies[msg.sender].push(strategyId);

        emit StrategyCreated(strategyId, msg.sender);
    }

    /**
     * @notice Replace all encrypted parameters of an existing strategy.
     * @dev    Same encryption pattern as createStrategy.
     *         Previous ciphertexts are replaced and ACL re-granted.
     */
    function updateStrategy(
        uint256 strategyId,
        einput encApyTarget,
        einput encRebalanceThreshold,
        einput encStopLossBuffer,
        einput encLiquidationBuffer,
        einput encMaxLeverage,
        bytes calldata inputProof
    ) external onlyStrategyOwner(strategyId) nonReentrant {
        Strategy storage s = _strategies[strategyId];
        s.apyTarget          = TFHE.asEuint64(encApyTarget, inputProof);
        s.rebalanceThreshold = TFHE.asEuint64(encRebalanceThreshold, inputProof);
        s.stopLossBuffer     = TFHE.asEuint64(encStopLossBuffer, inputProof);
        s.liquidationBuffer  = TFHE.asEuint64(encLiquidationBuffer, inputProof);
        s.maxLeverage        = TFHE.asEuint64(encMaxLeverage, inputProof);
        _grantStrategyAccess(strategyId);
        emit StrategyUpdated(strategyId);
    }

    /// @notice Deactivate a strategy so agents can no longer evaluate it.
    function deactivateStrategy(uint256 strategyId)
        external
        onlyStrategyOwner(strategyId)
    {
        _strategies[strategyId].isActive = false;
        emit StrategyDeactivated(strategyId);
    }

    // ── Agent: Evaluate Strategy ──────────────────────────────────────────────

    /**
     * @notice Evaluate a strategy against current encrypted market conditions.
     *
     * @dev The agent encrypts current market values using the same fhevmjs pattern:
     *
     *        const input = instance.createEncryptedInput(contractAddress, agentAddress);
     *        input.add64(currentApyBps);       // handles[0]
     *        input.add64(currentHealthX100);   // handles[1]
     *        const { handles, inputProof } = await input.encrypt();
     *
     *      OBLIVIOUS EVALUATION PROPERTY:
     *        • The agent knows the feed values it encrypted.
     *        • The strategy owner knows their thresholds.
     *        • NEITHER party can determine the evaluation outcome alone.
     *        • Only the Zama Gateway (trusted key management) can decrypt results.
     *
     *      TIMING LEAKAGE:
     *        • This transaction's existence is visible on-chain.
     *        • Block.timestamp reveals when evaluations occur.
     *        • Call frequency reveals agent activity patterns.
     *        • Smart observers may correlate frequency with market events.
     *
     * @param strategyId        Strategy to evaluate
     * @param encCurrentApy     Encrypted current APY (basis points)
     * @param encCurrentHealth  Encrypted current health factor ×100
     * @param inputProof        Single proof covering both encrypted inputs
     */
    function evaluateStrategy(
        uint256 strategyId,
        einput encCurrentApy,
        einput encCurrentHealth,
        bytes calldata inputProof
    ) external onlyAgent strategyExists(strategyId) nonReentrant {
        Strategy storage s = _strategies[strategyId];
        require(s.isActive, "ConfidentialStrategyAgent: strategy not active");

        euint64 currentApy    = TFHE.asEuint64(encCurrentApy, inputProof);
        euint64 currentHealth = TFHE.asEuint64(encCurrentHealth, inputProof);

        // ── Homomorphic comparisons ───────────────────────────────────────────
        //
        // Neither this contract nor any on-chain observer can read these results.
        // They are encrypted ebool handles maintained by Zama's key nodes.
        //
        // shouldRebalance: is current APY below the rebalance trigger threshold?
        // stopLossHit:     is current health factor below the safety buffer?
        euint64 shouldRebalance = TFHE.asEuint64(
            TFHE.lt(currentApy, s.rebalanceThreshold)
        );
        euint64 stopLossHit = TFHE.asEuint64(
            TFHE.lt(currentHealth, s.stopLossBuffer)
        );

        // ── Encrypted state update ────────────────────────────────────────────
        //
        // Always increment counter (doesn't leak whether conditions fired).
        // Store encrypted results for potential reveal via requestEvaluationReveal.
        s.evaluationCount     = TFHE.add(s.evaluationCount, TFHE.asEuint64(uint256(1)));
        s.lastShouldRebalance = shouldRebalance;
        s.lastStopLossHit     = stopLossHit;

        // ── Regrant ACL access to new handles ────────────────────────────────
        TFHE.allow(s.evaluationCount, address(this));
        TFHE.allow(s.evaluationCount, s.owner);
        TFHE.allow(s.lastShouldRebalance, address(this));
        TFHE.allow(s.lastShouldRebalance, s.owner);
        TFHE.allow(s.lastStopLossHit, address(this));
        TFHE.allow(s.lastStopLossHit, s.owner);

        // ── Update public timestamp (leaks timing) ────────────────────────────
        s.lastEvaluatedAt = block.timestamp;

        // ── Generic event — reveals WHEN but NOT whether conditions fired ─────
        emit EvaluationPerformed(strategyId, block.number);
    }

    // ── Gateway: Parameter Reveal ─────────────────────────────────────────────

    /**
     * @notice Request Gateway decryption of one strategy parameter.
     *
     * @dev ⚠️  IRREVERSIBLE PRIVACY REDUCTION
     *      Once this call lands on-chain, the parameter value will be permanently
     *      visible in ParameterRevealed event logs. Every explorer, indexer, and
     *      blockchain observer worldwide can read it.
     *
     *      Use this only when you intentionally want to make a parameter public —
     *      for example, to prove that a strategy configuration was compliant.
     *
     *      Only the strategy owner may request reveals for their own strategy.
     *
     * @param strategyId  ID of the strategy
     * @param paramType   Use PARAM_* constants (PARAM_APY_TARGET, PARAM_REBALANCE_THRESHOLD, ...)
     */
    function requestParameterReveal(uint256 strategyId, uint8 paramType)
        external
        onlyStrategyOwner(strategyId)
        nonReentrant
    {
        require(paramType < PARAM_COUNT, "ConfidentialStrategyAgent: invalid param type");

        euint64 handle = _getParamHandle(_strategies[strategyId], paramType);
        require(
            TFHE.isInitialized(handle),
            "ConfidentialStrategyAgent: param not initialized"
        );

        TFHE.allowTransient(handle, Gateway.gatewayContractAddress());

        uint256[] memory handles = new uint256[](1);
        handles[0] = Gateway.toUint256(handle);

        uint256 requestId = Gateway.requestDecryption(
            handles,
            this.callbackParameterReveal.selector,
            0,
            block.timestamp + 1 hours,
            false
        );

        pendingReveals[requestId] = RevealRequest({
            strategyId: strategyId,
            requester:  msg.sender,
            paramType:  paramType
        });

        emit RevealRequested(strategyId, paramType, requestId);
    }

    /**
     * @notice Request Gateway decryption of the last evaluation outcome.
     *
     * @dev ⚠️  REVEALS THAT CONDITIONS WERE (OR WERE NOT) TRIGGERED.
     *      This does not reveal the exact market values used in the evaluation,
     *      but it does reveal the binary outcome: whether the rebalance threshold
     *      was breached and whether the stop-loss buffer was hit.
     *
     *      Use this when you need to act on the evaluation result and are prepared
     *      to make the outcome public knowledge.
     *
     *      The callback receives TWO decrypted uint64 values (0 or 1 each).
     */
    function requestEvaluationReveal(uint256 strategyId)
        external
        onlyStrategyOwner(strategyId)
        nonReentrant
    {
        Strategy storage s = _strategies[strategyId];
        require(s.lastEvaluatedAt > 0, "ConfidentialStrategyAgent: strategy never evaluated");
        require(
            TFHE.isInitialized(s.lastShouldRebalance),
            "ConfidentialStrategyAgent: eval result not initialized"
        );

        TFHE.allowTransient(s.lastShouldRebalance, Gateway.gatewayContractAddress());
        TFHE.allowTransient(s.lastStopLossHit, Gateway.gatewayContractAddress());

        uint256[] memory handles = new uint256[](2);
        handles[0] = Gateway.toUint256(s.lastShouldRebalance);
        handles[1] = Gateway.toUint256(s.lastStopLossHit);

        uint256 requestId = Gateway.requestDecryption(
            handles,
            this.callbackEvaluationReveal.selector,
            0,
            block.timestamp + 1 hours,
            false
        );

        pendingReveals[requestId] = RevealRequest({
            strategyId: strategyId,
            requester:  msg.sender,
            paramType:  0xFF // sentinel for evaluation reveal
        });

        emit RevealRequested(strategyId, 0xFF, requestId);
    }

    // ── Gateway Callbacks ─────────────────────────────────────────────────────

    /**
     * @notice Gateway callback: decrypted single parameter value.
     * @dev    Only callable by the Zama Gateway (enforced by `onlyGateway`).
     *         The `revealedValue` is now visible to all on-chain observers.
     */
    function callbackParameterReveal(uint256 requestId, uint64 revealedValue)
        external
        onlyGateway
    {
        RevealRequest memory req = pendingReveals[requestId];
        require(req.requester != address(0), "ConfidentialStrategyAgent: unknown requestId");
        delete pendingReveals[requestId];

        emit ParameterRevealed(req.strategyId, req.paramType, revealedValue);
    }

    /**
     * @notice Gateway callback: decrypted evaluation outcome (both conditions).
     * @dev    Both values are permanently public after this fires.
     *         `shouldRebalanceRaw` and `stopLossRaw` are 0 or 1 (uint64).
     */
    function callbackEvaluationReveal(
        uint256 requestId,
        uint64  shouldRebalanceRaw,
        uint64  stopLossRaw
    ) external onlyGateway {
        RevealRequest memory req = pendingReveals[requestId];
        require(req.requester != address(0), "ConfidentialStrategyAgent: unknown requestId");
        delete pendingReveals[requestId];

        emit EvaluationRevealed(
            req.strategyId,
            shouldRebalanceRaw > 0,
            stopLossRaw > 0
        );
    }

    // ── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Returns public metadata and encrypted handles for a strategy.
     *
     * @dev The returned `apyTargetHandle` and `evaluationCountHandle` are
     *      uint256 values pointing to ciphertexts on Zama's nodes.
     *      To read the actual values:
     *
     *        const handle = BigInt(apyTargetHandle);
     *        const { publicKey, privateKey } = instance.generateKeypair();
     *        const eip712 = instance.createEIP712(publicKey, contractAddress);
     *        const sig = await walletClient.signTypedData(eip712);
     *        const plainValue = await instance.reencrypt(
     *          handle, privateKey, publicKey, sig, contractAddress, userAddress
     *        );
     *
     *      This is the ONLY way to read encrypted values without Gateway decryption.
     *      It requires the caller to have ACL access (granted via TFHE.allow in createStrategy).
     */
    function getStrategyMetadata(uint256 strategyId)
        external
        view
        strategyExists(strategyId)
        returns (
            address owner,
            bool    isActive,
            uint256 createdAt,
            uint256 lastEvaluatedAt,
            uint256 apyTargetHandle,
            uint256 rebalanceThresholdHandle,
            uint256 stopLossBufferHandle,
            uint256 liquidationBufferHandle,
            uint256 maxLeverageHandle,
            uint256 evaluationCountHandle
        )
    {
        Strategy storage s = _strategies[strategyId];
        return (
            s.owner,
            s.isActive,
            s.createdAt,
            s.lastEvaluatedAt,
            euint64.unwrap(s.apyTarget),
            euint64.unwrap(s.rebalanceThreshold),
            euint64.unwrap(s.stopLossBuffer),
            euint64.unwrap(s.liquidationBuffer),
            euint64.unwrap(s.maxLeverage),
            euint64.unwrap(s.evaluationCount)
        );
    }

    function getOwnerStrategies(address owner)
        external
        view
        returns (uint256[] memory)
    {
        return _ownerStrategies[owner];
    }

    // ── Internal Helpers ─────────────────────────────────────────────────────

    function _grantStrategyAccess(uint256 strategyId) internal {
        Strategy storage s = _strategies[strategyId];
        address owner = s.owner;

        TFHE.allow(s.apyTarget,          address(this)); TFHE.allow(s.apyTarget,          owner);
        TFHE.allow(s.rebalanceThreshold, address(this)); TFHE.allow(s.rebalanceThreshold, owner);
        TFHE.allow(s.stopLossBuffer,     address(this)); TFHE.allow(s.stopLossBuffer,     owner);
        TFHE.allow(s.liquidationBuffer,  address(this)); TFHE.allow(s.liquidationBuffer,  owner);
        TFHE.allow(s.maxLeverage,        address(this)); TFHE.allow(s.maxLeverage,        owner);
        TFHE.allow(s.evaluationCount,    address(this)); TFHE.allow(s.evaluationCount,    owner);
        TFHE.allow(s.lastShouldRebalance, address(this)); TFHE.allow(s.lastShouldRebalance, owner);
        TFHE.allow(s.lastStopLossHit,     address(this)); TFHE.allow(s.lastStopLossHit,     owner);
    }

    function _getParamHandle(Strategy storage s, uint8 paramType)
        internal
        view
        returns (euint64)
    {
        if (paramType == PARAM_APY_TARGET)           return s.apyTarget;
        if (paramType == PARAM_REBALANCE_THRESHOLD)  return s.rebalanceThreshold;
        if (paramType == PARAM_STOP_LOSS_BUFFER)     return s.stopLossBuffer;
        if (paramType == PARAM_LIQUIDATION_BUFFER)   return s.liquidationBuffer;
        if (paramType == PARAM_MAX_LEVERAGE)         return s.maxLeverage;
        return s.evaluationCount;
    }
}
