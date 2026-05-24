import { americanToDecimal, americanToImpliedProbability } from "@/lib/betting-math";
import { prisma } from "@/lib/prisma";
import type { BetType, Sport } from "@prisma/client";
import { oddsApiClient, type OddsApiEvent } from "./odds-api-client";
import { isMockMode } from "@/lib/env";

function dedupeEvents(events: OddsApiEvent[]): OddsApiEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.homeTeam}:${e.awayTeam}:${e.commenceTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function ingestOddsForSport(sport: Sport): Promise<number> {
  const events = dedupeEvents(await oddsApiClient.fetchOdds(sport));
  let count = 0;

  if (isMockMode() && events.length === 0) return 0;

  for (const event of events) {
    for (const book of event.bookmakers) {
      const sportsbook = await prisma.sportsbook.upsert({
        where: { slug: book.key },
        create: { slug: book.key, name: book.title, isSharp: book.key === "pinnacle" },
        update: { name: book.title },
      });

      for (const market of book.markets) {
        const betType: BetType =
          market.key === "h2h"
            ? "MONEYLINE"
            : market.key === "spreads"
              ? "SPREAD"
              : "TOTAL";

        for (const outcome of market.outcomes) {
          const american = Math.round(outcome.price);
          await prisma.oddsLine.create({
            data: {
              sportsbookId: sportsbook.id,
              betType,
              americanOdds: american,
              decimalOdds: americanToDecimal(american),
              impliedProb: americanToImpliedProbability(american),
              line: outcome.point,
              capturedAt: new Date(),
            },
          });
          count++;
        }
      }
    }
  }

  return count;
}

export async function runOddsIngestionJob(): Promise<{ ingested: number; sports: Sport[] }> {
  const sports: Sport[] = ["NBA", "NFL", "MLB", "NHL"];
  let ingested = 0;
  for (const sport of sports) {
    try {
      ingested += await ingestOddsForSport(sport);
    } catch (e) {
      console.error(`Ingestion failed for ${sport}:`, e);
    }
  }
  return { ingested, sports };
}
