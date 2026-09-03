import { kellyCriterion } from "@/lib/betting-math";
import type { KalshiBet, KalshiBetType, KalshiSportKey } from "@/types/kalshi";
import { isCatalogMoneyline } from "@/types/kalshi";
import { parsePropTitle, teamAbbrFromMarketTicker } from "./prop-parser";

/** Universal floor — model & Kalshi ask must be ≥50% (-100 American) for every market */
export const MIN_MODEL_PROBABILITY = 0.5;
export const MIN_YES_ASK = 0.5;

/** Hard filter thresholds — Step 1 */
export const PORTFOLIO_THRESHOLDS = {
  minEvPercent: 3,
  minPitcherExpectedInnings: 5,
  maxInjuryUncertainty: 0.65,
} as const;

/** Relaxed EV/injury filters for soccer/tennis moneylines (no stats model; fair vs ask) */
const CATALOG_THRESHOLDS = {
  minEvPercent: -8,
  maxInjuryUncertainty: 0.85,
} as const;

const CATALOG_MIN_STAKE = 0.005;
const CATALOG_MAX_FAIR_GAP = 0.08;

function thresholdsFor(bet: KalshiBet) {
  return isCatalogMoneyline(bet) ? CATALOG_THRESHOLDS : PORTFOLIO_THRESHOLDS;
}

/** Quality score weights — Step 2 */
const QUALITY_WEIGHTS = {
  probability: 0.5,
  ev: 0.35,
  confidence: 0.15,
  volatility: 0.25,
} as const;

/** Diversification limits — Step 3 */
const DIVERSIFY = {
  maxPropsPerPlayer: 1,
  maxBetsPerGame: 2,
  maxGameBankrollFraction: 0.2,
  kellyFraction: 0.5,
  /** Penalty multiplier applied to max correlation vs selected bets */
  correlationPenalty: 0.35,
} as const;

export type FilterRejectReason =
  | "low_model_probability"
  | "low_yes_ask"
  | "low_ev"
  | "low_pitcher_innings"
  | "high_injury_uncertainty"
  | "trend_exclusion";

/**
 * Segment dimensions used to detect losing trends and exclude matching bets
 * from future portfolios. Kept narrow/composite (rather than bare "betType")
 * so a rule targets a specific slice instead of an entire bet-type wholesale.
 */
export type TrendDimension =
  | "sport"
  | "sport_betType"
  | "statType"
  | "edgeBucket"
  | "probabilityBucket";

export interface DimensionSegment {
  dimension: TrendDimension;
  value: string;
}

/** A learned rule to exclude a losing segment from the next batch of picks. */
export interface ExclusionRule {
  dimension: TrendDimension;
  value: string;
  hitRate: number;
  settled: number;
  /** Trend windows ("1d" | "2d" | "all") that flagged this segment. */
  windows: string[];
  /** Human-readable description of the excluded segment, e.g. "MLB strikeouts props". */
  reason: string;
}

/** Fields needed to bucket a bet/pick into trend segments — satisfied by both KalshiBet and RecommendedPick. */
export interface SegmentableBet {
  sport: KalshiSportKey;
  betType: KalshiBetType;
  statType?: string;
  edgePercent: number;
  modelProbability: number;
}

function edgeBucket(edgePercent: number): string {
  if (edgePercent < 0) return "<0%";
  if (edgePercent < 5) return "0-5%";
  if (edgePercent < 10) return "5-10%";
  if (edgePercent < 20) return "10-20%";
  return "20%+";
}

function probabilityBucket(modelProbability: number): string {
  if (modelProbability < 0.55) return "50-55%";
  if (modelProbability < 0.6) return "55-60%";
  if (modelProbability < 0.7) return "60-70%";
  return "70%+";
}

/** The dimension segments a bet/pick belongs to, for trend aggregation and exclusion matching. */
export function segmentsFor(bet: SegmentableBet): DimensionSegment[] {
  const segments: DimensionSegment[] = [
    { dimension: "sport", value: bet.sport },
    { dimension: "sport_betType", value: `${bet.sport}:${bet.betType}` },
    { dimension: "edgeBucket", value: edgeBucket(bet.edgePercent) },
    { dimension: "probabilityBucket", value: probabilityBucket(bet.modelProbability) },
  ];
  if (bet.statType) segments.push({ dimension: "statType", value: bet.statType });
  return segments;
}

