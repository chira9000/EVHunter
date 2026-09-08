import { describe, expect, it } from "vitest";
import type { KalshiBet } from "@/types/kalshi";
import {
  analyzeParlay,
  matchLegToBet,
  splitParlayInput,
} from "./parlay-analysis";

function makeBet(overrides: Partial<KalshiBet> = {}): KalshiBet {
  return {
    id: "TEST-1",
    sport: "NBA",
    betType: "player_prop",
    eventTicker: "EVT-1",
    marketTicker: "TEST-1",
    matchup: "BOS @ NYK",
    selection: "Jayson Tatum 28+ points",
    marketTitle: "Jayson Tatum: 28+ points",
    playerName: "Jayson Tatum",
    statType: "points",
    line: 28,
    yesAsk: 0.42,
    yesBid: 0.38,
    midPrice: 0.4,
    impliedProbability: 0.42,
    fairProbability: 0.5,
    modelProbability: 0.54,
    confidence: 0.78,
    hitRate: 0.6,
    edgePercent: 6.2,
    americanOdds: 138,
    fairAmericanOdds: 100,
    spreadPercent: 4,
    volume24h: 500,
    gameDate: "2026-06-05",
    expiresAt: "2026-06-06T00:00:00Z",
    kalshiUrl: "https://kalshi.com/markets/test-1",
    statsSource: "espn",
    ...overrides,
  };
}

describe("splitParlayInput", () => {
  it("splits on commas, slashes, and newlines", () => {
    expect(
      splitParlayInput("Tatum 28+ points, Bucks ML\nJudge 1+ hits")
    ).toEqual(["Tatum 28+ points", "Bucks ML", "Judge 1+ hits"]);
  });
});

describe("matchLegToBet", () => {
  const catalog = [
    makeBet(),
    makeBet({
      id: "ML-1",
      betType: "moneyline",
      selection: "Milwaukee Bucks",
      marketTitle: "Milwaukee Bucks Winner?",
      playerName: undefined,
      statType: undefined,
      line: undefined,
      yesAsk: 0.55,
      americanOdds: -122,
    }),
  ];

  it("matches props by informal text", () => {
    const bet = matchLegToBet("Jayson Tatum 28+ points", catalog);
    expect(bet?.id).toBe("TEST-1");
  });

  it("matches moneylines by team name", () => {
    const bet = matchLegToBet("Milwaukee Bucks", catalog);
    expect(bet?.id).toBe("ML-1");
  });
});

describe("analyzeParlay", () => {
  it("returns analysis and rating for a multi-leg slip", () => {
    const catalog = [
      makeBet(),
      makeBet({
        id: "MLB-1",
        sport: "MLB",
        matchup: "NYY @ BOS",
        selection: "Aaron Judge 1+ hits",
        marketTitle: "Aaron Judge: 1+ hits",
        playerName: "Aaron Judge",
        statType: "hits",
        line: 1,
        modelProbability: 0.7,
        edgePercent: 4.5,
        americanOdds: -150,
        yesAsk: 0.6,
      }),
    ];

    const result = analyzeParlay(
      "Jayson Tatum 28+ points, Aaron Judge 1+ hits",
      catalog
    );

    expect(result.legCount).toBe(2);
    expect(result.matchedCount).toBe(2);
    expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    expect(["excellent", "good", "fair", "poor"]).toContain(result.qualityLabel);
    expect(result.analysis.length).toBeGreaterThan(50);
    expect(result.impliedProbability).toBeGreaterThan(0);
    expect(result.parlayProbability).toBeGreaterThan(0);
    expect(result.breakEvenProbability).toBeGreaterThan(0);
    expect(result.legs[0]!.calibratedProbability).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(result.correlationRisk);
  });

  it("handles empty input", () => {
    const result = analyzeParlay("   ");
    expect(result.legCount).toBe(0);
    expect(result.qualityScore).toBe(0);
    expect(result.qualityLabel).toBe("poor");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("uses offered odds when provided instead of estimating from leg prices", () => {
    const catalog = [makeBet()];
    const result = analyzeParlay("Jayson Tatum 28+ points", catalog, {
      offeredDecimalOdds: 3,
    });
    expect(result.offeredOddsSource).toBe("user");
    expect(result.decimalOdds).toBe(3);
    expect(result.breakEvenProbability).toBeCloseTo(1 / 3);
  });

  it("does not naively multiply probabilities for a same-game correlated pair", () => {
    const sameGame = [
      makeBet({ id: "A", eventTicker: "G1", playerName: "Star A", modelProbability: 0.6 }),
      makeBet({
        id: "B",
        eventTicker: "G1",
        playerName: "Star B",
        marketTicker: "T2",
        modelProbability: 0.6,
      }),
    ];
    const result = analyzeParlay(
      "Jayson Tatum 28+ points, Star B 28+ points",
      sameGame
    );
    const naiveProduct = 0.6 * 0.6;
    // Correlation-adjusted joint probability should exceed the naive independent product.
    expect(result.parlayProbability).toBeGreaterThan(naiveProduct);
    expect(result.correlationRisk).not.toBe("low");
  });
});
