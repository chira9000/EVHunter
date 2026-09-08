import { describe, expect, it } from "vitest";
import type { RecommendedPick } from "@/types/kalshi";
import { buildCalibrationModel, calibrateProbability } from "./calibration";

function pick(overrides: Partial<RecommendedPick> = {}): RecommendedPick {
  return {
    marketTicker: `T-${Math.random()}`,
    sport: "MLB",
    betType: "player_prop",
    selection: "Pitcher 5+ strikeouts",
    matchup: "NYY @ BOS",
    marketTitle: "Pitcher: 5+ strikeouts",
    statType: "strikeouts",
    modelProbability: 0.65,
    edgePercent: 6,
    yesAsk: 0.5,
    gameDate: "2026-06-10",
    expiresAt: "2026-06-10T20:00:00.000Z",
    recommendedAt: "2026-06-09T00:00:00.000Z",
    status: "lost",
    settledAt: "2026-06-10T21:00:00.000Z",
    result: "no",
    ...overrides,
  };
}

describe("buildCalibrationModel", () => {
  it("ignores pending/void picks and aggregates settled ones by segment", () => {
    const model = buildCalibrationModel([
      pick({ status: "lost" }),
      pick({ status: "won" }),
      pick({ status: "pending" }),
    ]);
    const bucket = model.buckets["statType:strikeouts"];
    expect(bucket).toBeDefined();
    expect(bucket!.n).toBe(2);
    expect(bucket!.actualWins).toBe(1);
  });
});

describe("calibrateProbability", () => {
  it("returns the raw probability untouched when no model is given", () => {
    const result = calibrateProbability(
      { sport: "MLB", betType: "player_prop", statType: "strikeouts", edgePercent: 6, modelProbability: 0.65 },
      0.65,
      null
    );
    expect(result.calibratedProbability).toBe(0.65);
    expect(result.calibrationConfidence).toBe(0);
  });

  it("shrinks the raw probability toward a consistently worse empirical hit rate", () => {
    // 20 settled picks in this segment, model predicted ~0.65 on average, but only 30% actually hit.
    const picks: RecommendedPick[] = Array.from({ length: 20 }, (_, i) =>
      pick({ modelProbability: 0.65, status: i < 6 ? "won" : "lost" })
    );
    const model = buildCalibrationModel(picks);

    const result = calibrateProbability(
      { sport: "MLB", betType: "player_prop", statType: "strikeouts", edgePercent: 6, modelProbability: 0.65 },
      0.65,
      model
    );

    expect(result.calibratedProbability).toBeLessThan(0.65);
    expect(result.calibrationConfidence).toBeGreaterThan(0);
    expect(result.sampleSize).toBeGreaterThanOrEqual(20);
  });

  it("leaves probability untouched when a segment has too few samples", () => {
    const model = buildCalibrationModel([pick({ status: "lost" }), pick({ status: "lost" })]);
    const result = calibrateProbability(
      { sport: "MLB", betType: "player_prop", statType: "strikeouts", edgePercent: 6, modelProbability: 0.65 },
      0.65,
      model
    );
    expect(result.calibratedProbability).toBe(0.65);
    expect(result.calibrationConfidence).toBe(0);
  });
});
