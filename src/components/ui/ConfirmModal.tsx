"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  /** Main body text describing the action */
  description: string;
  /** Optional secondary warning shown in a red box */
  warning?: string;
  /**
   * When set, the user must type this exact string before the confirm
   * button is enabled. Use for irreversible actions (e.g. "CONFIRM").
   */
  confirmKeyword?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  warning,
  confirmKeyword,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState("");

  // Reset typed value each time the modal opens
  useEffect(() => {
    if (isOpen) setTyped("");
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onCancel]);

  const canConfirm = !confirmKeyword || typed === confirmKeyword;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-surface-800 shadow-2xl shadow-black/50 animate-slide-up">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-surface-500/40">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2
              id="confirm-modal-title"
              className="text-base font-semibold text-white"
            >
              {title}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning box */}
          {warning && (
            <div className="rounded-xl bg-red-500/8 border border-red-500/25 p-4">
              <p className="text-xs text-red-300 leading-relaxed">{warning}</p>
            </div>
          )}

          {/* Keyword confirmation input */}
          {confirmKeyword && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">
                Type{" "}
                <code className="rounded bg-surface-600 px-1.5 py-0.5 text-red-300">
                  {confirmKeyword}
                </code>{" "}
                to confirm
              </label>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmKeyword}
                className={cn(
                  "w-full rounded-xl bg-surface-600 border px-4 py-2.5 text-sm text-white",
                  "placeholder-gray-600 focus:outline-none focus:ring-2",
                  typed === confirmKeyword
                    ? "border-brand-500/50 focus:ring-brand-500/40"
                    : "border-surface-400/50 focus:ring-red-500/30"
                )}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="danger"
              size="md"
              className="flex-1"
              onClick={onConfirm}
              disabled={!canConfirm || isLoading}
              isLoading={isLoading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * useConfirmModal — lightweight hook to drive ConfirmModal state.
 *
 * Usage:
 *   const confirm = useConfirmModal();
 *   <Button onClick={() => confirm.open()}>Reveal</Button>
 *   <ConfirmModal {...confirm.props} onConfirm={doReveal} onCancel={confirm.close} />
 */
export function useConfirmModal() {
  const [isOpen, setIsOpen] = useState(false);
  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, open, close };
}
