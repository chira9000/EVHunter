"use client";

import { useKalshiBets } from "@/hooks/use-kalshi-bets";
import { KalshiBetsTable } from "@/components/bets/kalshi-bets-table";
import { PickHitRatePanel } from "@/components/bets/pick-hit-rate-panel";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExplorerPage() {
  const { bets, loading, error, pickHitRate } = useKalshiBets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Kalshi Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Live MLB, NFL & NBA contracts from Kalshi — including NBA player points
        </p>
      </div>
      {pickHitRate && <PickHitRatePanel stats={pickHitRate} />}
      {loading ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Loading Kalshi markets…</p>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <KalshiBetsTable bets={bets} />
      )}
    </div>
  );
}
