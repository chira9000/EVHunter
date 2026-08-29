import { describe, expect, it } from "vitest";
import type { KalshiBet } from "@/types/kalshi";
import {
  betCorrelation,
  computeInjuryUncertainty,
  computeVolatility,
  deduplicateEquivalentMarkets,
  diversifyPortfolio,
  equivalenceKey,
  filterBadBets,
  rankByQualityScore,
  selectKalshiPortfolio,
} from "./portfolio-select";

function makeBet(overrides: Partial<KalshiBet> = {}): KalshiBet {
  return {
    id: "TEST-1",
    sport: "NBA",
    betType: "player_prop",
    eventTicker: "EVT-1",
    marketTicker: "TEST-1",
    matchup: "A @ B",
    selection: "Player 20+ points",
    marketTitle: "Player: 20+ points",
    playerName: "Test Player",
    statType: "points",
    line: 20,
    yesAsk: 0.45,
    yesBid: 0.42,
    midPrice: 0.435,
    impliedProbability: 0.45,
    fairProbability: 0.5,
    modelProbability: 0.52,
    confidence: 0.75,
    hitRate: 0.55,
    edgePercent: 5,
    americanOdds: 122,
    fairAmericanOdds: 100,
    spreadPercent: 3,
    volume24h: 500,
    gameDate: "2026-06-05",
    expiresAt: "2026-06-06T00:00:00Z",
    kalshiUrl: "https://kalshi.com/markets/test-1",
    statsSource: "espn",
    volatility: 0.3,
    injuryUncertainty: 0.2,
    ...overrides,
  };
}

describe("equivalenceKey", () => {
  it("groups same pick regardless of ask or market ticker", () => {
    const a = makeBet({ line: 20, marketTicker: "T1", yesAsk: 0.38, id: "A" });
    const b = makeBet({
      line: 20,
      marketTicker: "T2",
      yesAsk: 0.44,
      id: "B",
      edgePercent: 8,
    });
    expect(equivalenceKey(a)).toBe(equivalenceKey(b));
  });

  it("keeps different lines as separate picks", () => {
    const a = makeBet({ line: 20, marketTicker: "T1" });
    const b = makeBet({ line: 25, marketTicker: "T2" });
    expect(equivalenceKey(a)).not.toBe(equivalenceKey(b));
  });

  it("groups same game pick across different event tickers", () => {
    const a = makeBet({
      eventTicker: "KXNBAPTS-25JUN05BOSNYK",
      line: 28,
      yesAsk: 0.4,
    });
    const b = makeBet({
      eventTicker: "KXNBAGAME-25JUN05BOSNYK",
      marketTicker: "OTHER",
      line: 28,
      yesAsk: 0.42,
    });
    expect(equivalenceKey(a)).toBe(equivalenceKey(b));
  });
});

describe("deduplicateEquivalentMarkets", () => {
  it("keeps only the highest quality bet per equivalence group", () => {
    const ranked = rankByQualityScore([
      makeBet({
        id: "low",
        line: 20,
        yesAsk: 0.4,
        modelProbability: 0.48,
        edgePercent: 3,
      }),
      makeBet({
        id: "high",
        line: 20,
        marketTicker: "T2",
        yesAsk: 0.36,
        modelProbability: 0.55,
        edgePercent: 8,
      }),
    ]);
    const { bets, removed } = deduplicateEquivalentMarkets(ranked);
    expect(bets).toHaveLength(1);
    expect(bets[0]!.id).toBe("high");
    expect(removed).toBe(1);
  });

  it("keeps different lines for the same player", () => {
    const ranked = rankByQualityScore([
      makeBet({ id: "line-18", line: 18 }),
      makeBet({ id: "line-20", line: 20, marketTicker: "T2" }),
    ]);
    const { bets } = deduplicateEquivalentMarkets(ranked);
    expect(bets).toHaveLength(2);
  });
});

describe("betCorrelation", () => {
  it("is high for same game", () => {
    const a = makeBet({ eventTicker: "G1" });
    const b = makeBet({
      eventTicker: "G1",
      playerName: "Other",
      marketTicker: "T2",
    });
    expect(betCorrelation(a, b)).toBeGreaterThan(0.7);
  });

  it("is low for unrelated games", () => {
    const a = makeBet({ id: "A", sport: "NBA", gameDate: "2026-01-01", matchup: "A @ B" });
    const b = makeBet({
      id: "B",
      sport: "NFL",
      gameDate: "2026-01-02",
      matchup: "C @ D",
      eventTicker: "G2",
      marketTicker: "T2",
    });
    expect(betCorrelation(a, b)).toBeLessThan(0.2);
  });
});

describe("filterBadBets", () => {
  it("rejects low model probability", () => {
    const { survivors, rejected } = filterBadBets([
      makeBet({ modelProbability: 0.45 }),
      makeBet({ modelProbability: 0.52 }),
    ]);
    expect(survivors).toHaveLength(1);
    expect(rejected).toBe(1);
  });

  it("rejects low EV", () => {
    const { survivors } = filterBadBets([makeBet({ edgePercent: 2.9 })]);
    expect(survivors).toHaveLength(0);
  });

  it("rejects pitcher strikeout props with low expected innings", () => {
    const { survivors } = filterBadBets([
      makeBet({
        sport: "MLB",
        statType: "strikeouts",
        expectedInnings: 4.2,
        modelProbability: 0.5,
        edgePercent: 5,
      }),
    ]);
    expect(survivors).toHaveLength(0);
  });

  it("rejects high injury uncertainty", () => {
    const { survivors } = filterBadBets([
      makeBet({ injuryUncertainty: 0.8 }),
    ]);
    expect(survivors).toHaveLength(0);
  });
});

