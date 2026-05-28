# Testnet Deployment Guide

**Networks used in this guide:**

| Layer | Chain | Chain ID | Purpose |
|---|---|---|---|
| Settlement | Base Sepolia | `84532` | BaseVault — user deposits |
| Compute | Ethereum Sepolia | `11155111` | ConfidentialToken + StrategyAgent (fhEVM precompiles) |

> **Why Ethereum Sepolia for fhEVM?** The contracts inherit `SepoliaZamaFHEVMConfig`, which hardcodes Zama's precompile contract addresses on Ethereum Sepolia. Those contracts are deployed at fixed addresses on chain 11155111. Any standard Sepolia RPC works.
>
> **Zama Devnet (chain 9000)** is listed in the wagmi config for future use but the current contracts will not work there without changing the config inheritance to a devnet-specific version.

---

## 1. Exact Environment Variables

### A. `contracts/.env` (one-time setup, never committed)

```bash
# Deployer wallet — must have ETH on BOTH Base Sepolia AND Ethereum Sepolia
DEPLOYER_PRIVATE_KEY=0x<your_private_key>

# Base Sepolia RPC (public endpoint works)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Ethereum Sepolia RPC (Alchemy / Infura / public — any standard Sepolia RPC)
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_ALCHEMY_KEY>
# OR public (slower): https://rpc.sepolia.org

# Optional — Basescan API key for verification after deployment
BASESCAN_API_KEY=<from_basescan.org>
ETHERSCAN_API_KEY=<from_etherscan.io>

# Leave blank — deploy scripts auto-deploy MockERC20 on both chains
# UNDERLYING_TOKEN_ADDRESS=   (Sepolia — leave empty)
# TEST_TOKEN_ADDRESS=          (Base Sepolia — leave empty)
```

---

### B. Frontend `src/.env.local` (filled in AFTER contracts are deployed)

```bash
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<from_cloud.walletconnect.com>

# ── Layer 1: Base Sepolia ─────────────────────────────────────────────────────
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
# (Filled in after step 3 below)
NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA=<BaseVault address>

# ── Layer 2: Ethereum Sepolia (Zama fhEVM) ────────────────────────────────────
NEXT_PUBLIC_RPC_URL_SEPOLIA=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
# (Filled in after step 4 below)
NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA=<ConfidentialToken address>
NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_SEPOLIA=<ConfidentialStrategyAgent address>

# ── Zama fhEVM system contracts (Ethereum Sepolia — fixed addresses, do not change) ──
# Source: node_modules/fhevm/config/ZamaFHEVMConfig.sol (getSepoliaConfig)
NEXT_PUBLIC_FHEVM_ACL_ADDRESS=0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5
# Source: ZamaFHEVMConfig.sol KMSVerifierAddress
NEXT_PUBLIC_FHEVM_KMS_ADDRESS=0x9D6891A6240D6130c54ae243d8005063D05fE14b

# ── (Optional) Zama Devnet placeholder — not used for Sepolia deployment ─────
NEXT_PUBLIC_CONTRACT_ADDRESS_ZAMA_DEVNET=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_ZAMA_DEVNET=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_ZAMA_DEVNET_RPC=https://devnet.zama.ai
```

---

### C. `relayer/.env` (filled in after contracts are deployed)

```bash
# Base Sepolia
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_VAULT_ADDRESS=<BaseVault address from step 3>

# Ethereum Sepolia (Zama fhEVM) — read-only for now
ZAMA_DEVNET_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
CONFIDENTIAL_STRATEGY_AGENT_ADDRESS=<StrategyAgent address from step 4>
CONFIDENTIAL_TOKEN_ADDRESS=<ConfidentialToken address from step 4>

# ── Read-only mode: omit RELAYER_PRIVATE_KEY ─────────────────────────────────
# Relayer will poll and log events but CANNOT sign transactions.
# To enable write mode: set RELAYER_PRIVATE_KEY and authorise the address
# as the relayer on BaseVault (vault.setRelayer(relayerAddress)).
# RELAYER_PRIVATE_KEY=0x...

# ── CRITICAL: keep auto-complete DISABLED (default) ──────────────────────────
TESTNET_ONLY_AUTO_COMPLETE=false

# Polling
POLLING_INTERVAL_MS=12000
CONFIRMATION_BLOCKS=2
STATE_FILE_PATH=./state/state.json
LOG_LEVEL=info
```

