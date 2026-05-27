# ConfidentialFi — Private Agentic DeFi on Base

**Built for Base. Powered by Zama fhEVM.**

A full-stack Web3 application for private token transfers and encrypted DeFi strategy execution. Base Sepolia is the default wallet and settlement chain. Zama fhEVM handles all confidential computation.

Built with Next.js 15, TypeScript, Tailwind CSS, RainbowKit, wagmi, viem, and fhevmjs.

---

## What Is Real vs TODO

This project is explicit about what is working today versus what still requires implementation.

### ✅ Real (implemented and honest)

| Layer | What is real |
|---|---|
| **Smart contract** | `ConfidentialToken.sol` uses `TFHE.sol` types (`euint64`, `einput`, `ebool`), real Hardhat fhEVM plugin, real Gateway callback pattern for unshield |
| **Client encryption** | `fhevmjs` encrypts transfer amounts using the network's actual FHE public key before the transaction is signed. The plaintext never leaves the browser |
| **Homomorphic checks** | `TFHE.le(amount, balance)` and `TFHE.select()` run on ciphertexts – the contract never decrypts the values it compares |
| **Gateway unshield** | `requestUnshield` + `callbackUnshield` implements the real Zama Gateway async decryption pattern |
| **Hardhat tests** | Tests use `fhevmjs/lib/fhevmjsMock` (the fhEVM Hardhat plugin mock), not fake random data |
| **ABI** | The ABI in `src/lib/constants.ts` matches `ConfidentialToken.sol` exactly, with honest comments about fhEVM ABI encoding |

### 🔧 TODO (not yet wired in the UI)

| Feature | Status | Where to complete |
|---|---|---|
| **Shielded balance display** | The contract returns an encrypted handle; the UI shows it as `ENCRYPTED`. Decrypting it requires a re-encryption flow | `src/hooks/useTokenBalance.ts` – implement `useFhevm().instance.reencrypt()` with EIP-712 user signature |
| **ERC-20 approval UX** | Users must call `underlying.approve(contract, amount)` before shielding. There is no approval step in the UI today | Add an approval transaction step before the shield button |
| **Zama system contract addresses** | `NEXT_PUBLIC_FHEVM_ACL_ADDRESS` and `NEXT_PUBLIC_FHEVM_KMS_ADDRESS` must be set from Zama's docs | See `.env.example` |
| **ConfidentialToken deployed** | The contract address env vars contain `0x000…` placeholders | Deploy `contracts/` and update `.env.local` |

### ❌ Removed (was false in the previous version)

The previous version of this codebase contained:
- `mockCommitment()` – a trivial hash function claimed to be a "Pedersen commitment" — **removed**
- `mockProof()` – random bytes claimed to be a "ZK proof" — **removed**
- ABI comment claiming "amounts stored as Pedersen commitments" — **corrected**
- Badge claiming "ZK Proof Generated" — **corrected** (fhEVM uses FHE, not ZK proofs)

---

## How fhEVM Works (vs ZK Proofs)

This contract uses **Fully Homomorphic Encryption**, not Zero-Knowledge proofs.  These are different cryptographic primitives:

| | FHE (this project) | ZK Proofs (e.g. Tornado Cash) |
|---|---|---|
| Computation on encrypted data | ✅ Yes – contract computes on ciphertexts | ❌ No – circuit proves a statement about plaintext |
| Amount hidden on-chain | ✅ Yes (handle only) | ✅ Yes (commitment) |
| Client-side prover | fhevmjs encrypt (fast, ~ms) | WASM prover (slow, ~seconds) |
| Smart contract | TFHE.sol arithmetic | On-chain verifier (e.g. Groth16) |
| Balance viewing | Re-encrypt to user key pair via Gateway | Nullifier/note scanning |

---

## Project Structure

