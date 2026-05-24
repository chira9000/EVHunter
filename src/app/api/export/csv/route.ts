import { NextRequest, NextResponse } from "next/server";
import { getOpportunities } from "@/services/ev-engine";
import type { BetFilters } from "@/types";
import { Sport } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const filters: BetFilters = {
    sport: (searchParams.get("sport") as Sport) || undefined,
    minEvPercent: searchParams.get("minEv")
      ? parseFloat(searchParams.get("minEv")!)
      : 2,
  };

  const bets = getOpportunities(filters);
  const header =
    "id,sport,player,matchup,market,book,odds,ev_percent,model_prob,confidence,kelly\n";
  const rows = bets
    .map(
      (b) =>
        [
          b.id,
          b.sport,
          b.playerName ?? "",
          b.matchup,
          b.marketDescription,
          b.sportsbook,
          b.americanOdds,
          b.evPercent.toFixed(2),
          (b.modelProbability * 100).toFixed(2),
          (b.confidence * 100).toFixed(2),
          (b.kellyFraction * 100).toFixed(2),
        ].join(",")
    )
    .join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="evhunter-bets-${Date.now()}.csv"`,
    },
  });
}
