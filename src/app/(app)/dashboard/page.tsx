"use client";

import { RefreshCw } from "lucide-react";
import { useKalshiBets } from "@/hooks/use-kalshi-bets";
import { KalshiBetsTable } from "@/components/bets/kalshi-bets-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { bets, loading, error, updatedAt, refetch } = useKalshiBets();

  const bySport = {
    MLB: bets.filter((b) => b.sport === "MLB").length,
    NFL: bets.filter((b) => b.sport === "NFL").length,
    NBA: bets.filter((b) => b.sport === "NBA").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kalshi Daily Edge</h1>
          <p className="text-sm text-zinc-500">
            Live MLB, NFL & NBA game contracts — best edges ranked 1, 2, 3…
            {updatedAt && (
              <span className="ml-2 font-mono text-zinc-600">
                Updated {new Date(updatedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Plays ranked", value: bets.length },
          { label: "MLB", value: bySport.MLB },
          { label: "NFL", value: bySport.NFL },
          { label: "NBA", value: bySport.NBA },
        ].map((s) => (
          <div key={s.label} className="glass-panel rounded-xl px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{s.label}</p>
            <p className="font-mono text-2xl font-semibold text-emerald-400">{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
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