---

## 2. Deploy Order

```
Step 1 ──► Get testnet ETH on both chains
Step 2 ──► (optional) Fund a separate relayer wallet on Base Sepolia
Step 3 ──► Deploy BaseVault on Base Sepolia
             output: BASE_VAULT_ADDRESS, MockERC20 on Base Sepolia
Step 4 ──► Deploy ConfidentialToken + ConfidentialStrategyAgent on Ethereum Sepolia
             output: CT_ADDRESS, CSA_ADDRESS, MockERC20 on Sepolia
Step 5 ──► Update frontend .env.local with all addresses
Step 6 ──► Start frontend
Step 7 ──► (optional) Start relayer in read-only mode
Step 8 ──► Run flow test
```

---

## 3. BaseVault — Base Sepolia Commands

```bash
# Prerequisites:
#   - DEPLOYER_PRIVATE_KEY funded with Base Sepolia ETH
#     Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
#   - contracts/.env filled in (section 1-A above)

cd contracts

# Install if not already done
npm install

# Deploy BaseVault + auto-deploy MockERC20 (mUSDC, 6 decimals)
# This will:
#   1. Deploy MockERC20 ("Mock USDC", "mUSDC", 6 decimals) on Base Sepolia
#   2. Mint 1,000,000 mUSDC to the deployer
#   3. Deploy BaseVault(owner=deployer, relayer=deployer)
#   4. Print both addresses

npm run deploy:vault:baseSepolia
```

**Expected output:**
```
✓ MockERC20 deployed     : 0x<BASE_MOCK_USDC_ADDRESS>
✓ Minted 1,000,000 mUSDC to deployer
✓ BaseVault deployed     : 0x<BASE_VAULT_ADDRESS>
  Owner                  : 0x<YOUR_DEPLOYER_ADDRESS>
  Relayer (initial)      : 0x<YOUR_DEPLOYER_ADDRESS>

Next Steps:
1. Add to frontend .env.local:
   NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA=0x<BASE_VAULT_ADDRESS>
```

**Copy to `.env.local`:**
```bash
NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA=0x<BASE_VAULT_ADDRESS>
```

**Optional: verify on Basescan**
```bash
npx hardhat verify --network baseSepolia \
  0x<BASE_VAULT_ADDRESS> \
  0x<YOUR_DEPLOYER_ADDRESS> \
  0x<YOUR_DEPLOYER_ADDRESS>
```

---

## 4. Zama fhEVM Contracts — Ethereum Sepolia Commands

```bash
# Prerequisites:
#   - DEPLOYER_PRIVATE_KEY funded with Ethereum Sepolia ETH
#     Faucet: https://sepoliafaucet.com  or  https://faucet.quicknode.com/ethereum/sepolia
#   - SEPOLIA_RPC_URL set in contracts/.env (Alchemy or Infura recommended)

cd contracts

# Step 4a: Deploy ConfidentialToken + auto-deploy underlying MockERC20
# This will:
#   1. Deploy MockERC20 ("Mock USDC", "mUSDC", 6 decimals) on Ethereum Sepolia
#   2. Mint 1,000,000 mUSDC to the deployer
#   3. Deploy ConfidentialToken("Confidential USDC", "cUSDC", owner=deployer)
#      wrapping the MockERC20

npm run deploy:sepolia
```

**Expected output:**
```
✓ MockERC20 deployed  : 0x<SEPOLIA_MOCK_USDC_ADDRESS>
✓ Minted 1,000,000 mUSDC to deployer
✓ ConfidentialToken    : 0x<CT_ADDRESS>

Add to frontend .env.local:
   NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA=0x<CT_ADDRESS>
```

