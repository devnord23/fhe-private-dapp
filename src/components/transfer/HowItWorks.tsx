const STEPS = [
  {
    step: "01",
    title: "Shield Tokens",
    description:
      "Move your public ERC-20 tokens into the confidential pool. Your tokens are locked in the contract and you receive a private commitment.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Generate ZK Proof",
    description:
      "A zero-knowledge proof is generated client-side that verifies you own sufficient shielded balance without revealing the amount.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Confidential Transfer",
    description:
      "The proof and an encrypted commitment are submitted on-chain. Observers only see that a transfer occurred — not the amount or full parties.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Recipient Decrypts",
    description:
      "Only the recipient can decrypt their new shielded balance using their private view key. The protocol enforces correctness via the ZK proof.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-6">
      <h3 className="text-base font-semibold text-white mb-5">How It Works</h3>
      <div className="space-y-4">
        {STEPS.map((step, i) => (
          <div key={step.step} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                {step.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-px flex-1 bg-surface-400/40 mt-1 mb-1" />
              )}
            </div>
            <div className="pb-4 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-brand-500 font-mono">{step.step}</span>
                <p className="text-sm font-semibold text-white">{step.title}</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
