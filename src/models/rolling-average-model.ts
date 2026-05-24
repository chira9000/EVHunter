import { impliedProbabilityToAmerican } from "@/lib/betting-math";
import type { ModelInput, ModelOutput, PredictiveModel } from "./types";

function rollingAverage(values: number[], window: number): number {
  const slice = values.slice(-window);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function weightedRecent(values: number[], decay = 0.85): number {
  if (values.length === 0) return 0;
  let weight = 1;
  let total = 0;
  let weightSum = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    total += values[i]! * weight;
    weightSum += weight;
    weight *= decay;
  }
  return total / weightSum;
}

function opponentAdjusted(
  rawAvg: number,
  defenseRank: number,
  leagueAvg: number
): number {
  const rankFactor = 1 + (defenseRank - 15) * 0.02;
  return rawAvg * rankFactor + leagueAvg * (1 - rankFactor * 0.1);
}

function paceAdjusted(value: number, paceFactor: number): number {
  return value * (paceFactor / 100);
}

/** Normal CDF approximation for over/under probability */
function probOver(projection: number, line: number, stdDev: number): number {
  const z = (projection - line) / Math.max(stdDev, 0.5);
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export class RollingAverageModel implements PredictiveModel {
  readonly key = "rolling-average";
  readonly version = "1.0.0";

  predict(input: ModelInput): ModelOutput {
    const roll5 = rollingAverage(input.playerStats, 5);
    const roll10 = rollingAverage(input.playerStats, 10);
    const weighted = weightedRecent(input.playerStats);
    const adjusted = opponentAdjusted(roll10, input.opponentDefenseRank, roll10);
    const paced = paceAdjusted(adjusted, input.paceFactor);

    const projection = roll5 * 0.35 + weighted * 0.4 + paced * 0.25;
    const stdDev =
      input.playerStats.length > 1
        ? Math.sqrt(
            input.playerStats.reduce((s, v) => s + (v - roll10) ** 2, 0) /
              input.playerStats.length
          )
        : 3;

    let trueProbability: number;
    if (input.marketType === "over") {
      trueProbability = probOver(projection, input.line, stdDev);
    } else if (input.marketType === "under") {
      trueProbability = 1 - probOver(projection, input.line, stdDev);
    } else {
      trueProbability = 0.5 + (projection - input.line) * 0.02;
      trueProbability = Math.min(0.85, Math.max(0.15, trueProbability));
    }

    const sampleSize = input.playerStats.length;
    const confidence = Math.min(
      0.95,
      0.45 + sampleSize * 0.04 + (1 - Math.abs(trueProbability - 0.5) * 2) * 0.15
    );

    const fairAmericanOdds = impliedProbabilityToAmerican(trueProbability);

    return {
      trueProbability,
      confidence,
      fairAmericanOdds,
      features: {
        roll5,
        roll10,
        weighted,
        opponentAdjusted: adjusted,
        paceAdjusted: paced,
        projection,
        stdDev,
      },
      modelKey: this.key,
      modelVersion: this.version,
    };
  }
}

export class MLModelStub implements PredictiveModel {
  readonly key = "ml-stub";
  readonly version = "0.0.0";

  predict(input: ModelInput): ModelOutput {
    const base = new RollingAverageModel().predict(input);
    return {
      ...base,
      modelKey: this.key,
      modelVersion: this.version,
      confidence: base.confidence * 0.5,
    };
  }
}

export const modelRegistry: Record<string, PredictiveModel> = {
  "rolling-average": new RollingAverageModel(),
  "ml-stub": new MLModelStub(),
};

export function getModel(key: string): PredictiveModel {
  return modelRegistry[key] ?? modelRegistry["rolling-average"]!;
}
