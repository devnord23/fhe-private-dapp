"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useConfidentialTransfer } from "@/hooks/useConfidentialTransfer";
import { useTokenBalance } from "@/hooks/useTokenBalance";
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
    description: "Transfer tokens privately. The amount is hidden on-chain using a ZK commitment.",
  },
  {
    id: "shield",
    label: "Shield",
    description: "Move tokens from your public wallet into the private pool.",
  },
  {
    id: "unshield",
    label: "Unshield",
    description: "Withdraw tokens from the private pool back to a public address.",
  },
];

interface FormState {
  recipient: string;
  amount: string;
  note: string;
}

const INITIAL_FORM: FormState = { recipient: "", amount: "", note: "" };

export function TransferForm() {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("confidential");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [success, setSuccess] = useState<string | null>(null);

  const { balance } = useTokenBalance();
  const {
    shield,
    unshield,
    confidentialTransfer,
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

  function setMax() {
    if (!balance) return;
    const bal = tab === "unshield" ? balance.formatted.shielded : balance.formatted.public;
    handleField("amount", bal.replace(/,/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setSuccess(null);

    let hash: string | null = null;

    if (tab === "shield") {
      hash = await shield({ amount: form.amount });
    } else if (tab === "unshield") {
      hash = await unshield({
        amount: form.amount,
        recipient: form.recipient as `0x${string}`,
      });
    } else {
      hash = await confidentialTransfer({
        to: form.recipient as `0x${string}`,
        amount: form.amount,
        note: form.note || undefined,
      });
    }

    if (hash) {
      setSuccess(hash);
      setForm(INITIAL_FORM);
    }
  }

  const canSubmit =
    isConnected &&
    isValidAmount(form.amount) &&
    (tab === "shield" || isValidAddress(form.recipient));

  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-surface-400/40">
        {TAB_CONFIG.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setForm(INITIAL_FORM); clearError(); setSuccess(null); }}
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
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-surface-600/40 border border-surface-400/30 p-4">
          <svg className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-sm text-gray-400">{tabConfig.description}</p>
        </div>

        {/* Not connected */}
        {!isConnected && (
          <div className="rounded-xl bg-surface-600/40 border border-surface-300/30 p-8 text-center mb-4">
            <p className="text-gray-400 text-sm">Connect your wallet to make transfers</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-4 rounded-xl bg-brand-500/10 border border-brand-500/20 p-4 flex items-start gap-3">
            <svg className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-brand-400">Transaction submitted!</p>
              <p className="text-xs text-gray-400 font-mono mt-1 break-all">{success}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
            <svg className="h-5 w-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient – not needed for shield */}
          {tab !== "shield" && (
            <Input
              label="Recipient Address"
              placeholder="0x..."
              value={form.recipient}
              onChange={(e) => handleField("recipient", e.target.value)}
              error={
                form.recipient && !recipientValid
                  ? "Invalid Ethereum address"
                  : undefined
              }
              disabled={!isConnected || isPending}
              leftAddon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />
          )}

          {/* Amount */}
          <div>
            <Input
              label="Amount"
              placeholder="0.00"
              type="number"
              min="0"
              step="any"
              value={form.amount}
              onChange={(e) => handleField("amount", e.target.value)}
              error={
                form.amount && !amountValid ? "Enter a positive number" : undefined
              }
              disabled={!isConnected || isPending}
              rightAddon={
                <button
                  type="button"
                  onClick={setMax}
                  className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                >
                  MAX
                </button>
              }
            />
            {balance && (
              <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {tab === "unshield"
                    ? `Shielded: ${balance.formatted.shielded} ${balance.symbol}`
                    : `Public: ${balance.formatted.public} ${balance.symbol}`}
                </span>
              </div>
            )}
          </div>

          {/* Note – confidential only */}
          {tab === "confidential" && (
            <Input
              label="Encrypted Note (optional)"
              placeholder="Private memo – encrypted on-chain"
              value={form.note}
              onChange={(e) => handleField("note", e.target.value)}
              disabled={!isConnected || isPending}
              leftAddon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              }
            />
          )}

          {/* Privacy reminder */}
          {tab === "confidential" && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="confidential">ZK Proof Generated</Badge>
              <Badge variant="purple">Amount Hidden On-chain</Badge>
              <Badge variant="info">End-to-end Encrypted</Badge>
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
              ? "Unshield Tokens"
              : "Send Confidentially"}
          </Button>
        </form>
      </div>
    </div>
  );
}
