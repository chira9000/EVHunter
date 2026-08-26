/**
 * Core sports betting mathematics utilities.
 * All functions are pure and unit-tested.
 */

export function americanToDecimal(american: number): number {
  if (american === 0) throw new Error("American odds cannot be zero");
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) throw new Error("Decimal odds must be greater than 1");
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

export function americanToImpliedProbability(american: number): number {
  const decimal = americanToDecimal(american);
  return 1 / decimal;
}

export function impliedProbabilityToAmerican(probability: number): number {
  if (probability <= 0 || probability >= 1) {
    throw new Error("Probability must be between 0 and 1 exclusive");
  }
  const decimal = 1 / probability;
  return decimalToAmerican(decimal);
}

/** Remove vig from two-way market using multiplicative method */
export function noVigFairProbabilities(
  probA: number,
  probB: number
): { fairA: number; fairB: number; overround: number } {
  const total = probA + probB;
  if (total <= 0) throw new Error("Invalid probabilities");
  return {
    fairA: probA / total,
    fairB: probB / total,
    overround: total - 1,
  };
}

/** Remove vig from N-way market (e.g. soccer 1X2) using multiplicative method */
export function noVigFairProbabilitiesMulti(probs: number[]): number[] {
  const total = probs.reduce((sum, p) => sum + p, 0);
  if (total <= 0) throw new Error("Invalid probabilities");
  return probs.map((p) => p / total);
}

export function noVigFairOdds(americanA: number, americanB: number): {
  fairAmericanA: number;
  fairAmericanB: number;
} {
  const { fairA, fairB } = noVigFairProbabilities(
    americanToImpliedProbability(americanA),
    americanToImpliedProbability(americanB)
  );
  return {
    fairAmericanA: impliedProbabilityToAmerican(fairA),
    fairAmericanB: impliedProbabilityToAmerican(fairB),
  };
}

/** EV% = (trueProb * decimalPayout) - 1, expressed as percentage */
export function expectedValuePercent(
  trueProbability: number,
  americanOdds: number
): number {
  const decimal = americanToDecimal(americanOdds);
  const ev = trueProbability * decimal - 1;
  return ev * 100;
}

/** Kelly fraction for positive EV bets (fraction of bankroll) */
export function kellyCriterion(
  trueProbability: number,
  americanOdds: number,
  fraction = 1
): number {
  const decimal = americanToDecimal(americanOdds);
  const b = decimal - 1;
  const p = trueProbability;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  return Math.max(0, kelly * fraction);
}

/** CLV = closing implied prob - bet implied prob (positive = beat close) */
export function closingLineValue(
  betImpliedProb: number,
  closingImpliedProb: number
): number {
  return closingImpliedProb - betImpliedProb;
}

/** Arbitrage profit % for N legs with implied probs summing < 1 */
export function arbitrageProfitPercent(impliedProbs: number[]): number {
  const total = impliedProbs.reduce((a, b) => a + b, 0);
  if (total >= 1) return 0;
  return ((1 / total) - 1) * 100;
}

/** Optimal stake weights for arbitrage */
export function arbitrageStakes(
  bankroll: number,
  legs: { americanOdds: number }[]
): number[] {
  const decimals = legs.map((l) => americanToDecimal(l.americanOdds));
  const inverseSum = decimals.reduce((sum, d) => sum + 1 / d, 0);
  return decimals.map((d) => (bankroll / d) / inverseSum);
}

export type EvTier = "elite" | "strong" | "moderate" | "marginal" | "negative";

export function evTier(evPercent: number): EvTier {
  if (evPercent >= 8) return "elite";
  if (evPercent >= 5) return "strong";
  if (evPercent >= 2) return "moderate";
  if (evPercent > 0) return "marginal";
  return "negative";
}

export function formatEvPercent(ev: number): string {
  const sign = ev >= 0 ? "+" : "";
  return `${sign}${ev.toFixed(2)}%`;
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/** Combined decimal payout for a parlay (independent pricing). */
export function parlayDecimalOdds(americanOdds: number[]): number {
  if (americanOdds.length === 0) return 1;
  return americanOdds.reduce((acc, odds) => acc * americanToDecimal(odds), 1);
}

/** Product of leg implied probabilities (book treats legs as independent). */
export function parlayImpliedProbability(impliedProbs: number[]): number {
  if (impliedProbs.length === 0) return 0;
  return impliedProbs.reduce((acc, p) => acc * p, 1);
}

/** Product of model probabilities with a correlation uplift on joint hit rate. */
export function parlayModelProbability(
  modelProbs: number[],
  avgCorrelation: number
): number {
  if (modelProbs.length === 0) return 0;
  const independent = modelProbs.reduce((acc, p) => acc * p, 1);
  const correlationBoost = 1 + Math.max(0, avgCorrelation) * 0.4;
  return Math.min(0.98, independent * correlationBoost);
}

/** Parlay EV% from model joint probability and combined American odds. */
export function parlayExpectedValuePercent(
  jointModelProbability: number,
  americanOdds: number[]
): number {
  const decimal = parlayDecimalOdds(americanOdds);
  return (jointModelProbability * decimal - 1) * 100;
}
