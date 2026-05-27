import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  accent?: boolean;
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5 border transition-all duration-200 hover:border-surface-300",
        accent
          ? "bg-gradient-to-br from-brand-500/10 to-surface-700 border-brand-500/20"
          : "bg-surface-700 border-surface-400/50",
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            accent
              ? "bg-brand-500/15 text-brand-400"
              : "bg-surface-500 text-gray-300"
          )}
        >
          {icon}
        </div>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              trend.positive
                ? "bg-brand-500/10 text-brand-400"
                : "bg-red-500/10 text-red-400"
            )}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {title}
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold",
            accent ? "text-brand-400" : "text-white"
          )}
        >
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
