# Security Analysis — ConfidentialFi

**Status: Testnet / MVP. This codebase has NOT been audited by a third-party security firm.**

This document is the result of an internal code review. It documents real vulnerabilities, trust assumptions, and known limitations across all three layers of the stack. Every finding is traceable to specific code locations.

---

## Scope

| Component | File(s) | Review Status |
|---|---|---|
| BaseVault.sol | `contracts/contracts/BaseVault.sol` | Internal review |
| ConfidentialToken.sol | `contracts/contracts/ConfidentialToken.sol` | Internal review |
| ConfidentialStrategyAgent.sol | `contracts/contracts/ConfidentialStrategyAgent.sol` | Internal review |
| Relayer | `relayer/src/**` | Internal review |
| Frontend | `src/**` | Internal review |

**No external audit has been performed. Do not deploy with real funds.**

---

## 1. BaseVault.sol

### 1.1 — Fee-on-Transfer Token Incompatibility

**Severity: HIGH**
**Location:** `deposit()`, line 252–253

```solidity
IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
_available[msg.sender][token] += amount;  // records full amount
```

If the deposited token charges a transfer fee (e.g. PAXG, some deflationary tokens), the vault receives `amount - fee` but credits `amount` to the user. This means `sum(_available + _pending) > vault.vaultBalance(token)`. When the last user withdraws, the transfer will revert because the vault doesn't hold enough tokens.

**Impact:** Last depositors cannot withdraw. Incorrect accounting across all users.

**Mitigation (production):** Either whitelist only known non-fee-on-transfer tokens, or use a receive-and-balance-diff pattern:
```solidity
uint256 before = IERC20(token).balanceOf(address(this));
IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
uint256 received = IERC20(token).balanceOf(address(this)) - before;
_available[msg.sender][token] += received; // use actual received amount
```

---

### 1.2 — `emergencyWithdraw()` Emits `WithdrawalCompleted` (Misleading Event)

**Severity: LOW (documentation / monitoring risk)**
**Location:** `emergencyWithdraw()`, line 400

```solidity
emit WithdrawalCompleted(msg.sender, token, available);
```

`WithdrawalCompleted` is semantically "the relayer completed an unshield-confirmed withdrawal." An emergency withdrawal is a different action (no relayer, no Zama-side confirmation). Using the same event conflates two distinct operations in monitoring tools and event indexers.

**Impact:** Off-chain monitors may incorrectly treat emergency withdrawals as completed relayer-confirmed withdrawals.

**Mitigation (production):** Add a distinct `EmergencyWithdrawal(address indexed user, address indexed token, uint256 amount)` event.

---

### 1.3 — `cancelPendingWithdrawal()` Has No Timeout

**Severity: MEDIUM (production design risk)**
**Location:** `cancelPendingWithdrawal()`, line 366–379

In the current implementation, users can call `requestWithdrawal()` immediately followed by `cancelPendingWithdrawal()` with no delay. In the MVP (no bridge), this is benign. In production, if the relayer is expected to trigger Zama-side unshields on `WithdrawalRequested` events, a user could repeatedly request-and-cancel to generate relayer events they never intend to fulfill, wasting relayer gas.

**Impact:** Griefing attack against the relayer; no financial loss to vault.

**Mitigation (production):** Add a minimum pending period (e.g. 1 hour) before cancellation is allowed:
```solidity
mapping(address => mapping(address => uint256)) private _pendingTimestamp;
// In cancelPendingWithdrawal:
require(block.timestamp >= _pendingTimestamp[msg.sender][token] + MIN_CANCEL_DELAY, "too soon");
```

---

### 1.4 — `onlyRelayer` Includes the Contract Owner

**Severity: MEDIUM (trust assumption)**
**Location:** Modifier `onlyRelayer`, line 191–197

```solidity
modifier onlyRelayer() {
    require(
        msg.sender == relayer || msg.sender == owner(),  // ← owner is always allowed
        "BaseVault: caller is not the relayer"
    );
    _;
}
```

The contract owner can always call `relayerCompleteWithdrawal()` regardless of whether the relayer has set up the bridge. This means the contract owner can release any pending withdrawal to any user at any time, without any cross-chain verification.

**Impact (production):** Owner could complete withdrawals without Zama-side verification (intentional in MVP; must be eliminated in production).

**Mitigation (production):** Remove the `owner()` fallback and replace the relayer address with a permissioned bridge contract that includes cryptographic proof of the cross-chain message.

---

### 1.5 — `setRelayer(address(0))` Is Allowed

**Severity: LOW**
**Location:** `setRelayer()`, line 222–225

No zero-address check exists. Setting `relayer = address(0)` does NOT brick the contract (the `owner()` fallback in `onlyRelayer` prevents a DoS), but it emits a `RelayerSet(address(0))` event that could confuse monitoring systems.

