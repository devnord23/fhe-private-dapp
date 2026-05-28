# Production TODO — ConfidentialFi

Items that MUST be resolved before deploying with real funds.
Ordered by severity within each category.

---

## 🔴 CRITICAL — Do Not Deploy Without These

### C-1: Remove or disable relayer withdrawal auto-complete

**File:** `relayer/src/handlers/withdrawalRequested.ts`

The MVP relayer auto-completes Base withdrawals after N blocks **without verifying** the Zama-side unshield. This creates a double-spend: a user could receive funds on Base AND retain shielded balance on Zama.

**Action:**
1. Set `WITHDRAWAL_AUTO_COMPLETE_DELAY_BLOCKS = 0` in production to disable auto-complete entirely.
2. Implement Zama `Unshielded` event monitoring in `processPendingWithdrawals()`.
3. Only call `relayerCompleteWithdrawal()` after matching `Unshielded(sender, recipient=relayer, amount)` is confirmed on Zama fhEVM.

---

### C-2: Remove `emergencyWithdraw()` from BaseVault or add timelock

**File:** `contracts/contracts/BaseVault.sol`, line 393

`emergencyWithdraw()` lets any user bypass the relayer and withdraw their full available balance directly. In testnet this is a safety valve. In production:
- It bypasses the bridge accounting (Zama-side balance is NOT reduced)
- A user who shielded on Zama AND emergency-withdraws on Base has double the value

**Action:** Either:
- Remove `emergencyWithdraw()` from the production contract, OR
- Add a `onlyOwner` modifier and make it a protocol-level emergency only, OR
- Add a 7-day timelock before the withdrawal executes (enough time to verify Zama-side state)

---

### C-3: Replace relayer private key with on-chain bridge contract

**File:** `relayer/src/chains.ts`, `RELAYER_PRIVATE_KEY`

A compromised relayer private key allows an attacker to call `relayerCompleteWithdrawal()` for arbitrary pending withdrawals (combined with C-1, this enables a full double-spend attack).

**Action:**
1. Replace the `relayer` address in BaseVault with a bridge contract address.
2. The bridge contract verifies a cross-chain message proof before calling `completeWithdrawal`.
3. Use LayerZero, Hyperlane, or a custom verifier with on-chain proof.

---

### C-4: Fix Gateway timeout in ConfidentialToken.requestUnshield

**File:** `contracts/contracts/ConfidentialToken.sol`

If the Zama Gateway doesn't call `callbackUnshield` within 1 hour, the user's shielded balance is permanently lost (deducted before the Gateway call, never refunded).

**Action:**
1. Store the encrypted `actualAmount` handle in `pendingUnshields`.
2. Add a `recoverExpiredUnshield(requestId)` function callable by the user after the maxTimestamp passes.
3. The recovery function re-adds the encrypted amount to the user's balance.

---

### C-5: Handle fee-on-transfer tokens in BaseVault

**File:** `contracts/contracts/BaseVault.sol`, `deposit()`

Tokens with transfer fees cause the vault to credit more than it receives, eventually causing last-depositor withdrawal failures.

**Action:** Use balance-diff deposit accounting:
```solidity
uint256 before = IERC20(token).balanceOf(address(this));
IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
uint256 received = IERC20(token).balanceOf(address(this)) - before;
_available[msg.sender][token] += received;
emit DepositCreated(msg.sender, token, received, strategyId); // use received, not amount
```

---

## 🟡 HIGH — Required Before Mainnet

### H-1: Third-party security audit

No external audit has been conducted. All contracts (BaseVault, ConfidentialToken, ConfidentialStrategyAgent) must be audited by a reputable security firm before mainnet deployment.

**Scope:** Smart contracts, fhEVM interaction patterns, Gateway callback safety.

---

### H-2: Make `protocolOwner` in ConfidentialStrategyAgent changeable

**File:** `contracts/contracts/ConfidentialStrategyAgent.sol`

```solidity
address public immutable protocolOwner;
```

An immutable owner with no transfer mechanism means a lost or compromised key results in permanent loss of admin control.

**Action:** Replace `immutable` with a `Ownable2Step` pattern:
```solidity
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
```

---

### H-3: Add token allowlist to BaseVault

**File:** `contracts/contracts/BaseVault.sol`

Currently accepts any ERC-20. A malicious token with a reentrancy in `transferFrom` could theoretically attack the vault (though `nonReentrant` mitigates most vectors). Additionally, tokens with unusual behaviors (rebasing, fee-on-transfer, blacklisting) can cause accounting issues.

**Action:** Add an owner-managed token allowlist:
```solidity
mapping(address => bool) public allowedTokens;
// In deposit(): require(allowedTokens[token], "BaseVault: token not allowed");
```

---

### H-4: Add cancellation timeout to BaseVault

**File:** `contracts/contracts/BaseVault.sol`, `cancelPendingWithdrawal()`

Without a minimum pending period, users can spam `requestWithdrawal + cancelPendingWithdrawal` to generate relayer events at no cost, wasting relayer gas.

**Action:** Track pending timestamps and require a minimum delay (e.g., 1 hour) before cancellation.

