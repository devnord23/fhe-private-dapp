import type { Metadata } from "next";
import Link from "next/link";
import { ArchitectureFlow } from "@/components/architecture/ArchitectureFlow";
import { isDemoMode } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "ConfidentialFi — Private Agentic DeFi on Base",
  description:
    "Deposit on Base Sepolia. Execute encrypted DeFi strategies powered by Zama fhEVM. Fully Homomorphic Encryption — no ZK proofs, no fake privacy.",
};

// ── Static feature cards ──────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🔒",
    color: "green" as const,
    title: "Fully Homomorphic Encryption",
    desc: "Strategy parameters stored as euint64 ciphertexts on Zama fhEVM nodes. TFHE.lt / TFHE.add / TFHE.select run on-chain without ever decrypting.",
    tag: "Real",
  },
  {
    icon: "🔵",
    color: "blue" as const,
    title: "Base Sepolia Settlement",
    desc: "Deposits and withdrawals on Base Sepolia (chain 84532). BaseVault.sol locks ERC-20 tokens and emits events for the bridge relayer.",
    tag: "Real",
  },
  {
    icon: "⚡",
    color: "orange" as const,
    title: "Autonomous Agent",
    desc: "The off-chain agent encrypts live market feeds and calls evaluateStrategy(). Neither the agent nor the contract sees the outcome — only the Zama Gateway can decrypt.",
    tag: "MVP",
  },
  {
    icon: "🌉",
    color: "gray" as const,
    title: "Cross-chain Bridge",
    desc: "A relayer service connects Base deposits to Zama fhEVM operations. The bridge (LayerZero / Hyperlane) that moves tokens between layers is the remaining TODO.",
    tag: "TODO",
  },
];

