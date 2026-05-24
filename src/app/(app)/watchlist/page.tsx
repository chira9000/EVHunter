"use client";

import { BetCard } from "@/components/bets/bet-card";
import { useWatchlistStore } from "@/stores/watchlist-store";

export default function WatchlistPage() {
  const items = useWatchlistStore((s) => s.items);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Saved Bets</h1>
        <p className="text-sm text-zinc-500">Your watchlist and tracked opportunities</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-12 text-center text-zinc-500">
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
