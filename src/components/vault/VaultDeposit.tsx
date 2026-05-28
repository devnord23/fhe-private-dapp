"use client";

import { useState, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { NotDeployedCard } from "@/components/ui/DemoModeBanner";
import { useContractConfig } from "@/hooks/useContractConfig";
import { useDeposit, useWithdrawal, parseVaultAmount, useVaultBalance } from "@/hooks/useBaseVault";
import { isBaseChain } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "deposit" | "withdraw";

interface VaultDepositProps {
  onSuccess?: (tokenAddress: `0x${string}`) => void;
}

// Regex to validate an Ethereum address
const isAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

export function VaultDeposit({ onSuccess }: VaultDepositProps) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const onBase = isBaseChain(chainId);
  const { vault: vaultConfigured } = useContractConfig();

  // All hooks must be called unconditionally (Rules of Hooks).
  // We gate the JSX render on vaultConfigured after all hooks.
  const [tab, setTab] = useState<Tab>("deposit");
  const [tokenAddr, setTokenAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [strategyId, setStrategyId] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const tokenAddress = isAddress(tokenAddr) ? (tokenAddr as `0x${string}`) : null;
  const { tokenDecimals, tokenSymbol, formattedWallet, formattedAvailable } = useVaultBalance(tokenAddress);

  // ── Deposit flow ────────────────────────────────────────────────────────────

  const { step, approve, deposit, error: depositError, clearError: clearDeposit, reset } = useDeposit();

  const handleApprove = useCallback(async () => {
    if (!tokenAddress) return;
    const parsed = parseVaultAmount(amount, tokenDecimals);
    if (parsed === 0n) return;
    await approve(tokenAddress, parsed);
  }, [tokenAddress, amount, tokenDecimals, approve]);

  const handleDeposit = useCallback(async () => {
    if (!tokenAddress) return;
    const parsed = parseVaultAmount(amount, tokenDecimals);
    const stId = strategyId ? BigInt(strategyId) : 0n;
    const hash = await deposit(tokenAddress, parsed, stId);
    if (hash) {
      setSuccessMsg(hash);
      setAmount("");
      onSuccess?.(tokenAddress);
    }
  }, [tokenAddress, amount, tokenDecimals, strategyId, deposit, onSuccess]);

  // ── Withdraw flow ───────────────────────────────────────────────────────────

  const { requestWithdrawal, isPending: isWithdrawPending, error: withdrawError, clearError: clearWithdraw } = useWithdrawal();
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);

  const handleWithdraw = useCallback(async () => {
    if (!tokenAddress) return;
    const parsed = parseVaultAmount(amount, tokenDecimals);
    const hash = await requestWithdrawal(tokenAddress, parsed);
    if (hash) {
      setWithdrawSuccessMsg(hash);
      setAmount("");
    }
  }, [tokenAddress, amount, tokenDecimals, requestWithdrawal]);

  function switchTab(t: Tab) {
    setTab(t);
    setAmount("");
    setSuccessMsg(null);
    setWithdrawSuccessMsg(null);
    clearDeposit();
    clearWithdraw();
    reset();
  }

  const depositIsPending = step === "approving" || step === "depositing";

  if (!vaultConfigured) {
    return (
      <NotDeployedCard
        contractName="BaseVault"
        description="Deploy BaseVault on Base Sepolia to enable ERC-20 deposits and withdrawals."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-surface-400/40">
        {(["deposit", "withdraw"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={cn(
              "flex-1 py-4 text-sm font-medium transition-colors relative",
              tab === t ? "text-white bg-surface-600/50" : "text-gray-400 hover:text-gray-200 hover:bg-surface-600/20"
            )}
          >
            {t === "deposit" ? "Deposit" : "Request Withdrawal"}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {/* Network check */}
        {isConnected && !onBase && (
          <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-3 flex gap-2">
            <svg className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-yellow-400">
              BaseVault is on <strong>Base Sepolia (chain 84532)</strong>.
              Switch your wallet to Base Sepolia to use the vault.
            </p>
          </div>
        )}

        {!isConnected && (
          <div className="rounded-xl bg-surface-600/40 border border-surface-300/20 p-6 text-center">
            <p className="text-sm text-gray-400">Connect your wallet to use the vault</p>
          </div>
        )}

        {/* Token address */}
        <Input
          label="ERC-20 Token Address"
          placeholder="0x…"
          value={tokenAddr}
          onChange={(e) => { setTokenAddr(e.target.value); setSuccessMsg(null); setWithdrawSuccessMsg(null); }}
          error={tokenAddr && !isAddress(tokenAddr) ? "Invalid Ethereum address" : undefined}
          hint="Enter any ERC-20 token address on Base Sepolia. For testing, use the MockERC20 (mUSDC) deployed with the contracts."
          disabled={!isConnected || depositIsPending}
        />

        {/* Token info */}
        {tokenAddress && (
          <div className="rounded-xl bg-surface-600/40 border border-surface-400/30 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Symbol</span>
              <span className="text-white font-semibold">{tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Wallet balance</span>
              <span className="text-white">{formattedWallet} {tokenSymbol}</span>
            </div>
            {tab === "withdraw" && (
              <div className="flex justify-between">
                <span className="text-gray-400">Available in vault</span>
                <span className="text-brand-400">{formattedAvailable} {tokenSymbol}</span>
              </div>
            )}
          </div>
        )}

        {/* Amount */}
        <Input
          label={tab === "deposit" ? "Amount to Deposit" : "Amount to Withdraw"}
          type="number"
          placeholder="0.00"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!isConnected || depositIsPending}
        />

        {/* Strategy ID (deposit only) */}
        {tab === "deposit" && (
          <Input
            label="Link to Zama fhEVM Strategy ID (optional)"
            type="number"
            placeholder="e.g. 0 (none)"
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
            hint="The strategy ID from ConfidentialStrategyAgent on Zama fhEVM. Enter 0 or leave blank if no strategy yet."
            disabled={!isConnected || depositIsPending}
          />
        )}

        {/* Error messages */}
        {(depositError || withdrawError) && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-xs text-red-400">{depositError ?? withdrawError}</p>
          </div>
        )}

        {/* Success messages */}
        {(successMsg || withdrawSuccessMsg) && (
          <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 p-3">
            <p className="text-xs font-medium text-brand-400">Transaction submitted!</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5 break-all">
              {successMsg ?? withdrawSuccessMsg}
            </p>
          </div>
        )}

        {/* Deposit: two-step flow */}
        {tab === "deposit" && (
          <div className="space-y-2">
            {/* Step indicator */}
            <div className="flex items-center gap-3 text-xs">
              <StepDot active={step === "idle" || step === "approving"} done={step === "approved" || step === "depositing" || step === "confirmed"} label="1. Approve" />
              <div className="flex-1 h-px bg-surface-400/40" />
              <StepDot active={step === "approved" || step === "depositing"} done={step === "confirmed"} label="2. Deposit" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={step === "idle" || step === "approving" ? "primary" : "secondary"}
                size="sm"
                onClick={handleApprove}
                isLoading={step === "approving"}
                disabled={!isConnected || !onBase || !tokenAddress || !amount || step !== "idle"}
              >
                {step === "approved" || step === "depositing" || step === "confirmed" ? "✓ Approved" : "1. Approve"}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDeposit}
                isLoading={step === "depositing"}
                disabled={!isConnected || !onBase || step !== "approved" || !amount}
              >
                2. Deposit
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="info">Base Sepolia Settlement</Badge>
              <Badge variant="warning">Bridge to Zama TODO</Badge>
            </div>
          </div>
        )}

        {/* Withdrawal: single step */}
        {tab === "withdraw" && (
          <div className="space-y-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleWithdraw}
              isLoading={isWithdrawPending}
              disabled={!isConnected || !onBase || !tokenAddress || !amount || isWithdrawPending}
            >
              Request Withdrawal
            </Button>
            <p className="text-[10px] text-gray-500 text-center">
              Funds will be locked as pending. The relayer bridge (TODO) must confirm
              the Zama unshield before tokens are released. Use Emergency Withdraw
              to recover funds without the relayer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
        done ? "bg-brand-500 text-surface-900" :
        active ? "bg-brand-500/20 border border-brand-500 text-brand-400" :
        "bg-surface-500 text-gray-500"
      )}>
        {done ? "✓" : ""}
      </div>
      <span className={cn("text-[10px]", done ? "text-brand-400" : active ? "text-white" : "text-gray-500")}>{label}</span>
    </div>
  );
}
