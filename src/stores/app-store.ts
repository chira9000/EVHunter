import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BetFilters } from "@/types";
import type { BetType, Sport } from "@prisma/client";

interface AppState {
  theme: "dark" | "light" | "system";
  autoRefresh: boolean;
  refreshIntervalMs: number;
  filters: BetFilters;
  sidebarOpen: boolean;
  setTheme: (theme: AppState["theme"]) => void;
  setAutoRefresh: (v: boolean) => void;
  setRefreshInterval: (ms: number) => void;
  setFilters: (filters: Partial<BetFilters>) => void;
  resetFilters: () => void;
  setSidebarOpen: (v: boolean) => void;
}

const defaultFilters: BetFilters = {
  minEvPercent: 2,
  minConfidence: 0.5,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "dark",
      autoRefresh: true,
      refreshIntervalMs: 30000,
      filters: defaultFilters,
      sidebarOpen: true,
      setTheme: (theme) => set({ theme }),
      setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
      setRefreshInterval: (refreshIntervalMs) => set({ refreshIntervalMs }),
      setFilters: (filters) =>
        set((s) => ({ filters: { ...s.filters, ...filters } })),
      resetFilters: () => set({ filters: defaultFilters }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    { name: "evhunter-app" }
  )
);

export type { Sport, BetType };
