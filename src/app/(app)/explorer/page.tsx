"use client";

import { useBets } from "@/hooks/use-bets";
import { BetCard } from "@/components/bets/bet-card";
import { FiltersSidebar } from "@/components/bets/filters-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExplorerPage() {
  const { bets, loading, error } = useBets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bet Explorer</h1>
        <p className="text-sm text-zinc-500">Card view with full bet analytics</p>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <FiltersSidebar />
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          {error && <p className="text-red-400 col-span-full">{error}</p>}
          {!loading &&
            bets.map((bet) => <BetCard key={bet.id} bet={bet} />)}
        </div>
      </div>
    </div>
  );
}
