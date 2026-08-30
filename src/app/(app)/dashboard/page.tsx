"use client";

import { RefreshCw } from "lucide-react";
import { useKalshiBets } from "@/hooks/use-kalshi-bets";
import { KalshiBetsTable } from "@/components/bets/kalshi-bets-table";
import { PickHitRatePanel } from "@/components/bets/pick-hit-rate-panel";
import { PicksExportControls } from "@/components/bets/picks-export-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KALSHI_SPORT_KEYS } from "@/types/kalshi";

export default function DashboardPage() {
  const {
    bets,
    loading,
    error,
    updatedAt,
    propsScored,
    moneylinesScored,
    pickHitRate,
    refetch,
  } = useKalshiBets();

  const bySport = Object.fromEntries(
    KALSHI_SPORT_KEYS.map((sport) => [
      sport,
      bets.filter((b) => b.sport === sport).length,
    ])
  );
  const props = bets.filter((b) => b.betType === "player_prop").length;
  const nbaPts = bets.filter(
    (b) => b.sport === "NBA" && b.statType === "points"
  ).length;

  const hitRateLabel =
    pickHitRate && pickHitRate.settled > 0
      ? `${(pickHitRate.hitRate * 100).toFixed(1)}%`
      : "—";

  const statCards = [
    { label: "Portfolio", value: String(bets.length) },
    { label: "Pick hit rate", value: hitRateLabel },
    { label: "Player props", value: String(props || propsScored) },
    { label: "NBA points", value: String(nbaPts) },
    { label: "Moneylines", value: String(moneylinesScored) },
    ...KALSHI_SPORT_KEYS.map((sport) => ({
      label: sport,
      value: String(bySport[sport] ?? 0),
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kalshi Model Edge</h1>
          <p className="text-sm text-zinc-500">
            Player props (incl. NBA points) & moneylines across MLB, NFL, NBA, soccer,
            and tennis — filtered, quality-ranked, and diversified portfolio
            {updatedAt && (
              <span className="ml-2 font-mono text-zinc-600">
                Updated {new Date(updatedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PicksExportControls />
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-10">
        {statCards.map((s) => (
          <div key={s.label} className="glass-panel rounded-xl px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{s.label}</p>
            <p className="font-mono text-2xl font-semibold text-emerald-400">{s.value}</p>
          </div>
        ))}
      </div>

      {pickHitRate && <PickHitRatePanel stats={pickHitRate} />}

      {loading ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">
            Loading Kalshi model edges… first live fetch can take 10–30s; later loads use cache.
          </p>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-red-400" role="alert">
          {error}
        </p>
      ) : (
        <KalshiBetsTable bets={bets} />
      )}
    </div>
  );
}
