import type { Metadata } from "next";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { AgentDashboard } from "@/components/strategy/AgentDashboard";
import { SecurityNote } from "@/components/strategy/SecurityNote";
import { ArchitectureFlow } from "@/components/architecture/ArchitectureFlow";

export const metadata: Metadata = { title: "Agent Control Panel" };

export default function StrategyPage() {
  return (
    <div className="animate-fade-in space-y-8">

      {/* ── Control panel header ─────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.02]">
        <div className="absolute inset-0 bg-grid opacity-25 pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-500 to-brand-500/0" />

        {/* Ambient glow */}
        <div className="absolute -top-16 left-20 w-64 h-64 bg-brand-500/6 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="status-dot-live" />
                <span className="section-label">Encrypted Agent · Zama fhEVM</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Agent Control Panel
              </h1>
              <p className="text-sm text-gray-500 mt-1.5 max-w-lg">
                Configure encrypted strategy parameters. The agent evaluates conditions
                homomorphically — thresholds never appear in plaintext on-chain.
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
              <span className="pill-green">Zama fhEVM</span>
              <span className="font-mono text-[10px] text-gray-600">TFHE Operations</span>
            </div>
          </div>

          {/* FHE status chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "fhevmjs Encryption",   active: true  },
              { label: "TFHE.lt / TFHE.add",   active: true  },
              { label: "Gateway Decryption",    active: true  },
              { label: "Re-encryption (view)",  active: false },
              { label: "Oracle Feeds",          active: false },
            ].map((chip) => (
              <div
                key={chip.label}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium border ${
                  chip.active
                    ? "bg-brand-500/8 border-brand-500/20 text-brand-400"
                    : "bg-surface-500/30 border-surface-400/20 text-gray-600"
                }`}
              >
                <span className={`w-1 h-1 rounded-full ${chip.active ? "bg-brand-400" : "bg-gray-600"}`} />
                {chip.label}
                {!chip.active && <span className="text-yellow-500/70 ml-0.5">TODO</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Oblivious evaluation explainer ──────────────────────────────────── */}
      <div className="rounded-2xl border border-brand-500/10 bg-brand-500/[0.03] p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: "🔐",
              label: "Client-Side Encryption",
              desc: "fhevmjs encrypts all 5 parameters before the tx is signed. Plaintexts never leave your browser.",
              tag: "Real", ok: true,
            },
            {
              icon: "⊕",
              label: "Oblivious Evaluation",
              desc: "Agent knows current feeds. You know thresholds. Neither knows the outcome. Only Zama Gateway can decrypt.",
              tag: "Real", ok: true,
            },
            {
              icon: "🔑",
              label: "Balance Re-encryption",
              desc: "EIP-712 sign → Gateway re-encrypt → local decrypt. Wires the 'Reveal Balance' UI flow.",
              tag: "TODO", ok: false,
            },
          ].map((item) => (
            <div key={item.label} className="flex gap-3">
              <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-semibold text-white">{item.label}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    item.ok
                      ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  }`}>{item.tag}</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main two-column layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-6">
          <StrategyForm />
          <SecurityNote />
        </div>
        <div className="lg:col-span-3">
          <AgentDashboard />
        </div>
      </div>

      {/* ── Architecture flow ────────────────────────────────────────────────── */}
      <section>
        <p className="section-label mb-4">Compute Flow</p>
        <ArchitectureFlow compact />
      </section>
    </div>
  );
}
