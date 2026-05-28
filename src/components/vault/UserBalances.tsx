"use client";

/**
 * UserBalances — shows the user's balances across both layers.
 *
 * Base Sepolia (BaseVault):
 *   • Available balance  — readable directly from contract
 *   • Pending withdrawal — readable directly from contract
 *
 * Zama fhEVM (ConfidentialToken):
 *   • Encrypted handle   — readable (public); plaintext requires re-encryption
 *   • TODO: wire fhevmjs.reencrypt() with EIP-712 signature for plaintext display
 */

import { useState } from "react";
import { useAccount } from "wagmi";
import { useVaultBalance } from "@/hooks/useBaseVault";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { GlassCard, GlassCardAccentBar } from "@/components/ui/GlassCard";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

interface UserBalancesProps {
  tokenAddress: `0x${string}` | null;
}

function BalanceRow({
  label, value, subvalue, loading, accent, tooltip,
}: {
  label: string; value: string; subvalue?: string;
  loading?: boolean; accent?: "blue" | "green" | "yellow"; tooltip?: string;
}) {
  const accentColor = { blue: "text-base-400", green: "text-brand-400", yellow: "text-yellow-400" };
  const inner = (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="text-right">
        {loading ? (
          <div className="h-3.5 w-20 rounded bg-surface-500 animate-pulse" />
        ) : (
          <>
            <p className={cn("text-sm font-semibold font-mono", accent ? accentColor[accent] : "text-white")}>{value}</p>
            {subvalue && <p className="text-[9px] text-gray-600 mt-0.5">{subvalue}</p>}
          </>
        )}
      </div>
    </div>
  );
  return tooltip ? <Tooltip content={tooltip}><div className="cursor-help">{inner}</div></Tooltip> : inner;
}

export function UserBalances({ tokenAddress }: UserBalancesProps) {
  const { isConnected } = useAccount();
  const { available, pending, tokenSymbol, formattedAvailable, formattedPending, isLoading: vaultLoading } =
    useVaultBalance(tokenAddress);
  const { encryptedBalance, isLoading: zamaLoading } = useTokenBalance();

  const [revealClicked, setRevealClicked] = useState(false);

  if (!isConnected) {
    return (
      <GlassCard padding="md" className="text-center py-6">
        <p className="text-xs text-gray-500">Connect wallet to view balances</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Base Sepolia balances */}
      <GlassCard accent="blue" padding="md" className="relative overflow-hidden">
        <GlassCardAccentBar color="blue" />
        <div className="flex items-center gap-2 mb-3">
          <span className="status-dot-blue" />
          <p className="section-label">BaseVault · Base Sepolia</p>
        </div>
        {!tokenAddress ? (
          <p className="text-xs text-gray-600 py-2">Enter a token address to see balances.</p>
        ) : (
          <>
            <BalanceRow
              label="Available"
              value={`${formattedAvailable} ${tokenSymbol}`}
              loading={vaultLoading}
              accent={available > 0n ? "blue" : undefined}
              tooltip="Deposited and available to withdraw or shield"
            />
            <BalanceRow
              label="Pending withdrawal"
              value={`${formattedPending} ${tokenSymbol}`}
              loading={vaultLoading}
              accent={pending > 0n ? "yellow" : undefined}
              subvalue={pending > 0n ? "Waiting for relayer or cancel" : undefined}
              tooltip="Funds locked awaiting relayer completeWithdrawal call"
            />
          </>
        )}
      </GlassCard>

      {/* Zama fhEVM balance */}
      <GlassCard accent="green" padding="md" className="relative overflow-hidden">
        <GlassCardAccentBar color="green" />
        <div className="flex items-center gap-2 mb-3">
          <span className="status-dot-live" />
          <p className="section-label">ConfidentialToken · Zama fhEVM</p>
        </div>

        {zamaLoading ? (
          <div className="h-8 w-32 rounded bg-surface-500 animate-pulse" />
        ) : encryptedBalance ? (
          <div>
            <div className="flex items-center justify-between py-2 mb-1">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wide">Shielded balance</span>
              <span className="text-sm font-bold font-mono text-brand-400">ENCRYPTED</span>
            </div>
            <Tooltip content={`Handle: 0x${encryptedBalance.handle.toString(16).padStart(64, "0")}`}>
              <p className="font-mono text-[9px] text-gray-600 cursor-help mb-3">
                0x{encryptedBalance.handle.toString(16).slice(0, 16)}…
              </p>
            </Tooltip>

            {/* Re-encryption TODO */}
            {!revealClicked ? (
              <button
                onClick={() => setRevealClicked(true)}
                className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors font-mono"
              >
                Reveal plaintext →
              </button>
            ) : (
              <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/15 p-2.5 text-[10px] text-yellow-400/80 leading-relaxed">
                <strong className="text-yellow-400">TODO:</strong> Balance reveal requires:
                <br />1. <code>fhevmjs.generateKeypair()</code>
                <br />2. Sign EIP-712 message with wallet
                <br />3. <code>instance.reencrypt(handle, …)</code>
                <br />This feature is not yet wired in the UI.
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-600 py-2">
            No shielded balance found. Shield tokens first on the Deposit tab.
          </p>
        )}
      </GlassCard>
    </div>
  );
}
