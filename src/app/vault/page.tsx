import type { Metadata } from "next";
import { VaultDeposit } from "@/components/vault/VaultDeposit";
import { VaultBalance } from "@/components/vault/VaultBalance";
import { RelayerStatus } from "@/components/vault/RelayerStatus";
import { BaseArchitecture } from "@/components/architecture/BaseArchitecture";

export const metadata: Metadata = {
  title: "Base Vault — Settlement Layer",
};

/**
 * Vault page — Layer 1 (Base Sepolia settlement).
 *
 * Users deposit ERC-20 tokens on Base Sepolia.
 * The cross-chain bridge to Zama fhEVM is TODO.
 */
export default function VaultPage() {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold text-white">Base Vault</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium">
            Layer 1 — Settlement
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-surface-500 border border-surface-400/40 text-xs text-gray-400 font-medium">
            Base Sepolia (84532)
          </span>
        </div>
        <p className="text-sm text-gray-400 max-w-2xl">
          Deposit ERC-20 tokens on Base Sepolia. Events are emitted for the relayer to
          bridge deposits to Zama fhEVM for confidential computation. The bridge is not
          yet deployed — use Emergency Withdraw to recover funds during development.
        </p>
      </div>

      {/* What this layer does */}
      <div className="rounded-2xl border border-blue-500/15 bg-gradient-to-r from-blue-500/5 to-transparent p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "ERC-20 Deposits",
              desc: "Lock tokens on Base Sepolia. SafeERC20 transfer, per-user balance tracking.",
              tag: "Works",
              ok: true,
            },
            {
              label: "Relayer Events",
              desc: "DepositCreated + WithdrawalRequested emitted for bridge consumption.",
              tag: "Works",
              ok: true,
            },
            {
              label: "Bridge to Zama fhEVM",
              desc: "Relayer picks up events and calls ConfidentialToken.shield() on Zama.",
              tag: "TODO",
              ok: false,
            },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <span className={`shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border
                ${item.ok
                  ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                {item.tag}
              </span>
              <div>
                <p className="text-xs font-semibold text-white">{item.label}</p>
                <p className="text-[10px] text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Deposit form */}
        <div className="lg:col-span-3 space-y-5">
          <VaultDeposit />
        </div>

        {/* Balance + relayer status */}
        <div className="lg:col-span-2 space-y-5">
          <VaultBalance tokenAddress={null} />
          <RelayerStatus />
        </div>
      </div>

      {/* Architecture reference */}
      <BaseArchitecture compact />

      {/* Contract events */}
      <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Contract Events (for Relayer)</h3>
        <p className="text-xs text-gray-400 mb-4">
          These events are emitted by BaseVault and consumed by the off-chain relayer bridge.
          The relayer listens for them and bridges to Zama fhEVM. Contract address is configured
          via <code className="text-brand-400">NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA</code>.
        </p>
        <div className="space-y-2">
          {[
            {
              name: "DepositCreated",
              args: "(user, token, amount, strategyId)",
              desc: "Relayer calls ConfidentialToken.shield(amount) on Zama fhEVM",
              status: "Emitted ✓",
            },
            {
              name: "WithdrawalRequested",
              args: "(user, token, amount)",
              desc: "Relayer calls ConfidentialToken.requestUnshield() on Zama fhEVM",
              status: "Emitted ✓",
            },
            {
              name: "StrategyLinked",
              args: "(user, strategyId)",
              desc: "Relayer notes which strategy to interact with on Zama fhEVM",
              status: "Emitted ✓",
            },
          ].map((ev) => (
            <div key={ev.name} className="flex items-start gap-3 rounded-xl bg-surface-600/40 border border-surface-400/30 p-3">
              <code className="text-xs text-brand-400 font-bold shrink-0">{ev.name}</code>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-gray-400 mb-0.5">{ev.args}</p>
                <p className="text-[10px] text-gray-500">{ev.desc}</p>
              </div>
              <span className="text-[9px] text-brand-400 shrink-0">{ev.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
