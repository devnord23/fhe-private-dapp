# ConfidentialFi – Zama fhEVM Confidential Transfer DApp

A full-stack Web3 application for confidential token transfers using Zama's **Fully Homomorphic Encryption** (fhEVM).  Built with Next.js 15, TypeScript, Tailwind CSS, RainbowKit, wagmi, and viem.

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

## License

MIT
