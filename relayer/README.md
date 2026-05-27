# ConfidentialFi Relayer — MVP Testnet

**Status: MVP / Testnet only. Not production-ready.**

The relayer is the Layer 2 bridge service that monitors BaseVault events on Base Sepolia and triggers corresponding actions on Zama fhEVM (or, in this MVP, records them and auto-completes withdrawals).

---

## What the Relayer Does

```
Base Sepolia                          Relayer (this service)           Zama fhEVM
────────────────                      ──────────────────────           ──────────
BaseVault.deposit()
→ DepositCreated event  ───────────►  Records user mapping
                                      Logs TODO: shield on Zama  ───► TODO

BaseVault.linkStrategy()
→ StrategyLinked event  ───────────►  Updates user→strategyId map

BaseVault.requestWithdrawal()
→ WithdrawalRequested   ───────────►  Records pending withdrawal
                                      Waits N blocks             ───► TODO: Verify Unshielded
                                      Calls relayerCompleteWithdrawal()
BaseVault.relayerCompleteWithdrawal()
→ WithdrawalCompleted   ◄────────────  ERC-20 released to user
```

### MVP vs Production Behavior

| Step | MVP (this relayer) | Production (TODO) |
|---|---|---|
| Deposit detected | Records mapping | Records + calls ConfidentialToken.shield() on Zama |
| Withdrawal detected | Records + auto-completes after N blocks | Records + waits for Zama Unshielded event |
| Withdrawal completion | No Zama verification | Only after confirmed Zama unshield |
| Shield FHE call | ❌ NOT DONE | Requires fhevmjs WASM + dedicated FHE service |

---

## Trust Assumptions

> **This relayer is centralized. Read this section before using it.**

### What the relayer CAN do

- **Delay withdrawals**: The relayer controls when `relayerCompleteWithdrawal()` is called. A malicious or offline relayer can delay (but not steal) withdrawals.
- **Censor events**: A malicious relayer can ignore specific users' events.
- **Single point of failure**: If the relayer is down, withdrawals are delayed until it recovers.

### What the relayer CANNOT do

- **Steal user funds**: The relayer only calls `relayerCompleteWithdrawal()`, which releases funds to the user from the vault — not to the relayer.
- **Access encrypted balances**: The relayer reads only public on-chain state. It cannot decrypt fhEVM balances.
- **Double-spend**: The vault contract enforces balance accounting on-chain.

### Users always have an escape hatch

Even if the relayer is down or malicious:

```
// User can always recover without the relayer:
vault.emergencyWithdraw(tokenAddress)     // full available balance, no delay
vault.cancelPendingWithdrawal(token, amt) // returns pending → available
```

---

## Security Notes

### 1. Centralization risk

This is a single-process, single-key relayer. It is a **central point of failure and censorship**. For production:
- Use multiple relayer instances with consensus (e.g., 2-of-3 multisig)
- Or replace with a trust-minimized bridge (LayerZero, Hyperlane, zkBridge)

### 2. Withdrawal auto-complete without Zama verification

The MVP auto-completes withdrawals after `WITHDRAWAL_AUTO_COMPLETE_DELAY_BLOCKS` without verifying the Zama-side unshield. This means:
- A user could withdraw from Base AND still have shielded balance on Zama (double-spend in MVP mode)
- This is **only acceptable for testnet** where funds have no real value
- Production MUST gate `relayerCompleteWithdrawal()` on a confirmed Zama `Unshielded` event

### 3. Private key security

`RELAYER_PRIVATE_KEY` in `.env` must be:
- Never committed to version control
- Stored in a secrets manager (AWS Secrets Manager, Vault, etc.) in production
- The wallet should hold only enough ETH for gas (principle of least privilege)

### 4. State file is not crash-safe

The JSON state file is written atomically per-cycle but does not use a write-ahead log. In the event of a crash mid-write, the state file could be corrupted. For production, use SQLite with WAL mode or PostgreSQL.

### 5. No cryptographic proof of relay

The relayer claims to have seen events but there is no on-chain proof that it processed them correctly. Production should use a bridge protocol that includes cryptographic proofs of the relayed messages.

---

## Setup

### Prerequisites

- Node.js 18+
- A funded wallet on Base Sepolia (ETH for gas)
- BaseVault deployed on Base Sepolia
- Relayer wallet address set as authorized relayer on BaseVault:
  ```bash
  # From the deployer wallet:
  cast send $BASE_VAULT_ADDRESS "setRelayer(address)" $RELAYER_ADDRESS \
    --rpc-url $BASE_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY
  ```