/** Human-readable label for a segment, used in trend narratives and exclusion reasons. */
export function describeSegment(dimension: TrendDimension, value: string): string {
  switch (dimension) {
    case "sport":
      return `${value} picks`;
    case "sport_betType": {
      const [sport, betType] = value.split(":");
      return `${sport} ${betType === "moneyline" ? "moneylines" : "player props"}`;
    }
    case "statType":
      return `${value} props`;
    case "edgeBucket":
      return `picks in the ${value} model-edge range`;
    case "probabilityBucket":
      return `picks in the ${value} model-probability range`;
  }
}

/** Whether a bet falls into a segment an exclusion rule flagged. */
export function matchesExclusionRule(
  bet: SegmentableBet,
  rule: ExclusionRule
): boolean {
  return segmentsFor(bet).some(
    (s) => s.dimension === rule.dimension && s.value === rule.value
  );
}

export function bearsActiveExclusion(
  bet: SegmentableBet,
  rules: ExclusionRule[]
): ExclusionRule | undefined {
  if (rules.length === 0) return undefined;
  return rules.find((rule) => matchesExclusionRule(bet, rule));
}

export interface PortfolioBet extends KalshiBet {
  volatility: number;
  injuryUncertainty: number;
  expectedInnings?: number;
  qualityScore: number;
  bankrollPct: number;
  rank: number;
}

export interface PortfolioSelectResult {
  bets: PortfolioBet[];
  filteredCount: number;
  survivorCount: number;
  dedupedCount: number;
}

function playerKey(bet: KalshiBet): string | null {
  if (bet.betType !== "player_prop" || !bet.playerName) return null;
  return `${bet.sport}:${bet.playerName.toLowerCase()}`;
}

function isPitcherStrikeoutProp(bet: KalshiBet): boolean {
  return bet.sport === "MLB" && bet.statType === "strikeouts";
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Stable game identity across prop vs game series (event tickers differ). */
function gameSlateKey(bet: KalshiBet): string {
  const matchup = normalizeName(bet.matchup.replace(/\s*\([^)]*\)\s*$/, ""));
  return `${bet.sport}:${bet.gameDate}:${matchup}`;
}

function propLine(bet: KalshiBet): number | null {
  if (bet.line != null) return bet.line;
  const parsed = parsePropTitle(bet.marketTitle) ?? parsePropTitle(bet.selection);
  return parsed?.line ?? null;
}

/** Groups the same pick (game + side/line); ask price and market id are ignored. */
export function equivalenceKey(bet: KalshiBet): string {
  if (bet.betType === "player_prop" && bet.playerName && bet.statType) {
    const line = propLine(bet);
    if (line != null) {
      return `${gameSlateKey(bet)}:prop:${normalizeName(bet.playerName)}:${bet.statType.toLowerCase()}:${line}`;
    }
    return `${gameSlateKey(bet)}:prop:${normalizeName(bet.playerName)}:${bet.statType.toLowerCase()}`;
  }
  if (bet.betType === "moneyline") {
    const team = isCatalogMoneyline(bet)
      ? normalizeName(bet.selection)
      : (teamAbbrFromMarketTicker(bet.marketTicker)?.toLowerCase() ??
        normalizeName(bet.selection));
    return `${gameSlateKey(bet)}:ml:${team}`;
  }
  return `${gameSlateKey(bet)}:${bet.betType}:${normalizeName(bet.selection)}`;
}

function teamsFromMatchup(matchup: string): Set<string> {
  const teams = new Set<string>();
  for (const part of matchup.split(/\s+@\s+|\s+vs\s+/i)) {
    const t = part.trim().toLowerCase();
    if (t) teams.add(t);
  }
  return teams;
}

