import {
  parlayDecimalOdds,
  parlayModelProbability,
} from "@/lib/betting-math";
import type { KalshiBet, KalshiBetType, KalshiSportKey } from "@/types/kalshi";
import { betCorrelation } from "./portfolio-select";

/**
 * All tunable coefficients for parlay scoring live here, in one place, so a
 * future backtest against settled pick history (see pick-tracker.ts /
 * calibration.ts) can search for better values instead of the formula
 * hardcoding them. Pass a partial override into `scoreParlay` to try
 * alternate weights without touching the scoring logic itself.
 */
export interface ParlayScoringWeights {
  /** Decay rate applied to summed absolute pairwise correlation in correlationFactor. */
  lambdaCorrelation: number;
  /** Assumed |correlation| for a leg pair where at least one leg couldn't be matched to a market. */
  uncertainCorrelationDefault: number;
  /** Extra flat penalty added to the correlation sum per uncertain pair, on top of its assumed magnitude. */
  uncertainCorrelationPenalty: number;
  /** Confidence multiplier base — raised to (legCount - 1); each extra leg compounds estimation error. */
  legCountConfidenceDecay: number;
  /** Mean |pairwise correlation| thresholds for the Low/Medium/High correlation-risk label. */
  correlationRiskThresholds: { medium: number; high: number };
  /** Absolute probability shift (raw vs. calibrated) beyond which a leg is flagged "poorly calibrated". */
  poorCalibrationShiftThreshold: number;
  /** qualityScore thresholds for the Excellent/Good/Fair/Poor label. */
  qualityScoreThresholds: { good: number; fair: number };
}

export const DEFAULT_PARLAY_SCORING_WEIGHTS: ParlayScoringWeights = {
  lambdaCorrelation: 0.35,
  uncertainCorrelationDefault: 0.25,
  uncertainCorrelationPenalty: 0.15,
  legCountConfidenceDecay: 0.93,
  correlationRiskThresholds: { medium: 0.35, high: 0.6 },
  poorCalibrationShiftThreshold: 0.06,
  qualityScoreThresholds: { good: 0.05, fair: 0.015 },
};

export type CorrelationRisk = "low" | "medium" | "high";
export type QualityLabel = "excellent" | "good" | "fair" | "poor";

export interface ParlayScoringLegInput {
  raw: string;
  label: string;
  matched: boolean;
  sport?: KalshiSportKey;
  betType?: KalshiBetType;
  statType?: string;
  rawModelProbability: number;
  calibratedProbability: number;
  calibrationConfidence: number;
  calibrationSampleSize: number;
  /** Per-leg model confidence (0–1), e.g. KalshiBet.confidence. */
  modelConfidence: number;
  impliedProbability: number;
  americanOdds: number;
  /** Backing market, when matched — used only for pairwise correlation estimation. */
  bet?: KalshiBet;
}

export interface ParlayLegScore extends ParlayScoringLegInput {
  poorlyCalibrated: boolean;
}

export interface PairwiseCorrelation {
  legAIndex: number;
  legBIndex: number;
  legALabel: string;
  legBLabel: string;
  correlation: number;
  /** True when at least one leg is unmatched, so the correlation is an assumed default rather than estimated. */
  uncertain: boolean;
}

export interface ParlayScoreResult {
  legs: ParlayLegScore[];
  legCount: number;
  matchedCount: number;
  /** Calibrated joint hit probability, adjusted (not naively multiplied) for estimated correlation. */
  parlayProbability: number;
  decimalOdds: number;
  offeredOddsSource: "user" | "estimated";
  breakEvenProbability: number;
  expectedValue: number;
  avgLegConfidence: number;
  pairwiseCorrelations: PairwiseCorrelation[];
  correlationRisk: CorrelationRisk;
  correlationFactor: number;
  confidenceFactor: number;
  qualityScore: number;
  qualityLabel: QualityLabel;
  warnings: string[];
  weightsUsed: ParlayScoringWeights;
}

