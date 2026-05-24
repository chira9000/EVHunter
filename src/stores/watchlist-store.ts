import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BetOpportunity } from "@/types";

interface WatchlistState {
  items: BetOpportunity[];
  add: (bet: BetOpportunity) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (bet) => {
        if (get().has(bet.id)) return;
        set((s) => ({ items: [...s.items, bet] }));
      },
      remove: (id) => set((s) => ({ items: s.items.filter((b) => b.id !== id) })),
      has: (id) => get().items.some((b) => b.id === id),
    }),
    { name: "evhunter-watchlist" }
  )
);
