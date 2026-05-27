# AGENTS.md

## Cursor Cloud specific instructions

### Repository overview

ConfidentialFi is a three-package monorepo (no workspace manager — each has its own `package.json` and `package-lock.json`):

| Package | Path | Purpose | Key commands |
|---|---|---|---|
| Frontend | `/workspace` (root) | Next.js 15 + RainbowKit web app | `npm run dev`, `npm run build`, `npm run lint` |
| Contracts | `/workspace/contracts` | Solidity (Hardhat) smart contracts | `npm run compile`, `npm test` |
| Relayer | `/workspace/relayer` | Off-chain bridge service (tsx/viem) | `npm run dev`, `npm test` |

### Running the development environment

- **Frontend**: `npm run dev` from the workspace root starts Next.js on port 3000.
- **Contracts**: `npm test` in `contracts/` runs Hardhat tests (85 passing + 10 skipped FHE tests that require a live Zama network).
- **Relayer**: `npm test` in `relayer/` runs vitest (20 tests).

### Non-obvious gotchas

- **Contracts `.env` needs a valid private key**: Hardhat will refuse to even compile if `DEPLOYER_PRIVATE_KEY` is empty or too short. For local-only work, use a dummy 32-byte hex key (e.g. `0000...0001`). The `.env.example` ships with `your_private_key_here` which will fail.
- **Frontend `.env.local`**: Copy `.env.example` to `.env.local`. The app will start without real values (placeholder `0x000…` addresses), but wallet-connect features require a real `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- **FHE tests are skipped locally**: Contract tests for `ConfidentialToken` and `ConfidentialStrategyAgent` FHE operations are skipped on the local Hardhat network (no TFHE precompiles). They require `FHEVM_NETWORK=zamaDevnet` against a live Zama deployment.
- **Three separate `npm install` calls**: Each package has its own lockfile. The update script handles all three.
- **Next.js WASM config**: `next.config.ts` enables `asyncWebAssembly` for fhevmjs. This causes circular-dependency warnings during `next build` — these are harmless.
- **Relayer `.env`**: Copy `relayer/.env.example` to `relayer/.env`. The relayer won't start in watch mode without it, but tests run fine regardless.
