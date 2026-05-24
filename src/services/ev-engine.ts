import {
  americanToImpliedProbability,
  arbitrageProfitPercent,
  closingLineValue,
  evTier,
  expectedValuePercent,
  kellyCriterion,
} from "@/lib/betting-math";
import { getModel } from "@/models/rolling-average-model";
import type { BetOpportunity, BetFilters } from "@/types";
import type { BetSide, BetType, Sport } from "@prisma/client";
import { mockBetOpportunities } from "./mock/data";

export interface RawMarketOdds {
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
  oppositeAmericanOdds?: number;
  line?: number;
  gameDate: string;
  playerStats?: number[];
  opponentDefenseRank?: number;
  paceFactor?: number;
  hitRate?: number;
  injuryFlag?: boolean;
  newsSnippet?: string;
  lineMovement?: BetOpportunity["lineMovement"];
  sharpIndicator?: number;
  steamScore?: number;
  closingAmericanOdds?: number;
}

export function computeOpportunity(
  raw: RawMarketOdds,
  modelKey = "rolling-average"
): BetOpportunity {
  const model = getModel(modelKey);
  const impliedProbability = americanToImpliedProbability(raw.americanOdds);

  const marketType =
    raw.side === "OVER"
      ? "over"
      : raw.side === "UNDER"
        ? "under"
        : raw.betType === "SPREAD"
          ? "spread"
          : "moneyline";

  const prediction = model.predict({
    sport: raw.sport,
    statKey: raw.marketDescription,
    playerStats: raw.playerStats ?? [28, 31, 26, 33, 30, 29, 35, 27],
    opponentDefenseRank: raw.opponentDefenseRank ?? 15,
    paceFactor: raw.paceFactor ?? 100,
    line: raw.line ?? 0,
    marketType,
  });

  const evPercent = expectedValuePercent(
    prediction.trueProbability,
    raw.americanOdds
  );
  const kelly = kellyCriterion(prediction.trueProbability, raw.americanOdds, 0.25);

  let clv: number | undefined;
  if (raw.closingAmericanOdds) {
    clv = closingLineValue(
      impliedProbability,
      americanToImpliedProbability(raw.closingAmericanOdds)
    );
  }

  return {
    id: raw.id,
    sport: raw.sport,
    playerName: raw.playerName,
    teamName: raw.teamName,
    matchup: raw.matchup,
    betType: raw.betType,
    side: raw.side,
    marketDescription: raw.marketDescription,
    sportsbook: raw.sportsbook,
    sportsbookSlug: raw.sportsbookSlug,
    americanOdds: raw.americanOdds,
    fairAmericanOdds: prediction.fairAmericanOdds,
    impliedProbability,
    modelProbability: prediction.trueProbability,
    evPercent,
    evTier: evTier(evPercent),
    kellyFraction: kelly,
    confidence: prediction.confidence,
    hitRate: raw.hitRate,
    clv,
    injuryFlag: raw.injuryFlag ?? false,
    newsSnippet: raw.newsSnippet,
    gameDate: raw.gameDate,
    line: raw.line,
    lineMovement: raw.lineMovement ?? [],
    sharpIndicator: raw.sharpIndicator,
    steamScore: raw.steamScore,
  };
}

export function rankByEv(opportunities: BetOpportunity[]): BetOpportunity[] {
  return [...opportunities].sort((a, b) => b.evPercent - a.evPercent);
}

export function filterOpportunities(
  opportunities: BetOpportunity[],
  filters: BetFilters
): BetOpportunity[] {
  return opportunities.filter((o) => {
    if (filters.sport && o.sport !== filters.sport) return false;
    if (filters.sportsbook && o.sportsbookSlug !== filters.sportsbook) return false;
    if (filters.betType && o.betType !== filters.betType) return false;
    if (filters.minEvPercent != null && o.evPercent < filters.minEvPercent) return false;
    if (filters.minConfidence != null && o.confidence < filters.minConfidence) return false;
    if (filters.player && !o.playerName?.toLowerCase().includes(filters.player.toLowerCase()))
      return false;
    if (filters.gameDate && !o.gameDate.startsWith(filters.gameDate)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = [
        o.playerName,
        o.teamName,
        o.matchup,
        o.marketDescription,
        o.sportsbook,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function detectArbitrage(
  legs: { americanOdds: number; sportsbook: string; selection: string }[]
): { profitPercent: number; stakeWeights: number[] } | null {
  const probs = legs.map((l) => americanToImpliedProbability(l.americanOdds));
  const profit = arbitrageProfitPercent(probs);
  if (profit <= 0) return null;
  const decimals = probs.map((p) => 1 / p);
  const inverseSum = decimals.reduce((a, b) => a + b, 0);
  const stakeWeights = decimals.map((d) => d / inverseSum);
  return { profitPercent: profit, stakeWeights };
}

export function getOpportunities(filters: BetFilters = {}): BetOpportunity[] {
  const ranked = rankByEv(mockBetOpportunities);
  return filterOpportunities(ranked, filters);
}
