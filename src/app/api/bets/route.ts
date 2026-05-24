import { NextRequest, NextResponse } from "next/server";
import { getOpportunities } from "@/services/ev-engine";
import type { BetFilters } from "@/types";
import { BetType, Sport } from "@prisma/client";
import { cacheGet, cacheSet } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const filters: BetFilters = {
    sport: (searchParams.get("sport") as Sport) || undefined,
    sportsbook: searchParams.get("sportsbook") || undefined,
    betType: (searchParams.get("betType") as BetType) || undefined,
    minEvPercent: searchParams.get("minEv")
      ? parseFloat(searchParams.get("minEv")!)
      : undefined,
    minConfidence: searchParams.get("minConf")
      ? parseFloat(searchParams.get("minConf")!)
      : undefined,
    player: searchParams.get("player") || undefined,
    gameDate: searchParams.get("date") || undefined,
    search: searchParams.get("q") || undefined,
  };

  const cacheKey = `bets:${JSON.stringify(filters)}`;
  const cached = await cacheGet<{ bets: ReturnType<typeof getOpportunities> }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const bets = getOpportunities(filters);
  const payload = { bets, updatedAt: new Date().toISOString() };
  await cacheSet(cacheKey, payload, 30);
  return NextResponse.json(payload);
}
