# Launch Checklist — ConfidentialFi

Use this checklist before any deployment that will hold real user funds.
Items marked **[BLOCKER]** must be completed. Others are strongly recommended.

---

## Phase 0: Testnet (Current State)

Status of the current repository on testnet:

- [x] BaseVault.sol compiled and tested (82 passing, 9 pending FHE tests)
- [x] ConfidentialToken.sol compiled
- [x] ConfidentialStrategyAgent.sol compiled
- [x] Relayer builds and passes 19 unit tests
- [x] Frontend builds (Next.js `npm run build` passes)
- [x] Security analysis documented (SECURITY.md)
- [x] Production blockers documented (PRODUCTION_TODO.md)
- [ ] Contracts deployed on Base Sepolia (BaseVault)
- [ ] Contracts deployed on Zama Devnet (ConfidentialToken, StrategyAgent)
- [ ] Relayer configured and running against testnet
- [ ] End-to-end flow tested (deposit → shield → transfer → unshield → withdrawal)

---

## Phase 1: Testnet with Real Users (Public Beta)

### Smart Contracts

- [ ] **[BLOCKER]** External security audit complete (scope: BaseVault, ConfidentialToken, ConfidentialStrategyAgent)
- [ ] **[BLOCKER]** All CRITICAL items in PRODUCTION_TODO.md resolved (C-1 through C-5)
- [ ] **[BLOCKER]** `emergencyWithdraw()` removed or timelocked (C-2)
- [ ] **[BLOCKER]** Fee-on-transfer token accounting fixed (C-5)
- [ ] Token allowlist configured in BaseVault (H-3)
- [ ] `protocolOwner` uses Ownable2Step or multisig (H-2)
- [ ] All contract addresses verified on Basescan and Zama Explorer
- [ ] Contracts verified with source code on all explorers
- [ ] Deploy scripts version-controlled and reproducible

### Key Management

- [ ] **[BLOCKER]** Relayer private key stored in secrets manager (not `.env` file) (H-5)
- [ ] **[BLOCKER]** Contract owner address is a multisig (not a single EOA)
- [ ] Multisig requires minimum 2-of-3 signers
- [ ] Key rotation procedure documented and tested
- [ ] Relayer wallet funded with sufficient ETH for ≥ 30 days of gas

### Relayer

- [ ] **[BLOCKER]** Withdrawal auto-complete disabled (C-1, `WITHDRAWAL_AUTO_COMPLETE_DELAY_BLOCKS = 0`)
- [ ] **[BLOCKER]** Zama `Unshielded` event monitoring implemented before enabling withdrawals
- [ ] JSON state replaced with SQLite (H-6)
- [ ] `START_BLOCK` configured to deployment block (H-7)
- [ ] Relayer runs in process supervisor (systemd, PM2, or Kubernetes)
- [ ] Relayer health endpoint deployed and monitored
- [ ] Alerting configured (pending withdrawal age, wallet balance, RPC errors)
- [ ] Log aggregation configured (no log loss on crash)

### Frontend

- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set to production project ID
- [ ] `NEXT_PUBLIC_FHEVM_ACL_ADDRESS` and `NEXT_PUBLIC_FHEVM_KMS_ADDRESS` verified from Zama docs
- [ ] All contract addresses configured and verified
- [ ] "Privacy Begins After Shield" badge text corrected (M-2)
- [ ] Confirmation modal added before reveal operations (M-1)
- [ ] Chain-context warning shown when on wrong chain (M-5)
- [ ] Zama Gateway trust assumption surfaced in UI (M-4)
- [ ] `npm run build` passes with no warnings
- [ ] `npm run lint` passes with no errors
- [ ] Deployed to Vercel with production env vars

### Documentation

- [ ] SECURITY.md up to date
- [ ] PRODUCTION_TODO.md all CRITICAL items resolved
- [ ] README.md updated with deployed contract addresses
- [ ] Privacy guarantees accurately stated (no overclaiming)
- [ ] "What FHE does NOT protect" visible to users before they deposit

---

## Phase 2: Limited Mainnet (Capped TVL)