describe("rankByQualityScore", () => {
  it("ranks higher quality bets first", () => {
    const ranked = rankByQualityScore([
      makeBet({ id: "low", modelProbability: 0.4, edgePercent: 3, confidence: 0.5, volatility: 0.8 }),
      makeBet({ id: "high", modelProbability: 0.6, edgePercent: 10, confidence: 0.9, volatility: 0.2 }),
    ]);
    expect(ranked[0]!.id).toBe("high");
    expect(ranked[0]!.qualityScore).toBeGreaterThan(ranked[1]!.qualityScore);
  });
});

describe("diversifyPortfolio", () => {
  it("allows max one prop per player", () => {
    const ranked = rankByQualityScore([
      makeBet({ id: "a", playerName: "Same Player" }),
      makeBet({
        id: "b",
        playerName: "Same Player",
        marketTicker: "TEST-2",
        statType: "rebounds",
      }),
    ]);
    const selected = diversifyPortfolio(ranked);
    expect(selected).toHaveLength(1);
  });

  it("allows max two bets per game", () => {
    const ranked = rankByQualityScore([
      makeBet({ id: "a", eventTicker: "G1", playerName: "P1" }),
      makeBet({ id: "b", eventTicker: "G1", playerName: "P2", marketTicker: "T2" }),
      makeBet({ id: "c", eventTicker: "G1", playerName: "P3", marketTicker: "T3" }),
    ]);
    const selected = diversifyPortfolio(ranked);
    expect(selected.length).toBeLessThanOrEqual(2);
  });

  it("orders final output by quality score descending", () => {
    const ranked = rankByQualityScore([
      makeBet({ id: "a", eventTicker: "G1", playerName: "P1", modelProbability: 0.5, edgePercent: 4 }),
      makeBet({ id: "b", eventTicker: "G2", playerName: "P2", marketTicker: "T2", modelProbability: 0.6, edgePercent: 9 }),
      makeBet({ id: "c", eventTicker: "G3", playerName: "P3", marketTicker: "T3", modelProbability: 0.55, edgePercent: 6 }),
    ]);
    const selected = diversifyPortfolio(ranked);
    for (let i = 1; i < selected.length; i++) {
      expect(selected[i - 1]!.qualityScore).toBeGreaterThanOrEqual(
        selected[i]!.qualityScore
      );
    }
  });

  it("prefers uncorrelated bet over correlated lower-quality peer", () => {
    const ranked = rankByQualityScore([
      makeBet({
        id: "same-game",
        eventTicker: "G1",
        playerName: "Star",
        modelProbability: 0.58,
        edgePercent: 9,
      }),
      makeBet({
        id: "other-game",
        eventTicker: "G2",
        playerName: "Other",
        marketTicker: "T2",
        modelProbability: 0.52,
        edgePercent: 6,
        matchup: "C @ D",
      }),
      makeBet({
        id: "same-game-2",
        eventTicker: "G1",
        playerName: "Teammate",
        marketTicker: "T3",
        statType: "assists",
        modelProbability: 0.56,
        edgePercent: 8,
      }),
    ]);
    const selected = diversifyPortfolio(ranked);
    const ids = selected.map((b) => b.id);
    expect(ids).toContain("same-game");
    expect(ids).toContain("other-game");
    if (ids.length >= 2) {
      expect(ids.filter((id) => id.startsWith("same-game")).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("selectKalshiPortfolio", () => {
  it("runs full pipeline", () => {
    const result = selectKalshiPortfolio([
      makeBet({ id: "good" }),
      makeBet({ id: "bad", modelProbability: 0.2 }),
      makeBet({
        id: "dup",
        line: 20,
        marketTicker: "DUP",
        yesAsk: 0.41,
        modelProbability: 0.51,
        edgePercent: 3.5,
      }),
    ]);
    expect(result.bets.length).toBeGreaterThanOrEqual(1);
    expect(result.filteredCount).toBe(1);
    expect(result.dedupedCount).toBeGreaterThanOrEqual(1);
    expect(result.bets[0]!.rank).toBe(1);
    expect(result.bets[0]!.id).toBe("good");
  });
});

describe("computeVolatility", () => {
  it("returns higher volatility for scattered values", () => {
    const stable = computeVolatility([10, 11, 10, 11, 10]);
    const volatile = computeVolatility([2, 18, 5, 20, 8]);
    expect(volatile).toBeGreaterThan(stable);
  });
});

describe("computeInjuryUncertainty", () => {
  it("increases with fewer games sampled", () => {
    expect(computeInjuryUncertainty(3, 0.8)).toBeGreaterThan(
      computeInjuryUncertainty(12, 0.8)
    );
  });
});
