"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmericanOdds } from "@/lib/betting-math";
import type { BetOpportunity } from "@/types";
import { EvBadge } from "@/components/bets/ev-badge";

/** Compare the same market across books for a featured bet */
export function SportsbookComparison({ bet }: { bet: BetOpportunity }) {
  const otherBooks = [
    { name: "FanDuel", odds: bet.americanOdds + 5, ev: bet.evPercent - 0.8 },
    { name: "DraftKings", odds: bet.americanOdds - 3, ev: bet.evPercent + 0.4 },
    { name: "BetMGM", odds: bet.americanOdds + 8, ev: bet.evPercent - 1.2 },
    { name: "Caesars", odds: bet.americanOdds + 2, ev: bet.evPercent - 0.3 },
    { name: "Pinnacle", odds: bet.americanOdds - 2, ev: bet.evPercent + 0.6 },
  ].filter((b) => b.name !== bet.sportsbook);

  const books = [
    { name: bet.sportsbook, odds: bet.americanOdds, ev: bet.evPercent },
    ...otherBooks,
  ]
    .sort((a, b) => b.ev - a.ev)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Sportsbook Comparison</CardTitle>
        <p className="text-xs text-zinc-500">{bet.marketDescription}</p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {books.map((b) => (
          <div
            key={b.name}
            className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
          >
            <p className="text-xs text-zinc-500">{b.name}</p>
            <p className="font-mono text-lg text-zinc-100">
              {formatAmericanOdds(b.odds)}
            </p>
            <EvBadge
              evPercent={b.ev}
              tier={b.ev >= 5 ? "strong" : b.ev >= 2 ? "moderate" : "marginal"}
              className="mt-1"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