Additional items required before deploying on mainnet with real tokens.

### Smart Contracts

- [ ] **[BLOCKER]** Second independent audit by a different firm
- [ ] **[BLOCKER]** All HIGH items in PRODUCTION_TODO.md resolved
- [ ] **[BLOCKER]** Bridge contract replaces EOA relayer (C-3) — on-chain message proof verification
- [ ] TVL cap implemented in BaseVault (`require(totalDeposited <= MAX_TVL)`)
- [ ] Circuit breaker / pause mechanism implemented (Pausable from OZ)
- [ ] Upgrade path defined (proxy pattern or migration contract)
- [ ] Bug bounty program established

### Relayer / Bridge

- [ ] **[BLOCKER]** Bridge/relayer uses on-chain proof of Zama-side unshield
- [ ] Multiple redundant relayer instances with failover
- [ ] Bridge contract audited separately
- [ ] 48-hour withdrawal delay implemented for large amounts (anti-drain measure)

### Key Management

- [ ] All admin keys are hardware-backed (HSM or hardware wallet)
- [ ] 3-of-5 multisig for protocol owner operations
- [ ] Timelocked governance for parameter changes (72-hour minimum delay)
- [ ] Dead man's switch (if no activity for 90 days, users can self-rescue via emergency path)

### Monitoring

- [ ] Real-time balance invariant monitoring (`vaultBalance >= sum(available + pending)`)
- [ ] Automated alerting for anomalies (large single withdrawal, rapid drain)
- [ ] On-call rotation established
- [ ] Incident response runbook documented

### Legal / Compliance

- [ ] Terms of service reviewed by legal counsel
- [ ] Privacy policy addresses FHE data handling
- [ ] KYC/AML requirements assessed for jurisdiction(s)
- [ ] OFAC sanctions screening considered for depositing addresses
- [ ] Insurance / coverage assessed

---

## Phase 3: Full Mainnet

- [ ] Zama fhEVM production mainnet deployment (requires Zama protocol maturity)
- [ ] Decentralized relayer / bridge protocol live
- [ ] DAO governance for protocol parameters
- [ ] All PRODUCTION_TODO.md items resolved
- [ ] Independent formal verification of critical contract invariants

---

## Pre-Deployment Verification Script

Run these checks immediately after any deployment:

```bash
# 1. Verify BaseVault configuration
cast call $BASE_VAULT_ADDRESS "owner()(address)" --rpc-url $BASE_SEPOLIA_RPC
cast call $BASE_VAULT_ADDRESS "relayer()(address)" --rpc-url $BASE_SEPOLIA_RPC

# 2. Verify ConfidentialToken configuration
cast call $CT_ADDRESS "underlying()(address)" --rpc-url $ZAMA_RPC
cast call $CT_ADDRESS "owner()(address)" --rpc-url $ZAMA_RPC

# 3. Verify ConfidentialStrategyAgent configuration
cast call $CSA_ADDRESS "protocolOwner()(address)" --rpc-url $ZAMA_RPC

# 4. Smoke test: deposit 1 unit to BaseVault
cast send $BASE_VAULT_ADDRESS "deposit(address,uint256,uint256)" \
  $TEST_TOKEN $MIN_AMOUNT 0 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $TEST_KEY

# 5. Verify balance recorded
cast call $BASE_VAULT_ADDRESS "getAvailableBalance(address,address)(uint256)" \
  $TEST_WALLET $TEST_TOKEN --rpc-url $BASE_SEPOLIA_RPC

# 6. Verify relayer is running and watching correct block
curl http://localhost:PORT/health
```

---

## Ongoing Security Practices

After launch:
1. Monitor `processedEvents` set size in relayer; prune if approaching 100k entries
2. Review relayer logs daily for unexpected errors or anomalous withdrawal patterns
3. Rotate relayer private key quarterly
4. Re-audit after any contract changes
5. Subscribe to Zama security advisories (fhEVM updates may change trust assumptions)
6. Subscribe to OpenZeppelin security advisories (Ownable, ReentrancyGuard, SafeERC20)
7. Monitor Base Sepolia for any chain upgrades that could affect contract behavior
