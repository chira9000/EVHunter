import { NextResponse } from "next/server";
import { isKalshiMockMode } from "@/lib/env";
import { cacheGet, cacheSet } from "@/lib/redis";
import { fetchKalshiBestBets } from "@/services/kalshi/best-bets";
import {
  getPickHitRateStats,
  settleRecommendedPicks,
  syncRecommendedPickTracking,
} from "@/services/kalshi/pick-tracker";
import { getMockKalshiBetsResponse } from "@/services/mock/kalshi-data";
import type { KalshiBetsResponse } from "@/types/kalshi";

const CACHE_KEY = "kalshi:bets:daily";
const CACHE_TTL = 300;
const STALE_TTL = 3600;

type CachedKalshiPayload = KalshiBetsResponse & { cachedAt: number };

let refreshInFlight: Promise<KalshiBetsResponse> | null = null;

async function loadKalshiBets(): Promise<KalshiBetsResponse> {
  if (isKalshiMockMode()) return getMockKalshiBetsResponse();

  const { bets, propsScored, moneylinesScored, filteredCount, survivorCount } =
    await fetchKalshiBestBets();
  const pickHitRate = await syncRecommendedPickTracking(bets);
  return {
    bets,
    updatedAt: new Date().toISOString(),
    source: "kalshi",
    propsScored,
    moneylinesScored,
    filteredCount,
    survivorCount,
    pickHitRate,
  };
}

async function refreshKalshiCache(): Promise<KalshiBetsResponse> {
  if (!refreshInFlight) {
    refreshInFlight = loadKalshiBets()
      .then(async (payload) => {
        await cacheSet(
          CACHE_KEY,
          { ...payload, cachedAt: Date.now() } satisfies CachedKalshiPayload,
          STALE_TTL
        );
        return payload;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function stripCacheMeta(cached: CachedKalshiPayload): KalshiBetsResponse {
  const { cachedAt: _cachedAt, ...payload } = cached;
  return payload;
}

/** Prefer fresh settlement stats over whatever was baked into the bets cache. */
async function withFreshHitRate(
  payload: KalshiBetsResponse
): Promise<KalshiBetsResponse> {
  try {
    await settleRecommendedPicks();
    const pickHitRate = await getPickHitRateStats();
    return { ...payload, pickHitRate };
  } catch {
    return payload;
  }
}

export async function GET() {
  if (isKalshiMockMode()) {
    return NextResponse.json(getMockKalshiBetsResponse());
  }

  const cached = await cacheGet<CachedKalshiPayload>(CACHE_KEY);
  if (cached?.cachedAt) {
    const ageSec = (Date.now() - cached.cachedAt) / 1000;
    if (ageSec < CACHE_TTL) {
      return NextResponse.json(await withFreshHitRate(stripCacheMeta(cached)));
    }
    if (ageSec < STALE_TTL) {
      void refreshKalshiCache();
      return NextResponse.json(await withFreshHitRate(stripCacheMeta(cached)));
    }
  }

  try {
    const payload = await refreshKalshiCache();
    return NextResponse.json(payload);
  } catch (e) {
    if (cached) {
      return NextResponse.json(await withFreshHitRate(stripCacheMeta(cached)));
    }
    const message = e instanceof Error ? e.message : "Failed to load Kalshi odds";
    return NextResponse.json({ error: message, bets: [] }, { status: 502 });
  }
}
