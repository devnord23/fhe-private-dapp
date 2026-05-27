"use client";

import { useChainId } from "wagmi";
import { cn } from "@/lib/utils";
import { isBaseChain, isFhevmChain } from "@/lib/utils";

/**
 * BaseArchitecture — Three-layer architecture diagram.
 *
 * Shows the full system architecture for "Private Agentic DeFi on Base":
 *   Layer 1: Base (settlement / user-facing)
 *   Layer 2: Zama fhEVM (confidential compute)
 *   Layer 3: Off-chain agent / oracle
 *
 * Every claim in this component is technically accurate.
 * Items marked TODO are not yet implemented.
 */

interface LayerStatus {
  real: string[];
  todo: string[];
}

const LAYER_1: LayerStatus = {
  real: [
    "Wallet connection (Base Sepolia default)",
    "Explorer links to Basescan",
    "Base Sepolia listed as default RPC in wagmi config",
    "Public token balance display via viem",
  ],
  todo: [
    "BaseVault.sol — lock tokens on Base for bridging",
    "Deposit/withdrawal UI for Base-native assets",
    "Gas estimation for Base transactions",
    "Coinbase Smart Wallet integration",
  ],
};

const LAYER_2: LayerStatus = {
  real: [
    "ConfidentialToken.sol — euint64 balances, TFHE arithmetic",
    "ConfidentialStrategyAgent.sol — 5 encrypted params, homomorphic eval",
    "fhevmjs client-side encryption (batch input proof)",
    "Gateway.requestDecryption callback pattern",
    "TFHE.lt / TFHE.add / TFHE.select homomorphic operations",
    "ACL permissions via TFHE.allow()",
  ],
  todo: [
    "Deploy ConfidentialToken to Zama Devnet / Sepolia",
    "Wire re-encryption balance display (EIP-712 + reencrypt())",
    "ERC-20 approval UX before shield()",
    "Real fhEVM integration tests (FHEVM_NETWORK=zamaDevnet)",
  ],
};

const LAYER_3: LayerStatus = {
  real: [
    "Simulated APY feed (random walk, useAgentFeeds hook)",
    "Simulated health factor feed",
    "Local strategy evaluation estimate (client-side plaintext)",
  ],
  todo: [
    "Chainlink price feed adapter for real APY data",
    "Aave health factor oracle integration",
    "Uniswap V3 TWAP for token prices",
    "Automated agent execution (cron / keeper network)",
  ],
};

const BRIDGE: LayerStatus = {
  real: [],
  todo: [
    "Cross-chain message passing: Base → Zama fhEVM",
    "Token locking on Base Vault + shielded mint on Zama",
    "Decrypted unshield → bridge back → Base release",
    "Choose bridge protocol (LayerZero / Hyperlane / custom)",
    "Relayer service for automated message delivery",
    "Bridge security audit before any mainnet use",
  ],
};

