import { describe, expect, it } from "vitest";
import type { KalshiBet } from "@/types/kalshi";
import {
  applySettlementResult,
  betToRecommendedPick,
  computePickHitRateStats,
  isReadyToSettle,
  mergeRecommendedPicks,
} from "./pick-tracker";

function sampleBet(overrides: Partial<KalshiBet> = {}): KalshiBet {
  return {
    id: "KXNBAPTS-1",
    sport: "NBA",
    betType: "player_prop",
    eventTicker: "KXNBAPTS-EVENT",
    marketTicker: "KXNBAPTS-1",
    matchup: "BOS @ NYK",
    selection: "Jayson Tatum 28+ points",
    marketTitle: "Jayson Tatum: 28+ points",
    playerName: "Jayson Tatum",
    statType: "points",
    line: 28,
    yesAsk: 0.4,
    yesBid: 0.36,
    midPrice: 0.38,
    impliedProbability: 0.4,
    fairProbability: 0.52,
    modelProbability: 0.52,
    confidence: 0.7,
    hitRate: 0.6,
    edgePercent: 8,
    americanOdds: 150,
    fairAmericanOdds: 92,
    spreadPercent: 4,
    volume24h: 100,
    gameDate: "2026-01-15",
    expiresAt: "2026-01-16T04:00:00.000Z",
    kalshiUrl: "https://kalshi.com/markets/kxnbapts-1",
    statsSource: "espn",
    ...overrides,
  };
}

describe("pick-tracker", () => {
  it("merges new portfolio picks without duplicating tickers", () => {
    const first = mergeRecommendedPicks([], [sampleBet()]);
    expect(first).toHaveLength(1);
    expect(first[0]!.status).toBe("pending");

    const again = mergeRecommendedPicks(first, [
      sampleBet({ edgePercent: 9.5, modelProbability: 0.55 }),
    ]);
    expect(again).toHaveLength(1);
    expect(again[0]!.edgePercent).toBe(9.5);
    expect(again[0]!.modelProbability).toBe(0.55);
  });

  it("does not overwrite settled picks on re-recommend", () => {
    const won = applySettlementResult(betToRecommendedPick(sampleBet()), "yes");
    const merged = mergeRecommendedPicks([won], [
      sampleBet({ edgePercent: 99 }),
    ]);
    expect(merged[0]!.status).toBe("won");
    expect(merged[0]!.edgePercent).toBe(won.edgePercent);
  });

  it("settles yes/no results correctly", () => {
    const pick = betToRecommendedPick(sampleBet());
    expect(applySettlementResult(pick, "yes").status).toBe("won");
    expect(applySettlementResult(pick, "no").status).toBe("lost");
    expect(applySettlementResult(pick, "").status).toBe("pending");
  });

  it("only settles after expiry grace period", () => {
    const pick = betToRecommendedPick(sampleBet());
    const exp = new Date(pick.expiresAt).getTime();
    expect(isReadyToSettle(pick, exp)).toBe(false);
    expect(isReadyToSettle(pick, exp + 90 * 60 * 1000)).toBe(true);
  });

  it("computes hit rate across sports including NBA points", () => {
    const picks = [
      applySettlementResult(betToRecommendedPick(sampleBet()), "yes"),
      applySettlementResult(
        betToRecommendedPick(
          sampleBet({
            marketTicker: "KXNBAPTS-2",
            id: "KXNBAPTS-2",
          })
        ),
        "no"
      ),
      applySettlementResult(
        betToRecommendedPick(
          sampleBet({
            id: "KXMLBHIT-1",
            marketTicker: "KXMLBHIT-1",
            sport: "MLB",
            betType: "player_prop",
            selection: "Judge 1+ hits",
            statType: "hits",
          })
        ),
        "yes"
      ),
      betToRecommendedPick(
        sampleBet({
          id: "PENDING-1",
          marketTicker: "PENDING-1",
        })
      ),
    ];

    const stats = computePickHitRateStats(picks);
    expect(stats.settled).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
    expect(stats.bySport.NBA?.wins).toBe(1);
    expect(stats.bySport.NBA?.settled).toBe(2);
    expect(stats.bySport.MLB?.hitRate).toBe(1);
  });
});
