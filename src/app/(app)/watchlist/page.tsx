"use client";

import { BetCard } from "@/components/bets/bet-card";
import { useWatchlistStore } from "@/stores/watchlist-store";

export default function WatchlistPage() {
  const items = useWatchlistStore((s) => s.items);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Saved Bets</h1>
        <p className="text-sm text-muted-foreground">Your watchlist and tracked opportunities</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No saved bets. Bookmark opportunities from the Explorer.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </div>
      )}
    </div>
  );
}
