import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string;
}

export function StatGroup({
  items,
  className,
}: {
  items: StatItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-4",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="p-3">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
