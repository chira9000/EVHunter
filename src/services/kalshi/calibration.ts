import type { RecommendedPick } from "@/types/kalshi";
import { segmentsFor, type SegmentableBet } from "./portfolio-select";

/**
 * Empirical calibration: for each trend segment (sport, sport+betType, statType,
 * edge band, model-probability band — reusing the same buckets pick-trends.ts
 * uses to flag losing trends) we track the model's average predicted probability
 * against the actual settled hit rate. A leg's raw model probability is then
 * shrunk toward the empirical rate, weighted by how much settled history backs
 * that segment.
 */
export interface CalibrationBucketStat {
  n: number;
  predictedSum: number;
  actualWins: number;
}

export interface CalibrationModel {
  generatedAt: string;
  /** Keyed by `${dimension}:${value}`, mirroring pick-trends.ts segment keys. */
  buckets: Record<string, CalibrationBucketStat>;
}

export const EMPTY_CALIBRATION_MODEL: CalibrationModel = {
  generatedAt: new Date(0).toISOString(),
  buckets: {},
};

/** Build an empirical calibration model from settled pick history. */
export function buildCalibrationModel(
  picks: RecommendedPick[],
  now: Date = new Date()
): CalibrationModel {
  const buckets: Record<string, CalibrationBucketStat> = {};

  for (const pick of picks) {
    if (pick.status !== "won" && pick.status !== "lost") continue;

    for (const seg of segmentsFor(pick)) {
      const key = `${seg.dimension}:${seg.value}`;
      const stat = buckets[key] ?? { n: 0, predictedSum: 0, actualWins: 0 };
      stat.n += 1;
      stat.predictedSum += pick.modelProbability;
      if (pick.status === "won") stat.actualWins += 1;
      buckets[key] = stat;
    }
  }

  return { generatedAt: now.toISOString(), buckets };
}

export interface CalibrationWeights {
  /** Shrinkage prior strength (K in n/(n+K)) — higher means more historical evidence required to trust the empirical rate over the raw model probability. */
  priorStrength: number;
  /** Minimum settled samples in a bucket before it contributes to calibration at all. */
  minBucketSamples: number;
}

export const DEFAULT_CALIBRATION_WEIGHTS: CalibrationWeights = {
  priorStrength: 20,
  minBucketSamples: 3,
};

export interface CalibrationResult {
  rawProbability: number;
  calibratedProbability: number;
  /** 0–1 — how much weight settled history got vs. the raw model probability. */
  calibrationConfidence: number;
  /** Total settled samples backing the segments that contributed. */
  sampleSize: number;
}

/**
 * Blend a leg's raw model probability toward the empirical hit rate of the
 * segments it belongs to, weighted by sample size. Segments with too little
 * history (or an absent model) leave the raw probability untouched.
 */
export function calibrateProbability(
  bet: SegmentableBet,
  rawProbability: number,
  model: CalibrationModel | null,
  weights: CalibrationWeights = DEFAULT_CALIBRATION_WEIGHTS
): CalibrationResult {
  if (!model) {
    return {
      rawProbability,
      calibratedProbability: rawProbability,
      calibrationConfidence: 0,
      sampleSize: 0,
    };
  }

  let totalWeight = 0;
  let weightedActual = 0;
  let sampleSize = 0;

  for (const seg of segmentsFor(bet)) {
    const key = `${seg.dimension}:${seg.value}`;
    const stat = model.buckets[key];
    if (!stat || stat.n < weights.minBucketSamples) continue;

    const actualHitRate = stat.actualWins / stat.n;
    totalWeight += stat.n;
    weightedActual += actualHitRate * stat.n;
    sampleSize += stat.n;
  }

  if (totalWeight === 0) {
    return {
      rawProbability,
      calibratedProbability: rawProbability,
      calibrationConfidence: 0,
      sampleSize: 0,
    };
  }

  const empiricalRate = weightedActual / totalWeight;
  const shrinkage = totalWeight / (totalWeight + weights.priorStrength);
  const calibratedProbability =
    rawProbability * (1 - shrinkage) + empiricalRate * shrinkage;

  return {
    rawProbability,
    calibratedProbability: Math.min(0.99, Math.max(0.01, calibratedProbability)),
    calibrationConfidence: shrinkage,
    sampleSize,
  };
}
