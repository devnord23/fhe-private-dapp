/**
 * RelayerStatus — Shows current relayer bridge status.
 *
 * The bridge connecting BaseVault (Base Sepolia) to ConfidentialToken (Zama fhEVM)
 * is NOT YET IMPLEMENTED. This component shows that clearly and explains what
 * the user can do in the meantime.
 */

import { Badge } from "@/components/ui/Badge";

export function RelayerStatus() {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
          <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-white">Bridge Relayer</p>
            <Badge variant="danger">Not Implemented</Badge>
          </div>
          <p className="text-xs text-gray-400">
            The cross-chain bridge connecting Base Sepolia deposits to Zama fhEVM
            is not yet deployed. Deposits are safely held in BaseVault on Base Sepolia
            but are NOT automatically shielded on Zama.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-surface-600/40 border border-surface-400/30 p-4 space-y-2">
        <p className="text-[11px] font-semibold text-white">Current deposit flow without bridge</p>
        <div className="space-y-1.5">
          {[
            { step: "1", label: "Deposit on Base Sepolia", status: "Works", ok: true },
            { step: "2", label: "Bridge to Zama fhEVM", status: "TODO", ok: false },
            { step: "3", label: "Shield on Zama fhEVM", status: "TODO (manual)", ok: false },
            { step: "4", label: "Encrypted strategy evaluation", status: "TODO (after bridge)", ok: false },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500 w-5 shrink-0">{item.step}.</span>
              <span className="text-[10px] text-gray-400 flex-1">{item.label}</span>
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border shrink-0
                ${item.ok
                  ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-surface-600/40 border border-surface-400/30 p-4">
        <p className="text-[11px] font-semibold text-white mb-2">What you can do now</p>
        <ul className="space-y-1 text-[10px] text-gray-400">
          <li className="flex gap-1.5"><span className="text-brand-400 shrink-0">•</span>
            Deposit ERC-20 tokens on Base Sepolia (they are safely held in the vault)
          </li>
          <li className="flex gap-1.5"><span className="text-brand-400 shrink-0">•</span>
            Link your account to a Zama fhEVM strategy ID
          </li>
          <li className="flex gap-1.5"><span className="text-brand-400 shrink-0">•</span>
            Withdraw via <strong className="text-white">Emergency Withdraw</strong> at any time (no relayer needed)
          </li>
          <li className="flex gap-1.5"><span className="text-yellow-400 shrink-0">—</span>
            Use the <strong className="text-white">Transfer</strong> page to interact directly with Zama fhEVM (switch to Zama Devnet first)
          </li>
        </ul>
      </div>

      <div className="text-[10px] text-gray-500 border-t border-surface-500/40 pt-3">
        <strong className="text-gray-400">Bridge candidates:</strong> LayerZero OFT, Hyperlane, Wormhole, custom relayer.
        See <code className="text-brand-400">contracts/contracts/IRelayer.sol</code> for the interface specification.
      </div>
    </div>
  );
}
