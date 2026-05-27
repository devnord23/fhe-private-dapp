"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useConfidentialTransfer } from "@/hooks/useConfidentialTransfer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn, isValidAddress, isValidAmount } from "@/lib/utils";
import type { TransferType } from "@/types";

type Tab = "confidential" | "shield" | "unshield";

const TAB_CONFIG: { id: Tab; label: string; description: string }[] = [
  {
    id: "confidential",
    label: "Confidential Send",
    description:
      "Transfer tokens inside the encrypted pool. The amount is encrypted by fhevmjs before the transaction is submitted — it never appears in plaintext on-chain.",
  },
  {
    id: "shield",
    label: "Shield",
    description:
      "Deposit public ERC-20 tokens into the confidential pool. The deposited amount is visible at this step because it comes from your public wallet. Privacy applies to subsequent transfers.",
  },
  {
    id: "unshield",
    label: "Unshield",
    description:
      "Withdraw from the pool back to a public address. The withdrawal amount is encrypted and sent to the Zama Gateway, which decrypts it and triggers the ERC-20 transfer (~1-2 blocks).",
  },
];

interface FormState {
  recipient: string;
  amount: string;
}

const INITIAL_FORM: FormState = { recipient: "", amount: "" };

export function TransferForm() {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("confidential");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    shield,
    confidentialTransfer,
    requestUnshield,
    fhevmReady,
    isPending,
    error,
    clearError,
  } = useConfidentialTransfer();

  const tabConfig = TAB_CONFIG.find((t) => t.id === tab)!;

  const recipientValid = !form.recipient || isValidAddress(form.recipient);
  const amountValid = !form.amount || isValidAmount(form.amount);

  function handleField(field: keyof FormState, value: string) {
    clearError();
    setSuccess(null);
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setSuccess(null);

    let hash: string | null = null;

    if (tab === "shield") {
      hash = await shield({ amount: form.amount });
    } else if (tab === "unshield") {
      hash = await requestUnshield({
        amount: form.amount,
        recipient: form.recipient as `0x${string}`,
      });
    } else {
      hash = await confidentialTransfer({
        to: form.recipient,
        amount: form.amount,
      });
    }

    if (hash) {
      setSuccess(hash);
      setForm(INITIAL_FORM);
    }
  }

  const needsFhevm = tab === "confidential" || tab === "unshield";

  const canSubmit =
    isConnected &&
    isValidAmount(form.amount) &&
    (tab === "shield" || isValidAddress(form.recipient)) &&
    (!needsFhevm || fhevmReady);

  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-surface-400/40">
        {TAB_CONFIG.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setForm(INITIAL_FORM);
              clearError();
              setSuccess(null);
            }}
            className={cn(
              "flex-1 py-4 text-sm font-medium transition-colors duration-150 relative",
              tab === t.id
                ? "text-white bg-surface-600/50"
                : "text-gray-400 hover:text-gray-200 hover:bg-surface-600/20"
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* Description */}
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-surface-600/40 border border-surface-400/30 p-4">
          <svg
            className="h-5 w-5 text-brand-400 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-gray-400">{tabConfig.description}</p>
        </div>

        {/* fhEVM status banner (shown for confidential / unshield tabs) */}
        {needsFhevm && isConnected && (
          <div
            className={cn(
              "mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
              fhevmReady
                ? "bg-brand-500/5 border-brand-500/20 text-brand-400"
                : "bg-yellow-500/5 border-yellow-500/20 text-yellow-400"
            )}
          >
            {fhevmReady ? (
              <>
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>fhEVM encryption ready — amounts will be encrypted via fhevmjs before submission.</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>
                  Loading fhEVM encryption module… Connect to <strong>Zama Devnet</strong> (chain ID 9000) if this stalls.
                </span>
              </>
            )}
          </div>
        )}

        {/* Not connected */}
        {!isConnected && (
          <div className="rounded-xl bg-surface-600/40 border border-surface-300/30 p-8 text-center mb-4">
            <p className="text-gray-400 text-sm">Connect your wallet to make transfers</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-4 rounded-xl bg-brand-500/10 border border-brand-500/20 p-4 flex items-start gap-3">
            <svg
              className="h-5 w-5 text-brand-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-brand-400">Transaction submitted!</p>
              {tab === "unshield" && (
                <p className="text-xs text-gray-400 mt-0.5">
                  The Zama Gateway will decrypt the amount and trigger the ERC-20 transfer in ~1-2 blocks.
                </p>
              )}
              <p className="text-xs text-gray-400 font-mono mt-1 break-all">{success}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
            <svg
              className="h-5 w-5 text-red-400 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab !== "shield" && (
            <Input
              label="Recipient Address"
              placeholder="0x…"
              value={form.recipient}
              onChange={(e) => handleField("recipient", e.target.value)}
              error={
                form.recipient && !recipientValid ? "Invalid Ethereum address" : undefined
              }
              disabled={!isConnected || isPending}
              leftAddon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />
          )}

          <Input
            label="Amount"
            placeholder="0.00"
            type="number"
            min="0"
            step="any"
            value={form.amount}
            onChange={(e) => handleField("amount", e.target.value)}
            error={form.amount && !amountValid ? "Enter a positive number" : undefined}
            disabled={!isConnected || isPending}
          />

          {/* Honest status badges */}
          {tab === "confidential" && (
            <div className="flex flex-wrap gap-2">
              <Badge variant={fhevmReady ? "success" : "warning"}>
                {fhevmReady ? "fhevmjs Encrypted" : "fhevmjs Loading…"}
              </Badge>
              <Badge variant="info">TFHE Homomorphic Arithmetic</Badge>
              <Badge variant="purple">No Plaintext On-chain</Badge>
            </div>
          )}

          {tab === "shield" && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">Amount Public at Shield Step</Badge>
              <Badge variant="info">Privacy Begins After Shield</Badge>
            </div>
          )}

          {tab === "unshield" && (
            <div className="flex flex-wrap gap-2">
              <Badge variant={fhevmReady ? "success" : "warning"}>
                {fhevmReady ? "Amount Encrypted" : "fhevmjs Loading…"}
              </Badge>
              <Badge variant="info">Gateway Decrypts Asynchronously</Badge>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isPending}
            disabled={!canSubmit || isPending}
          >
            {isPending
              ? "Waiting for wallet…"
              : tab === "shield"
              ? "Shield Tokens"
              : tab === "unshield"
              ? "Request Unshield"
              : "Send Confidentially"}
          </Button>

          {tab === "shield" && (
            <p className="text-xs text-gray-500 text-center">
              You must approve the contract to spend your ERC-20 tokens before shielding.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
