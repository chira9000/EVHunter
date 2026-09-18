"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ExternalLink } from "lucide-react";
import type { KalshiBet, KalshiBetType, KalshiSportKey } from "@/types/kalshi";
import { KALSHI_SPORT_KEYS } from "@/types/kalshi";
import { EvBadge } from "@/components/bets/ev-badge";
import { evTier, formatEvPercent } from "@/lib/betting-math";
import { cn } from "@/lib/utils";

const columns = [
  "#",
  "Type",
  "Sport",
  "Pick",
  "Market",
  "Model",
  "Quality",
  "Edge",
  "Size",
  "Ask",
] as const;

type BetTypeFilter = "all" | KalshiBetType;
type SportFilter = "all" | KalshiSportKey;

export function KalshiBetsTable({ bets }: { bets: KalshiBet[] }) {
  const [typeFilter, setTypeFilter] = useState<BetTypeFilter>("all");
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");

  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (typeFilter !== "all" && b.betType !== typeFilter) return false;
      if (sportFilter !== "all" && b.sport !== sportFilter) return false;
      return true;
    });
  }, [bets, typeFilter, sportFilter]);

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  const propCount = bets.filter((b) => b.betType === "player_prop").length;
  const mlCount = bets.filter((b) => b.betType === "moneyline").length;
  const sportCounts = useMemo(
    () =>
      Object.fromEntries(
        KALSHI_SPORT_KEYS.map((sport) => [
          sport,
          bets.filter((b) => b.sport === sport).length,
        ])
      ) as Record<KalshiSportKey, number>,
    [bets]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["all", `All (${bets.length})`],
              ["player_prop", `Props (${propCount})`],
              ["moneyline", `Moneylines (${mlCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                typeFilter === key
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="hidden h-4 w-px bg-border sm:block" />

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSportFilter("all")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              sportFilter === "all"
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All sports
          </button>
          {KALSHI_SPORT_KEYS.map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => setSportFilter(sport)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                sportFilter === sport
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground",
                sportCounts[sport] === 0 && "opacity-40"
              )}
            >
              {sport} ({sportCounts[sport]})
            </button>
          ))}
        </div>
      </div>

      <div
        ref={parentRef}
        className="h-[calc(100vh-280px)] overflow-auto rounded-lg border border-border"
        role="region"
        aria-label="Kalshi best bets"
      >
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              {columns.map((c) => (
                <th key={c} className="px-3 py-3 font-medium">
                  {c}
                </th>
              ))}
              <th className="px-3 py-3">Kalshi</th>
            </tr>
          </thead>
          <tbody
            style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const bet = filtered[virtualRow.index]!;
              const rank = bet.rank ?? virtualRow.index + 1;
              const tier = evTier(bet.edgePercent);
              return (
                <tr
                  key={bet.id}
                  className="absolute left-0 w-full border-b border-border hover:bg-foreground/[0.03]"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <td className="px-3 py-2 font-mono text-muted-foreground">{rank}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {bet.betType === "player_prop" ? "Prop" : "ML"}
                  </td>
                  <td className="px-3 py-2 font-medium">{bet.sport}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate font-medium">
                    {bet.playerName ?? bet.selection}
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground">
                    {bet.betType === "player_prop"
                      ? `${bet.line}+ ${bet.statType}`
                      : bet.matchup}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {(bet.modelProbability * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {bet.qualityScore != null
                      ? bet.qualityScore.toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <EvBadge evPercent={bet.edgePercent} tier={tier} />
                    <span className="ml-1 font-mono text-xs text-muted-foreground">
                      {formatEvPercent(bet.edgePercent)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {bet.bankrollPct != null
                      ? `${bet.bankrollPct.toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {(bet.yesAsk * 100).toFixed(1)}¢
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={bet.kalshiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      Trade <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No scored Kalshi markets in this filter.
          </p>
        )}
        {filtered.length > 0 && (
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            All markets: model ≥50%, ask ≥50¢. MLB/NFL/NBA props also require EV≥3%.
            Soccer & tennis moneylines ranked by fair price vs ask. Diversified with
            correlation penalties.
          </p>
        )}
      </div>
    </div>
  );
}
