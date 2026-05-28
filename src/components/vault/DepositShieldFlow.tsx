"use client";

/**
 * DepositShieldFlow
 *
 * Guides the user through the complete deposit → shield workflow in three steps:
 *
 *  Step 1  Base Sepolia   Approve ERC-20 + deposit into BaseVault
 *  Step 2  (switch)       Switch wallet from Base Sepolia → Ethereum Sepolia
 *  Step 3  Zama fhEVM     Approve + shield into ConfidentialToken
 *
 * CROSS-CHAIN NOTE:
 *   Steps 1 and 3 involve DIFFERENT ERC-20 tokens on different chains. There is
 *   no automatic bridge between them yet. You need tokens on both chains separately.
 *   The relayer service (/relayer) will eventually automate this flow — today the
 *   UI guides you through each step manually.
 *
 * PRIVACY NOTE:
 *   The shield amount (Step 3) is PUBLIC in the Shielded() event.
 *   Only subsequent transfer() amounts are hidden via FHE.
 */

import { useState, useCallback, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useDeposit, parseVaultAmount, useVaultBalance } from "@/hooks/useBaseVault";
import { useConfidentialTransfer } from "@/hooks/useConfidentialTransfer";
import { useFhevm } from "@/hooks/useFhevm";
import { useVaultEvents, type DepositEventPayload } from "@/hooks/useVaultEvents";
import { useContractConfig } from "@/hooks/useContractConfig";
import { isBaseChain, isFhevmChain } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { NotDeployedCard } from "@/components/ui/DemoModeBanner";

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowStep =
  | "idle"
  | "approving_token"
  | "depositing"
  | "deposit_done"        // Base deposit confirmed — prompt switch
  | "switch_network"      // user needs to be on Ethereum Sepolia
  | "shielding"           // calling ConfidentialToken.shield()
  | "complete"
  | "error";

