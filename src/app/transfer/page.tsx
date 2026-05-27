import type { Metadata } from "next";
import { TransferForm } from "@/components/transfer/TransferForm";
import { HowItWorks } from "@/components/transfer/HowItWorks";

export const metadata: Metadata = {
  title: "Confidential Transfer",
};

export default function TransferPage() {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-white">Confidential Transfer</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs text-brand-400 font-medium">
            ZK-Powered
          </span>
        </div>
        <p className="text-sm text-gray-400">
          Send tokens privately. Shield your balance or make confidential transfers where the
          amount is provably hidden from all on-chain observers.
        </p>
      </div>

      {/* Privacy guarantees banner */}
      <div className="rounded-2xl border border-brand-500/15 bg-gradient-to-r from-brand-500/5 to-transparent p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Amount Privacy", desc: "Transfer amounts hidden via Pedersen commitments", icon: "🔒" },
            { label: "Proof Verified", desc: "ZK proof enforces balance constraints on-chain", icon: "✓" },
            { label: "Non-custodial", desc: "Only you can access your shielded balance", icon: "🛡" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="text-lg">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TransferForm />
        </div>
        <div className="lg:col-span-2">
          <HowItWorks />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-4 flex gap-3">
        <svg className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-xs text-yellow-400/80">
          <strong className="text-yellow-400">Testnet only.</strong> This dapp is currently
          deployed on Sepolia and Base Sepolia testnets. Do not send real funds. The ZK proof
          generation is simulated client-side for demonstration; production deployments use a WASM
          prover (e.g. Noir or snarkjs).
        </p>
      </div>
    </div>
  );
}