---

### H-5: Secure relayer key management

**File:** `relayer/.env.example`

In production, the relayer private key must not be stored in a `.env` file on disk.

**Action:**
- Use AWS Secrets Manager, HashiCorp Vault, or GCP Secret Manager
- Or use a hardware security module (HSM) / cloud HSM
- Document the key rotation process

---

### H-6: Replace JSON state file with SQLite

**File:** `relayer/src/state.ts`

The JSON state file is not crash-safe, grows without bound, and cannot be shared across multiple relayer instances.

**Action:**
- Use SQLite with WAL mode for single-instance production
- Use PostgreSQL for multi-instance production
- Implement periodic pruning of old `processedEvents` (keep only last N blocks)

---

### H-7: Add `START_BLOCK` configuration to relayer

**File:** `relayer/src/state.ts`, `emptyState()`

A fresh state starts from block 0, which will time out or be rate-limited by public RPCs.

**Action:**
```typescript
lastProcessedBlock: parseInt(process.env.START_BLOCK ?? "0", 10),
```
Document the deployment block in `contracts/.env.example`.

---

## 🟢 MEDIUM — Required Before Significant TVL

### M-1: Add Confirmation Dialog for Irreversible Reveals

**File:** `src/components/strategy/StrategyCard.tsx`

No confirmation dialog before `requestEvaluationReveal()`. Users may accidentally make strategy outcomes permanently public.

**Action:** Add a modal with explicit "Type CONFIRM to proceed" before any reveal operation.

---

### M-2: Fix "Privacy Begins After Shield" badge text

**File:** `src/components/transfer/TransferForm.tsx`

The shield amount appears in the `Shielded` event as plaintext. The badge is slightly misleading.

**Action:** Change to `"Transfer amounts private after shielding"`.

---

### M-3: Distinct event for emergency withdrawal

**File:** `contracts/contracts/BaseVault.sol`

`emergencyWithdraw()` emits `WithdrawalCompleted`, conflating it with relayer-confirmed withdrawals in monitoring.

**Action:** Add `EmergencyWithdrawal(address indexed user, address indexed token, uint256 amount)`.

---

### M-4: Surface Zama Gateway trust assumption in frontend

**File:** `src/components/strategy/SecurityNote.tsx`

The re-encryption model is described but the Gateway's role in ALL decryption (unshields, reveals) is not explicitly stated.

**Action:** Add: "All FHE decryption (unshields, reveals, balance viewing) depends on Zama's Gateway being honest and available. This is not fully trustless."

---

### M-5: Add chain-context warning when on Base Sepolia

FHE features only work on Zama Devnet. The dashboard doesn't prominently warn when the user is on Base Sepolia (where FHE features are inactive).

**Action:** Show inline callout on Dashboard/Transfer pages when connected chain is Base Sepolia.

---

## 📋 FHE-Specific TODOs

### F-1: Implement re-encryption balance display

**File:** `src/hooks/useTokenBalance.ts`

Currently shows "ENCRYPTED" and the handle. Users cannot see their actual balance.

**Action:** Implement the full re-encryption flow:
1. `generateKeypair()` → NaCl keypair
2. `createEIP712(publicKey, contractAddress)` → EIP-712
3. `walletClient.signTypedData(eip712)` → signature
4. `instance.reencrypt(handle, ...)` → plaintext bigint

---

### F-2: Implement shield() bridging in relayer

**File:** `relayer/src/handlers/depositCreated.ts`

When `DepositCreated` fires, the relayer should call `ConfidentialToken.shield(amount)` on Zama fhEVM. This requires:
- fhevmjs running in Node.js with proper WASM support
- OR a dedicated FHE-capable service
- OR user manually shields from the frontend

---

### F-3: ERC-20 approval step before shield

**File:** `src/components/transfer/TransferForm.tsx`

The shield tab has no ERC-20 `approve` step. Users must pre-approve the contract externally.

**Action:** Add approve → shield two-step flow (similar to `VaultDeposit.tsx`).

---

## 🏗️ Infrastructure TODOs

### I-1: Monitoring and alerting

- Alert when pending withdrawals are older than `WITHDRAWAL_AUTO_COMPLETE_DELAY_BLOCKS * 2`
- Alert on relayer wallet balance below gas threshold
- Alert on RPC errors exceeding retry budget
- Alert on state file size exceeding 50 MB

### I-2: Relayer health endpoint

Add an HTTP health endpoint (`/health`) that returns:
- Relayer wallet balance (ETH)
- Last processed block
- Count of pending withdrawals
- Age of oldest pending withdrawal

### I-3: Deployment verification

After every deployment:
1. Verify `BaseVault.relayer()` equals the intended relayer address
2. Verify `ConfidentialStrategyAgent.protocolOwner()` equals the intended owner
3. Verify `ConfidentialToken.underlying()` equals the intended token
4. Run the test suite against the deployed contracts

### I-4: Private key rotation procedure

Document how to:
1. Rotate the relayer private key (set new relayer address in vault, fund new wallet)
2. Rotate the deployer key
3. Transfer ownership of all contracts to a multisig