const COLOR_MAP = {
  green:  { border: "border-brand-500/20",  bg: "bg-brand-500/[0.04]",  tag: "bg-brand-500/10 text-brand-400 border-brand-500/20"  },
  blue:   { border: "border-base-500/20",   bg: "bg-base-500/[0.04]",   tag: "bg-base-500/10 text-base-400 border-base-500/20"    },
  orange: { border: "border-orange-500/15", bg: "bg-orange-500/[0.03]", tag: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  gray:   { border: "border-white/[0.06]",  bg: "bg-white/[0.02]",      tag: "bg-surface-400/40 text-gray-500 border-surface-300/20" },
};

// ── Privacy comparison ────────────────────────────────────────────────────────

const PRIVACY_ROWS = [
  { aspect: "Mechanism",        fhe: "Fully Homomorphic Encryption (FHE)",  zk: "Zero-Knowledge Proofs" },
  { aspect: "On-chain compute", fhe: "Computes on ciphertexts directly",    zk: "Verifies a proof of off-chain computation" },
  { aspect: "Amount privacy",   fhe: "✓ Amounts encrypted as euint64",      zk: "✓ Via commitments / nullifiers" },
  { aspect: "Strategy params",  fhe: "✓ All thresholds stay encrypted",     zk: "✗ Typically revealed to prover" },
  { aspect: "Client burden",    fhe: "Fast — fhevmjs encrypt() is ~ms",     zk: "Slow — WASM prover ~seconds" },
  { aspect: "This project",     fhe: "✓ This is what we use",               zk: "✗ Not used here" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const demo = isDemoMode();

  return (
    <div className="animate-fade-in">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] flex items-center">
        {/* Background layers */}
        <div className="absolute inset-0 bg-hero-mesh pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] bg-base-500/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <span className="pill-blue">Built for Base</span>
            <span className="pill-green">Powered by Zama fhEVM</span>
            {demo && (
              <span className="pill-orange">Demo Mode — No Contracts Deployed</span>
            )}
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.04] mb-6">
            <span className="text-white">Private Agentic</span>
            <br />
            <span className="text-gradient-dual">DeFi on Base</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-400 leading-relaxed mb-10 max-w-2xl">
            Deposit on Base Sepolia. Execute encrypted DeFi strategies powered by Zama fhEVM.
            Strategy parameters stay encrypted on-chain using Fully Homomorphic Encryption —
            no plaintext ever touches the chain.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 mb-16">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 rounded-xl bg-base-500 text-white px-6 py-3 text-sm font-semibold hover:bg-base-600 active:scale-[0.98] transition-all shadow-glow-blue"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Launch Dashboard
            </Link>

            <a
              href="#architecture"
              className="inline-flex items-center gap-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white px-6 py-3 text-sm font-semibold hover:bg-white/[0.1] active:scale-[0.98] transition-all"
            >
              <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              View Architecture
            </a>

            <Link
              href="/vault"
              className="inline-flex items-center gap-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 px-6 py-3 text-sm font-semibold hover:bg-brand-500/15 active:scale-[0.98] transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Deposit on Base
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="flex flex-col items-center gap-2 opacity-30">
            <div className="w-px h-12 bg-gradient-to-b from-white to-transparent" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">scroll</p>
          </div>
        </div>
      </section>

      {/* ── Demo Mode notice ─────────────────────────────────────────────────── */}
      {demo && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto mb-16">
          <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.03] p-5 flex gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/15">
              <svg className="h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/80 mb-1">Demo Mode Active</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                No contracts are deployed yet. All pages render fully — forms show
                &ldquo;not deployed&rdquo; states instead of sending transactions.
                Follow the{" "}
                <a
                  href="https://github.com/devnord23/fhe-private-dapp/blob/main/TESTNET_DEPLOYMENT.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
                >
                  deployment guide
                </a>{" "}
                to activate all features.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Architecture preview ─────────────────────────────────────────────── */}
      <section id="architecture" className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto mb-20">
        <div className="mb-8">
          <p className="section-label mb-2">System Architecture</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Three-layer privacy stack
          </h2>
          <p className="text-sm text-gray-500 mt-2 max-w-lg">
            Base handles settlement. Zama fhEVM handles confidential computation.
            A bridge relayer connects them.
          </p>
        </div>

        <ArchitectureFlow />

        {/* Layer descriptions */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              num: "L1",
              label: "Base Sepolia",
              role: "Settlement",
              desc: "User-facing chain. Deposits, withdrawals, gas. Fast finality, low cost.",
              color: "blue" as const,
            },
            {
              num: "L2",
              label: "Bridge / Relayer",
              role: "Relay",
              desc: "Off-chain service that bridges events from Base to Zama fhEVM. Implemented as MVP; decentralized bridge is TODO.",
              color: "orange" as const,
            },
            {
              num: "L3",
              label: "Zama fhEVM",
              role: "Compute",
              desc: "Encrypted balances (euint64). Homomorphic strategy evaluation. Gateway decryption for reveals.",
              color: "green" as const,
            },
          ].map((layer) => {
            const cm = COLOR_MAP[layer.color];
            return (
              <div key={layer.num} className={`rounded-xl border p-4 ${cm.bg} ${cm.border}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${cm.tag}`}>
                    {layer.num}
                  </span>
                  <span className="text-xs font-semibold text-white/80">{layer.role}</span>
                </div>
                <p className="text-xs font-medium text-white mb-1">{layer.label}</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">{layer.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto mb-20">
        <p className="section-label mb-2">Capabilities</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8">
          What&apos;s real, what&apos;s coming
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => {
            const cm = COLOR_MAP[f.color];
            return (
              <div
                key={f.title}
                className={`rounded-2xl border p-5 transition-all duration-200 hover:border-opacity-60 ${cm.bg} ${cm.border}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{f.icon}</span>
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-full border uppercase tracking-wide ${cm.tag}`}>
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FHE vs ZK comparison ──────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto mb-20">
        <p className="section-label mb-2">Technology</p>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          FHE is not ZK proofs
        </h2>
        <p className="text-sm text-gray-500 mb-8 max-w-lg">
          This project uses Fully Homomorphic Encryption, not zero-knowledge proofs.
          They solve different problems.
        </p>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-3 border-b border-white/[0.06]">
            <div className="px-4 py-3 text-[10px] font-mono text-gray-600 uppercase tracking-wider" />
            <div className="px-4 py-3 border-l border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="status-dot-live shrink-0" />
                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">FHE (this project)</span>
              </div>
            </div>
            <div className="px-4 py-3 border-l border-white/[0.06]">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ZK Proofs</span>
            </div>
          </div>

          {PRIVACY_ROWS.map((row, i) => (
            <div
              key={row.aspect}
              className={`grid grid-cols-3 ${i < PRIVACY_ROWS.length - 1 ? "border-b border-white/[0.04]" : ""}`}
            >
              <div className="px-4 py-3">
                <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wide">{row.aspect}</span>
              </div>
              <div className="px-4 py-3 border-l border-white/[0.04]">
                <span className="text-[11px] text-gray-300">{row.fhe}</span>
              </div>
              <div className="px-4 py-3 border-l border-white/[0.04]">
                <span className="text-[11px] text-gray-500">{row.zk}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto mb-24">
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.07] bg-white/[0.02] p-10 sm:p-14 text-center">
          <div className="absolute inset-0 bg-hero-mesh opacity-60 pointer-events-none" />
          <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

          <div className="relative">
            <p className="section-label mb-4">Ready to start?</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Deposit on Base, compute in private
            </h2>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              Connect your wallet to Base Sepolia and start the encrypted DeFi flow.
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/vault"
                className="inline-flex items-center gap-2 rounded-xl bg-base-500 text-white px-5 py-2.5 text-sm font-semibold hover:bg-base-600 transition-colors shadow-glow-blue"
              >
                Open Vault
              </Link>
              <Link
                href="/strategy"
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white px-5 py-2.5 text-sm font-semibold hover:bg-white/[0.1] transition-colors"
              >
                Create Strategy
              </Link>
              <a
                href="https://github.com/devnord23/fhe-private-dapp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-400 px-5 py-2.5 text-sm font-medium hover:bg-white/[0.08] transition-colors"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View Source
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
