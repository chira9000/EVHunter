import type { PickTrendReport } from "@/services/kalshi/pick-trends";

export type KalshiSportKey = "MLB" | "NFL" | "NBA" | "SOCCER" | "TENNIS";

export const KALSHI_SPORT_KEYS: KalshiSportKey[] = [
  "MLB",
  "NFL",
  "NBA",
  "SOCCER",
  "TENNIS",
];

/** Moneylines without prop/stats models — ranked by fair-price vs ask */
export function isCatalogMoneyline(bet: {
  sport: KalshiSportKey;
  betType: KalshiBetType;
}): boolean {
  return (
    bet.betType === "moneyline" &&
    (bet.sport === "SOCCER" || bet.sport === "TENNIS")
  );
}
export type KalshiBetType = "moneyline" | "player_prop";

export interface KalshiBet {
  id: string;
  sport: KalshiSportKey;
  betType: KalshiBetType;
  eventTicker: string;
  marketTicker: string;
  matchup: string;
  selection: string;
  marketTitle: string;
  playerName?: string;
  statType?: string;
  line?: number;
  /** Kalshi yes ask (0–1), cost to buy Yes */
  yesAsk: number;
  yesBid: number;
  midPrice: number;
  impliedProbability: number;
  fairProbability: number;
  modelProbability: number;
  confidence: number;
  /** Share of recent games clearing the prop line */
  hitRate: number;
  /** Edge vs model fair probability at the ask (%) */
  edgePercent: number;
  americanOdds: number;
  fairAmericanOdds: number;
  spreadPercent: number;
  volume24h: number;
  gameDate: string;
  expiresAt: string;
  kalshiUrl: string;
  statsSource: "mlb-statsapi" | "espn";
  /** Stat volatility 0–1 (coefficient of variation) */
  volatility?: number;
  /** 0–1; higher = more injury/sample uncertainty */
  injuryUncertainty?: number;
  /** MLB pitcher rolling avg IP (strikeout props only) */
  expectedInnings?: number;
  /** Composite rank score after filter + diversify */
  qualityScore?: number;
  /** Suggested half-Kelly bankroll % */
  bankrollPct?: number;
  rank?: number;
}

export type RecommendedPickStatus = "pending" | "won" | "lost" | "void";

/** Snapshot of a portfolio recommendation for post-game settlement. */
export interface RecommendedPick {
  marketTicker: string;
  sport: KalshiSportKey;
  betType: KalshiBetType;
  selection: string;
  matchup: string;
  marketTitle: string;
  playerName?: string;
  statType?: string;
  line?: number;
  modelProbability: number;
  edgePercent: number;
  yesAsk: number;
  gameDate: string;
  expiresAt: string;
  recommendedAt: string;
  status: RecommendedPickStatus;
  settledAt?: string;
  /** Kalshi market result when settled */
  result?: "yes" | "no";
}

export interface SportHitRate {
  settled: number;
  wins: number;
  hitRate: number;
}

/** Aggregate accuracy of past recommended portfolio picks. */
export interface PickHitRateStats {
  settled: number;
  wins: number;
  losses: number;
  pending: number;
  hitRate: number;
  bySport: Partial<Record<KalshiSportKey, SportHitRate>>;
  recent: RecommendedPick[];
  trends: PickTrendReport;
}

export interface KalshiBetsResponse {
  bets: KalshiBet[];
  updatedAt: string;
  source: "kalshi";
  propsScored: number;
  moneylinesScored: number;
  filteredCount?: number;
  survivorCount?: number;
  pickHitRate?: PickHitRateStats;
}

export interface ParlayLegAnalysis {
  raw: string;
  label: string;
  matched: boolean;
  impliedProbability: number;
  modelProbability: number;
  edgePercent: number;
  confidence: number;
  americanOdds: number;
}

export interface ParlayAnalysisResult {
  legs: ParlayLegAnalysis[];
  legCount: number;
  matchedCount: number;
  combinedAmericanOdds: number;
  impliedProbability: number;
  modelProbability: number;
  edgePercent: number;
  avgCorrelation: number;
  avgLegEdge: number;
  rating: number;
  analysis: string;
  warnings: string[];
}
