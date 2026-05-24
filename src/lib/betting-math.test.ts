import { describe, it, expect } from "vitest";
import {
  americanToDecimal,
  americanToImpliedProbability,
  decimalToAmerican,
  impliedProbabilityToAmerican,
  noVigFairProbabilities,
  noVigFairOdds,
  expectedValuePercent,
  kellyCriterion,
  closingLineValue,
  arbitrageProfitPercent,
  arbitrageStakes,
  evTier,
} from "./betting-math";

describe("american odds conversion", () => {
  it("converts positive american to decimal", () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5);
  });

  it("converts negative american to decimal", () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 2);
  });

  it("round-trips through decimal", () => {
    expect(decimalToAmerican(americanToDecimal(-115))).toBe(-115);
    expect(decimalToAmerican(americanToDecimal(200))).toBe(200);
  });
});

describe("implied probability", () => {
  it("calculates from american odds", () => {
    expect(americanToImpliedProbability(-110)).toBeCloseTo(0.524, 2);
    expect(americanToImpliedProbability(100)).toBeCloseTo(0.5, 2);
  });

  it("converts probability back to american", () => {
    const p = 0.55;
    expect(impliedProbabilityToAmerican(p)).toBeCloseTo(-122, 0);
  });
});

describe("no-vig fair odds", () => {
  it("normalizes two-way market", () => {
    const { fairA, fairB, overround } = noVigFairProbabilities(0.55, 0.55);
    expect(fairA + fairB).toBeCloseTo(1);
    expect(overround).toBeCloseTo(0.1, 1);
  });

  it("returns fair american odds", () => {
    const fair = noVigFairOdds(-110, -110);
    expect(fair.fairAmericanA).toBe(fair.fairAmericanB);
    expect(fair.fairAmericanA).not.toBe(-110);
  });
});

describe("expected value", () => {
  it("positive EV when true prob exceeds implied", () => {
    const ev = expectedValuePercent(0.55, -110);
    expect(ev).toBeGreaterThan(0);
  });

  it("negative EV when overpriced", () => {
    const ev = expectedValuePercent(0.45, -110);
    expect(ev).toBeLessThan(0);
  });
});

describe("kelly criterion", () => {
  it("returns zero for negative edge", () => {
    expect(kellyCriterion(0.4, -110)).toBe(0);
  });

  it("positive fraction for +EV", () => {
    expect(kellyCriterion(0.55, 110)).toBeGreaterThan(0);
  });
});

describe("CLV", () => {
  it("positive when closing line is sharper", () => {
    expect(closingLineValue(0.5, 0.52)).toBeCloseTo(0.02);
  });
});

describe("arbitrage", () => {
  it("detects profit when sum of implied < 1", () => {
    const profit = arbitrageProfitPercent([
      americanToImpliedProbability(150),
      americanToImpliedProbability(-130),
    ]);
    expect(profit).toBeGreaterThan(0);
  });

  it("allocates stakes across legs", () => {
    const stakes = arbitrageStakes(1000, [
      { americanOdds: 150 },
      { americanOdds: -130 },
    ]);
    expect(stakes.reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 0);
  });
});

describe("evTier", () => {
  it("classifies tiers", () => {
    expect(evTier(10)).toBe("elite");
    expect(evTier(6)).toBe("strong");
    expect(evTier(3)).toBe("moderate");
    expect(evTier(1)).toBe("marginal");
    expect(evTier(-1)).toBe("negative");
  });
});
