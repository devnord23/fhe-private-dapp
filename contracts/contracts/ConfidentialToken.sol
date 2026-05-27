// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ConfidentialToken
 * @author fhe-private-dapp
 *
 * @notice A shield/unshield wrapper that gives an existing ERC-20 token an FHE-encrypted
 *         balance layer using Zama's fhEVM (https://docs.zama.ai/fhevm).
 *
 * Architecture
 * ────────────
 *  Public ERC-20 (e.g. USDC)
 *      │
 *      │  shield(uint64 amount)       ← amount is PUBLIC here (coming from public ERC-20)
 *      ▼
 *  ConfidentialToken (this contract)
 *      │  internal storage: mapping(address => euint64) — ciphertexts on Zama nodes
 *      │
 *      │  transfer(to, einput, proof) ← amount is ENCRYPTED; never visible on-chain
 *      │
 *      │  requestUnshield(einput, proof, recipient) ← amount ENCRYPTED
 *      ▼                                              Gateway decrypts asynchronously
 *  Public ERC-20 (sent to recipient after Gateway callback)
 *
 * Encryption model (Zama TFHE)
 * ─────────────────────────────
 *  • All shielded balances are stored as `euint64` — a handle pointing to a ciphertext
 *    maintained by the Zama fhEVM node network.
 *  • TFHE arithmetic (add, sub, le, select) is performed homomorphically: the contract
 *    never sees plaintext amounts.
 *  • Callers supply `einput + inputProof` produced by fhevmjs on the client.
 *  • ACL (Access Control List): `TFHE.allow(handle, address)` grants a specific address
 *    the ability to re-encrypt that ciphertext for viewing.
 *  • Decryption (for unshield) goes through the Gateway which calls back with the plain value.
 *
 * Deployment requirements
 * ───────────────────────
 *  • Must be deployed on a network running Zama's fhEVM precompiles.
 *  • Tested on Zama Devnet (chain ID 9000) and Zama's Ethereum Sepolia deployment.
 *  • See scripts/deploy.ts for deployment instructions.
 */