```bash
# Step 4b: Deploy ConfidentialStrategyAgent
# This will:
#   1. Deploy ConfidentialStrategyAgent(protocolOwner=deployer)
#   2. Authorise deployer as the initial agent

npm run deploy:agent:sepolia
```

**Expected output:**
```
✓ ConfidentialStrategyAgent: 0x<CSA_ADDRESS>
✓ Agent authorized: 0x<YOUR_DEPLOYER_ADDRESS>

Add to frontend .env.local:
   NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_SEPOLIA=0x<CSA_ADDRESS>
```

**Copy both to `.env.local`:**
```bash
NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA=0x<CT_ADDRESS>
NEXT_PUBLIC_STRATEGY_AGENT_ADDRESS_SEPOLIA=0x<CSA_ADDRESS>
```

**Optional: verify on Etherscan**
```bash
# ConfidentialToken
npx hardhat verify --network sepolia \
  0x<CT_ADDRESS> \
  0x<SEPOLIA_MOCK_USDC_ADDRESS> \
  "Confidential USDC" "cUSDC" \
  0x<YOUR_DEPLOYER_ADDRESS>

# ConfidentialStrategyAgent
npx hardhat verify --network sepolia \
  0x<CSA_ADDRESS> \
  0x<YOUR_DEPLOYER_ADDRESS>
```

---

## 5. Relayer in Read-Only Mode

Read-only mode = no `RELAYER_PRIVATE_KEY` set. The relayer polls events and logs them but never signs a transaction.

```bash
# 1. Set up relayer .env (without private key)
cd relayer
cp .env.example .env

# Edit .env — fill in RPC URLs and contract addresses from steps 3 & 4.
# Leave RELAYER_PRIVATE_KEY commented out.
# Keep TESTNET_ONLY_AUTO_COMPLETE=false (default).

# 2. Install dependencies
npm install

# 3. Start read-only polling (continuous)
npm run dev
```

**Expected log (read-only startup):**
```
[timestamp] INFO  ╔═══════════════════════════════════════════════════════╗
[timestamp] INFO  ║  ConfidentialFi Relayer  —  MVP Testnet               ║
[timestamp] WARN  RELAYER_PRIVATE_KEY not set. The relayer can READ events
                  but cannot call relayerCompleteWithdrawal.
[timestamp] INFO  Base Sepolia vault  { address: "0x<BASE_VAULT_ADDRESS>" }
[timestamp] INFO  State loaded        { lastBlock: 0 }
[timestamp] INFO  Starting poll loop  { intervalMs: 12000 }
[timestamp] INFO  [processor] Scanning blocks { from: "1", to: "12345678" }
```

**Single-run mode (for cron or debugging):**
```bash
npm run once
# → processes all unprocessed events since lastBlock and exits
```

---

## 6. Full Deposit → Strategy Link → Encrypted Evaluation Flow

This test exercises the entire stack. You will switch between two browser networks.

> **Important:** The two MockERC20 tokens are on different chains. `mUSDC` on Base Sepolia and `mUSDC` on Ethereum Sepolia are independent contracts. For this test, you mint and use each separately — they are NOT bridged (that is the relayer TODO).

---

### Phase A — Base Sepolia: Deposit into vault

**Wallet network: Base Sepolia (84532)**

```
Frontend URL: http://localhost:3000/vault
```

1. Connect wallet. Confirm the `ChainBadge` shows **Settlement Layer (Base)**.
2. Navigate to `/vault`.
3. Paste the `mUSDC` address on Base Sepolia into the token field:
   ```
   0x<BASE_MOCK_USDC_ADDRESS>   ← from step 3 output
   ```
4. Click **1. Approve** → MetaMask prompt → confirm.
   - Approves BaseVault to spend 100 mUSDC.
5. Enter amount `100` and click **2. Deposit** → confirm.
   - `BaseVault.deposit(mUSDC, 100e6, 0)` sent on Base Sepolia.
   - `DepositCreated(user, mUSDC, 100000000, 0)` event emitted.
   - **Vault available balance** should now show `100.0000 mUSDC`.
