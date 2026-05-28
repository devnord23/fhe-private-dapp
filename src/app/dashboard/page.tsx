import type { Metadata } from "next";
import Link from "next/link";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { ArchitectureFlow } from "@/components/architecture/ArchitectureFlow";
import { GlassCard, GlassCardAccentBar } from "@/components/ui/GlassCard";

export const metadata: Metadata = { title: "Dashboard" };

// ── Layer status card data ─────────────────────────────────────────────────────

const LAYERS = [
  {
    id: "base",
    color: "blue" as const,
    dotClass: "status-dot-blue",
    status: "Active",
    title: "Base Settlement",
    desc: "User deposits, withdrawals, and gas payments on Base Sepolia.",
    chain: "Chain 84532",
    pill: "pill-blue",
    pillText: "Live",
  },
  {
    id: "fhevm",
    color: "green" as const,
    dotClass: "status-dot-live",
    status: "Configured",
    title: "Confidential Compute",
    desc: "TFHE homomorphic operations on encrypted strategy parameters.",
    chain: "Chain 11155111",
    pill: "pill-green",
    pillText: "Ready",
  },
  {
    id: "bridge",
    color: "orange" as const,
    dotClass: "",
    status: "TODO",
    title: "Bridge / Relayer",
    desc: "Cross-chain message passing between Base and Zama fhEVM.",
    chain: "LayerZero / Hyperlane",
    pill: "pill-orange",
    pillText: "Pending",
  },
];

const STATS = [
  { label: "Total Shielded",  value: "4.28M", unit: "CTOK", delta: "+12.4%", up: true  },
  { label: "Privacy Model",   value: "FHE",   unit: "TFHE",  delta: "Zama",  up: true  },
  { label: "Settlement",      value: "Base",  unit: "L2",    delta: "EVM",   up: true  },
  { label: "Avg Block Time",  value: "~2s",   unit: "Base",  delta: "Sepolia", up: true },
];

export default function DashboardPage() {
  return (
    <div className="animate-fade-in space-y-10">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative rounded-3xl overflow-hidden">
        {/* Mesh background */}
        <div className="absolute inset-0 bg-hero-mesh" />
        <div className="absolute inset-0 bg-grid opacity-40" />
        {/* Glow orbs */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-base-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 right-0 w-80 h-80 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

        <div
          className="relative border border-white/[0.07] rounded-3xl p-8 sm:p-12"
          style={{ backdropFilter: "blur(2px)" }}
        >
          <div className="max-w-2xl">
            {/* Label */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <span className="pill-blue">Built for Base</span>
              <span className="pill-green">Powered by Zama fhEVM</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl font-bold leading-[1.08] tracking-tight mb-4">
              <span className="text-white">Private Agentic</span>
              <br />
              <span className="text-gradient-dual">DeFi on Base</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base text-gray-400 leading-relaxed mb-8 max-w-lg">
              Encrypted strategy execution powered by Zama fhEVM.
              Deposit on Base Sepolia, evaluate confidentially on the compute layer.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/vault"
                className="inline-flex items-center gap-2 rounded-xl bg-base-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-base-600 transition-colors shadow-glow-blue"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Deposit on Base
              </Link>
              <Link
                href="/strategy"
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white px-5 py-2.5 text-sm font-semibold hover:bg-white/[0.1] transition-colors"
              >
                <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Launch Agent
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-10 pt-8 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-5">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="section-label mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{s.unit} · {s.delta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Layer status cards ───────────────────────────────────────────────── */}
      <section>
        <p className="section-label mb-4">Infrastructure Layers</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LAYERS.map((layer) => (
            <GlassCard key={layer.id} accent={layer.color} className="relative overflow-hidden">
              <GlassCardAccentBar color={layer.color} />
              <div className="flex items-center gap-2 mb-4">
                <span className={layer.dotClass || "w-2 h-2 rounded-full bg-orange-400"} />
                <span className={layer.pill}>{layer.pillText}</span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{layer.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">{layer.desc}</p>
              <p className="font-mono text-[10px] text-gray-600">{layer.chain}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <BalanceCard />
        </div>
        <div className="lg:col-span-2">
          <RecentTransactions />
        </div>
      </div>

      {/* ── Architecture flow ────────────────────────────────────────────────── */}
      <section>
        <p className="section-label mb-4">Data Flow</p>
        <ArchitectureFlow />
      </section>

    </div>
  );
}