import { TFHE, euint64, einput, ebool } from "fhevm/lib/TFHE.sol";
import { SepoliaZamaFHEVMConfig } from "fhevm/config/ZamaFHEVMConfig.sol";
import { GatewayCaller } from "fhevm/gateway/GatewayCaller.sol";
import { Gateway } from "fhevm/gateway/Gateway.sol";
import { IERC20, SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ConfidentialToken is SepoliaZamaFHEVMConfig, GatewayCaller, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ────────────────────────────────────────────────────────────────────

    /// @notice The underlying public ERC-20 token being wrapped.
    IERC20 public immutable underlying;

    /// @notice Name / symbol of the confidential wrapper (e.g. "Confidential USDC", "cUSDC").
    string public name;
    string public symbol;

    /**
     * @notice Encrypted balance for each account.
     *
     * The euint64 handle points to a ciphertext held by Zama's fhEVM nodes.
     * Only addresses that have been granted access via TFHE.allow() can re-encrypt
     * and read the plaintext.  The contract itself can perform arithmetic on the
     * ciphertext without ever decrypting it.
     */
    mapping(address => euint64) private _encryptedBalances;

    /// @notice Aggregate of all shielded amounts (encrypted – contract can add/sub but not read).
    euint64 private _encryptedTotalShielded;

    /**
     * @notice Tracks pending unshield requests awaiting Gateway decryption callback.
     *
     * key   = requestId returned by Gateway.requestDecrypt
     * value = PendingUnshield struct
     */
    struct PendingUnshield {
        address sender;
        address recipient;
    }
    mapping(uint256 => PendingUnshield) public pendingUnshields;

    // ── Events ───────────────────────────────────────────────────────────────────

    /// @notice Emitted when tokens are deposited into the confidential pool.
    /// @dev  `amount` is intentionally public – the shield step is not private.
    event Shielded(address indexed account, uint64 amount);

    /// @notice Emitted when an unshield is requested (amount unknown until callback).
    event UnshieldRequested(address indexed sender, address indexed recipient, uint256 indexed requestId);

    /// @notice Emitted by the Gateway callback once the ERC-20 transfer is complete.
    /// @dev  `amount` is revealed here because it is leaving the confidential pool.
    event Unshielded(address indexed sender, address indexed recipient, uint64 amount);

    /**
     * @notice Emitted when a confidential transfer occurs.
     * @dev  No amount is logged. An observer only knows a transfer happened between
     *       `from` and `to`.  The amount remains encrypted.
     */
    event Transfer(address indexed from, address indexed to);

    // ── Constructor ──────────────────────────────────────────────────────────────

    constructor(
        address _underlying,
        string memory _name,
        string memory _symbol,
        address _initialOwner
    ) Ownable(_initialOwner) {
        underlying = IERC20(_underlying);
        name = _name;
        symbol = _symbol;
    }

    // ── External: Shield ─────────────────────────────────────────────────────────

    /**
     * @notice Deposit `amount` of the underlying ERC-20 and credit an equal encrypted balance.
     *
     * @dev The shield amount is PUBLIC – the user transfers from their public wallet, so the
     *      blockchain already knows how many tokens entered the pool.  Privacy begins from the
     *      moment of the first `transfer()` call inside the pool.
     *
     *      Caller must approve this contract for at least `amount` before calling.
     *
     * @param amount Plain-text uint64 (underlying token's smallest unit).
     */
    function shield(uint64 amount) external nonReentrant {
        require(amount > 0, "ConfidentialToken: amount must be > 0");

        underlying.safeTransferFrom(msg.sender, address(this), amount);

        // Initialise balance if first shield; otherwise add.
        if (!TFHE.isInitialized(_encryptedBalances[msg.sender])) {
            _encryptedBalances[msg.sender] = TFHE.asEuint64(amount);
        } else {
            _encryptedBalances[msg.sender] = TFHE.add(_encryptedBalances[msg.sender], amount);
        }

        // Grant ACL access so the owner can re-encrypt their own balance.
        TFHE.allow(_encryptedBalances[msg.sender], address(this));
        TFHE.allow(_encryptedBalances[msg.sender], msg.sender);

        // Update encrypted total (owner can observe this via re-encryption).
        if (!TFHE.isInitialized(_encryptedTotalShielded)) {
            _encryptedTotalShielded = TFHE.asEuint64(amount);
        } else {
            _encryptedTotalShielded = TFHE.add(_encryptedTotalShielded, amount);
        }
        TFHE.allow(_encryptedTotalShielded, address(this));
        TFHE.allow(_encryptedTotalShielded, owner());

        emit Shielded(msg.sender, amount);
    }

    // ── External: Confidential Transfer ─────────────────────────────────────────

    /**
     * @notice Transfer an encrypted amount to `to` within the confidential pool.
     *
     * @dev  The amount is NEVER decrypted by the contract.  TFHE arithmetic verifies
     *       that `amount <= _encryptedBalances[msg.sender]` homomorphically and uses
     *       TFHE.select to conditionally apply the transfer (avoids reverting which
     *       would leak information).
     *
     *       `encryptedAmount` and `inputProof` must be produced by fhevmjs:
     *         const input = instance.createEncryptedInput(contractAddress, signerAddress);
     *         input.add64(amountInSmallestUnit);
     *         const { handles, inputProof } = await input.encrypt();
     *
     * @param to              Recipient address (must have a shielded balance on this contract).
     * @param encryptedAmount The ciphertext handle produced by fhevmjs (bytes32 / einput).
     * @param inputProof      Proof bytes produced by fhevmjs alongside the handle.
     */
    function transfer(
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (bool) {
        require(to != address(0), "ConfidentialToken: transfer to zero address");
        require(to != msg.sender, "ConfidentialToken: self-transfer not allowed");
        require(TFHE.isInitialized(_encryptedBalances[msg.sender]), "ConfidentialToken: no shielded balance");

        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);

        // Homomorphic balance check: transfer only if sender has enough.
        // This never reverts on insufficient balance – instead it transfers 0.
        // This is intentional: reverting with "insufficient balance" leaks information.
        ebool canTransfer = TFHE.le(amount, _encryptedBalances[msg.sender]);
        euint64 actualAmount = TFHE.select(canTransfer, amount, TFHE.asEuint64(0));

        _encryptedBalances[msg.sender] = TFHE.sub(_encryptedBalances[msg.sender], actualAmount);
        TFHE.allow(_encryptedBalances[msg.sender], address(this));
        TFHE.allow(_encryptedBalances[msg.sender], msg.sender);

        if (!TFHE.isInitialized(_encryptedBalances[to])) {
            _encryptedBalances[to] = actualAmount;
        } else {
            _encryptedBalances[to] = TFHE.add(_encryptedBalances[to], actualAmount);
        }
        TFHE.allow(_encryptedBalances[to], address(this));
        TFHE.allow(_encryptedBalances[to], to);

        // No amount in the event – amount is encrypted.
        emit Transfer(msg.sender, to);
        return true;
    }

    // ── External: Unshield (two-step via Gateway) ────────────────────────────────

    /**
     * @notice Request an unshield: decrypt the amount via the Gateway, then send underlying ERC-20.
     *
     * @dev  The amount is encrypted on input.  The Zama Gateway decrypts it off-chain and
     *       calls back `callbackUnshield` with the plain value.  The two-step design means
     *       the on-chain state change (balance deduction) happens in this function, but the
     *       ERC-20 transfer happens in the callback.
     *
     *       If the caller does not have enough balance, TFHE.select returns 0 and the ERC-20
     *       transfer in the callback will be a no-op (0 tokens sent).
     *
     * @param encryptedAmount Encrypted withdrawal amount from fhevmjs.
     * @param inputProof      Proof bytes from fhevmjs.
     * @param recipient       Public address to receive the unwrapped ERC-20 tokens.
     */
    function requestUnshield(
        einput encryptedAmount,
        bytes calldata inputProof,
        address recipient
    ) external nonReentrant {
        require(recipient != address(0), "ConfidentialToken: recipient is zero address");
        require(TFHE.isInitialized(_encryptedBalances[msg.sender]), "ConfidentialToken: no shielded balance");

        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);

        // Homomorphic check; clamp to 0 if insufficient (same reasoning as transfer).
        ebool canUnshield = TFHE.le(amount, _encryptedBalances[msg.sender]);
        euint64 actualAmount = TFHE.select(canUnshield, amount, TFHE.asEuint64(0));

        // Deduct from balance before the async callback to prevent double-spend.
        _encryptedBalances[msg.sender] = TFHE.sub(_encryptedBalances[msg.sender], actualAmount);
        TFHE.allow(_encryptedBalances[msg.sender], address(this));
        TFHE.allow(_encryptedBalances[msg.sender], msg.sender);

        // Update total shielded.
        _encryptedTotalShielded = TFHE.sub(_encryptedTotalShielded, actualAmount);
        TFHE.allow(_encryptedTotalShielded, address(this));
        TFHE.allow(_encryptedTotalShielded, owner());

        // Allow the Gateway to access the encrypted amount for decryption.
        TFHE.allowTransient(actualAmount, address(Gateway));

        uint256[] memory handles = new uint256[](1);
        handles[0] = Gateway.toUint256(actualAmount);

        uint256 requestId = Gateway.requestDecrypt(
            handles,
            this.callbackUnshield.selector,
            0,     // msgValue: no ETH passed to callback
            block.timestamp + 1 hours, // maxTimestamp
            false  // passSignaturesToCaller: not needed here
        );

        pendingUnshields[requestId] = PendingUnshield({
            sender: msg.sender,
            recipient: recipient
        });

        emit UnshieldRequested(msg.sender, recipient, requestId);
    }

    /**
     * @notice Gateway callback – called by the Zama Gateway after decrypting the unshield amount.
     *
     * @dev  Only the Gateway contract can call this function (enforced by `onlyGateway`).
     *
     * @param requestId       ID returned by Gateway.requestDecrypt in requestUnshield.
     * @param decryptedAmount Plain-text amount (decrypted by Gateway nodes).
     */
    function callbackUnshield(
        uint256 requestId,
        uint64 decryptedAmount
    ) external onlyGateway {
        PendingUnshield memory pending = pendingUnshields[requestId];
        require(pending.recipient != address(0), "ConfidentialToken: unknown requestId");

        delete pendingUnshields[requestId];

        if (decryptedAmount > 0) {
            underlying.safeTransfer(pending.recipient, decryptedAmount);
        }

        emit Unshielded(pending.sender, pending.recipient, decryptedAmount);
    }

    // ── Read ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the encrypted balance handle for `account`.
     *
     * @dev  This returns the ciphertext handle (a uint256 pointing to a ciphertext on Zama nodes).
     *       The caller can only READ the actual balance by performing a re-encryption request
     *       off-chain using fhevmjs.reencrypt() with a key pair they control, after the contract
     *       has granted them access via TFHE.allow.
     */
    function encryptedBalanceOf(address account) external view returns (euint64) {
        return _encryptedBalances[account];
    }

    /**
     * @notice Returns the encrypted total of all shielded tokens.
     *
     * @dev  Only the contract owner has ACL access to re-encrypt this value.
     */
    function encryptedTotalShielded() external view returns (euint64) {
        return _encryptedTotalShielded;
    }

    // ── Emergency ────────────────────────────────────────────────────────────────

    /**
     * @notice Owner-only: recover accidentally sent ERC-20 tokens (not the underlying).
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(underlying), "ConfidentialToken: cannot rescue underlying");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