6. If the relayer is running, it will log:
   ```
   [INFO] [depositCreated] Deposit recorded { user: "0x...", amount: "100000000" }
   [WARN] TODO: Funds are locked in BaseVault but NOT yet shielded on Zama fhEVM.
   ```

---

### Phase B — Ethereum Sepolia: Create strategy

**Wallet network: Ethereum Sepolia (11155111)**

```
Frontend URL: http://localhost:3000/strategy
```

7. Switch your wallet to Ethereum Sepolia. `ChainBadge` shows **Compute Layer (Zama fhEVM)**.
8. Navigate to `/strategy`.
9. Verify **fhEVM Ready** badge is green (fhevmjs loaded the network FHE public key).
   - If it stays yellow/loading, check that `NEXT_PUBLIC_FHEVM_ACL_ADDRESS` and
     `NEXT_PUBLIC_FHEVM_KMS_ADDRESS` are set in `.env.local`.
10. Fill in strategy parameters (example values):
    ```
    APY Target:           800   (= 8.00%)
    Rebalance Threshold:  500   (= 5.00%)
    Stop-Loss Buffer:     120   (HF 1.20)
    Liquidation Buffer:    20   (+0.20 margin)
    Max Leverage:         150   (1.5×)
    ```
11. Click **Create Encrypted Strategy**.
    - fhevmjs creates a single `EncryptedInput` with all 5 values:
      ```
      input.add64(800)   input.add64(500)   input.add64(120)
      input.add64(20)    input.add64(150)   → handles[0..4], inputProof
      ```
    - `ConfidentialStrategyAgent.createStrategy(h0, h1, h2, h3, h4, proof)` sent.
    - `StrategyCreated(strategyId=0, user=0x...)` event emitted.
    - Note the `strategyId` from the transaction receipt or the dashboard card.

---

### Phase C — Base Sepolia: Link strategy to vault deposit

**Wallet network: Base Sepolia (84532)**

```
Frontend URL: http://localhost:3000/vault
```

12. Switch back to Base Sepolia.
13. In the Strategy ID field, enter the `strategyId` from step 11 (e.g. `0`).
14. Click **Deposit** again with `strategyId=0` — OR use the browser console:
    ```javascript
    // Alternative: call linkStrategy directly via cast
    ```
    Using `cast` (Foundry) if you have it:
    ```bash
    cast send 0x<BASE_VAULT_ADDRESS> \
      "linkStrategy(uint256)" 0 \
      --rpc-url https://sepolia.base.org \
      --private-key 0x<DEPLOYER_PRIVATE_KEY>
    ```
    - `StrategyLinked(user, strategyId=0)` event emitted.
15. Relayer (if running) logs:
    ```
    [INFO] [strategyLinked] New user strategy link { user: "0x...", strategyId: "0" }
    ```

---

### Phase D — Ethereum Sepolia: Shield tokens (manual bridge step)

**Wallet network: Ethereum Sepolia (11155111)**

> This step is required because the bridge (relayer-to-Zama shield) is not yet implemented. You manually shield on Ethereum Sepolia.

16. First, mint mUSDC on Ethereum Sepolia. This can be done via cast:
    ```bash
    cast send 0x<SEPOLIA_MOCK_USDC_ADDRESS> \
      "mint(address,uint256)" \
      0x<YOUR_WALLET_ADDRESS> 100000000 \
      --rpc-url $SEPOLIA_RPC_URL \
      --private-key 0x<DEPLOYER_PRIVATE_KEY>
    ```
17. Approve ConfidentialToken to spend mUSDC:
    ```bash
    cast send 0x<SEPOLIA_MOCK_USDC_ADDRESS> \
      "approve(address,uint256)" \
      0x<CT_ADDRESS> 100000000 \
      --rpc-url $SEPOLIA_RPC_URL \
      --private-key 0x<DEPLOYER_PRIVATE_KEY>
    ```
