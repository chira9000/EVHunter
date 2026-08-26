"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import type { KalshiBet, PickHitRateStats } from "@/types/kalshi";

interface UseKalshiBetsResult {
  bets: KalshiBet[];
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
  propsScored: number;
  moneylinesScored: number;
  pickHitRate: PickHitRateStats | null;
  refetch: () => void;
}

export function useKalshiBets(): UseKalshiBetsResult {
  const autoRefresh = useAppStore((s) => s.autoRefresh);
  const refreshIntervalMs = useAppStore((s) => s.refreshIntervalMs);

  const [bets, setBets] = useState<KalshiBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [propsScored, setPropsScored] = useState(0);
  const [moneylinesScored, setMoneylinesScored] = useState(0);
  const [pickHitRate, setPickHitRate] = useState<PickHitRateStats | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kalshi/bets", {
        signal: AbortSignal.timeout(120_000),
      });
      const data = (await res.json()) as {
        bets?: KalshiBet[];
        updatedAt?: string;
        propsScored?: number;
        moneylinesScored?: number;
        pickHitRate?: PickHitRateStats;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load Kalshi bets");
      setBets(data.bets ?? []);
      setUpdatedAt(data.updatedAt ?? null);
      setPropsScored(data.propsScored ?? 0);
      setMoneylinesScored(data.moneylinesScored ?? 0);
      setPickHitRate(data.pickHitRate ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setBets([]);
      setPickHitRate(null);
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

  return {
    bets,
    loading,
    error,
    updatedAt,
    propsScored,
    moneylinesScored,
    pickHitRate,
    refetch,
  };
}
