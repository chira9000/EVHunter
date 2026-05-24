"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { BetOpportunity } from "@/types";
import { EvBadge } from "@/components/bets/ev-badge";
import { OddsSparkline } from "@/components/bets/odds-sparkline";
import { formatAmericanOdds } from "@/lib/betting-math";
import { cn } from "@/lib/utils";

const columns = [
  "Player/Team",
  "Matchup",
  "Market",
  "Book",
  "Odds",
  "Model",
  "EV",
  "Conf",
  "CLV",
  "Line",
] as const;

export function BetsTable({ bets }: { bets: BetOpportunity[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: bets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-220px)] overflow-auto rounded-xl border border-white/10 bg-zinc-900/40"
      role="region"
      aria-label="Bets table"
    >
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-zinc-500">
            {columns.map((c) => (
              <th key={c} className="px-3 py-3 font-medium">
                {c}
              </th>
            ))}
            <th className="px-3 py-3">Trend</th>
          </tr>
        </thead>
        <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const bet = bets[virtualRow.index]!;
            const label = bet.playerName ?? bet.teamName ?? "—";
            return (
              <tr
                key={bet.id}
                className={cn(
                  "absolute left-0 w-full border-b border-white/5 hover:bg-white/[0.02]",
                  virtualRow.index % 2 === 0 && "bg-white/[0.01]"
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <td className="px-3 py-2 font-medium text-zinc-200">{label}</td>
                <td className="px-3 py-2 text-zinc-400">{bet.matchup}</td>
                <td className="px-3 py-2 text-zinc-300 max-w-[140px] truncate">
                  {bet.marketDescription}
                </td>
                <td className="px-3 py-2 text-zinc-400">{bet.sportsbook}</td>
                <td className="px-3 py-2 font-mono">{formatAmericanOdds(bet.americanOdds)}</td>
                <td className="px-3 py-2 font-mono text-emerald-400/90">
                  {(bet.modelProbability * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2">
                  <EvBadge evPercent={bet.evPercent} tier={bet.evTier} />
                </td>
                <td className="px-3 py-2 font-mono">
                  {(bet.confidence * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {bet.clv != null ? `${(bet.clv * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-500">
                  {bet.line ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <OddsSparkline data={bet.lineMovement} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {bets.length === 0 && (
        <p className="p-8 text-center text-zinc-500">No bets match your filters.</p>
      )}
    </div>
  );
}
