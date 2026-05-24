"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { Sport, BetType } from "@prisma/client";
import { BOOKS } from "@/services/mock/data";

export function FiltersSidebar() {
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const autoRefresh = useAppStore((s) => s.autoRefresh);
  const setAutoRefresh = useAppStore((s) => s.setAutoRefresh);

  return (
    <aside
      className="w-full shrink-0 space-y-4 rounded-xl border border-white/10 bg-zinc-900/50 p-4 lg:w-64"
      aria-label="Filters"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Filters
      </h2>

      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">Search</span>
        <Input
          placeholder="Player, team, market..."
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ search: e.target.value || undefined })}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">Sport</span>
        <select
          className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-950/50 px-3 text-sm"
          value={filters.sport ?? ""}
          onChange={(e) =>
            setFilters({ sport: (e.target.value as Sport) || undefined })
          }
        >
          <option value="">All sports</option>
          {Object.values(Sport).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">Sportsbook</span>
        <select
          className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-950/50 px-3 text-sm"
          value={filters.sportsbook ?? ""}
          onChange={(e) => setFilters({ sportsbook: e.target.value || undefined })}
        >
          <option value="">All books</option>
          {BOOKS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">Bet type</span>
        <select
          className="flex h-9 w-full rounded-md border border-white/10 bg-zinc-950/50 px-3 text-sm"
          value={filters.betType ?? ""}
          onChange={(e) =>
            setFilters({ betType: (e.target.value as BetType) || undefined })
          }
        >
          <option value="">All types</option>
          {Object.values(BetType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">Min EV %</span>
        <Input
          type="number"
          step="0.5"
          value={filters.minEvPercent ?? 2}
          onChange={(e) =>
            setFilters({ minEvPercent: parseFloat(e.target.value) || 0 })
          }
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-zinc-500">Min confidence</span>
        <Input
          type="number"
          step="0.05"
          min="0"
          max="1"
          value={filters.minConfidence ?? 0.5}
          onChange={(e) =>
            setFilters({ minConfidence: parseFloat(e.target.value) || 0 })
          }
        />
      </label>

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">Auto-refresh</span>
        <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
      </div>

      <Button variant="secondary" size="sm" className="w-full" onClick={resetFilters}>
        Reset filters
      </Button>
    </aside>
  );
}
