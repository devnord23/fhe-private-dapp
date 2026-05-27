import type { Metadata } from "next";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { NetworkStats } from "@/components/dashboard/NetworkStats";

export const metadata: Metadata = {
  title: "Dashboard",
};

const SHIELD_ICON = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const TX_ICON = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const LOCK_ICON = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const GAS_ICON = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

export default function DashboardPage() {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Overview of your confidential token activity and balances
        </p>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Total Shielded"
          value="4.28M"
          subtitle="CTOK locked in pool"
          icon={SHIELD_ICON}
          trend={{ value: "12.4%", positive: true }}
          accent
        />
        <StatsCard
          title="Your Transfers"
          value="—"
          subtitle="Connect wallet to view"
          icon={TX_ICON}
        />
        <StatsCard
          title="Privacy Level"
          value="ZK"
          subtitle="Zero-knowledge proofs"
          icon={LOCK_ICON}
        />
        <StatsCard
          title="Avg Gas"
          value="~12 gwei"
          subtitle="Current network price"
          icon={GAS_ICON}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Balance card – takes 1/3 on desktop */}
        <div className="lg:col-span-1 space-y-6">
          <BalanceCard />
          <NetworkStats />
        </div>

        {/* Recent transactions – takes 2/3 on desktop */}
        <div className="lg:col-span-2">
          <RecentTransactions />
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            title: "Fully Homomorphic Encryption",
            description:
              "Powered by Zama's fhEVM. Balances are stored as encrypted ciphertexts on Zama nodes. The contract performs arithmetic (add, sub, compare) on ciphertexts — amounts are never decrypted on-chain.",
            icon: "🔐",
            tag: "Real",
          },
          {
            title: "fhevmjs Client Encryption",
            description:
              "The browser SDK encrypts amounts locally before any transaction is sent. The plaintext never leaves your device. The contract receives a ciphertext handle + input proof.",
            icon: "🛡️",
            tag: "Real",
          },
          {
            title: "Gateway-mediated Unshield",
            description:
              "Withdrawal amounts are encrypted in the transaction. The Zama Gateway decrypts asynchronously and triggers the ERC-20 transfer on-chain. Balance viewing via re-encryption is TODO.",
            icon: "🔑",
            tag: "Partial",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-surface-400/40 bg-surface-700 p-5 hover:border-surface-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{feature.icon}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border
                ${feature.tag === "Real"
                  ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                {feature.tag}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-white mb-1.5">{feature.title}</h4>
            <p className="text-xs text-gray-400 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