**Mitigation:** Document that `address(0)` is a valid "disabled" state for the external relayer (owner-only fallback remains active). Add a comment to this effect.

---

### 1.6 — No Invariant Check: `vaultBalance >= sum(available + pending)`

**Severity: MEDIUM (monitoring gap)**

The contract has no on-chain invariant that verifies the actual ERC-20 balance equals the sum of all `_available` and `_pending` values. Discrepancies (from fee-on-transfer tokens, direct token sends, etc.) are silent.

**Mitigation:** Add a view function that exposes the accounting discrepancy for off-chain monitoring. Note: no on-chain invariant can enumerate all users efficiently.

---

## 2. ConfidentialToken.sol

### 2.1 — Gateway Timeout: Unshielded Funds May Be Permanently Lost

**Severity: HIGH**
**Location:** `requestUnshield()`, line (Gateway.requestDecryption call)

```solidity
uint256 requestId = Gateway.requestDecryption(
    handles,
    this.callbackUnshield.selector,
    0,
    block.timestamp + 1 hours,  // maxTimestamp
    false
);
```

The encrypted balance is deducted **before** the Gateway call. If the Gateway never fires `callbackUnshield` within 1 hour (Gateway unreachable, Zama node outage, expired transaction), the user's shielded balance is reduced but no ERC-20 is released.

**Impact:** Loss of user funds (ERC-20 locked in contract, shielded balance reduced, no recovery path).

**Mitigation (production):**
1. Store the `actualAmount` (euint64) in `pendingUnshields` alongside sender/recipient.
2. After timeout, allow the user to call a `recoverExpiredUnshield(requestId)` function that adds back the pending amount to their balance.
3. Or use a longer timeout (e.g. 24 hours) to reduce the likelihood.

---

### 2.2 — `shield(uint64 amount)`: Maximum Deposit Is ~18.4 × 10^18 Units

**Severity: LOW (design constraint)**
**Location:** `shield()` function signature

The function accepts `uint64 amount`. For a token with 6 decimals (like USDC), max deposit is ~18,446,744 USDC. For a token with 18 decimals, max deposit is ~18.4 ETH. This is a TFHE storage limitation (euint64 stores up to 2^64 - 1).

**Impact:** Very large deposits require multiple transactions. Large DeFi protocols may find this restrictive.

**Mitigation:** Document the limit. If higher amounts are needed, use `euint128`.

---

### 2.3 — Pending Unshield Recipients Are Publicly Visible

**Severity: LOW (metadata leakage)**
**Location:** `pendingUnshields` mapping (public)

```solidity
mapping(uint256 => PendingUnshield) public pendingUnshields;
```

The `sender` and `recipient` addresses of pending unshields are publicly readable. An observer can see which address is receiving an unshield, even if they cannot see the amount.

**Impact:** Address-level privacy is NOT provided. Only amount privacy.

**Mitigation:** Accept as a design limitation and document clearly.

---

### 2.4 — Zama Gateway Is a Trusted Third Party

**Severity: HIGH (trust assumption, not a code bug)**
**Location:** All Gateway.requestDecryption calls

The Zama Gateway's Key Management System (KMS) holds the decryption keys. If Zama's KMS is compromised or coerced:
- All encrypted balances could be decrypted
- Gateway callbacks could be faked (with a compromised KMS verifier)

This is an inherent property of the Zama fhEVM system at its current maturity level.

**Impact:** Not fully trustless. Equivalent trust to a trusted hardware enclave (TEE).

**Mitigation:** This is a system-level property. As Zama matures toward threshold cryptography and decentralized key management, this trust assumption diminishes. Document clearly to users.

---

## 3. ConfidentialStrategyAgent.sol

### 3.1 — `protocolOwner` Is Immutable

**Severity: MEDIUM**
**Location:** `address public immutable protocolOwner;`

The protocol owner address cannot be changed. If the private key is compromised or lost, there is no ownership transfer mechanism.

**Impact:** Permanent loss of admin control (cannot authorize new agents, cannot upgrade contract).

**Mitigation (production):** Use a timelock + multisig as the `protocolOwner`, or implement `Ownable2Step` (OZ) for two-step ownership transfer.

---

### 3.2 — `ParameterRevealed` and `EvaluationRevealed` Events Are Permanent

**Severity: HIGH (user awareness)**
**Location:** `callbackParameterReveal`, `callbackEvaluationReveal`

When `requestParameterReveal()` or `requestEvaluationReveal()` is called, the revealed value is emitted in a blockchain event. This is **permanent and irreversible**. Every node, indexer, and blockchain explorer worldwide retains this data forever.

**Impact:** Accidental reveal cannot be undone.