export interface ScoreParlayOptions {
  /** Decimal odds actually offered for the parlay. Falls back to the product of leg American odds when omitted. */
  offeredDecimalOdds?: number;
  weights?: Partial<ParlayScoringWeights>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function computePairwiseCorrelations(
  legs: ParlayScoringLegInput[],
  weights: ParlayScoringWeights
): PairwiseCorrelation[] {
  const pairs: PairwiseCorrelation[] = [];
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const a = legs[i]!;
      const b = legs[j]!;
      const uncertain = !a.bet || !b.bet;
      const correlation = uncertain
        ? weights.uncertainCorrelationDefault
        : betCorrelation(a.bet!, b.bet!);
      pairs.push({
        legAIndex: i,
        legBIndex: j,
        legALabel: a.label,
        legBLabel: b.label,
        correlation,
        uncertain,
      });
    }
  }
  return pairs;
}

function correlationRiskFromPairs(
  pairs: PairwiseCorrelation[],
  weights: ParlayScoringWeights
): CorrelationRisk {
  if (pairs.length === 0) return "low";
  const avgAbs =
    pairs.reduce((sum, p) => sum + Math.abs(p.correlation), 0) / pairs.length;
  if (avgAbs >= weights.correlationRiskThresholds.high) return "high";
  if (avgAbs >= weights.correlationRiskThresholds.medium) return "medium";
  return "low";
}

function qualityLabelFor(
  score: number,
  weights: ParlayScoringWeights
): QualityLabel {
  if (score >= weights.qualityScoreThresholds.good) return "excellent";
  if (score >= weights.qualityScoreThresholds.fair) return "good";
  if (score > 0) return "fair";
  return "poor";
}

function buildWarnings(
  legs: ParlayLegScore[],
  pairs: PairwiseCorrelation[],
  expectedValue: number,
  weights: ParlayScoringWeights
): string[] {
  const warnings: string[] = [];

  const unmatched = legs.filter((l) => !l.matched);
  if (unmatched.length > 0) {
    warnings.push(
      `${unmatched.length} leg${unmatched.length > 1 ? "s" : ""} could not be matched to a live market (${unmatched.map((l) => l.label).join(", ")}) — probability and correlation for ${unmatched.length > 1 ? "them are" : "it is"} estimated, not modeled.`
    );
  }

  const highCorrPairs = pairs.filter(
    (p) => !p.uncertain && p.correlation >= weights.correlationRiskThresholds.high
  );
  for (const p of highCorrPairs) {
    warnings.push(
      `${p.legALabel} and ${p.legBLabel} are highly correlated (same game/player) — their joint hit probability is less than the product of the two would suggest.`
    );
  }

  const uncertainPairs = pairs.filter((p) => p.uncertain);
  if (uncertainPairs.length > 0 && highCorrPairs.length === 0) {
    warnings.push(
      "Correlation between one or more legs is unknown (unmatched to a market) and was estimated conservatively rather than assumed independent."
    );
  }

  const poorlyCalibrated = legs.filter((l) => l.poorlyCalibrated);
  for (const l of poorlyCalibrated) {
    const segment = l.statType ?? (l.sport ? `${l.sport} ${l.betType ?? ""}`.trim() : l.label);
    warnings.push(
      `${segment} probability estimates have shifted meaningfully after calibration against settled history (n=${l.calibrationSampleSize}) — treat "${l.label}" with extra caution.`
    );
  }

  if (legs.length >= 5) {
    warnings.push(
      "Five or more legs compound small probability errors quickly — long-shot territory."
    );
  }

  if (expectedValue <= 0) {
    warnings.push(
      "Calibrated model probability does not clear the break-even probability at the offered price."
    );
  }

  return warnings;
}

/**
 * Score a parlay from calibrated leg probabilities, an offered (or estimated)
 * payout, and estimated pairwise correlation. Pure function — no I/O — so it
 * can run identically inside the API route and inside a backtest harness.
 */
