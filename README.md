# ConfidentialFi – Confidential Transfer DApp

A full-stack Web3 application for private token transfers using zero-knowledge proofs, built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, **RainbowKit**, **wagmi**, and **viem**.

---

## Features

- **Wallet Connection** – RainbowKit modal supporting MetaMask, WalletConnect, Coinbase Wallet, and 200+ others
- **Confidential Transfers** – Send tokens where the amount is hidden using Pedersen commitments and ZK proofs
- **Shield / Unshield** – Move tokens in and out of the private pool
- **Transfer History** – Paginated, filterable table with private-amount masking
- **Dashboard** – Balance overview, protocol stats, and recent activity feed
- **Dark UI** – Full dark theme with subtle green accent, glass effects, and smooth animations
- **Responsive** – Mobile-first layout with a native-feel bottom navigation bar
- **Vercel-Ready** – Zero-config deployment with App Router and Edge compatibility

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Wallet UX | RainbowKit v2 |
| Blockchain hooks | wagmi v2 |
| Low-level Ethereum | viem v2 |
| Server state | TanStack Query v5 |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout – wraps providers, navbar, mobile nav
│   ├── page.tsx            # Redirects / → /dashboard
│   ├── dashboard/page.tsx  # Portfolio overview page
│   ├── transfer/page.tsx   # Shield / unshield / confidential send page
│   └── history/page.tsx    # Paginated transfer history page
│
├── components/
│   ├── ui/                 # Headless, reusable primitives
│   │   ├── Button.tsx      # Polymorphic button with variants (primary / secondary / ghost / danger / outline)
│   │   ├── Card.tsx        # Card + CardHeader + CardTitle + CardContent
│   │   ├── Input.tsx       # Labeled input with left/right addons, error state
│   │   ├── Badge.tsx       # Status / type badges with dot indicator
│   │   └── Tooltip.tsx     # Hover tooltip
│   │
│   ├── wallet/
│   │   └── ConnectButton.tsx  # Custom RainbowKit connect button (address pill, chain switcher)
│   │
│   ├── layout/
│   │   ├── Navbar.tsx      # Sticky top navbar with logo + desktop nav + wallet button
│   │   └── MobileNav.tsx   # Fixed bottom tab bar for mobile
│   │
│   ├── dashboard/
│   │   ├── BalanceCard.tsx       # Public + shielded balance display with CTA buttons
│   │   ├── StatsCard.tsx         # Metric tile with icon, trend indicator
│   │   ├── RecentTransactions.tsx # Latest 5 transfers feed
│   │   └── NetworkStats.tsx       # Protocol-level aggregates
│   │
│   ├── transfer/
│   │   ├── TransferForm.tsx  # Tabbed form: Confidential Send / Shield / Unshield
│   │   └── HowItWorks.tsx    # Step-by-step protocol explanation
│   │
│   └── history/
│       ├── TransactionTable.tsx  # Desktop table + mobile card list with pagination
│       └── HistoryStats.tsx      # Summary stat tiles for history page
│
├── hooks/
│   ├── useTokenBalance.ts          # Reads public + shielded balances via wagmi
│   ├── useTransferHistory.ts       # localStorage-backed history with demo seeding
│   └── useConfidentialTransfer.ts  # shield / unshield / confidentialTransfer actions
│
├── lib/
│   ├── wagmi.ts       # wagmi + RainbowKit config (chains, projectId)
│   ├── constants.ts   # Contract addresses, ABI, chain IDs, polling config
│   └── utils.ts       # cn(), formatTokenAmount, shortenAddress, ZK mock helpers
│
├── providers/
│   └── Web3Provider.tsx  # WagmiProvider + QueryClientProvider + RainbowKitProvider
│
└── types/
    └── index.ts  # Shared TypeScript interfaces (Transfer, TokenBalance, etc.)
```

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-org/fhe-private-dapp.git
cd fhe-private-dapp
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | Description | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID | [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA` | ConfidentialToken on Sepolia | Deploy the contract (see below) |
| `NEXT_PUBLIC_CONTRACT_ADDRESS_BASE_SEPOLIA` | ConfidentialToken on Base Sepolia | Deploy the contract (see below) |
| `NEXT_PUBLIC_RPC_URL_SEPOLIA` | (Optional) Alchemy/Infura RPC | [alchemy.com](https://alchemy.com) |

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build for production

```bash
npm run build
npm start
```

---

## Deploy to Vercel

1. Push your code to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Add environment variables in the Vercel dashboard (same as `.env.local`).
4. Click **Deploy**. Vercel auto-detects Next.js and configures everything.

---

## Smart Contract

The dapp expects a `ConfidentialToken` contract with the following interface (ABI defined in `src/lib/constants.ts`):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IConfidentialToken {
    // Read
    function publicBalanceOf(address account) external view returns (uint256);
    function shieldedBalanceOf(address account) external view returns (bytes32 commitment);
    function totalShielded() external view returns (uint256);
    function transferCount(address account) external view returns (uint256);

    // Write
    function shield(uint256 amount) external;
    function unshield(uint256 amount, address recipient) external;
    function confidentialTransfer(
        address to,
        bytes32 encryptedAmount,
        bytes calldata proof,
        bytes calldata note
    ) external;

    // Events
    event Shielded(address indexed account, uint256 amount);
    event Unshielded(address indexed account, address indexed recipient, uint256 amount);
    event ConfidentialTransfer(address indexed from, address indexed to, bytes32 encryptedAmount);
}
```

For a production deployment you would implement:
- **Pedersen commitments** for amount hiding
- **Groth16 / PLONK verifier** (generated via [Noir](https://noir-lang.org/) or [snarkjs](https://github.com/iden3/snarkjs))
- **View key** derivation for balance decryption

A ready-made reference implementation can be found in [Aztec Protocol](https://docs.aztec.network/) or [Semaphore](https://semaphore.pse.dev/).

---

## ZK Proof Note

In this demo the proof generation calls `mockProof()` in `src/lib/utils.ts` which generates a random 64-byte blob. In production, replace this with a real WASM prover:

```ts
// Example using snarkjs
import { groth16 } from "snarkjs";

const { proof, publicSignals } = await groth16.fullProve(
  { amount, senderKey, receiverKey, nonce },
  "circuit.wasm",
  "circuit_final.zkey"
);
const proofBytes = encodeProof(proof); // ABI-encode for on-chain verification
```

---

## License

MIT