**Mitigation:** The contracts warn extensively. The frontend should add a confirmation dialog:  
`"⚠️ This will permanently reveal [param] to all blockchain observers. This cannot be undone. Continue?"`  
No such confirmation dialog exists yet.

---

### 3.3 — Agent Timing Correlation Attack

**Severity: MEDIUM (metadata leakage)**
**Location:** `evaluateStrategy()` — public timestamp

```solidity
s.lastEvaluatedAt = block.timestamp;
emit EvaluationPerformed(strategyId, block.number);
```

A sophisticated observer can infer threshold neighborhoods by correlating:
- Frequency of `EvaluationPerformed` events with market data
- Changes in evaluation frequency (suggests approaching a threshold)
- Timing of `requestEvaluationReveal` calls (suggests result was significant)

**Impact:** Partial privacy leakage for strategies with regular evaluation cadences.

**Mitigation (partial):** Randomize evaluation timing. Use a fixed evaluation schedule regardless of market conditions. Never call `requestEvaluationReveal` close in time to the triggering market event.

---

## 4. Relayer

### 4.1 — Withdrawal Auto-Complete Without Zama Verification Is a Double-Spend

**Severity: CRITICAL (testnet-only but must be fixed for production)**
**Location:** `relayer/src/handlers/withdrawalRequested.ts`, `processPendingWithdrawals()`

The MVP relayer auto-completes withdrawals after `WITHDRAWAL_AUTO_COMPLETE_DELAY_BLOCKS` without verifying that the corresponding Zama-side balance was actually unshielded.

**Impact:** A user can:
1. Deposit 100 tokens on Base Sepolia.
2. Shield 100 tokens on Zama fhEVM (manually).
3. Request withdrawal on Base (pending = 100).
4. Wait for auto-complete → receive 100 tokens on Base.
5. Their shielded balance on Zama is STILL 100 (never unshielded).
6. Net result: user has 200 tokens where they started with 100.

This is a FULL DOUBLE-SPEND in MVP mode.

**Severity for testnet:** Low (no real value at risk).
**Severity for production:** Critical (must NEVER be deployed this way with real tokens).

**Mitigation (production):** Gate `relayerCompleteWithdrawal()` on a confirmed `Unshielded(sender, recipient=relayerAddress, amount)` event from the Zama fhEVM chain.

---

### 4.2 — Relayer Private Key Is a Single Point of Failure

**Severity: HIGH**
**Location:** `RELAYER_PRIVATE_KEY` in `.env`

The relayer's private key is stored in a `.env` file on the server running the relayer. If this file is compromised:
- An attacker could submit fraudulent `relayerCompleteWithdrawal` calls for arbitrary users
- This does NOT allow theft (funds go to the correct user, not the attacker), BUT it allows the attacker to drain the vault without actual Zama-side unshields (double-spend)

**Impact:** Combined with finding 4.1, a compromised relayer key enables theft by completing withdrawals without Zama verification.

**Mitigation:**
- Use a hardware security module (HSM) or cloud KMS for the relayer key
- Set `WITHDRAWAL_AUTO_COMPLETE_DELAY_BLOCKS = 0` in production (disable auto-complete entirely)
- Replace the relayer key with a smart contract address that requires on-chain proof

---

### 4.3 — State File Grows Without Bound

**Severity: LOW (operational)**
**Location:** `relayer/src/state.ts`, `processedEvents` record

The `processedEvents` record accumulates every processed event ID and never prunes old entries. After years of operation, the state file could grow to hundreds of MB.

**Impact:** Slow state file writes; eventual memory pressure.

**Mitigation (production):** Prune events older than N blocks (beyond any realistic chain reorg depth). Or switch to SQLite with an indexed events table.

---

### 4.4 — No Starting Block Configuration

**Severity: MEDIUM (operational)**
**Location:** `relayer/src/state.ts`, `emptyState()`

```typescript
lastProcessedBlock: 0,
```

If the state file is deleted or corrupted, the relayer starts from block 0 of Base Sepolia (genesis). Scanning millions of blocks via `getLogs` will likely time out or be rate-limited.

**Impact:** Relayer cannot restart cleanly after state corruption.

**Mitigation:** Add `START_BLOCK` env var and use it in `emptyState()`:
```typescript
lastProcessedBlock: parseInt(process.env.START_BLOCK ?? "0", 10),
```

---

### 4.5 — Relayer State File Is Not Crash-Safe

**Severity: LOW**
**Location:** `relayer/src/state.ts`, `save()`

The state is written with `writeFileSync` (atomic on POSIX via rename). However, the `processedEvents` flag is set in memory BEFORE the file is saved. A crash between `markEventProcessed()` and `save()` means the event will be retried on restart.

