"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ExternalLink } from "lucide-react";
import type { KalshiBet } from "@/types/kalshi";
import { EvBadge } from "@/components/bets/ev-badge";
import { evTier, formatEvPercent } from "@/lib/betting-math";
import { cn } from "@/lib/utils";

const columns = [
  "#",
  "Sport",
  "Matchup",
  "Pick",
  "Yes Ask",
  "Fair",
  "Edge",
  "Spread",
  "Game",
] as const;

export function KalshiBetsTable({ bets }: { bets: KalshiBet[] }) {
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
      aria-label="Kalshi best bets"
    >
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-zinc-500">
            {columns.map((c) => (
              <th key={c} className="px-3 py-3 font-medium">
                {c}
              </th>
            ))}
            <th className="px-3 py-3">Kalshi</th>
          </tr>
        </thead>
        <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const bet = bets[virtualRow.index]!;
            const rank = virtualRow.index + 1;
            const tier = evTier(bet.edgePercent);
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
                <td className="px-3 py-2 font-mono text-zinc-500">{rank}</td>
                <td className="px-3 py-2 font-medium text-emerald-400/90">{bet.sport}</td>
                <td className="px-3 py-2 text-zinc-300">{bet.matchup}</td>
                <td className="px-3 py-2 font-medium text-zinc-200">{bet.selection}</td>
                <td className="px-3 py-2 font-mono">
                  {(bet.yesAsk * 100).toFixed(1)}¢
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {(bet.fairProbability * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2">
                  <EvBadge evPercent={bet.edgePercent} tier={tier} />
                  <span className="ml-1 font-mono text-xs text-zinc-500">
                    {formatEvPercent(bet.edgePercent)}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-zinc-500">
                  {bet.spreadPercent.toFixed(1)}¢
                </td>
                <td className="px-3 py-2 font-mono text-zinc-500">{bet.gameDate}</td>
                <td className="px-3 py-2">
                  <a
                    href={bet.kalshiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400"
                  >
                    Trade <ExternalLink className="h-3 w-3" />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {bets.length === 0 && (
        <p className="p-8 text-center text-zinc-500">
          No open Kalshi game markets in the next {96}h for MLB, NFL, or NBA.
        </p>
      )}
      {bets.length > 0 && (
        <p className="border-t border-white/5 px-4 py-2 text-xs text-zinc-600">
          Ranked 1→n (ascending rank): highest edge at the ask vs no-vig fair mid on paired
          game contracts. MLB, NFL, NBA — live Kalshi Trade API.
        </p>
      )}
    </div>
  );
}
