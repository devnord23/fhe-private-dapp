import type { Metadata } from "next";
import { DepositShieldFlow } from "@/components/vault/DepositShieldFlow";
import { WithdrawUnshieldFlow } from "@/components/vault/WithdrawUnshieldFlow";
import { UserBalances } from "@/components/vault/UserBalances";

export const metadata: Metadata = { title: "Base Vault — Deposit & Shield" };

export default function VaultPage() {
  return (
    <div className="animate-fade-in space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.02]">
        <div className="absolute inset-0 bg-grid opacity-25 pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-base-500 to-base-500/0" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="status-dot-blue" />
                <span className="section-label">Settlement Layer · Base Sepolia</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Base Vault</h1>
              <p className="text-sm text-gray-500 mt-1.5 max-w-xl">
                Deposit ERC-20 on Base Sepolia, then shield on Zama fhEVM.
                Withdraw and unshield in reverse. All in one place.
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
              <span className="pill-blue">Chain 84532</span>
              <span className="font-mono text-[10px] text-gray-600">BaseVault.sol</span>
            </div>
          </div>

          {/* Flow summary */}
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-gray-600">
            <span className="text-base-400">Approve</span>
            <span>→</span>
            <span className="text-base-400">BaseVault.deposit()</span>
            <span>→</span>
            <span className="text-gray-500">switch network</span>
            <span>→</span>
            <span className="text-brand-400">ConfidentialToken.shield()</span>
            <span>→</span>
            <span className="text-brand-400">encrypted balance</span>
          </div>
        </div>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* Left: flows */}
        <div className="lg:col-span-3 space-y-6">
          <DepositShieldFlow />
          <WithdrawUnshieldFlow />
        </div>

        {/* Right: balances */}
        <div className="lg:col-span-2">
          {/* Token input to view balances is in UserBalances itself */}
          <UserBalances tokenAddress={null} />
        </div>
      </div>

    </div>
  );
}
