"use client";

import type { PickHitRateStats, RecommendedPick } from "@/types/kalshi";

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function statusColor(status: RecommendedPick["status"]): string {
  if (status === "won") return "text-accent";
  if (status === "lost") return "text-danger";
  return "text-muted-foreground";
}

export function PickHitRatePanel({ stats }: { stats: PickHitRateStats }) {
  const sportRows = Object.entries(stats.bySport).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const trends = stats.trends;

  return (
    <section
      className="space-y-4 rounded-lg border border-border p-4"
      aria-label="Recommended pick hit rate"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Recommended pick hit rate</h2>
          <p className="text-xs text-muted-foreground">
            Share of past portfolio Yes picks that settled Yes on Kalshi
            (includes NBA player points)
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold text-accent">
            {stats.settled > 0 ? pct(stats.hitRate) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {stats.wins}W – {stats.losses}L
            {stats.pending > 0 ? ` · ${stats.pending} pending` : ""}
          </p>
        </div>
      </div>

      {trends && (
        <div className="space-y-3 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            Trend analysis
          </span>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            {trends.windows.map((w) => (
              <div key={w.window}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {w.label}
                </p>
                <p className="mt-0.5 text-xs">{w.summary}</p>
                {w.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {w.bullets.map((bullet) => (
                      <li key={bullet} className="text-xs text-warning">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {trends.exclusionRules.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Excluding from next batch:{" "}
              {trends.exclusionRules.map((r) => r.reason).join(", ")}
            </p>
          )}
        </div>
      )}

      {sportRows.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3">
          {sportRows.map(([sport, row]) => (
            <div key={sport}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {sport}
              </p>
              <p className="font-mono text-sm">
                {pct(row.hitRate)}{" "}
                <span className="text-muted-foreground">
                  ({row.wins}/{row.settled})
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      {stats.settled === 0 ? (
        <p className="text-sm text-muted-foreground">
          No settled recommendations yet. Picks are recorded from each portfolio
          refresh and scored after markets expire.
        </p>
      ) : stats.recent.length > 0 ? (
        <div className="overflow-x-auto border-t border-border pt-3">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
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
                  className="border-b border-border"
                >
                  <td className="py-2 pr-3">{pick.selection}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                    {pick.sport}
                    {pick.statType === "points" ? " · PTS" : ""}
                  </td>
                  <td
                    className={`py-2 pr-3 font-mono text-xs uppercase ${statusColor(pick.status)}`}
                  >
                    {pick.status}
                  </td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">
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
