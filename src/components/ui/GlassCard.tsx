import { cn } from "@/lib/utils";

type Accent = "none" | "blue" | "green" | "orange";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: Accent;
  glow?: boolean;
  padding?: "sm" | "md" | "lg" | "none";
}

const accentStyles: Record<Accent, string> = {
  none:   "border-white/[0.07]",
  blue:   "border-base-500/25 shadow-glow-blue",
  green:  "border-brand-500/25 shadow-glow-green",
  orange: "border-orange-500/25",
};

const paddingStyles = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-6",
};

export function GlassCard({
  accent = "none",
  glow = false,
  padding = "md",
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative bg-white/[0.04] backdrop-blur-xl border rounded-2xl transition-all duration-300",
        "hover:border-white/[0.12]",
        accentStyles[accent],
        paddingStyles[padding],
        glow && "hover:shadow-glass",
        className
      )}
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)" }}
      {...props}
    >
      {children}
    </div>
  );
}

/** Thin colored top-border accent line */
export function GlassCardAccentBar({ color }: { color: "blue" | "green" | "orange" | "gray" }) {
  const colors = {
    blue:   "from-base-500 to-base-400",
    green:  "from-brand-500 to-brand-400",
    orange: "from-orange-500 to-orange-400",
    gray:   "from-surface-400 to-surface-300",
  };
  return (
    <div className={cn("absolute top-0 left-0 right-0 h-px rounded-t-2xl bg-gradient-to-r", colors[color])} />
  );
}
