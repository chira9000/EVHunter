"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import type { KalshiBet } from "@/types/kalshi";

interface UseKalshiBetsResult {
  bets: KalshiBet[];
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
  refetch: () => void;
}

export function useKalshiBets(): UseKalshiBetsResult {
  const autoRefresh = useAppStore((s) => s.autoRefresh);
  const refreshIntervalMs = useAppStore((s) => s.refreshIntervalMs);

  const [bets, setBets] = useState<KalshiBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kalshi/bets");
      const data = (await res.json()) as {
        bets?: KalshiBet[];
        updatedAt?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load Kalshi bets");
      setBets(data.bets ?? []);
      setUpdatedAt(data.updatedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refetch, refreshIntervalMs);
    return () => clearInterval(id);
  }, [autoRefresh, refreshIntervalMs, refetch]);

  return { bets, loading, error, updatedAt, refetch };
}