**Impact:** Events may be processed twice. For most handlers this is safe (on-chain check in `completeWithdrawal` provides idempotency), but the deposit accounting in `recordDeposit` would double-count. This is an accounting-only issue (no financial risk), but it could cause the relayer to log an inaccurate local ledger.

**Mitigation:** Mark events processed ONLY after successful save. Or use SQLite with transactions.

---

## 5. UI and Wording Audit

### 5.1 — "Privacy Begins After Shield" Overclaims

**Severity: LOW (user confusion risk)**
**Location:** `src/components/transfer/TransferForm.tsx`

```tsx
<Badge variant="info">Privacy Begins After Shield</Badge>
```

This is misleading. The amount deposited in `shield()` is **permanently visible** in the `Shielded(account, amount)` event on the Zama chain. Privacy for TRANSFER AMOUNTS begins after shielding, but the shield amount itself is public.

**Mitigation:** Change badge text to `"Transfer amounts private after shielding"` or add a tooltip: `"The shielded amount is visible in the Shielded event. Only subsequent transfer amounts are hidden."`

---

### 5.2 — No Confirmation Dialog for Irreversible Reveals

**Severity: MEDIUM (UX safety)**

The frontend has no confirmation dialog before calling `requestParameterReveal()` or `requestEvaluationReveal()`. A user clicking "Request Eval Reveal" without understanding the consequences will permanently expose their strategy outcome on-chain.

**Location:** `src/components/strategy/StrategyCard.tsx` — the "Request Eval Reveal" button has no confirmation.

**Mitigation:** Add an explicit modal: "⚠️ This will permanently reveal whether your strategy triggered to ALL blockchain observers. This action is irreversible. Type CONFIRM to proceed."

---

### 5.3 — Dashboard Claims Strategy Evaluation Privacy Without Qualification

**Severity: LOW**
**Location:** `src/app/dashboard/page.tsx`

The dashboard shows "TFHE Homomorphic Arithmetic" as "Real" and "No Plaintext On-chain" as a feature. These claims are accurate but only apply when using the Zama fhEVM network. If a user is connected to Base Sepolia (default chain), none of the FHE features are active. The UI does not make this distinction visible on the dashboard.

**Mitigation:** The `ChainBadge` component in the navbar partially addresses this by labeling the current layer. Consider adding an inline callout on the dashboard: "FHE features require Zama Devnet (chain 9000). You are currently on [ChainName]."

---

### 5.4 — Zama Gateway Trust Not Surfaced to Users

**Severity: MEDIUM (user awareness)**

The `SecurityNote` component on the Strategy page mentions re-encryption requires Zama KMS nodes but does not clearly state that ALL decryption operations (including unshield callbacks) depend on Zama's Gateway being trusted and operational.

**Mitigation:** Add to SecurityNote: "The Zama Gateway is a trusted third party. All FHE decryption (unshields, reveals, re-encryption) requires Zama's key management nodes to be honest and reachable. This is not fully trustless at current Zama maturity."

---

## 6. What Is and Is Not Private

### On-chain: Zama fhEVM side

| Data | Private? |
|---|---|
| Strategy parameter values | ✅ YES — encrypted as euint64, never on-chain in plaintext |
| Whether conditions were triggered (during silent eval) | ✅ YES — result stored as encrypted ebool |
| Transfer amounts between shielded accounts | ✅ YES — Transfer event has no amount |
| Shield amount | ❌ NO — Shielded(account, amount) event is plaintext |
| Unshield recipient | ❌ NO — Unshielded(sender, recipient, amount) is all plaintext |
| Strategy existence | ❌ NO — strategyId and owner are public |
| Evaluation timing | ❌ NO — block.timestamp is public |
| Revealed values | ❌ NO — permanently public after requestReveal |

### On-chain: Base Sepolia (BaseVault)

| Data | Private? |
|---|---|
| Deposit amounts | ❌ NO — DepositCreated(user, token, amount) is plaintext |
| Withdrawal amounts | ❌ NO — WithdrawalRequested(user, token, amount) is plaintext |
| Linked strategy IDs | ❌ NO — StrategyLinked(user, strategyId) is plaintext |
| User addresses | ❌ NO — always public on any EVM chain |

### Off-chain: Relayer

| Data | Private? |
|---|---|
| User deposit history | ❌ NO — stored in relayer state file in plaintext |
| User strategy mappings | ❌ NO — stored in relayer state file in plaintext |
| Relayer private key | Must be secret — compromise enables double-spend |

---

## 7. Responsible Disclosure

If you discover a security vulnerability in this codebase, please report it via the project's GitHub issue tracker, marked as **[SECURITY]**. Do not publicly disclose vulnerabilities until they have been acknowledged and addressed.

This project is testnet-only. There are no bug bounties at this time.