```
.
├── contracts/                  # Solidity contracts (Hardhat + fhEVM)
│   ├── contracts/
│   │   ├── ConfidentialToken.sol   # Main contract using TFHE.sol
│   │   └── MockERC20.sol           # ERC-20 for local testing
│   ├── scripts/
│   │   ├── deploy.ts               # Deploy to Zama Devnet or Sepolia
│   │   └── interact.ts             # Example shield→transfer→unshield flow
│   ├── test/
│   │   └── ConfidentialToken.test.ts  # Hardhat tests with fhEVM mock
│   ├── hardhat.config.ts           # Networks: hardhat (mock), zamaDevnet, sepolia
│   ├── package.json
│   └── .env.example
│
└── src/                        # Next.js 15 frontend
    ├── app/
    │   ├── layout.tsx              # Root layout, Web3Provider
    │   ├── dashboard/page.tsx      # Portfolio overview
    │   ├── transfer/page.tsx       # Shield / Confidential Send / Unshield
    │   └── history/page.tsx        # Transfer history table
    ├── components/
    │   ├── ui/                     # Button, Card, Input, Badge, Tooltip
    │   ├── layout/                 # Navbar (desktop) + MobileNav (bottom tabs)
    │   ├── wallet/                 # RainbowKit custom ConnectButton
    │   ├── dashboard/              # BalanceCard (TODO: re-encryption), StatsCard, etc.
    │   ├── transfer/               # TransferForm (real fhevmjs), HowItWorks
    │   └── history/                # TransactionTable (filters, pagination)
    ├── hooks/
    │   ├── useFhevm.ts             # Loads fhevmjs WASM, returns FhevmInstance
    │   ├── useConfidentialTransfer.ts  # shield / confidentialTransfer / requestUnshield
    │   ├── useTokenBalance.ts      # Reads encrypted handle (TODO: reencrypt)
    │   └── useTransferHistory.ts   # localStorage-backed tx history
    ├── lib/
    │   ├── fhevm.ts                # createFhevmInstance, encodeEncryptedInput
    │   ├── wagmi.ts                # Zama Devnet custom chain + wagmi config
    │   ├── constants.ts            # ABI, contract addresses, chain IDs
    │   └── utils.ts                # Formatting utilities (no fake crypto)
    ├── providers/
    │   └── Web3Provider.tsx        # wagmi + tanstack query + rainbowkit
    └── types/
        └── index.ts                # Transfer, ShieldParams, etc.
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A wallet with Zama Devnet configured (chain ID 9000, RPC: `https://devnet.zama.ai`)
- A WalletConnect project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com)

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud ID | [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `NEXT_PUBLIC_FHEVM_ACL_ADDRESS` | Zama ACL system contract | [docs.zama.ai/fhevm/references/contracts](https://docs.zama.ai/fhevm/references/contracts) |
| `NEXT_PUBLIC_FHEVM_KMS_ADDRESS` | Zama KMS Verifier contract | same link above |
| `NEXT_PUBLIC_CONTRACT_ADDRESS_ZAMA_DEVNET` | Your deployed ConfidentialToken | after running `npm run deploy:zamaDevnet` in `contracts/` |

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Smart Contract Setup

### Install contract dependencies

```bash
cd contracts
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY and optionally UNDERLYING_TOKEN_ADDRESS
npm install
```

### Compile

```bash
npm run compile
```

### Run tests (uses fhEVM Hardhat mock – no real network needed)

```bash
npm test
```

The tests use `fhevmjs/lib/fhevmjsMock` which simulates the fhEVM precompiles locally. The mock makes Gateway callbacks fire synchronously in the same block, so you can verify the full shield→transfer→unshield flow without connecting to a real network.

### Deploy to Zama Devnet

```bash
# Set DEPLOYER_PRIVATE_KEY in contracts/.env
npm run deploy:zamaDevnet
```

The script deploys a MockERC20 (if no `UNDERLYING_TOKEN_ADDRESS` is set) and the ConfidentialToken, then prints the addresses. Copy the ConfidentialToken address to the frontend's `.env.local`.

---

## fhEVM System Contract Addresses

The `fhevmjs` SDK requires two system contract addresses that are deployed by Zama on their networks.  **Do not invent these** – they must match the actual contracts on the chain you are using.

Find the correct addresses at: **https://docs.zama.ai/fhevm/references/contracts**

Then add them to `.env.local`:
```
NEXT_PUBLIC_FHEVM_ACL_ADDRESS=<from docs>
NEXT_PUBLIC_FHEVM_KMS_ADDRESS=<from docs>
```

Without these, fhevmjs will throw when trying to create an encrypted input.

---

## Deploy to Vercel

1. Push your code to GitHub.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Set all environment variables from `.env.example` in the Vercel dashboard.
4. Click **Deploy**.

---

## Implementing the TODO: Balance Display

The encrypted balance handle returned by `encryptedBalanceOf()` can be decrypted
client-side using the re-encryption flow. Here is the code to wire in `useTokenBalance.ts`:

```ts
// 1. Get the encrypted handle from the contract
const handle = await readContract({ functionName: 'encryptedBalanceOf', args: [address] });

// 2. Generate a temporary NaCl keypair (do this once per session)
const { publicKey, privateKey } = fhevmInstance.generateKeypair();

// 3. Build EIP-712 message and ask user to sign it
const eip712 = fhevmInstance.createEIP712(publicKey, contractAddress);
const signature = await walletClient.signTypedData({
  domain: eip712.domain,
  types: eip712.types,
  primaryType: eip712.primaryType,
  message: eip712.message,
});

// 4. Re-encrypt via Zama Gateway and decrypt locally
const plainBalance = await fhevmInstance.reencrypt(
  handle as bigint,        // euint64 handle from contract
  privateKey,
  publicKey,
  signature,
  contractAddress,
  address
);

console.log('Balance:', plainBalance); // bigint
```

---

## BaseVault → Relayer → Zama fhEVM Flow

```
DEPOSIT FLOW
─────────────────────────────────────────────────────────────────────
User (Base Sepolia wallet)
  │
  │ 1. token.approve(BaseVault, amount)
  │ 2. BaseVault.deposit(token, amount, strategyId)
  ▼
BaseVault.sol  (Base Sepolia — chain 84532)
  • Locks ERC-20 tokens on Base
  • Emits DepositCreated(user, token, amount, strategyId)
  │
  │ Off-chain relayer watches for DepositCreated event  ← TODO
  ▼
Relayer Service  (TODO — off-chain Node.js / keeper)
  • Reads DepositCreated from Base Sepolia
  • Builds fhevmjs encrypted input for amount
  • Calls ConfidentialToken.shield(amount) on Zama fhEVM
  │
  ▼
ConfidentialToken.sol  (Zama fhEVM — chain 9000 or Sepolia)
  • Mints encrypted euint64 balance for user
  • TFHE.allow() grants user ACL access
  • User can now do encrypted transfers and strategy evaluation


WITHDRAWAL FLOW
─────────────────────────────────────────────────────────────────────
User requests withdrawal
  │ BaseVault.requestWithdrawal(token, amount)
  │ → Emits WithdrawalRequested, locks funds in _pending
  │
  │ Relayer watches WithdrawalRequested  ← TODO
  ▼
Relayer Service  (TODO)
  • Encrypts amount via fhevmjs
  • Calls ConfidentialToken.requestUnshield(encAmt, proof, relayer)
  • Waits for Zama Gateway callbackUnshield (ERC-20 on Zama released)
  │
  │ Relayer calls back on Base
  ▼
BaseVault.relayerCompleteWithdrawal(user, token, amount)
  • Releases ERC-20 to user on Base Sepolia
  • Emits WithdrawalCompleted
```

See `contracts/contracts/IRelayer.sol` for the full interface specification.

### What BaseVault protects vs what it doesn't

| Claim | Reality |
|---|---|
| ERC-20 funds are safely held on Base | ✅ True — contract inherits ReentrancyGuard, SafeERC20 |
| Deposit amounts are private | ❌ False — `DepositCreated` emits the amount publicly |
| Strategy IDs are private | ❌ False — `StrategyLinked` emits the ID publicly |
| Withdrawal requests are private | ❌ False — `WithdrawalRequested` emits the amount |
| Funds can be recovered without relayer | ✅ True — `emergencyWithdraw()` and `cancelPendingWithdrawal()` |

The privacy of amounts and strategy parameters is provided by Zama fhEVM after bridging, not by BaseVault itself. BaseVault is a transparent settlement contract.

---

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1 — SETTLEMENT                                    │
│  Base Sepolia (chain 84532) / Base (chain 8453)         │
│                                                          │
│  ✅ Implemented:                                         │
│    • Default wallet connection (RainbowKit)             │
│    • Explorer links → sepolia.basescan.org              │
│    • ENV vars: BASE_RPC_URL, BASE_VAULT_ADDRESS_*       │
│    • ChainBadge in navbar ("Settlement Layer")          │
│                                                          │
│  🔧 TODO:                                                │
│    • BaseVault.sol — lock tokens before bridging        │
│    • Deposit/withdrawal UI for Base-native assets       │
│    • Coinbase Smart Wallet integration                  │
└───────────────────┬─────────────────────────────────────┘
                    │ Bridge / Relayer ← NOT IMPLEMENTED
                    │ (LayerZero / Hyperlane / custom)
┌───────────────────▼─────────────────────────────────────┐
│  LAYER 2 — CONFIDENTIAL COMPUTE                         │
│  Zama fhEVM (chain 9000 / Sepolia)                     │
│                                                          │
│  ✅ Implemented:                                         │
│    • ConfidentialToken.sol (TFHE.sol, euint64)          │
│    • ConfidentialStrategyAgent.sol (5 encrypted params) │
│    • fhevmjs batch encryption (single proof, 5 inputs)  │
│    • Gateway.requestDecryption callback pattern         │
│    • TFHE.lt / TFHE.add / TFHE.select homomorphic ops  │
│                                                          │
│  🔧 TODO:                                                │
│    • Deploy contracts to Zama Devnet / Sepolia          │
│    • Re-encryption balance display (EIP-712 + reencrypt)│
│    • ERC-20 approval step before shield()               │
└───────────────────┬─────────────────────────────────────┘
                    │ Oracle / Feed ← Simulated
┌───────────────────▼─────────────────────────────────────┐
│  LAYER 3 — AGENT / ORACLE                               │
│  Off-chain (browser simulation)                         │
│                                                          │
│  ✅ Implemented (simulated):                             │
│    • APY feed — random walk                             │
│    • Health factor feed — random walk                   │
│    • Local evaluation estimate                          │
│                                                          │
│  🔧 TODO:                                                │
│    • Chainlink price feed adapter                       │
│    • Aave health factor oracle                          │
│    • Automated keeper / cron execution                  │
└─────────────────────────────────────────────────────────┘
```

---

## Base Deployment Reality Check

> This section explains honestly what works on Base today and what requires future work.

### ✅ What works on Base Sepolia right now

| Feature | Status |
|---|---|
| Wallet connection on Base Sepolia | Works — RainbowKit lists Base Sepolia as default |
| Base Sepolia Basescan explorer links | Works — `https://sepolia.basescan.org` |
| Base-first wagmi chain ordering | Works — Base Sepolia is chain[0] |
| "Built for Base" / "Powered by Zama fhEVM" branding | Works |

### ❌ What does NOT yet work on Base

| Feature | Reason | Path to fix |
|---|---|---|
| `ConfidentialToken.shield()` | Zama TFHE precompiles do NOT exist on Base or Base Sepolia (OP Stack) | Deploy on Zama network; add bridge |
| `ConfidentialStrategyAgent.createStrategy()` | Same — fhEVM is a separate network | Deploy on Zama network |
| Confidential balance display | Requires fhevmjs connected to Zama RPC | Bridge + fhevmjs on Zama side |
| Cross-chain settlement flow | Bridge not implemented | See TODO list below |

### Why Zama fhEVM can't run natively on Base

Base is an **OP Stack** L2. It uses the standard EVM with Optimism's modifications. It does not include Zama's TFHE executor precompile (deployed at a specific address on Zama's network only). This is not a limitation of Base — it is simply that fhEVM is a separate network with additional cryptographic infrastructure.

Possible future paths:
1. **EVM equivalence route**: Zama deploys their precompile system on Base via a validator extension — possible but requires coordination with Base/Optimism.
2. **Coprocessor route**: A trusted off-chain coprocessor (like Zama's own) processes FHE operations and posts results back to Base — reduces trust assumptions but adds latency.
3. **Cross-chain route** (current design): User deposits on Base, bridge relays to Zama network for FHE computation, results settle back on Base.

---

## Base Integration TODO List

Complete roadmap to make this a fully functional Base-first application:

### Immediate (contracts)

- [x] **BaseVault.sol written and tested** (50 tests passing)
  - Deposits, withdrawals, strategy linking, relayer auth
  - See `contracts/contracts/BaseVault.sol`
- [ ] **Deploy BaseVault.sol on Base Sepolia**
  - Run `cd contracts && npm run deploy:vault:baseSepolia`
  - Copy address → `NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA`

### Bridge / Relayer

- [ ] **Connect Base deposits to fhEVM computation layer**
  - Listen for `DepositInitiated` events on Base
  - Relay deposit message to Zama Sepolia (or Devnet)
  - Call `ConfidentialToken.shield(amount)` on Zama side
  - Protocol candidates: [LayerZero OFT](https://layerzero.network/), [Hyperlane](https://hyperlane.xyz/), [Wormhole](https://wormhole.com/)

- [ ] **Add relayer service**
  - Off-chain service that monitors Base events
  - Signs and submits cross-chain messages
  - Handles retries, gas, and failure recovery

- [ ] **Add bridge/message passing**
  - On-chain contracts on both sides to verify cross-chain messages
  - Handle finality differences (Base ~2s, Zama ~varies)

### Settlement

- [ ] **Test Base settlement flow end-to-end**
  - User shields on Base → funds bridged → shielded on Zama
  - User unshields on Zama → Gateway decrypts → bridged back → released on Base
  - Full round-trip test on testnets before any mainnet consideration

### UX

- [ ] **Deploy Base Vault contract** and update `NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA`
- [ ] **Add network switching prompt** when user is on Base but tries fhEVM operation
- [ ] **Show pending cross-chain transactions** in history with two-chain status

---

## Quick Start (Base Sepolia)

```bash
# 1. Install and configure
npm install
cp .env.example .env.local

# 2. Add to .env.local (Base Sepolia = wallet default, no further setup needed)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
# Base RPC is public — no API key required for devnet:
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# 3. Run
npm run dev   # Wallet defaults to Base Sepolia

# 4. For fhEVM encrypted operations, also set:
NEXT_PUBLIC_CONTRACT_ADDRESS_ZAMA_DEVNET=<after deploy:zamaDevnet>
NEXT_PUBLIC_FHEVM_ACL_ADDRESS=<from docs.zama.ai>
NEXT_PUBLIC_FHEVM_KMS_ADDRESS=<from docs.zama.ai>
```

---

## License

MIT