18. Navigate to `/transfer` in the frontend (wallet on Ethereum Sepolia).
19. Select **Shield** tab. Paste `mUSDC` address on Sepolia and enter `100`.
20. Click **Shield Tokens**.
    - `ConfidentialToken.shield(100000000)` sent.
    - `Shielded(user, 100000000)` event emitted — amount is PUBLIC at this step.
    - Your encrypted balance handle appears in the `/dashboard` BalanceCard.

---

### Phase E — Ethereum Sepolia: Evaluate strategy (encrypted)

**Wallet network: Ethereum Sepolia (11155111)**

```
Frontend URL: http://localhost:3000/strategy
```

21. Navigate to `/strategy`. Your strategy `#0` should appear in the dashboard.
22. The Feed Display shows simulated APY and health factor (random walk).
23. Click **Evaluate Strategy** on the strategy card.
    - fhevmjs encrypts the feed values:
      ```
      input.add64(currentApyBps)        → handles[0]
      input.add64(currentHealthX100)    → handles[1]
      → inputProof
      ```
    - `ConfidentialStrategyAgent.evaluateStrategy(0, h0, h1, proof)` sent.
    - Contract executes homomorphically:
      ```
      shouldRebalance = TFHE.lt(currentApy, rebalanceThreshold)  ← stays encrypted
      stopLossHit     = TFHE.lt(currentHealth, stopLossBuffer)    ← stays encrypted
      evaluationCount = TFHE.add(count, 1)
      ```
    - `EvaluationPerformed(strategyId=0, blockNumber=N)` emitted.
    - No amount, no condition result — only that evaluation occurred.
24. To see if conditions were triggered (optional — irreversible):
    - Click **Request Eval Reveal** on the strategy card.
    - Type `CONFIRM` in the modal.
    - Zama Gateway decrypts both ebools and calls `callbackEvaluationReveal`.
    - `EvaluationRevealed(strategyId=0, shouldRebalance=true/false, stopLossHit=true/false)`.
    - ⚠️ This value is now permanently public on Ethereum Sepolia.

---

## Quick Reference Card

| What | Where | Command |
|---|---|---|
| Fund Base Sepolia | Faucet | https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet |
| Fund Eth Sepolia | Faucet | https://sepoliafaucet.com |
| Deploy vault | `contracts/` | `npm run deploy:vault:baseSepolia` |
| Deploy token | `contracts/` | `npm run deploy:sepolia` |
| Deploy agent | `contracts/` | `npm run deploy:agent:sepolia` |
| Start frontend | root | `npm run dev` |
| Start relayer (read) | root | `npm run relayer:dev` (no RELAYER_PRIVATE_KEY) |
| Run relayer once | root | `npm run relayer:once` |
| View vault | browser | http://localhost:3000/vault |
| View strategy | browser | http://localhost:3000/strategy |
| View transfer | browser | http://localhost:3000/transfer |

---

## Faucet Links

| Network | Faucet |
|---|---|
| Base Sepolia | https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet |
| Ethereum Sepolia | https://sepoliafaucet.com |
| Ethereum Sepolia (alt) | https://faucet.quicknode.com/ethereum/sepolia |
| Ethereum Sepolia (alt) | https://faucets.chain.link/sepolia |

---

## Address Reference (fill in after deployment)

```
BASE_MOCK_USDC (Base Sepolia):      0x___________
BASE_VAULT (Base Sepolia):          0x___________

SEPOLIA_MOCK_USDC (Eth Sepolia):    0x___________
CONFIDENTIAL_TOKEN (Eth Sepolia):   0x___________
STRATEGY_AGENT (Eth Sepolia):       0x___________

Zama ACL (Eth Sepolia, fixed):      0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5
Zama KMS (Eth Sepolia, fixed):      0x9D6891A6240D6130c54ae243d8005063D05fE14b
Zama Gateway (Eth Sepolia, fixed):  0x33347831500F1e73f0ccCBb95c9f86B94d7b1123
```
