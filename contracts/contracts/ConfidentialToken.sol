// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  ConfidentialToken
 * @notice Shield/unshield wrapper that gives a public ERC-20 an FHE-encrypted
 *         balance layer using Zama fhEVM v0.6 (https://docs.zama.ai/fhevm).
 *
 * Deployment requirements
 * ───────────────────────
 * Must be deployed on a network running Zama's fhEVM precompiles:
 *   - Ethereum Sepolia (Zama deployment, chainId 11155111)
 *   - Zama Devnet (chainId 9000)
 *
 * This contract inherits SepoliaZamaFHEVMConfig + SepoliaZamaGatewayConfig which
 * wire the pre-deployed system contract addresses in the constructor.
 *
 * Privacy model
 * ─────────────
 * - shield(uint64 amount)      : deposit amount is PUBLIC (comes from public ERC-20)
 * - transfer(…)                : amount is ENCRYPTED via fhevmjs before the call
 * - requestUnshield(…)         : amount is ENCRYPTED; Gateway decrypts async → callback
 *
 * The encrypted balance for each address is a euint64 handle.
 * Observers see only addresses and that a transfer occurred — not amounts.
 * To read one's own balance, call encryptedBalanceOf() and pass the returned handle
 * to fhevmjs.instance.reencrypt() with an EIP-712 signed keypair.
 */

import {TFHE, euint64, einput, ebool} from "fhevm/lib/TFHE.sol";
import {SepoliaZamaFHEVMConfig} from "fhevm/config/ZamaFHEVMConfig.sol";
import {SepoliaZamaGatewayConfig} from "fhevm/config/ZamaGatewayConfig.sol";
import {GatewayCaller} from "fhevm/gateway/GatewayCaller.sol";
import {Gateway} from "fhevm/gateway/lib/Gateway.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ConfidentialToken is
    SepoliaZamaFHEVMConfig,
    SepoliaZamaGatewayConfig,
    GatewayCaller,
    Ownable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    // ── Immutable state ────────────────────────────────────────────────────────

    IERC20 public immutable underlying;
    string public name;
    string public symbol;

    // ── Encrypted state ────────────────────────────────────────────────────────

    /**
     * @dev euint64 handle → ciphertext maintained by Zama fhEVM nodes.
     *      The handle is public; only ACL-authorised addresses can re-encrypt
     *      it into plaintext (using fhevmjs.reencrypt).
     */
    mapping(address => euint64) private _encryptedBalances;

    /// @dev Running sum of all shielded tokens (encrypted).
    euint64 private _encryptedTotalShielded;

    // ── Pending unshields ──────────────────────────────────────────────────────

    struct PendingUnshield {
        address sender;
        address recipient;
    }
    mapping(uint256 => PendingUnshield) public pendingUnshields;

    // ── Events ─────────────────────────────────────────────────────────────────

    /// @notice Deposited `amount` tokens (plaintext – shield step is not private).
    event Shielded(address indexed account, uint64 amount);

    /// @notice Withdrawal requested. Amount is unknown until Gateway callback.
    event UnshieldRequested(
        address indexed sender,
        address indexed recipient,
        uint256 indexed requestId
    );

    /// @notice Withdrawal complete (amount revealed here because it left the pool).
    event Unshielded(
        address indexed sender,
        address indexed recipient,
        uint64 amount
    );

    /**
     * @notice Confidential transfer occurred.
     * @dev    No `amount` field. Amount is permanently encrypted.
     */
    event Transfer(address indexed from, address indexed to);

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(
        address _underlying,
        string memory _name,
        string memory _symbol,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_underlying != address(0), "ConfidentialToken: zero underlying");
        underlying = IERC20(_underlying);
        name = _name;
        symbol = _symbol;
    }

    // ── Shield ─────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit `amount` of the underlying ERC-20 into the confidential pool.
     *
     * @dev The deposited `amount` is plaintext — it is visible on-chain because
     *      it comes from the user's public ERC-20 wallet.  Privacy begins from
     *      the first `transfer()` call after shielding.
     *
     *      Caller must call underlying.approve(address(this), amount) first.
     *
     * @param amount  Number of tokens (uint64, in the underlying token's smallest unit).
     */
    function shield(uint64 amount) external nonReentrant {
        require(amount > 0, "ConfidentialToken: amount must be > 0");

        underlying.safeTransferFrom(msg.sender, address(this), amount);

        // trivialEncrypt wraps a plaintext uint64 into an encrypted euint64.
        // The resulting ciphertext is trivial (known to everyone) but allows
        // the handle to participate in further FHE arithmetic.
        if (!TFHE.isInitialized(_encryptedBalances[msg.sender])) {
            _encryptedBalances[msg.sender] = TFHE.asEuint64(uint256(amount));
        } else {
            _encryptedBalances[msg.sender] = TFHE.add(
                _encryptedBalances[msg.sender],
                TFHE.asEuint64(uint256(amount))
            );
        }

        TFHE.allow(_encryptedBalances[msg.sender], address(this));
        TFHE.allow(_encryptedBalances[msg.sender], msg.sender);

        if (!TFHE.isInitialized(_encryptedTotalShielded)) {
            _encryptedTotalShielded = TFHE.asEuint64(uint256(amount));
        } else {
            _encryptedTotalShielded = TFHE.add(
                _encryptedTotalShielded,
                TFHE.asEuint64(uint256(amount))
            );
        }
        TFHE.allow(_encryptedTotalShielded, address(this));
        TFHE.allow(_encryptedTotalShielded, owner());

        emit Shielded(msg.sender, amount);
    }

    // ── Confidential Transfer ──────────────────────────────────────────────────

    /**
     * @notice Transfer an encrypted amount within the pool.
     *
     * @dev The caller must produce `encryptedAmount` and `inputProof` using
     *      fhevmjs on the client:
     *
     *        const input = instance.createEncryptedInput(contractAddress, signerAddress);
     *        input.add64(amountInSmallestUnit);
     *        const { handles, inputProof } = await input.encrypt();
     *        // handles[0] → encryptedAmount (bytes32)
     *        // inputProof  → inputProof      (bytes)
     *
     *      TFHE.le checks balance ≥ amount without revealing either value.
     *      TFHE.select conditionally applies the debit/credit (never reverts on
     *      insufficient balance, because a revert would leak information).
     *
     * @param to              Recipient (must be a non-zero address != sender).
     * @param encryptedAmount fhevmjs-produced ciphertext handle (bytes32 / einput).
     * @param inputProof      fhevmjs-produced input proof.
     */
    function transfer(
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (bool) {
        require(to != address(0), "ConfidentialToken: transfer to zero address");
        require(to != msg.sender, "ConfidentialToken: self-transfer not allowed");
        require(
            TFHE.isInitialized(_encryptedBalances[msg.sender]),
            "ConfidentialToken: sender has no shielded balance"
        );

        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);

        // Homomorphic balance check: silently transfer 0 if insufficient.
        ebool canTransfer = TFHE.le(amount, _encryptedBalances[msg.sender]);
        euint64 actualAmount = TFHE.select(canTransfer, amount, TFHE.asEuint64(0));

        _encryptedBalances[msg.sender] = TFHE.sub(
            _encryptedBalances[msg.sender],
            actualAmount
        );
        TFHE.allow(_encryptedBalances[msg.sender], address(this));
        TFHE.allow(_encryptedBalances[msg.sender], msg.sender);

        if (!TFHE.isInitialized(_encryptedBalances[to])) {
            _encryptedBalances[to] = actualAmount;
        } else {
            _encryptedBalances[to] = TFHE.add(_encryptedBalances[to], actualAmount);
        }
        TFHE.allow(_encryptedBalances[to], address(this));
        TFHE.allow(_encryptedBalances[to], to);

        emit Transfer(msg.sender, to);
        return true;
    }

    // ── Unshield (async via Gateway) ───────────────────────────────────────────

    /**
     * @notice Request withdrawal of an encrypted amount back to a public address.
     *
     * @dev Two-step process:
     *       1. This function deducts the encrypted amount and asks the Gateway
     *          to decrypt it.
     *       2. The Gateway calls `callbackUnshield` with the plain uint64.
     *          The ERC-20 transfer happens there.
     *
     *      On Zama Devnet the Gateway callback fires within ~1-2 blocks.
     *
     *      Caller must produce encryptedAmount + inputProof with fhevmjs.
     */
    function requestUnshield(
        einput encryptedAmount,
        bytes calldata inputProof,
        address recipient
    ) external nonReentrant {
        require(recipient != address(0), "ConfidentialToken: zero recipient");
        require(
            TFHE.isInitialized(_encryptedBalances[msg.sender]),
            "ConfidentialToken: sender has no shielded balance"
        );

        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);

        ebool canUnshield = TFHE.le(amount, _encryptedBalances[msg.sender]);
        euint64 actualAmount = TFHE.select(canUnshield, amount, TFHE.asEuint64(0));

        // Deduct before the async callback to prevent re-entrancy / double-spend.
        _encryptedBalances[msg.sender] = TFHE.sub(
            _encryptedBalances[msg.sender],
            actualAmount
        );
        TFHE.allow(_encryptedBalances[msg.sender], address(this));
        TFHE.allow(_encryptedBalances[msg.sender], msg.sender);

        _encryptedTotalShielded = TFHE.sub(_encryptedTotalShielded, actualAmount);
        TFHE.allow(_encryptedTotalShielded, address(this));
        TFHE.allow(_encryptedTotalShielded, owner());

        // Grant Gateway transient ACL access to decrypt `actualAmount`.
        TFHE.allowTransient(actualAmount, Gateway.gatewayContractAddress());

        uint256[] memory handles = new uint256[](1);
        handles[0] = Gateway.toUint256(actualAmount);

        uint256 requestId = Gateway.requestDecryption(
            handles,
            this.callbackUnshield.selector,
            0,
            block.timestamp + 1 hours,
            false // passSignaturesToCaller
        );

        pendingUnshields[requestId] = PendingUnshield({
            sender: msg.sender,
            recipient: recipient
        });

        emit UnshieldRequested(msg.sender, recipient, requestId);
    }

    /**
     * @notice Gateway callback – called after decrypting the unshield amount.
     * @dev    Only the Gateway contract can call this (enforced by `onlyGateway`).
     * @param  requestId        ID returned by Gateway.requestDecryption.
     * @param  decryptedAmount  Plain uint64 produced by the Gateway.
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

    // ── Read ───────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the encrypted balance handle for `account`.
     *
     * @dev The returned uint256 is a ciphertext handle.  To get the plaintext
     *      balance, use fhevmjs.reencrypt() — see src/hooks/useTokenBalance.ts.
     */
    function encryptedBalanceOf(address account) external view returns (euint64) {
        return _encryptedBalances[account];
    }

    /// @notice Encrypted running total (only owner has ACL access).
    function encryptedTotalShielded() external view returns (euint64) {
        return _encryptedTotalShielded;
    }

    // ── Emergency ──────────────────────────────────────────────────────────────

    /// @notice Rescue accidentally-sent ERC-20 tokens (not the underlying).
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(underlying), "ConfidentialToken: cannot rescue underlying");
        IERC20(token).safeTransfer(owner(), amount);
    }
}
