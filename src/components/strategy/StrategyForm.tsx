"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { NotDeployedCard } from "@/components/ui/DemoModeBanner";
import { useContractConfig } from "@/hooks/useContractConfig";
import { useCreateStrategy, type StrategyParams } from "@/hooks/useStrategy";
import { PARAM_LABELS, bpsToPercent, healthX100ToHF } from "@/lib/agent";

const DEFAULTS: StrategyParams = {
  apyTargetBps:          800,  // 8.00%
  rebalanceThresholdBps: 500,  // 5.00%
  stopLossBufferX100:    120,  // HF 1.20
  liquidationBufferX100: 20,   // +0.20 HF safety
  maxLeverageX100:       150,  // 1.5×
};

interface StrategyFormProps {
  onCreated?: (txHash: string) => void;
}

export function StrategyForm({ onCreated }: StrategyFormProps) {
  const { isConnected } = useAccount();
  const { strategyAgent: agentConfigured } = useContractConfig();
  const { createStrategy, isPending, fhevmReady, error, clearError } = useCreateStrategy();
  const [params, setParams] = useState<StrategyParams>(DEFAULTS);
  const [success, setSuccess] = useState<string | null>(null);

  if (!agentConfigured) {
    return (
      <NotDeployedCard
        contractName="ConfidentialStrategyAgent"
        description="Deploy ConfidentialStrategyAgent on Ethereum Sepolia to create and evaluate encrypted strategies."
      />
    );
  }

  function setField(key: keyof StrategyParams, raw: string) {
    clearError();
    setSuccess(null);
    const num = parseInt(raw, 10);
    if (!isNaN(num)) setParams((p) => ({ ...p, [key]: num }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setSuccess(null);

    const hash = await createStrategy(params);
    if (hash) {
      setSuccess(hash);
      onCreated?.(hash);
    }
  }

  const fields: { key: keyof StrategyParams; preview: string }[] = [
    { key: "apyTargetBps",          preview: bpsToPercent(params.apyTargetBps) },
    { key: "rebalanceThresholdBps", preview: bpsToPercent(params.rebalanceThresholdBps) },
    { key: "stopLossBufferX100",    preview: `HF ${healthX100ToHF(params.stopLossBufferX100)}` },
    { key: "liquidationBufferX100", preview: `+${healthX100ToHF(params.liquidationBufferX100)} HF` },
    { key: "maxLeverageX100",       preview: `${(params.maxLeverageX100 / 100).toFixed(2)}×` },
  ];

  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-6">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-white">Create Encrypted Strategy</h3>
          <Badge variant={fhevmReady ? "success" : "warning"}>
            {fhevmReady ? "fhEVM Ready" : "fhEVM Loading…"}
          </Badge>
        </div>
        <p className="text-xs text-gray-400">
          All five parameters are encrypted client-side via fhevmjs before the transaction
          is signed. A single input proof covers all five ciphertexts. Values are NEVER
          sent in plaintext to any server or the blockchain.
        </p>
      </div>

      {/* fhEVM flow reminder */}
      <div className="mb-5 rounded-xl bg-surface-600/40 border border-brand-500/15 p-4">
        <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
          fhevmjs.createEncryptedInput(contract, user)<br />
          &nbsp;&nbsp;.add64(apyTarget)          → handles[0]<br />
          &nbsp;&nbsp;.add64(rebalanceThreshold) → handles[1]<br />
          &nbsp;&nbsp;.add64(stopLossBuffer)     → handles[2]<br />
          &nbsp;&nbsp;.add64(liquidationBuffer)  → handles[3]<br />
          &nbsp;&nbsp;.add64(maxLeverage)        → handles[4]<br />
          &nbsp;&nbsp;.encrypt() → &lbrace; handles, inputProof &rbrace;
        </p>
      </div>

      {/* Success / Error */}
      {success && (
        <div className="mb-4 rounded-xl bg-brand-500/10 border border-brand-500/20 p-3 flex items-start gap-2">
          <svg className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-medium text-brand-400">Strategy created!</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5 break-all">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {!isConnected && (
        <div className="mb-4 rounded-xl bg-surface-600/40 border border-surface-300/20 p-4 text-center">
          <p className="text-sm text-gray-400">Connect your wallet to create a strategy</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map(({ key, preview }) => {
          const meta = PARAM_LABELS[key];
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-300">
                  {meta.label}
                </label>
                <span className="text-xs text-brand-400 font-mono font-semibold">
                  = {preview}
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={params[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  disabled={!isConnected || isPending}
                  rightAddon={meta.unit ? <span className="text-xs text-gray-500">{meta.unit}</span> : undefined}
                  className="flex-1"
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{meta.hint}</p>
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant={fhevmReady ? "success" : "warning"}>
            {fhevmReady ? "fhevmjs Encrypted" : "Awaiting fhEVM"}
          </Badge>
          <Badge variant="info">5 Params · 1 Proof</Badge>
          <Badge variant="purple">No Plaintext On-chain</Badge>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isPending}
          disabled={!isConnected || !fhevmReady || isPending}
        >
          {isPending ? "Encrypting & Submitting…" : "Create Encrypted Strategy"}
        </Button>

        {isConnected && !fhevmReady && (
          <p className="text-xs text-yellow-400 text-center">
            Waiting for fhEVM module. Connect to Zama Devnet (chain 9000).
          </p>
        )}
      </form>
    </div>
  );
}
