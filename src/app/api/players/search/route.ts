import { NextRequest, NextResponse } from "next/server";
import { isKalshiMockMode } from "@/lib/env";
import { cacheGet, cacheSet } from "@/lib/redis";
import { searchKalshiPlayer, type PlayerSearchResult } from "@/services/kalshi/player-search";
import { getMockPlayerSearchResult } from "@/services/mock/kalshi-data";

const CACHE_TTL = 300;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "Missing ?q= player name" }, { status: 400 });
  }

  if (isKalshiMockMode()) {
    const mock = getMockPlayerSearchResult(q);
    if (!mock) {
      return NextResponse.json(
        { error: `No player prop markets found matching "${q}"` },
        { status: 404 }
      );
    }
    return NextResponse.json(mock);
  }

  const cacheKey = `kalshi:player-search:${q.toLowerCase()}`;
  const cached = await cacheGet<PlayerSearchResult>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const result = await searchKalshiPlayer(q);
    if (!result) {
      return NextResponse.json(
        { error: `No player prop markets found matching "${q}"` },
        { status: 404 }
      );
    }
    await cacheSet(cacheKey, result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to search Kalshi";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
