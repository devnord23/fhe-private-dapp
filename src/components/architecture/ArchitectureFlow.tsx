"use client";

import { useContractConfig } from "@/hooks/useContractConfig";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  sublabel: string;
  chain?: string;
  status: "active" | "configured" | "todo" | "demo";
  color: "blue" | "green" | "orange" | "gray";
}

const COLOR = {
  blue:   { bg: "bg-base-500/10",   border: "border-base-500/25",   text: "text-base-400",   dot: "bg-base-400"   },
  green:  { bg: "bg-brand-500/10",  border: "border-brand-500/25",  text: "text-brand-400",  dot: "bg-brand-400"  },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", dot: "bg-orange-400" },
  gray:   { bg: "bg-surface-500/40",border: "border-surface-400/30",text: "text-gray-500",   dot: "bg-gray-600"   },
};

const STATUS_LABEL: Record<Step["status"], string> = {
  active:     "Active",
  configured: "Configured",
  todo:       "TODO",
  demo:       "Not Deployed",
};

function FlowStep({ step }: { step: Step }) {
  const c = COLOR[step.color];
  const isLive = step.status === "active" || step.status === "configured";

  return (
    <div className={cn(
      "flex-1 min-w-0 rounded-xl border p-4 transition-all duration-200",
      c.bg, c.border
    )}>
      {/* Status dot + label */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          c.dot,
          isLive && "animate-pulse-slow"
        )} />
        <span className={cn("text-[9px] font-bold uppercase tracking-[0.15em]", c.text)}>
          {STATUS_LABEL[step.status]}
        </span>
      </div>

      {/* Main label */}
      <p className="text-sm font-semibold text-white leading-tight mb-1">
        {step.label}
      </p>
      <p className="text-[10px] text-gray-500 leading-snug">
        {step.sublabel}
      </p>
      {step.chain && (
        <p className={cn("mt-2 font-mono text-[9px]", c.text)}>
          Chain {step.chain}
        </p>
      )}
    </div>
  );
}

function Arrow({ todo }: { todo?: boolean }) {
  return (
    <div className="flex items-center justify-center shrink-0 w-6">
      <div className="flex flex-col items-center gap-1">
        <svg
          className={cn("h-4 w-4 shrink-0", todo ? "text-orange-500/40" : "text-gray-600")}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M3 8h10m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {todo && (
          <span className="text-[7px] font-bold text-orange-500/50 uppercase tracking-wide leading-none">
            TODO
          </span>
        )}
      </div>
    </div>
  );
}

export function ArchitectureFlow({ compact = false }: { compact?: boolean }) {
  const { vault, confidentialToken, strategyAgent } = useContractConfig();

  const steps: Step[] = [
    {
      id: "wallet",
      label:    "Base Wallet",
      sublabel: "User connects on Base Sepolia",
      chain:    "84532",
      status:   "active",
      color:    "blue",
    },
    {
      id: "vault",
      label:    "BaseVault",
      sublabel: "Lock ERC-20 on Base",
      chain:    "84532",
      status:   vault ? "configured" : "demo",
      color:    vault ? "blue" : "gray",
    },
    {
      id: "bridge",
      label:    "Bridge / Relayer",
      sublabel: "Cross-chain message passing",
      status:   "todo",
      color:    "orange",
    },
    {
      id: "fhevm",
      label:    "Zama fhEVM",
      sublabel: "Confidential compute",
      chain:    "11155111",
      status:   (confidentialToken || strategyAgent) ? "configured" : "demo",
      color:    (confidentialToken || strategyAgent) ? "green" : "gray",
    },
    {
      id: "eval",
      label:    "Encrypted Eval",
      sublabel: "TFHE homomorphic ops",
      status:   strategyAgent ? "configured" : "demo",
      color:    strategyAgent ? "green" : "gray",
    },
  ];

  return (
    <div className={cn(
      "rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-lg overflow-hidden",
      compact ? "p-4" : "p-5"
    )}>
      {!compact && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="section-label mb-1">System Architecture</p>
            <h3 className="text-sm font-semibold text-white">Settlement → Compute Flow</h3>
          </div>
          <div className="flex gap-2">
            <span className="pill-blue">Base</span>
            <span className="pill-green">Zama fhEVM</span>
          </div>
        </div>
      )}

      {/* Flow steps */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2 min-w-0">
            <FlowStep step={step} />
            {i < steps.length - 1 && (
              <Arrow todo={step.id === "bridge"} />
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="status-dot-blue" />
            <span className="text-[10px] text-gray-500">Base Sepolia (settlement)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="status-dot-live" />
            <span className="text-[10px] text-gray-500">Zama fhEVM (compute)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            <span className="text-[10px] text-gray-500">Bridge relay (TODO)</span>
          </div>
        </div>
      )}
    </div>
  );
}
