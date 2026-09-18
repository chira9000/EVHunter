"use client";

import { RefreshCw } from "lucide-react";
import { useKalshiBets } from "@/hooks/use-kalshi-bets";
import { KalshiBetsTable } from "@/components/bets/kalshi-bets-table";
import { PickHitRatePanel } from "@/components/bets/pick-hit-rate-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatGroup } from "@/components/ui/stat-group";
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

  const windowLabel = (window: "1d" | "2d") => {
    const w = pickHitRate?.trends.windows.find((w) => w.window === window);
    return w && w.settled > 0 ? `${(w.hitRate * 100).toFixed(1)}%` : "—";
  };

  const statCards = [
    { label: "Portfolio", value: String(bets.length) },
    { label: "Pick hit rate", value: hitRateLabel },
    { label: "Hit rate (24h)", value: windowLabel("1d") },
    { label: "Hit rate (48h)", value: windowLabel("2d") },
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
          <h1 className="text-xl font-semibold tracking-tight">Kalshi Model Edge</h1>
          <p className="text-sm text-muted-foreground">
            Player props (incl. NBA points) & moneylines across MLB, NFL, NBA, soccer,
            and tennis — filtered, quality-ranked, and diversified portfolio
            {updatedAt && (
              <span className="ml-2 font-mono text-muted-foreground">
                Updated {new Date(updatedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <StatGroup items={statCards} className="sm:grid-cols-3 lg:grid-cols-6" />

      {pickHitRate && <PickHitRatePanel stats={pickHitRate} />}

      {loading ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Loading Kalshi model edges… first live fetch can take 10–30s; later loads use cache.
          </p>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : (
        <KalshiBetsTable bets={bets} />
      )}
    </div>
  );
}
