import { detectArbitrage } from "@/services/ev-engine";
import { mockArbitrage } from "@/services/mock/data";
import type { ArbitrageOpportunity } from "@/types";

export function findArbitrageOpportunities(): ArbitrageOpportunity[] {
  return mockArbitrage;
}

export function scanMarketsForArbitrage(
  markets: { sportsbook: string; selection: string; americanOdds: number }[][]
): ArbitrageOpportunity[] {
  const results: ArbitrageOpportunity[] = [];
  for (const legs of markets) {
    const arb = detectArbitrage(legs);
    if (arb) {
      results.push({
        id: `arb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        matchup: legs.map((l) => l.selection).join(" / "),
        profitPercent: arb.profitPercent,
        detectedAt: new Date().toISOString(),
        legs: legs.map((l, i) => ({
          sportsbook: l.sportsbook,
          selection: l.selection,
          americanOdds: l.americanOdds,
          stakeWeight: arb.stakeWeights[i] ?? 0,
        })),
      });
    }
  }
  return results;
}
