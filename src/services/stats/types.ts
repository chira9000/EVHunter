import type { KalshiSportKey } from "@/types/kalshi";

export type StatKey =
  | "hits"
  | "strikeouts"
  | "homeRuns"
  | "rbi"
  | "totalBases"
  | "points"
  | "rebounds"
  | "assists"
  | "passingYards"
  | "rushingYards"
  | "receivingYards"
  | "receptions"
  | "passingTouchdowns"
  | "touchdowns"
  | "anytimeTd"
  | "wins";

export interface PlayerStatSeries {
  sport: KalshiSportKey;
  playerName: string;
  statKey: StatKey;
  /** Most recent game first */
  values: number[];
  gamesSampled: number;
  season: number;
}

export interface TeamForm {
  sport: KalshiSportKey;
  teamAbbr: string;
  wins: number;
  losses: number;
  winRate: number;
  avgMargin: number;
  gamesSampled: number;
}
