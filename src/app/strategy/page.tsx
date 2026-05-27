import type { Metadata } from "next";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { AgentDashboard } from "@/components/strategy/AgentDashboard";
import { SecurityNote } from "@/components/strategy/SecurityNote";
import { BaseArchitecture } from "@/components/architecture/BaseArchitecture";

export const metadata: Metadata = {
  title: "Confidential Strategy Agent",
};

export default function StrategyPage() {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold text-white">Confidential Strategy Agent</h1>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium">
            Built for Base
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs text-brand-400 font-medium">
            Powered by Zama fhEVM
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 font-medium">
            Feeds Simulated
          </span>
        </div>
        <p className="text-sm text-gray-400 max-w-2xl">
          Private Agentic DeFi on Base — configure strategy parameters encrypted on Zama fhEVM.
          An autonomous agent evaluates encrypted conditions homomorphically. Base Sepolia is the
          user-facing chain; Zama fhEVM is the confidential compute layer.
        </p>
      </div>

      {/* Architecture callout */}
      <div className="rounded-2xl border border-brand-500/15 bg-gradient-to-r from-brand-500/5 to-transparent p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "5 Encrypted Params", desc: "apyTarget, threshold, stopLoss, liquidity, leverage via fhevmjs", tag: "Real" },
            { label: "Oblivious Eval",     desc: "TFHE.lt compares encrypted vs encrypted — neither party sees outcome", tag: "Real" },
            { label: "Simulated Feeds",    desc: "APY + health factor random walk. Replace with Chainlink in prod.", tag: "Simulated" },
            { label: "Balance Reveal",     desc: "EIP-712 sign → Gateway re-encrypt → local decrypt (not yet wired)", tag: "TODO" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <span className={`shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border
                ${item.tag === "Real"
                  ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                  : item.tag === "TODO"
                  ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  : "bg-orange-500/10 text-orange-400 border-orange-500/20"}`}>
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

      {/* Main two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Strategy creation form */}
        <div className="lg:col-span-2 space-y-6">
          <StrategyForm />
          <SecurityNote />
        </div>

        {/* Agent dashboard */}
        <div className="lg:col-span-3">
          <AgentDashboard />
        </div>
      </div>

      {/* Architecture diagram (compact on this page) */}
      <BaseArchitecture compact />
    </div>
  );
}