/** Heuristic correlation 0–1 between two bets. */
export function betCorrelation(a: KalshiBet, b: KalshiBet): number {
  if (a.id === b.id) return 1;

  if (a.eventTicker === b.eventTicker) {
    if (a.betType === "moneyline" && b.betType === "moneyline") return 0.95;
    if (
      a.playerName &&
      b.playerName &&
      a.playerName.toLowerCase() === b.playerName.toLowerCase()
    ) {
      return 0.98;
    }
    return 0.78;
  }

  if (a.sport === b.sport && a.gameDate === b.gameDate) {
    const shared = [...teamsFromMatchup(a.matchup)].some((t) =>
      teamsFromMatchup(b.matchup).has(t)
    );
    if (shared) return 0.55;
    return 0.12;
  }

  if (
    a.playerName &&
    b.playerName &&
    a.sport === b.sport &&
    a.playerName.toLowerCase() === b.playerName.toLowerCase()
  ) {
    return 0.35;
  }

  if (a.sport === b.sport && a.statType && a.statType === b.statType) {
    return 0.1;
  }

  return 0;
}

function maxCorrelationWithSelected(
  bet: KalshiBet,
  selected: PortfolioBet[]
): number {
  if (selected.length === 0) return 0;
  return Math.max(...selected.map((s) => betCorrelation(bet, s)));
}

function adjustedQualityScore(
  bet: PortfolioBet,
  selected: PortfolioBet[]
): number {
  const corr = maxCorrelationWithSelected(bet, selected);
  return bet.qualityScore - DIVERSIFY.correlationPenalty * corr;
}

/** Step 1 — remove bets that fail hard filters or match a learned losing trend */
export function filterBadBets(
  bets: KalshiBet[],
  exclusionRules: ExclusionRule[] = []
): {
  survivors: KalshiBet[];
  rejected: number;
} {
  const survivors: KalshiBet[] = [];
  let rejected = 0;

  for (const bet of bets) {
    const t = thresholdsFor(bet);
    if (bet.modelProbability < MIN_MODEL_PROBABILITY) {
      rejected++;
      continue;
    }
    if (bet.yesAsk < MIN_YES_ASK) {
      rejected++;
      continue;
    }
    if (bet.edgePercent < t.minEvPercent) {
      rejected++;
      continue;
    }
    if (
      isPitcherStrikeoutProp(bet) &&
      (bet.expectedInnings ?? 0) < PORTFOLIO_THRESHOLDS.minPitcherExpectedInnings
    ) {
      rejected++;
      continue;
    }
    if ((bet.injuryUncertainty ?? 0) > t.maxInjuryUncertainty) {
      rejected++;
      continue;
    }
    if (bearsActiveExclusion(bet, exclusionRules)) {
      rejected++;
      continue;
    }
    survivors.push(bet);
  }

  return { survivors, rejected };
}

function normalizeEv(ev: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (ev - min) / (max - min)));
}

/** Step 2 — compute quality score for each survivor */
export function rankByQualityScore(bets: KalshiBet[]): PortfolioBet[] {
  if (bets.length === 0) return [];

  const evValues = bets.map((b) => b.edgePercent);
  const evMin = Math.min(...evValues);
  const evMax = Math.max(...evValues);

  const scored = bets.map((bet) => {
    const P = bet.modelProbability;
    const C = bet.confidence;
    const V = bet.volatility ?? 0.5;
    const evNorm = normalizeEv(bet.edgePercent, evMin, evMax);
    const fairGap = Math.abs(bet.fairProbability - bet.yesAsk);
    const catalogBoost = isCatalogMoneyline(bet) ? (1 - fairGap) * 0.15 : 0;
    const qualityScore =
      QUALITY_WEIGHTS.probability * P +
      QUALITY_WEIGHTS.ev * evNorm +
      QUALITY_WEIGHTS.confidence * C -
      QUALITY_WEIGHTS.volatility * V +
      catalogBoost;

    return {
      ...bet,
      volatility: V,
      injuryUncertainty: bet.injuryUncertainty ?? 0,
      expectedInnings: bet.expectedInnings,
      qualityScore,
      bankrollPct: 0,
      rank: 0,
    };
  });

  return scored.sort((a, b) => b.qualityScore - a.qualityScore);
}

