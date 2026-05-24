import { cn } from "@/lib/utils";
import { formatEvPercent } from "@/lib/betting-math";
import type { EvTier } from "@/lib/betting-math";

const tierStyles: Record<EvTier, string> = {
  elite: "text-violet-400 bg-violet-500/15 border-violet-500/30",
  strong: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  moderate: "text-sky-400 bg-sky-500/15 border-sky-500/30",
  marginal: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  negative: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
};

export function EvBadge({
  evPercent,
  tier,
  className,
}: {
  evPercent: number;
  tier: EvTier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        tierStyles[tier],
        className
      )}
    >
      {formatEvPercent(evPercent)}
    </span>
  );
}
