export type KalshiSportKey = "MLB" | "NFL" | "NBA";

export interface KalshiBet {
  id: string;
  sport: KalshiSportKey;
  eventTicker: string;
  marketTicker: string;
  matchup: string;
  selection: string;
  marketTitle: string;
  /** Kalshi yes ask (0–1), cost to buy Yes */
  yesAsk: number;
  yesBid: number;
  midPrice: number;
  impliedProbability: number;
  fairProbability: number;
  /** Edge vs no-vig fair price on the paired game market (%) */
  edgePercent: number;
  americanOdds: number;
  fairAmericanOdds: number;
  spreadPercent: number;
  volume24h: number;
  gameDate: string;
  expiresAt: string;
  kalshiUrl: string;
}

export interface KalshiBetsResponse {
  bets: KalshiBet[];
  updatedAt: string;
  source: "kalshi";
}
