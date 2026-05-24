"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import type { BetOpportunity } from "@/types";
import type { BetFilters } from "@/types";

interface UseBetsResult {
  bets: BetOpportunity[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function buildQuery(filters: BetFilters): string {
  const params = new URLSearchParams();
  if (filters.sport) params.set("sport", filters.sport);
  if (filters.sportsbook) params.set("sportsbook", filters.sportsbook);
  if (filters.betType) params.set("betType", filters.betType);
  if (filters.minEvPercent != null) params.set("minEv", String(filters.minEvPercent));
  if (filters.minConfidence != null) params.set("minConf", String(filters.minConfidence));
  if (filters.player) params.set("player", filters.player);
  if (filters.gameDate) params.set("date", filters.gameDate);
  if (filters.search) params.set("q", filters.search);
  return params.toString();
}

export function useBets(overrideFilters?: BetFilters): UseBetsResult {
  const storeFilters = useAppStore((s) => s.filters);
  const autoRefresh = useAppStore((s) => s.autoRefresh);
  const refreshIntervalMs = useAppStore((s) => s.refreshIntervalMs);
  const filters = useMemo(
    () => ({ ...storeFilters, ...overrideFilters }),
    [storeFilters, overrideFilters]
  );

  const [bets, setBets] = useState<BetOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery(filters);
      const res = await fetch(`/api/bets${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load bets");
      const data = (await res.json()) as { bets: BetOpportunity[] };
      setBets(data.bets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refetch, refreshIntervalMs);
    return () => clearInterval(id);
  }, [autoRefresh, refreshIntervalMs, refetch]);

  return { bets, loading, error, refetch };
}