### Install

```bash
cd relayer
npm install
cp .env.example .env
# Fill in values in .env
```

### Configure `.env`

```bash
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org      # or your Alchemy/Infura URL
BASE_VAULT_ADDRESS=0x...                            # from deploy:vault:baseSepolia
ZAMA_DEVNET_RPC_URL=https://devnet.zama.ai
CONFIDENTIAL_STRATEGY_AGENT_ADDRESS=0x...          # from deploy:agent:zamaDevnet
RELAYER_PRIVATE_KEY=0x...                          # funded wallet, Base Sepolia ETH
```

---

## Running

### Continuous polling (development)

```bash
npm run dev
```

Polls Base Sepolia every `POLLING_INTERVAL_MS` (default 12 seconds). Logs all events and actions. Press Ctrl+C to stop gracefully.

### Single run (cron / manual catch-up)

```bash
npm run once
```

Processes all pending events since last run and exits. Suitable for:
- Cron job: `*/1 * * * * cd /path/to/relayer && npm run once >> /var/log/relayer.log 2>&1`
- Manual catch-up after downtime

### Tests

```bash
npm test          # run once
npm run test:watch # watch mode
```

### Type check

```bash
npm run build     # TypeScript check (tsc --noEmit)
```

---

## State File

The relayer stores persistent state at `STATE_FILE_PATH` (default `./state/state.json`):

```json
{
  "lastProcessedBlock": 12345678,
  "processedEvents": {
    "0xabc...-0": true
  },
  "userMappings": {
    "0xuser...": {
      "baseAddress": "0xuser...",
      "strategyId": "42",
      "deposited": { "0xtoken...": "1000000" },
      "linkedAt": 1716000000000,
      "updatedAt": 1716000000000
    }
  },
  "pendingWithdrawals": {
    "0xuser..._0xtoken..._0xtxhash...": {
      "user": "0xuser...",
      "token": "0xtoken...",
      "amount": "500000",
      "status": "completed",
      "completedTxHash": "0x..."
    }
  }
}
```

To reset state and reprocess from genesis (or a specific block), delete or edit `state.json`.

---

## Production Upgrade Path

To harden this relayer for production:

1. **Replace auto-complete with Zama verification**
   - Listen for `ConfidentialToken.Unshielded(sender, recipient=relayerAddr, amount)` on Zama
   - Match to pending withdrawals by user + amount
   - Only then call `relayerCompleteWithdrawal()`

2. **Add FHE-capable shield service**
   - When `DepositCreated` fires, a service with fhevmjs running in Node.js
     (with proper WASM support) calls `ConfidentialToken.shield(amount)` on Zama

3. **Decentralize the relayer**
   - Run multiple instances with 2-of-3 multisig or use LayerZero/Hyperlane
   - Or use a zkBridge that includes on-chain proof verification

4. **Replace JSON state with a database**
   - SQLite (write-ahead log) for single-instance
   - PostgreSQL for multi-instance

5. **Add monitoring and alerting**
   - Alert on missed events, failed transactions, large pending withdrawal queues

---

## Architecture Reference

```
relayer/
├── src/
│   ├── config.ts          — env loading + validation
│   ├── types.ts           — RelayerState, UserMapping, PendingWithdrawal types
│   ├── logger.ts          — structured logging
│   ├── retry.ts           — exponential backoff retry
│   ├── state.ts           — JSON file persistence with idempotency
│   ├── abis.ts            — BaseVault + StrategyAgent + ConfidentialToken ABIs
│   ├── chains.ts          — viem public + wallet clients
│   ├── processor.ts       — core poll loop (runOnce)
│   ├── index.ts           — dev mode (continuous)
│   ├── once.ts            — single-run mode
│   └── handlers/
│       ├── depositCreated.ts      — records deposit, logs TODO for shield
│       ├── strategyLinked.ts      — updates user→strategyId mapping
│       └── withdrawalRequested.ts — records pending, auto-completes (testnet)
├── tests/
│   ├── eventParsing.test.ts  — ABI event decode tests (19 tests)
│   └── idempotency.test.ts   — state persistence + idempotency tests
└── state/
    └── .gitkeep              — state.json is gitignored
```
