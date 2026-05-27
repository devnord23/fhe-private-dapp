/**
 * SecurityNote – Explains exactly what FHE protects in this dApp.
 *
 * This component is shown on the Strategy page. Every claim here must be accurate.
 * No exaggerated privacy guarantees.
 */

const PROTECTED: string[] = [
  "Exact values of strategy parameters (APY target, rebalance threshold, stop-loss buffer, liquidation buffer, max leverage)",
  "Whether individual conditions were met during a silent evaluation",
  "Intermediate TFHE computation results (comparison outputs as ebool handles)",
  "Exact market values submitted by the agent during evaluation",
];

const NOT_PROTECTED: string[] = [
  "That a strategy EXISTS — strategyId and owner address are public",
  "WHEN evaluations occur — block timestamps are visible to all observers",
  "HOW OFTEN evaluations occur — transaction frequency is fully public",
  "THAT requestReveal was called — and the revealed value itself (permanently public in event logs)",
  "Gas usage patterns — may correlate with which TFHE operations ran",
  "Transaction metadata — sender, gas price, nonce, block number",
];

const METADATA_RISKS: string[] = [
  "Evaluation frequency changes: if an agent evaluates more often as market approaches a threshold, observers may infer the threshold neighborhood",
  "Timing correlation: stop-loss triggers cause agent to stop evaluating. Silence after a volatile period reveals the event",
  "Gas cost differential: if different evaluation paths cost different gas, sophisticated observers can narrow the outcome",
  "Gateway request timing: calling requestEvaluationReveal immediately after a market event reveals the binary outcome",
];

export function SecurityNote() {
  return (
    <div className="rounded-2xl border border-surface-400/50 bg-surface-700 p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold text-white mb-1">Security Audit</h3>
        <p className="text-xs text-gray-400">
          Accurate summary of what Zama fhEVM protects in this protocol. Not a claim of
          perfect privacy — FHE protects data confidentiality but not metadata.
        </p>
      </div>

      <Section title="✅ Protected by FHE" items={PROTECTED} color="brand" />
      <Section title="⚠️ NOT Protected (visible on-chain)" items={NOT_PROTECTED} color="yellow" />
      <Section title="🔴 Metadata Leakage Risks" items={METADATA_RISKS} color="red" />

      <div className="rounded-xl bg-surface-600/40 border border-surface-400/30 p-4">
        <p className="text-[11px] font-semibold text-white mb-1.5">FHE vs ZK Proofs — Key Difference</p>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          This protocol uses <strong className="text-white">Fully Homomorphic Encryption (FHE)</strong>, not
          zero-knowledge proofs. FHE allows the EVM to perform arithmetic on encrypted values (add, compare, select)
          without decrypting them. ZK proofs allow a prover to convince a verifier of a statement without revealing
          the witness. They solve different problems: FHE enables private computation; ZK enables private verification.
          This contract never generates or verifies a ZK proof.
        </p>
      </div>

      <div className="rounded-xl bg-surface-600/40 border border-surface-400/30 p-4">
        <p className="text-[11px] font-semibold text-white mb-1.5">Re-encryption Model</p>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          To read an encrypted value (e.g., your APY target), you must:
          (1) generate a temporary NaCl keypair via <code className="text-brand-400">fhevmjs.generateKeypair()</code>,
          (2) sign an EIP-712 message proving ownership,
          (3) call <code className="text-brand-400">fhevmjs.reencrypt(handle, ...)</code> which asks the Zama Gateway
          to re-encrypt the ciphertext to your temporary public key,
          (4) decrypt locally with your temporary private key.
          The re-encryption step touches the Zama key management nodes — it is not fully trustless.
        </p>
      </div>
    </div>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: "brand" | "yellow" | "red" }) {
  const border = color === "brand" ? "border-brand-500/20" : color === "yellow" ? "border-yellow-500/20" : "border-red-500/20";
  const text   = color === "brand" ? "text-brand-400"    : color === "yellow" ? "text-yellow-400"    : "text-red-400";

  return (
    <div className={`rounded-xl border ${border} p-4`}>
      <p className={`text-xs font-semibold ${text} mb-2`}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[10px] text-gray-400 leading-relaxed">
            <span className="shrink-0 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
