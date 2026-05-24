import type { Sport } from "@prisma/client";

export interface ModelInput {
  sport: Sport;
  statKey: string;
  playerStats: number[];
  opponentDefenseRank: number;
  paceFactor: number;
  homeAdvantage?: number;
  line: number;
  marketType: "over" | "under" | "spread" | "moneyline";
}

export interface ModelOutput {
  trueProbability: number;
  confidence: number;
  fairAmericanOdds: number;
  features: Record<string, number>;
  modelKey: string;
  modelVersion: string;
}

export interface PredictiveModel {
  readonly key: string;
  readonly version: string;
  predict(input: ModelInput): ModelOutput;
}

/** Placeholder for future ML model integration */
export interface MLModelPlaceholder {
  modelPath: string;
  framework: "tensorflow" | "pytorch" | "onnx";
  status: "planned" | "training" | "ready";
}