export function scoreParlay(
  legInputs: ParlayScoringLegInput[],
  options: ScoreParlayOptions = {}
): ParlayScoreResult {
  const weights: ParlayScoringWeights = {
    ...DEFAULT_PARLAY_SCORING_WEIGHTS,
    ...options.weights,
    correlationRiskThresholds: {
      ...DEFAULT_PARLAY_SCORING_WEIGHTS.correlationRiskThresholds,
      ...options.weights?.correlationRiskThresholds,
    },
    qualityScoreThresholds: {
      ...DEFAULT_PARLAY_SCORING_WEIGHTS.qualityScoreThresholds,
      ...options.weights?.qualityScoreThresholds,
    },
  };

  if (legInputs.length === 0) {
    return {
      legs: [],
      legCount: 0,
      matchedCount: 0,
      parlayProbability: 0,
      decimalOdds: 1,
      offeredOddsSource: "estimated",
      breakEvenProbability: 0,
      expectedValue: 0,
      avgLegConfidence: 0,
      pairwiseCorrelations: [],
      correlationRisk: "low",
      correlationFactor: 1,
      confidenceFactor: 0,
      qualityScore: 0,
      qualityLabel: "poor",
      warnings: [],
      weightsUsed: weights,
    };
  }

  const legs: ParlayLegScore[] = legInputs.map((leg) => ({
    ...leg,
    poorlyCalibrated:
      leg.matched &&
      leg.calibrationSampleSize > 0 &&
      Math.abs(leg.calibratedProbability - leg.rawModelProbability) >=
        weights.poorCalibrationShiftThreshold,
  }));

  const matchedCount = legs.filter((l) => l.matched).length;

  const pairwiseCorrelations = computePairwiseCorrelations(legs, weights);
  const avgCorrelation =
    pairwiseCorrelations.length > 0
      ? pairwiseCorrelations.reduce((s, p) => s + p.correlation, 0) /
        pairwiseCorrelations.length
      : 0;

  const calibratedProbs = legs.map((l) => l.calibratedProbability);
  // Independence-adjusted, not a naive product: parlayModelProbability applies a
  // correlation uplift so tightly linked same-game legs aren't underpriced.
  const parlayProbability = parlayModelProbability(
    calibratedProbs,
    avgCorrelation
  );

  const decimalOdds =
    options.offeredDecimalOdds ??
    parlayDecimalOdds(legs.map((l) => l.americanOdds));
  const offeredOddsSource: "user" | "estimated" =
    options.offeredDecimalOdds != null ? "user" : "estimated";

  const breakEvenProbability = decimalOdds > 0 ? 1 / decimalOdds : 0;
  const expectedValue = parlayProbability * decimalOdds - 1;

  const correlationPenaltyInput = pairwiseCorrelations.reduce(
    (sum, p) =>
      sum +
      Math.abs(p.correlation) +
      (p.uncertain ? weights.uncertainCorrelationPenalty : 0),
    0
  );
  const correlationFactor = Math.exp(
    -weights.lambdaCorrelation * correlationPenaltyInput
  );
  const correlationRisk = correlationRiskFromPairs(
    pairwiseCorrelations,
    weights
  );

  const avgLegConfidence =
    legs.reduce((s, l) => s + l.modelConfidence, 0) / legs.length;
  const avgCalibrationConfidence =
    legs.reduce((s, l) => s + l.calibrationConfidence, 0) / legs.length;
  const legCountDecay = Math.pow(
    weights.legCountConfidenceDecay,
    Math.max(0, legs.length - 1)
  );
  // Calibration confidence softly modulates rather than zeroing out reliability
  // when a segment simply lacks settled history yet.
  const confidenceFactor = clamp01(
    avgLegConfidence * (0.4 + 0.6 * avgCalibrationConfidence) * legCountDecay
  );

  const qualityScore =
    Math.max(expectedValue, 0) *
    Math.sqrt(Math.max(parlayProbability, 0)) *
    correlationFactor *
    confidenceFactor;

  const warnings = buildWarnings(
    legs,
    pairwiseCorrelations,
    expectedValue,
    weights
  );

  return {
    legs,
    legCount: legs.length,
    matchedCount,
    parlayProbability,
    decimalOdds,
    offeredOddsSource,
    breakEvenProbability,
    expectedValue,
    avgLegConfidence,
    pairwiseCorrelations,
    correlationRisk,
    correlationFactor,
    confidenceFactor,
    qualityScore,
    qualityLabel: qualityLabelFor(qualityScore, weights),
    warnings,
    weightsUsed: weights,
  };
}
