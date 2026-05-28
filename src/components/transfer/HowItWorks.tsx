/**
 * HowItWorks – explains the real Zama fhEVM architecture.
 *
 * This component intentionally makes no claims about ZK proofs or Pedersen
 * commitments because this contract does not use them.  It uses Fully
 * Homomorphic Encryption (FHE) instead, which is a different cryptographic
 * primitive.
 */

const STEPS = [
  {
    step: "01",
    title: "Approve & Shield",
    status: "real" as const,
    description:
      "You approve the ConfidentialToken contract to spend your public ERC-20 tokens, then call shield(amount). The deposited amount is visible at this step — it comes from your public wallet.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Client-side FHE Encryption",
    status: "real" as const,
    description:
      "For transfers and unshields, fhevmjs (Zama's browser SDK) encrypts the amount locally using the network's FHE public key. The ciphertext handle and an input proof are produced. Your plaintext amount is never sent to any server.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Homomorphic On-chain Arithmetic",
    status: "real" as const,
    description:
      "The contract receives the encrypted handle and proof. It runs TFHE.le(amount, balance) and TFHE.sub() — arithmetic on ciphertexts — without ever decrypting them. The balance check and deduction happen homomorphically.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Re-encryption for Balance Viewing",
    status: "todo" as const,
    description:
      "To read your encrypted balance, fhevmjs generates a temporary NaCl keypair. You sign an EIP-712 message to prove ownership. The Zama Gateway re-encrypts your balance to your temporary key, which fhevmjs decrypts locally.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    step: "05",
    title: "Gateway-mediated Unshield",
    status: "real" as const,
    description:
      "For unshields, the contract asks the Zama Gateway to decrypt the withdrawal amount. Once decrypted (~1-2 blocks), the Gateway calls back with the plain uint64 and the contract transfers that many ERC-20 tokens to the recipient.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
];

const STATUS_LABEL: Record<"real" | "todo", { label: string; cls: string }> = {
  real: { label: "Implemented", cls: "bg-brand-500/10 text-brand-400 border-brand-500/20" },
  todo: { label: "TODO", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
};

export function HowItWorks() {
  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-6">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-semibold text-white">How fhEVM Works</h3>
      </div>
      <p className="text-xs text-gray-500 mb-5">
        This contract uses Fully Homomorphic Encryption (FHE) via{" "}
        <a
          href="https://docs.zama.ai/fhevm"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 hover:underline"
        >
          Zama fhEVM
        </a>
        {" "}— not ZK proofs or Pedersen commitments.
      </p>

      <div className="space-y-4">
        {STEPS.map((step, i) => {
          const { label, cls } = STATUS_LABEL[step.status];
          return (
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold text-brand-500 font-mono">{step.step}</span>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
                    {label}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-surface-500/40">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          <strong className="text-gray-400">What this is NOT:</strong> This is not a ZK proof system (Groth16, PLONK, STARK) and does not use Pedersen commitments, Merkle trees, or nullifiers. FHE and ZK are fundamentally different cryptographic approaches. FHE allows the server (EVM) to compute on encrypted data; ZK allows a prover to convince a verifier of a statement without revealing the witness.
        </p>
      </div>
    </div>
  );
}
