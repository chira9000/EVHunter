"use client";

import { useCallback, useState } from "react";
import type { PlayerSearchResult } from "@/services/kalshi/player-search";

interface UsePlayerSearchResult {
  result: PlayerSearchResult | null;
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
}

export function usePlayerSearch(): UsePlayerSearchResult {
  const [result, setResult] = useState<PlayerSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(60_000),
      });
      const data = (await res.json()) as PlayerSearchResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Player not found");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, search };
}
