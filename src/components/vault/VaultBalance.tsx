"use client";

import { useAccount } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useVaultBalance, useWithdrawal } from "@/hooks/useBaseVault";
import { getExplorerUrl, shortenAddress } from "@/lib/utils";
import { useChainId } from "wagmi";

interface VaultBalanceProps {
  tokenAddress: `0x${string}` | null;
  onRefresh?: () => void;
}

export function VaultBalance({ tokenAddress, onRefresh }: VaultBalanceProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    available,
    linkedStrategy,
    formattedAvailable,
    formattedPending,
    formattedWallet,
    tokenSymbol,
    isLoading,
    refetch,
  } = useVaultBalance(tokenAddress);

  const { emergencyWithdraw, isPending: isEmergencyPending, error: emergencyError } = useWithdrawal();

  async function handleEmergency() {
    if (!tokenAddress) return;
    await emergencyWithdraw(tokenAddress);
    refetch();
    onRefresh?.();
  }

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-6 text-center">
        <p className="text-gray-400 text-sm">Connect your wallet to view vault balances</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Vault Balance</h3>
        <div className="flex items-center gap-2">
          <Badge variant="info">Base Sepolia</Badge>
          {isLoading && <span className="text-xs text-gray-500 animate-pulse">Loading…</span>}
        </div>
      </div>

      {/* Account info */}
      {address && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Account</span>
          <Tooltip content={address}>
            <a
              href={getExplorerUrl(chainId, "address", address)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-gray-300 hover:text-brand-400 transition-colors"
            >
              {shortenAddress(address, 6)}↗
            </a>
          </Tooltip>
        </div>
      )}

      {/* Balance rows */}
      <div className="space-y-2">
        <BalanceRow
          label="Wallet Balance"
          value={formattedWallet}
          symbol={tokenSymbol}
          isLoading={isLoading}
          tooltip="Your on-chain ERC-20 balance on Base Sepolia"
        />
        <BalanceRow
          label="Available in Vault"
          value={formattedAvailable}
          symbol={tokenSymbol}
          isLoading={isLoading}
          highlight={available > 0n}
          tooltip="Deposited into BaseVault, not yet pending withdrawal"
        />
        <BalanceRow
          label="Pending Withdrawal"
          value={formattedPending}
          symbol={tokenSymbol}
          isLoading={isLoading}
          tooltip="Locked awaiting relayer confirmation (TODO: bridge not live)"
        />
      </div>

      {/* Linked strategy */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Linked Strategy</span>
        {linkedStrategy === 0n ? (
          <span className="text-gray-500">None</span>
        ) : (
          <span className="font-mono text-brand-400">#{linkedStrategy.toString()}</span>
        )}
      </div>

      {/* Emergency withdraw */}
      {available > 0n && (
        <div className="pt-2 border-t border-surface-500/40">
          <p className="text-[10px] text-yellow-400/80 mb-2">
            ⚠️ Emergency Withdraw bypasses the relayer bridge.
            Use only during testnet development or if the relayer is unavailable.
          </p>
          {emergencyError && (
            <p className="text-xs text-red-400 mb-2">{emergencyError}</p>
          )}
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={handleEmergency}
            isLoading={isEmergencyPending}
            disabled={!tokenAddress || isEmergencyPending}
          >
            Emergency Withdraw (All Available)
          </Button>
        </div>
      )}
    </div>
  );
}

function BalanceRow({
  label,
  value,
  symbol,
  isLoading,
  highlight,
  tooltip,
}: {
  label: string;
  value: string;
  symbol: string;
  isLoading: boolean;
  highlight?: boolean;
  tooltip: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <Tooltip content={tooltip}>
        <span className="text-xs text-gray-400 cursor-help">{label}</span>
      </Tooltip>
      {isLoading ? (
        <div className="h-3 w-20 rounded bg-surface-500 animate-pulse" />
      ) : (
        <span className={`text-sm font-semibold font-mono ${highlight ? "text-brand-400" : "text-white"}`}>
          {value} {symbol}
        </span>
      )}
    </div>
  );
}