interface StepMeta { label: string; chain: string; color: "blue" | "gray" | "green" }
const STEPS: StepMeta[] = [
  { label: "Deposit on Base",  chain: "Base Sepolia (84532)",   color: "blue"  },
  { label: "Switch Network",   chain: "Eth Sepolia (11155111)", color: "gray"  },
  { label: "Shield on Zama",   chain: "Zama fhEVM (11155111)", color: "green" },
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => {
        const done    = i < current;
        const active  = i === current;
        const color   = done ? "green" : active ? s.color : "gray";
        const colorMap = {
          blue:  "bg-base-500 border-base-500 text-white",
          green: "bg-brand-500 border-brand-500 text-white",
          gray:  "bg-surface-600 border-surface-400 text-gray-500",
        };
        return (
          <div key={i} className="flex items-center">
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all",
              colorMap[color]
            )}>
              {done ? "✓" : i + 1}
            </div>
            <div className="ml-2 mr-6">
              <p className={cn("text-xs font-medium leading-none", active ? "text-white" : "text-gray-500")}>
                {s.label}
              </p>
              <p className="text-[9px] font-mono text-gray-600 mt-0.5">{s.chain}</p>
            </div>
            {i < 2 && <div className={cn("h-px w-8 -ml-4 mr-2", done || active ? "bg-white/20" : "bg-white/[0.06]")} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DepositShieldFlow() {
  const { isConnected } = useAccount();
  const chainId    = useChainId();
  const onBase     = isBaseChain(chainId);
  const onFhevm    = isFhevmChain(chainId);
  const { switchChain } = useSwitchChain();

  const { vault: vaultOk, confidentialToken: ctOk } = useContractConfig();
  const { isReady: fhevmReady } = useFhevm();

  const [flowStep,     setFlowStep]     = useState<FlowStep>("idle");
  const [tokenAddr,    setTokenAddr]    = useState("");
  const [amount,       setAmount]       = useState("");
  const [strategyId,   setStrategyId]   = useState("");
  const [depositTx,    setDepositTx]    = useState<string | null>(null);
  const [shieldTx,     setShieldTx]     = useState<string | null>(null);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  const isValidAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
  const tokenAddress = isValidAddr(tokenAddr) ? (tokenAddr as `0x${string}`) : null;

  const { tokenDecimals, tokenSymbol, formattedWallet, formattedAvailable } =
    useVaultBalance(tokenAddress);

  // ── Base deposit hooks ─────────────────────────────────────────────────────
  const {
    step: depositStep,
    approve,
    deposit,
    error: depositError,
    clearError: clearDepositError,
    reset: resetDeposit,
  } = useDeposit();

  // ── Zama shield hook ───────────────────────────────────────────────────────
  const { shield, isPending: shieldPending, error: shieldError, clearError: clearShieldError } =
    useConfidentialTransfer();

  // ── Listen for DepositCreated events (local relayer simulation) ────────────
  useVaultEvents({
    onDeposit: useCallback((_evt: DepositEventPayload) => {
      if (flowStep === "depositing" || flowStep === "deposit_done") {
        setFlowStep("deposit_done");
      }
    }, [flowStep]),
  });

  // Sync depositStep to flowStep
  useEffect(() => {
    if (depositStep === "approving") setFlowStep("approving_token");
    if (depositStep === "depositing") setFlowStep("depositing");
    if (depositStep === "confirmed") {
      setFlowStep("deposit_done");
    }
    if (depositStep === "error") {
      setErrorMsg(depositError ?? "Deposit failed");
      setFlowStep("error");
    }
  }, [depositStep, depositError]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleApprove = useCallback(async () => {
    if (!tokenAddress || !amount) return;
    clearDepositError();
    const parsed = parseVaultAmount(amount, tokenDecimals);
    if (parsed === 0n) return;
    await approve(tokenAddress, parsed);
  }, [tokenAddress, amount, tokenDecimals, approve, clearDepositError]);

  const handleDeposit = useCallback(async () => {
    if (!tokenAddress || !amount) return;
    clearDepositError();
    const parsed = parseVaultAmount(amount, tokenDecimals);
    const stId   = strategyId ? BigInt(strategyId) : 0n;
    const hash   = await deposit(tokenAddress, parsed, stId);
    if (hash) setDepositTx(hash);
  }, [tokenAddress, amount, tokenDecimals, strategyId, deposit, clearDepositError]);

  const handleSwitchToFhevm = useCallback(() => {
    switchChain({ chainId: 11155111 }); // Ethereum Sepolia
    setFlowStep("switch_network");
  }, [switchChain]);

  const handleShield = useCallback(async () => {
    if (!amount || !fhevmReady) return;
    clearShieldError();
    setFlowStep("shielding");
    const hash = await shield({ amount });
    if (hash) {
      setShieldTx(hash);
      setFlowStep("complete");
    } else {
      setFlowStep("error");
      setErrorMsg(shieldError ?? "Shield failed");
    }
  }, [amount, fhevmReady, shield, shieldError, clearShieldError]);

  const handleReset = useCallback(() => {
    setFlowStep("idle");
    setDepositTx(null);
    setShieldTx(null);
    setErrorMsg(null);
    setAmount("");
    setStrategyId("");
    resetDeposit();
  }, [resetDeposit]);

  // ── Rendering ──────────────────────────────────────────────────────────────

  // Which "visual step" we're on (0=Base, 1=Switch, 2=Shield)
  const visualStep: 0 | 1 | 2 =
    flowStep === "idle" || flowStep === "approving_token" || flowStep === "depositing" ? 0 :
    flowStep === "deposit_done" || flowStep === "switch_network" ? 1 : 2;

  if (!vaultOk && !ctOk) {
    return (
      <NotDeployedCard
        contractName="BaseVault + ConfidentialToken"
        description="Set NEXT_PUBLIC_BASE_VAULT_ADDRESS_BASE_SEPOLIA and NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA in Vercel to enable deposits."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Deposit &amp; Shield</h3>
          <div className="flex gap-2">
            <Badge variant="info" className="text-[10px]">2-chain flow</Badge>
            {fhevmReady && <Badge variant="success" className="text-[10px]">fhEVM Ready</Badge>}
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
          Deposit on Base Sepolia, then shield on Zama fhEVM. Requires tokens on both chains.
          <span className="text-yellow-500/70 ml-1">No automatic bridge yet.</span>
        </p>
      </div>

      <div className="p-5">
        <StepDots current={visualStep} />

        {/* ── Complete ──────────────────────────────────────────────────────── */}
        {flowStep === "complete" && (
          <div className="rounded-xl bg-brand-500/8 border border-brand-500/20 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="status-dot-live" />
              <p className="text-sm font-semibold text-brand-400">Flow complete!</p>
            </div>
            {depositTx && (
              <p className="text-[10px] font-mono text-gray-500 break-all">
                Base deposit: {depositTx}
              </p>
            )}
            {shieldTx && (
              <p className="text-[10px] font-mono text-gray-500 break-all">
                Zama shield: {shieldTx}
              </p>
            )}
            <Button variant="secondary" size="sm" onClick={handleReset}>Start new flow</Button>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {flowStep === "error" && (
          <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-4 mb-4">
            <p className="text-xs text-red-400 mb-2">{errorMsg}</p>
            <Button variant="secondary" size="sm" onClick={handleReset}>Reset</Button>
          </div>
        )}

        {/* ── Step 1: Base deposit ───────────────────────────────────────────── */}
        {(flowStep === "idle" || flowStep === "approving_token" || flowStep === "depositing") && (
          <div className="space-y-4">
            {/* Network warning */}
            {isConnected && !onBase && (
              <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-3 flex items-start gap-2">
                <svg className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs text-yellow-400 font-medium">Switch to Base Sepolia</p>
                  <p className="text-[10px] text-yellow-400/70 mt-0.5">Step 1 requires Base Sepolia (chain 84532).</p>
                  <button
                    onClick={() => switchChain({ chainId: 84532 })}
                    className="mt-1.5 text-[10px] text-base-400 hover:text-base-300 font-medium transition-colors"
                  >
                    Switch now →
                  </button>
                </div>
              </div>
            )}

            <Input
              label="Token address (on Base Sepolia)"
              placeholder="0x… (mUSDC or any ERC-20)"
              value={tokenAddr}
              onChange={(e) => setTokenAddr(e.target.value)}
              error={tokenAddr && !isValidAddr(tokenAddr) ? "Invalid address" : undefined}
              disabled={!isConnected}
            />

            {tokenAddress && (
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2 text-xs flex gap-4">
                <span className="text-gray-500">Wallet: <span className="text-white">{formattedWallet} {tokenSymbol}</span></span>
                <span className="text-gray-500">In vault: <span className="text-brand-400">{formattedAvailable} {tokenSymbol}</span></span>
              </div>
            )}

            <Input
              label="Amount"
              type="number" min="0" step="any" placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!isConnected}
            />

            <Input
              label="Link to Zama strategy ID (optional)"
              type="number" placeholder="0"
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              hint="strategyId from ConfidentialStrategyAgent.createStrategy()"
              disabled={!isConnected}
            />

            {!isConnected && (
              <p className="text-xs text-gray-500 text-center py-2">Connect your wallet to start</p>
            )}

            {/* Two-step approve → deposit */}
            {isConnected && (
              <div className="flex gap-2">
                <Button
                  variant={depositStep === "idle" ? "primary" : "secondary"}
                  size="sm"
                  className="flex-1"
                  onClick={handleApprove}
                  isLoading={depositStep === "approving"}
                  disabled={!onBase || !tokenAddress || !amount || depositStep !== "idle"}
                >
                  {depositStep === "approved" || depositStep === "depositing" ? "✓ Approved" : "1. Approve"}
                </Button>
                <Button
                  variant="primary" size="sm" className="flex-1"
                  onClick={handleDeposit}
                  isLoading={depositStep === "depositing"}
                  disabled={!onBase || depositStep !== "approved" || !amount}
                >
                  2. Deposit
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1→2 transition: deposit confirmed ────────────────────────── */}
        {flowStep === "deposit_done" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-base-500/8 border border-base-500/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="status-dot-blue" />
                <p className="text-sm font-semibold text-base-400">Base deposit confirmed!</p>
              </div>
              {depositTx && (
                <p className="text-[10px] font-mono text-gray-600 break-all mb-3">{depositTx}</p>
              )}
              <p className="text-xs text-gray-400 mb-4">
                Your tokens are locked in BaseVault on Base Sepolia.
                Now switch to Ethereum Sepolia to shield them on Zama fhEVM.
              </p>
              <p className="text-[10px] text-yellow-500/70 mb-3">
                ⚠ You need <strong className="text-yellow-400">{amount} {tokenSymbol}</strong> on Ethereum Sepolia separately.
                These are different chain deployments — no bridge yet.
              </p>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleSwitchToFhevm}>
                  Switch to Eth Sepolia →
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Done (Base only)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 / waiting for network switch ───────────────────────────── */}
        {flowStep === "switch_network" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-600/40 border border-white/[0.06] p-4">
              <p className="text-xs text-gray-400 mb-3">
                Switch your wallet to <strong className="text-white">Ethereum Sepolia (11155111)</strong>.
                Once connected, click Shield below.
              </p>
              {onFhevm ? (
                <div className="flex items-center gap-2 mb-3">
                  <span className="status-dot-live" />
                  <p className="text-xs text-brand-400">Connected to Ethereum Sepolia</p>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={handleSwitchToFhevm}>
                  Switch now
                </Button>
              )}
            </div>

            {onFhevm && (
              <div className="space-y-3">
                {!fhevmReady && (
                  <div className="flex items-center gap-2 text-xs text-yellow-400">
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading fhEVM encryption module…
                  </div>
                )}
                <p className="text-[10px] text-gray-500">
                  Token on Sepolia (may be different from Base token):
                </p>
                <Input
                  label="Token address on Ethereum Sepolia"
                  placeholder="0x… (mUSDC-Sepolia)"
                  value={tokenAddr}
                  onChange={(e) => setTokenAddr(e.target.value)}
                  hint="The ConfidentialToken underlying ERC-20 on Ethereum Sepolia."
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary" size="sm" className="flex-1"
                    onClick={handleShield}
                    isLoading={shieldPending}
                    disabled={!fhevmReady || !amount}
                  >
                    {fhevmReady ? `Shield ${amount} ${tokenSymbol}` : "fhEVM loading…"}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-600">
                  Shield amount is public in the Shielded() event. Subsequent transfer amounts are encrypted.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Shielding in progress ──────────────────────────────────────────── */}
        {flowStep === "shielding" && (
          <div className="flex items-center gap-3 py-4">
            <svg className="h-5 w-5 text-brand-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-brand-400">Shielding on Zama fhEVM…</p>
          </div>
        )}
      </div>
    </div>
  );
}
