"use client";

import { useEffect, useState } from "react";
import type { ArbitrageOpportunity } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmericanOdds } from "@/lib/betting-math";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArbitragePage() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/arbitrage")
      .then((r) => r.json())
      .then((d: { opportunities: ArbitrageOpportunity[] }) => {
        setOpportunities(d.opportunities);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Arbitrage Finder</h1>
        <p className="text-sm text-zinc-500">
          Cross-book opportunities with guaranteed profit margins
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {opportunities.map((arb) => (
            <Card key={arb.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{arb.matchup}</CardTitle>
                <Badge variant="elite">+{arb.profitPercent.toFixed(2)}%</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {arb.legs.map((leg) => (
                  <div
                    key={leg.selection}
                    className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                  >
                    <span>
                      {leg.sportsbook}: {leg.selection}
                    </span>
                    <span className="font-mono">
                      {formatAmericanOdds(leg.americanOdds)} (
                      {(leg.stakeWeight * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
