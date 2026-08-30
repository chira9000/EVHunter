"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { KALSHI_SPORT_KEYS } from "@/types/kalshi";
import type { KalshiSportKey, PickHitRateStats, RecommendedPick } from "@/types/kalshi";
import { cn } from "@/lib/utils";

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function statusColor(status: RecommendedPick["status"]): string {
  if (status === "won") return "text-emerald-400";
  if (status === "lost") return "text-red-400";
  return "text-zinc-400";
}

const EXPORT_WINDOWS = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
] as const;

export function PickHitRatePanel({ stats }: { stats: PickHitRateStats }) {
  const sportRows = Object.entries(stats.bySport).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const [exportSports, setExportSports] = useState<Set<KalshiSportKey>>(
    () => new Set()
  );
  const [exportHours, setExportHours] = useState<number>(24);

  function toggleExportSport(sport: KalshiSportKey) {
    setExportSports((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) next.delete(sport);
      else next.add(sport);
      return next;
    });
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ hours: String(exportHours) });
    if (exportSports.size > 0) {
      params.set("sport", [...exportSports].join(","));
    }
    return `/api/kalshi/picks/export?${params.toString()}`;
  }, [exportHours, exportSports]);

  return (
    <section
      className="glass-panel space-y-4 rounded-xl p-4"
      aria-label="Recommended pick hit rate"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">
            Recommended pick hit rate
          </h2>
          <p className="text-xs text-zinc-500">
            Share of past portfolio Yes picks that settled Yes on Kalshi
            (includes NBA player points)
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-semibold text-emerald-400">
            {stats.settled > 0 ? pct(stats.hitRate) : "—"}
          </p>
          <p className="text-xs text-zinc-500">
            {stats.wins}W – {stats.losses}L
            {stats.pending > 0 ? ` · ${stats.pending} pending` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <span className="text-xs font-medium text-zinc-500">Export picks:</span>
        {EXPORT_WINDOWS.map((w) => (
          <button
            key={w.hours}
            type="button"
            onClick={() => setExportHours(w.hours)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              exportHours === w.hours
                ? "bg-sky-500/20 text-sky-400"
                : "bg-white/5 text-zinc-400 hover:text-zinc-200"
            )}
          >
            {w.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        {KALSHI_SPORT_KEYS.map((sport) => (
          <button
            key={sport}
            type="button"
            onClick={() => toggleExportSport(sport)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
              exportSports.has(sport)
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/5 text-zinc-400 hover:text-zinc-200"
            )}
          >
            {sport}
          </button>
        ))}
        <a
          href={exportHref}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30"
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </a>
      </div>

      {sportRows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sportRows.map(([sport, row]) => (
            <div
              key={sport}
              className="rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                {sport}
              </p>
              <p className="font-mono text-sm text-zinc-200">
                {pct(row.hitRate)}{" "}
                <span className="text-zinc-500">
                  ({row.wins}/{row.settled})
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      {stats.settled === 0 ? (
        <p className="text-sm text-zinc-500">
          No settled recommendations yet. Picks are recorded from each portfolio
          refresh and scored after markets expire.
        </p>
      ) : stats.recent.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-3 font-medium">Pick</th>
                <th className="py-2 pr-3 font-medium">Sport</th>
                <th className="py-2 pr-3 font-medium">Result</th>
                <th className="py-2 font-medium">Settled</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.slice(0, 8).map((pick) => (
                <tr
                  key={`${pick.marketTicker}-${pick.settledAt}`}
                  className="border-b border-white/5"
                >
                  <td className="py-2 pr-3 text-zinc-300">{pick.selection}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-500">
                    {pick.sport}
                    {pick.statType === "points" ? " · PTS" : ""}
                  </td>
                  <td
                    className={`py-2 pr-3 font-mono text-xs uppercase ${statusColor(pick.status)}`}
                  >
                    {pick.status}
                  </td>
                  <td className="py-2 font-mono text-xs text-zinc-500">
                    {pick.settledAt
                      ? new Date(pick.settledAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
