"use client";

/**
 * WithdrawUnshieldFlow
 *
 * Two-step guided withdrawal:
 *  Step 1  Base Sepolia   requestWithdrawal() — moves balance to pending
 *  Step 2  Zama fhEVM     requestUnshield()   — encrypted Gateway decryption
 *
 * After Step 2, the relayer (when live) calls relayerCompleteWithdrawal()
 * to release ERC-20 back to the user on Base Sepolia.
 * For now, users can also call cancelPendingWithdrawal() / emergencyWithdraw().
 */

import { useState, useCallback } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useWithdrawal, parseVaultAmount, useVaultBalance } from "@/hooks/useBaseVault";
import { useConfidentialTransfer } from "@/hooks/useConfidentialTransfer";
import { useFhevm } from "@/hooks/useFhevm";
import { useContractConfig } from "@/hooks/useContractConfig";
import { isBaseChain, isFhevmChain } from "@/lib/utils";
import { NotDeployedCard } from "@/components/ui/DemoModeBanner";

type Step = "idle" | "requesting_base" | "base_done" | "switch" | "requesting_unshield" | "gateway_pending" | "complete" | "error";

export function WithdrawUnshieldFlow() {
  const { isConnected } = useAccount();
  const chainId  = useChainId();
  const onBase   = isBaseChain(chainId);
  const onFhevm  = isFhevmChain(chainId);
  const { switchChain } = useSwitchChain();
  const { vault: vaultOk } = useContractConfig();
  const { isReady: fhevmReady } = useFhevm();

  const [step,         setStep]         = useState<Step>("idle");
  const [tokenAddr,    setTokenAddr]    = useState("");
  const [amount,       setAmount]       = useState("");
  const [recipient,    setRecipient]    = useState("");
  const [withdrawTx,   setWithdrawTx]   = useState<string | null>(null);
  const [unshieldTx,   setUnshieldTx]   = useState<string | null>(null);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  const isValidAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
  const tokenAddress = isValidAddr(tokenAddr) ? (tokenAddr as `0x${string}`) : null;

  const { tokenDecimals, tokenSymbol, formattedAvailable, formattedPending } =
    useVaultBalance(tokenAddress);

  const { requestWithdrawal, cancelWithdrawal, emergencyWithdraw, isPending, error, clearError } =
    useWithdrawal();
  const { requestUnshield, isPending: unshieldPending, error: unshieldError } =
    useConfidentialTransfer();

  const handleWithdraw = useCallback(async () => {
    if (!tokenAddress || !amount) return;
    clearError();
    setStep("requesting_base");
    const hash = await requestWithdrawal(tokenAddress, parseVaultAmount(amount, tokenDecimals));
    if (hash) {
      setWithdrawTx(hash);
      setStep("base_done");
    } else {
      setErrorMsg(error ?? "Withdrawal request failed");
      setStep("error");
    }
  }, [tokenAddress, amount, tokenDecimals, requestWithdrawal, clearError, error]);

  const handleEmergencyWithdraw = useCallback(async () => {
    if (!tokenAddress) return;
    await emergencyWithdraw(tokenAddress);
  }, [tokenAddress, emergencyWithdraw]);

  const handleCancelWithdrawal = useCallback(async () => {
    if (!tokenAddress || !amount) return;
    await cancelWithdrawal(tokenAddress, parseVaultAmount(amount, tokenDecimals));
    setStep("idle");
  }, [tokenAddress, amount, tokenDecimals, cancelWithdrawal]);

  const handleRequestUnshield = useCallback(async () => {
    if (!amount || !recipient || !isValidAddr(recipient)) return;
    setStep("requesting_unshield");
    const hash = await requestUnshield({
      amount,
      recipient: recipient as `0x${string}`,
    });
    if (hash) {
      setUnshieldTx(hash);
      setStep("gateway_pending");
    } else {
      setErrorMsg(unshieldError ?? "Unshield request failed");
      setStep("error");
    }
  }, [amount, recipient, requestUnshield, unshieldError]);

  const reset = () => {
    setStep("idle");
    setWithdrawTx(null);
    setUnshieldTx(null);
    setErrorMsg(null);
    setAmount("");
  };

  if (!vaultOk) {
    return (
      <NotDeployedCard
        contractName="BaseVault"
        description="Set NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA to enable withdrawals."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="p-5 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white mb-0.5">Withdraw &amp; Unshield</h3>
        <p className="text-[10px] text-gray-500">
          Request withdrawal on Base Sepolia, then trigger unshield on Zama fhEVM.
          <span className="text-yellow-500/70 ml-1">Relayer completes final release.</span>
        </p>
      </div>

      <div className="p-5 space-y-4">

        {/* Error */}
        {step === "error" && (
          <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-3 flex items-start justify-between gap-2">
            <p className="text-xs text-red-400">{errorMsg}</p>
            <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
          </div>
        )}

        {/* Gateway pending */}
        {step === "gateway_pending" && (
          <div className="rounded-xl bg-brand-500/8 border border-brand-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="status-dot-live" />
              <p className="text-sm font-semibold text-brand-400">Unshield request submitted</p>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              Zama Gateway is decrypting the amount (~1–2 blocks).
              After the callback, the relayer calls relayerCompleteWithdrawal() on Base.
            </p>
            {unshieldTx && <p className="text-[10px] font-mono text-gray-600 break-all">{unshieldTx}</p>}
            <p className="text-[10px] text-yellow-500/60 mt-2">
              If the relayer is not running, use Emergency Withdraw on Base Sepolia.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>Done</Button>
          </div>
        )}

        {/* Step 1: Base withdrawal request */}
        {(step === "idle" || step === "requesting_base") && (
          <>
            {isConnected && !onBase && (
              <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-3">
                <p className="text-xs text-yellow-400 mb-1">Switch to Base Sepolia</p>
                <button onClick={() => switchChain({ chainId: 84532 })}
                  className="text-[10px] text-base-400 hover:text-base-300 font-medium">
                  Switch now →
                </button>
              </div>
            )}

            <Input label="Token address (Base Sepolia)" placeholder="0x…"
              value={tokenAddr} onChange={(e) => setTokenAddr(e.target.value)} />

            {tokenAddress && (
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2 text-xs flex gap-4">
                <span className="text-gray-500">Available: <span className="text-white">{formattedAvailable} {tokenSymbol}</span></span>
                <span className="text-gray-500">Pending: <span className="text-yellow-400">{formattedPending} {tokenSymbol}</span></span>
              </div>
            )}

            <Input label="Amount" type="number" placeholder="0.00" value={amount}
              onChange={(e) => setAmount(e.target.value)} />

            <div className="flex gap-2">
              <Button variant="primary" size="sm" className="flex-1"
                onClick={handleWithdraw}
                isLoading={step === "requesting_base" || isPending}
                disabled={!isConnected || !onBase || !tokenAddress || !amount}>
                Request Withdrawal
              </Button>
              {tokenAddress && (
                <Button variant="danger" size="sm"
                  onClick={handleEmergencyWithdraw}
                  disabled={!isConnected || !onBase}
                  title="Bypass relayer — returns available balance directly">
                  Emergency
                </Button>
              )}
            </div>
            <p className="text-[10px] text-gray-600">
              Emergency Withdraw bypasses the relayer and returns your available balance immediately.
            </p>
          </>
        )}

        {/* Step 1 done → switch to Zama */}
        {step === "base_done" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-base-500/8 border border-base-500/20 p-4">
              <p className="text-sm font-semibold text-base-400 mb-1">Withdrawal requested on Base ✓</p>
              {withdrawTx && <p className="text-[10px] font-mono text-gray-600 break-all mb-3">{withdrawTx}</p>}
              <p className="text-xs text-gray-400">
                Funds are locked as pending. Switch to Ethereum Sepolia to request unshield from Zama fhEVM.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => { switchChain({ chainId: 11155111 }); setStep("switch"); }}>
                Switch to Eth Sepolia →
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancelWithdrawal}>
                Cancel withdrawal
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Zama unshield */}
        {(step === "switch" || step === "requesting_unshield") && (
          <div className="space-y-3">
            {!onFhevm ? (
              <div className="rounded-xl bg-surface-600/40 border border-white/[0.06] p-3">
                <p className="text-xs text-gray-400 mb-2">Connect to Ethereum Sepolia (11155111).</p>
                <Button variant="outline" size="sm" onClick={() => switchChain({ chainId: 11155111 })}>Switch</Button>
              </div>
            ) : (
              <>
                {!fhevmReady && <p className="text-xs text-yellow-400 animate-pulse">Loading fhEVM…</p>}
                <Input label="Recipient (receives ERC-20 on Base)" placeholder="0x…"
                  value={recipient} onChange={(e) => setRecipient(e.target.value)}
                  hint="Usually your own Base Sepolia address." />
                <Button variant="primary" size="sm" className="w-full"
                  onClick={handleRequestUnshield}
                  isLoading={step === "requesting_unshield" || unshieldPending}
                  disabled={!fhevmReady || !amount || !isValidAddr(recipient)}>
                  Request Unshield on Zama
                </Button>
                <p className="text-[10px] text-gray-600">
                  The encrypted amount is sent to Zama Gateway for decryption.
                  After callback, the relayer completes the withdrawal on Base.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
