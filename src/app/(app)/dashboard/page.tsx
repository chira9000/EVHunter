"use client";

import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { useBets } from "@/hooks/use-bets";
import { FiltersSidebar } from "@/components/bets/filters-sidebar";
import { BetsTable } from "@/components/bets/bets-table";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { SportsbookComparison } from "@/components/dashboard/sportsbook-comparison";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sport } from "@prisma/client";

export default function DashboardPage() {
  const { bets, loading, error, refetch } = useBets();

  const stats = {
    totalOpportunities: bets.length,
    avgEv: bets.length
      ? bets.reduce((s, b) => s + b.evPercent, 0) / bets.length
      : 0,
    topSport: bets[0]?.sport ?? Sport.NBA,
    arbitrageCount: 2,
    steamMoves: bets.filter((b) => (b.steamScore ?? 0) > 0.6).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">Top +EV opportunities ranked by edge</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link href="/api/export/csv" target="_blank">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" /> CSV
            </Button>
          </Link>
        </div>
      </div>

      <StatsCards stats={stats} />

      {bets[0] && <SportsbookComparison bet={bets[0]} />}

      <div className="flex flex-col gap-4 lg:flex-row">
        <FiltersSidebar />
        <div className="min-w-0 flex-1">
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
            <BetsTable bets={bets} />
          )}
        </div>
      </div>
    </div>
  );
}
