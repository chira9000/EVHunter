import type { BetSide, BetType, Sport } from "@prisma/client";
import type { EvTier } from "@/lib/betting-math";

export interface BetOpportunity {
  id: string;
  sport: Sport;
  playerName?: string;
  teamName?: string;
  matchup: string;
  betType: BetType;
  side?: BetSide;
  marketDescription: string;
  sportsbook: string;
  sportsbookSlug: string;
  americanOdds: number;
  fairAmericanOdds: number;
  impliedProbability: number;
  modelProbability: number;
  evPercent: number;
  evTier: EvTier;
  kellyFraction: number;
  confidence: number;
  hitRate?: number;
  clv?: number;
  injuryFlag: boolean;
  newsSnippet?: string;
  gameDate: string;
  line?: number;
  lineMovement: LineMovementPoint[];
  sharpIndicator?: number;
  steamScore?: number;
}

export interface LineMovementPoint {
  timestamp: string;
  americanOdds: number;
  impliedProb: number;
}

export interface SportsbookComparison {
  sportsbook: string;
  americanOdds: number;
  impliedProbability: number;
  evPercent: number;
}

export interface ArbitrageLeg {
  sportsbook: string;
  selection: string;
  americanOdds: number;
  stakeWeight: number;
}

export interface ArbitrageOpportunity {
  id: string;
  matchup: string;
  profitPercent: number;
  legs: ArbitrageLeg[];
  detectedAt: string;
}

export interface PlayerAnalytics {
  id: string;
  name: string;
  team: string;
  sport: Sport;
  position?: string;
  rollingAvg: Record<string, number>;
  opponentAdjusted: Record<string, number>;
  paceMetrics: Record<string, number>;
  recentWeighted: Record<string, number>;
  trendData: { game: string; value: number }[];
  injuryStatus?: string;
}

export interface ModelPerformance {
  modelKey: string;
  version: string;
  sport: Sport;
  sampleSize: number;
  hitRate: number;
  roi: number;
  brierScore: number;
  calibration: { bucket: string; predicted: number; actual: number }[];
}

export interface BetFilters {
  sport?: Sport;
  sportsbook?: string;
  player?: string;
  betType?: BetType;
  minEvPercent?: number;
  minConfidence?: number;
  gameDate?: string;
  search?: string;
}

export interface DashboardStats {
  totalOpportunities: number;
  avgEv: number;
  topSport: Sport;
  arbitrageCount: number;
  steamMoves: number;
}