export function BaseArchitecture({ compact = false }: { compact?: boolean }) {
  const chainId = useChainId();
  const onBase = isBaseChain(chainId);
  const onFhevm = isFhevmChain(chainId);

  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-surface-500/40">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-white">
            System Architecture
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
            Built for Base
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 font-medium">
            Powered by Zama fhEVM
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Three independent layers. The bridge connecting Base to Zama fhEVM is not yet implemented.
        </p>
      </div>

      <div className="p-5 space-y-3">
        {/* Layer 1: Base */}
        <Layer
          number="1"
          title="Base / Base Sepolia"
          subtitle="Settlement · User-facing · Default wallet chain"
          chainTag="84532 / 8453"
          color="blue"
          isActive={onBase}
          activeLabel="Connected"
          status={LAYER_1}
          compact={compact}
          explorerUrl="https://sepolia.basescan.org"
        />

        {/* Bridge connector */}
        <BridgeConnector />

        {/* Layer 2: Zama fhEVM */}
        <Layer
          number="2"
          title="Zama fhEVM"
          subtitle="Confidential compute · TFHE precompiles · Gateway"
          chainTag="9000 / 11155111"
          color="green"
          isActive={onFhevm}
          activeLabel="Connected"
          status={LAYER_2}
          compact={compact}
          explorerUrl="https://main.explorer.zama.ai"
        />

        {/* Oracle connector */}
        <OracleConnector />

        {/* Layer 3: Agent */}
        <Layer
          number="3"
          title="Agent / Oracle"
          subtitle="Off-chain feeds · Evaluation engine · Keeper"
          chainTag="Off-chain"
          color="purple"
          isActive={false}
          activeLabel=""
          status={LAYER_3}
          compact={compact}
        />
      </div>

      {/* Bridge callout */}
      {!compact && (
        <div className="mx-5 mb-5 rounded-xl bg-red-500/5 border border-red-500/15 p-4">
          <p className="text-[10px] font-semibold text-red-400 mb-2">
            ❌ Layer 3 Bridge — NOT IMPLEMENTED
          </p>
          <ul className="space-y-1">
            {BRIDGE.todo.map((t) => (
              <li key={t} className="text-[10px] text-gray-400 flex gap-1.5">
                <span className="text-yellow-500 shrink-0">TODO</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BridgeConnector() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex-1 border-t border-dashed border-red-500/30" />
      <div className="flex items-center gap-1.5 rounded-lg bg-red-500/5 border border-red-500/20 px-2.5 py-1">
        <span className="text-[10px] text-red-400 font-medium">Bridge / Relayer</span>
        <span className="text-[9px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">TODO</span>
      </div>
      <div className="flex-1 border-t border-dashed border-red-500/30" />
    </div>
  );
}

function OracleConnector() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex-1 border-t border-dashed border-purple-500/30" />
      <div className="flex items-center gap-1.5 rounded-lg bg-purple-500/5 border border-purple-500/20 px-2.5 py-1">
        <span className="text-[10px] text-purple-400 font-medium">Oracle / Feed</span>
        <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">Simulated</span>
      </div>
      <div className="flex-1 border-t border-dashed border-purple-500/30" />
    </div>
  );
}

interface LayerProps {
  number: string;
  title: string;
  subtitle: string;
  chainTag: string;
  color: "blue" | "green" | "purple";
  isActive: boolean;
  activeLabel: string;
  status: LayerStatus;
  compact: boolean;
  explorerUrl?: string;
}

const COLOR_MAP = {
  blue:   { border: "border-blue-500/20",   bg: "bg-blue-500/5",   tag: "bg-blue-500/10 text-blue-400 border-blue-500/20",   num: "text-blue-400" },
  green:  { border: "border-brand-500/20",  bg: "bg-brand-500/5",  tag: "bg-brand-500/10 text-brand-400 border-brand-500/20", num: "text-brand-400" },
  purple: { border: "border-purple-500/20", bg: "bg-purple-500/5", tag: "bg-purple-500/10 text-purple-400 border-purple-500/20", num: "text-purple-400" },
};

function Layer({ number, title, subtitle, chainTag, color, isActive, activeLabel, status, compact, explorerUrl }: LayerProps) {
  const c = COLOR_MAP[color];

  return (
    <div className={cn("rounded-xl border p-4", c.border, c.bg)}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs font-bold font-mono", c.num)}>L{number}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium", c.tag)}>
            {chainTag}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-[9px] text-brand-400">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
              {activeLabel}
            </span>
          )}
        </div>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-500 hover:text-gray-300 shrink-0 transition-colors"
          >
            Explorer ↗
          </a>
        )}
      </div>

      <p className="text-[10px] text-gray-400 mb-3">{subtitle}</p>

      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {status.real.length > 0 && (
            <div>
              <p className="text-[9px] text-brand-400 font-semibold mb-1 uppercase tracking-wide">
                ✅ Implemented
              </p>
              <ul className="space-y-0.5">
                {status.real.map((item) => (
                  <li key={item} className="text-[10px] text-gray-400 flex gap-1.5">
                    <span className="shrink-0">•</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {status.todo.length > 0 && (
            <div>
              <p className="text-[9px] text-yellow-400 font-semibold mb-1 uppercase tracking-wide">
                🔧 TODO
              </p>
              <ul className="space-y-0.5">
                {status.todo.map((item) => (
                  <li key={item} className="text-[10px] text-gray-400 flex gap-1.5">
                    <span className="text-yellow-500/70 shrink-0">—</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