/** Collapse equivalent markets — keep highest quality per group */
export function deduplicateEquivalentMarkets(
  ranked: PortfolioBet[]
): { bets: PortfolioBet[]; removed: number } {
  const best = new Map<string, PortfolioBet>();

  for (const bet of ranked) {
    const key = equivalenceKey(bet);
    const existing = best.get(key);
    if (!existing || bet.qualityScore > existing.qualityScore) {
      best.set(key, bet);
    }
  }

  const bets = [...best.values()].sort(
    (a, b) => b.qualityScore - a.qualityScore
  );
  return { bets, removed: ranked.length - bets.length };
}

function kellyStake(bet: PortfolioBet): number {
  const kelly = kellyCriterion(
    bet.modelProbability,
    bet.americanOdds,
    DIVERSIFY.kellyFraction
  );
  if (kelly > 0) return kelly;
  if (isCatalogMoneyline(bet)) {
    const gap = bet.fairProbability - bet.yesAsk;
    if (gap >= -CATALOG_MAX_FAIR_GAP) return CATALOG_MIN_STAKE;
  }
  return 0;
}

function canAddBet(
  bet: PortfolioBet,
  selected: PortfolioBet[],
  playerProps: Set<string>,
  gameBetCount: Map<string, number>,
  gameBankroll: Map<string, number>,
  stake: number
): boolean {
  const gameKey = bet.eventTicker;
  const pk = playerKey(bet);
  if (pk && playerProps.has(pk)) return false;
  if ((gameBetCount.get(gameKey) ?? 0) >= DIVERSIFY.maxBetsPerGame) return false;
  const gameUsed = gameBankroll.get(gameKey) ?? 0;
  if (gameUsed + stake > DIVERSIFY.maxGameBankrollFraction) return false;
  return true;
}

/** Step 3 — correlation-penalized greedy selection, then order by quality score */
export function diversifyPortfolio(ranked: PortfolioBet[]): PortfolioBet[] {
  const remaining = [...ranked];
  const selected: PortfolioBet[] = [];
  const playerProps = new Set<string>();
  const gameBetCount = new Map<string, number>();
  const gameBankroll = new Map<string, number>();

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestAdj = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const bet = remaining[i]!;
      const stake = kellyStake(bet);
      if (stake <= 0) continue;
      if (
        !canAddBet(
          bet,
          selected,
          playerProps,
          gameBetCount,
          gameBankroll,
          stake
        )
      ) {
        continue;
      }

      const adj = adjustedQualityScore(bet, selected);
      if (adj > bestAdj) {
        bestAdj = adj;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;

    const bet = remaining.splice(bestIdx, 1)[0]!;
    const stake = kellyStake(bet);
    const gameKey = bet.eventTicker;
    const pk = playerKey(bet);

    selected.push({ ...bet, bankrollPct: stake * 100 });
    if (pk) playerProps.add(pk);
    gameBetCount.set(gameKey, (gameBetCount.get(gameKey) ?? 0) + 1);
    gameBankroll.set(gameKey, (gameBankroll.get(gameKey) ?? 0) + stake);
  }

  return selected
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .map((b, i) => ({ ...b, rank: i + 1 }));
}

/** Full pipeline: filter → score → dedupe → diversify */
export function selectKalshiPortfolio(
  bets: KalshiBet[],
  exclusionRules: ExclusionRule[] = []
): PortfolioSelectResult {
  const { survivors, rejected } = filterBadBets(bets, exclusionRules);
  const ranked = rankByQualityScore(survivors);
  const { bets: deduped, removed: dedupedCount } =
    deduplicateEquivalentMarkets(ranked);
  const diversified = diversifyPortfolio(deduped);

  return {
    bets: diversified,
    filteredCount: rejected,
    survivorCount: survivors.length,
    dedupedCount,
  };
}

/** Coefficient-of-variation volatility, normalized 0–1 */
export function computeVolatility(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 1;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.min(1, cv / 1.5);
}

/** Injury uncertainty proxy: low sample + low confidence → high uncertainty */
export function computeInjuryUncertainty(
  gamesSampled: number,
  confidence: number
): number {
  const samplePenalty =
    gamesSampled < 4 ? 0.45 : gamesSampled < 7 ? 0.2 : gamesSampled < 10 ? 0.08 : 0;
  const confidencePenalty = (1 - confidence) * 0.4;
  return Math.min(1, samplePenalty + confidencePenalty);
}
