import { cn } from "@/lib/utils";
import { formatEvPercent } from "@/lib/betting-math";
import type { EvTier } from "@/lib/betting-math";

const tierStyles: Record<EvTier, string> = {
  elite: "text-accent bg-accent/15 border-accent/30 font-bold",
  strong: "text-accent bg-accent/10 border-accent/25",
  moderate: "text-foreground bg-foreground/5 border-border",
  marginal: "text-warning bg-warning/10 border-warning/25",
  negative: "text-muted-foreground bg-foreground/5 border-border",
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
