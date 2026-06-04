import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { fetchKalshiBestBets } from "@/services/kalshi/best-bets";
import type { KalshiBetsResponse } from "@/types/kalshi";

const CACHE_KEY = "kalshi:bets:daily";
const CACHE_TTL = 120;

export async function GET() {
  const cached = await cacheGet<KalshiBetsResponse>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  try {
    const bets = await fetchKalshiBestBets();
    const payload: KalshiBetsResponse = {
      bets,
      updatedAt: new Date().toISOString(),
      source: "kalshi",
    };
    await cacheSet(CACHE_KEY, payload, CACHE_TTL);
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load Kalshi odds";
    return NextResponse.json({ error: message, bets: [] }, { status: 502 });
  }
}
