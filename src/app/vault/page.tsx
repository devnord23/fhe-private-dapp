import type { Metadata } from "next";
import { VaultDeposit } from "@/components/vault/VaultDeposit";
import { VaultBalance } from "@/components/vault/VaultBalance";
import { RelayerStatus } from "@/components/vault/RelayerStatus";
import { ArchitectureFlow } from "@/components/architecture/ArchitectureFlow";

export const metadata: Metadata = { title: "Base Vault — Settlement Layer" };

export default function VaultPage() {
  return (
    <div className="animate-fade-in space-y-8">

      {/* ── Terminal header ──────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.02]">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-base-500 to-base-500/0" />
        <div className="relative p-6 sm:p-8">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="status-dot-blue" />
                <span className="section-label">Settlement Layer · Base Sepolia</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Base Vault
              </h1>
              <p className="text-sm text-gray-500 mt-1.5 max-w-md">
                Lock ERC-20 tokens on Base Sepolia. Events are emitted for the bridge
                relayer to shield funds on Zama fhEVM.
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
              <span className="pill-blue">Chain 84532</span>
              <span className="font-mono text-[10px] text-gray-600">BaseVault.sol</span>
            </div>
          </div>

          {/* Info strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Network",  value: "Base Sepolia",     mono: false },
              { label: "Contract", value: "BaseVault.sol",    mono: true  },
              { label: "Bridge",   value: "TODO",             mono: false },
              { label: "Privacy",  value: "Zama fhEVM Layer", mono: false },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3">
                <p className="section-label mb-1">{item.label}</p>
                <p className={item.mono
                  ? "font-mono text-xs text-brand-400"
                  : "text-xs font-medium text-white/80"}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Events emitted (relayer reference) ──────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <p className="section-label mb-4">Events Emitted for Relayer</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { name: "DepositCreated",     args: "(user, token, amount, strategyId)", desc: "→ Bridge should call shield() on Zama" },
            { name: "WithdrawalRequested", args: "(user, token, amount)",            desc: "→ Bridge should call requestUnshield() on Zama" },
            { name: "StrategyLinked",     args: "(user, strategyId)",               desc: "→ Maps Base user to Zama strategy" },
          ].map((ev) => (
            <div key={ev.name} className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
              <p className="font-mono text-xs font-semibold text-brand-400 mb-1">{ev.name}</p>
              <p className="font-mono text-[10px] text-gray-600 mb-1.5">{ev.args}</p>
              <p className="text-[10px] text-gray-500">{ev.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main deposit terminal ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <VaultDeposit />
        </div>
        <div className="lg:col-span-2 space-y-5">
          <VaultBalance tokenAddress={null} />
          <RelayerStatus />
        </div>
      </div>

      {/* ── Architecture flow ────────────────────────────────────────────────── */}
      <section>
        <p className="section-label mb-4">System Flow</p>
        <ArchitectureFlow compact />
      </section>
    </div>
  );
}
