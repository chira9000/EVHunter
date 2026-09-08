import { describe, expect, it } from "vitest";
import type { KalshiBet } from "@/types/kalshi";
import { scoreParlay, type ParlayScoringLegInput } from "./parlay-scoring";

function makeBet(overrides: Partial<KalshiBet> = {}): KalshiBet {
  return {
    id: "TEST-1",
    sport: "NBA",
    betType: "player_prop",
    eventTicker: "EVT-1",
    marketTicker: "TEST-1",
    matchup: "BOS @ NYK",
    selection: "Player 20+ points",
    marketTitle: "Player: 20+ points",
    playerName: "Player",
    statType: "points",
    line: 20,
    yesAsk: 0.52,
    yesBid: 0.49,
    midPrice: 0.505,
    impliedProbability: 0.52,
    fairProbability: 0.55,
    modelProbability: 0.55,
    confidence: 0.7,
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
    ...overrides,
  };
}

function leg(overrides: Partial<ParlayScoringLegInput> = {}): ParlayScoringLegInput {
  const bet = overrides.bet ?? makeBet();
  return {
    raw: bet.selection,
    label: bet.selection,
    matched: true,
    sport: bet.sport,
    betType: bet.betType,
    statType: bet.statType,
    rawModelProbability: bet.modelProbability,
    calibratedProbability: bet.modelProbability,
    calibrationConfidence: 0,
    calibrationSampleSize: 0,
    modelConfidence: bet.confidence,
    impliedProbability: bet.yesAsk,
    americanOdds: bet.americanOdds,
    bet,
    ...overrides,
  };
}

describe("scoreParlay", () => {
  it("returns a zeroed, poor result for no legs", () => {
    const result = scoreParlay([]);
    expect(result.legCount).toBe(0);
    expect(result.qualityScore).toBe(0);
    expect(result.qualityLabel).toBe("poor");
  });

  it("uses offered decimal odds over the estimated combined odds when given", () => {
    const result = scoreParlay([leg()], { offeredDecimalOdds: 4 });
    expect(result.offeredOddsSource).toBe("user");
    expect(result.decimalOdds).toBe(4);
    expect(result.breakEvenProbability).toBeCloseTo(0.25);
  });

  it("estimates decimal odds from leg American odds when none is offered", () => {
    const result = scoreParlay([leg()]);
    expect(result.offeredOddsSource).toBe("estimated");
    expect(result.decimalOdds).toBeGreaterThan(1);
  });

  it("gives a highly correlated same-game pair a smaller correlationFactor than an independent pair", () => {
    const sameGameLegs = [
      leg({ bet: makeBet({ id: "A", eventTicker: "G1", playerName: "P1" }) }),
      leg({
        bet: makeBet({ id: "B", eventTicker: "G1", playerName: "P1", marketTicker: "T2" }),
      }),
    ];
    const independentLegs = [
      leg({ bet: makeBet({ id: "A", eventTicker: "G1", playerName: "P1" }) }),
      leg({
        bet: makeBet({
          id: "C",
          eventTicker: "G2",
          playerName: "P2",
          marketTicker: "T3",
          matchup: "MIA @ LAL",
        }),
      }),
    ];

    const correlated = scoreParlay(sameGameLegs, { offeredDecimalOdds: 3 });
    const independent = scoreParlay(independentLegs, { offeredDecimalOdds: 3 });

    expect(correlated.correlationFactor).toBeLessThan(independent.correlationFactor);
    expect(correlated.correlationRisk).not.toBe("low");
  });

  it("computes qualityScore as max(EV,0) * sqrt(parlayProbability) * correlationFactor * confidenceFactor", () => {
    const result = scoreParlay([leg(), leg({ bet: makeBet({ id: "B", marketTicker: "T2" }) })], {
      offeredDecimalOdds: 5,
    });
    const expected =
      Math.max(result.expectedValue, 0) *
      Math.sqrt(Math.max(result.parlayProbability, 0)) *
      result.correlationFactor *
      result.confidenceFactor;
    expect(result.qualityScore).toBeCloseTo(expected, 10);
  });

  it("does not simply multiply calibrated probabilities for a correlated same-game pair", () => {
    const naiveProduct = leg().calibratedProbability * leg().calibratedProbability;
    const result = scoreParlay(
      [
        leg({ bet: makeBet({ id: "A", eventTicker: "G1", playerName: "P1" }) }),
        leg({
          bet: makeBet({ id: "B", eventTicker: "G1", playerName: "P1", marketTicker: "T2" }),
        }),
      ],
      { offeredDecimalOdds: 3 }
    );
    expect(result.parlayProbability).not.toBeCloseTo(naiveProduct, 5);
  });

  it("treats unmatched-leg pairs as uncertain rather than independent", () => {
    const result = scoreParlay([
      leg({ matched: true }),
      leg({ matched: false, bet: undefined, calibrationConfidence: 0 }),
    ]);
    expect(result.pairwiseCorrelations[0]!.uncertain).toBe(true);
  });

  it("reduces confidenceFactor as more legs are added", () => {
    const twoLegs = scoreParlay([leg(), leg({ bet: makeBet({ id: "B", marketTicker: "T2" }) })]);
    const fiveLegs = scoreParlay([
      leg(),
      leg({ bet: makeBet({ id: "B", marketTicker: "T2" }) }),
      leg({ bet: makeBet({ id: "C", marketTicker: "T3" }) }),
      leg({ bet: makeBet({ id: "D", marketTicker: "T4" }) }),
      leg({ bet: makeBet({ id: "E", marketTicker: "T5" }) }),
    ]);
    expect(fiveLegs.confidenceFactor).toBeLessThan(twoLegs.confidenceFactor);
  });

  it("flags a leg as poorly calibrated when calibration shifted its probability a lot", () => {
    const result = scoreParlay([
      leg({
        rawModelProbability: 0.65,
        calibratedProbability: 0.4,
        calibrationConfidence: 0.8,
        calibrationSampleSize: 30,
      }),
    ]);
    expect(result.legs[0]!.poorlyCalibrated).toBe(true);
    expect(result.warnings.some((w) => w.includes("calibration"))).toBe(true);
  });

  it("does not flag calibration shift when the segment has no settled history", () => {
    const result = scoreParlay([
      leg({
        rawModelProbability: 0.65,
        calibratedProbability: 0.65,
        calibrationConfidence: 0,
        calibrationSampleSize: 0,
      }),
    ]);
    expect(result.legs[0]!.poorlyCalibrated).toBe(false);
  });

  it("respects overridden weights", () => {
    const legs = [leg(), leg({ bet: makeBet({ id: "B", marketTicker: "T2", eventTicker: "EVT-1" }) })];
    const strict = scoreParlay(legs, { weights: { lambdaCorrelation: 5 } });
    const lenient = scoreParlay(legs, { weights: { lambdaCorrelation: 0.01 } });
    expect(strict.correlationFactor).toBeLessThan(lenient.correlationFactor);
    expect(strict.weightsUsed.lambdaCorrelation).toBe(5);
  });
});
