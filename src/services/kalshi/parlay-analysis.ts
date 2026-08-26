import {
  decimalToAmerican,
  formatAmericanOdds,
  formatEvPercent,
  parlayExpectedValuePercent,
  parlayImpliedProbability,
  parlayModelProbability,
} from "@/lib/betting-math";
import type { KalshiBet, ParlayAnalysisResult, ParlayLegAnalysis } from "@/types/kalshi";
import { betCorrelation } from "./portfolio-select";
import { parsePropTitle, type ParsedKalshiProp } from "./prop-parser";

const DEFAULT_IMPLIED = 0.52;
const DEFAULT_MODEL = 0.48;
const DEFAULT_CONFIDENCE = 0.35;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Split free-text parlay input into individual legs. */
export function splitParlayInput(text: string): string[] {
  return text
    .split(/\n|;|\||\s\/\s|\s&\s+|\s+and\s+/gi)
    .flatMap((chunk) => chunk.split(/\s*,\s*(?=[A-Za-z])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function tryParseInformalProp(text: string): ParsedKalshiProp | null {
  const fromTitle = parsePropTitle(text);
  if (fromTitle) return fromTitle;

  const match = text.match(/^(.+?)\s+(\d+)\+\s*(.+)$/i);
  if (!match) return null;

  const playerName = match[1]!.trim();
  const line = parseInt(match[2]!, 10);
  const statRaw = match[3]!.trim().toLowerCase();
  if (!Number.isFinite(line)) return null;

  const colonForm = parsePropTitle(`${playerName}: ${line}+ ${statRaw}`);
  return colonForm;
}

function legMatchScore(parsed: ParsedKalshiProp, bet: KalshiBet): number {
  if (bet.betType !== "player_prop" || !bet.playerName) return 0;

  let score = 0;
  const player = normalizeText(bet.playerName);
  const parsedPlayer = normalizeText(parsed.playerName);

  if (player === parsedPlayer) score += 3;
  else if (player.includes(parsedPlayer) || parsedPlayer.includes(player)) score += 2;
  else return 0;

  if (bet.line === parsed.line) score += 2;
  else if (bet.line != null && Math.abs(bet.line - parsed.line) <= 1) score += 1;

  if (bet.statType && normalizeText(bet.statType).includes(normalizeText(parsed.statKey))) {
    score += 2;
  } else if (
    bet.selection &&
    normalizeText(bet.selection).includes(normalizeText(parsed.statKey))
  ) {
    score += 1;
  }

  return score;
}

export function matchLegToBet(legText: string, bets: KalshiBet[]): KalshiBet | undefined {
  const norm = normalizeText(legText);

  for (const bet of bets) {
    if (normalizeText(bet.selection) === norm) return bet;
    if (normalizeText(bet.marketTitle) === norm) return bet;
  }

  const parsed = tryParseInformalProp(legText);
  if (parsed) {
    let best: KalshiBet | undefined;
    let bestScore = 0;
    for (const bet of bets) {
      const score = legMatchScore(parsed, bet);
      if (score > bestScore) {
        bestScore = score;
        best = bet;
      }
    }
    if (bestScore >= 4) return best;
  }

  for (const bet of bets) {
    if (bet.betType !== "moneyline") continue;
    const team = normalizeText(bet.selection);
    if (norm === team || norm.includes(team) || team.includes(norm)) return bet;
    if (bet.matchup && norm.includes(normalizeText(bet.matchup.split("@")[0] ?? ""))) {
      return bet;
    }
  }

  return undefined;
}

function legLabel(legText: string, bet?: KalshiBet): string {
  if (bet) return bet.selection;
  const parsed = tryParseInformalProp(legText);
  if (parsed) return `${parsed.playerName} ${parsed.marketLabel}`;
  return legText;
}

function buildLegAnalysis(legText: string, bet?: KalshiBet): ParlayLegAnalysis {
  const impliedProbability = bet?.yesAsk ?? bet?.impliedProbability ?? DEFAULT_IMPLIED;
  const modelProbability = bet?.modelProbability ?? DEFAULT_MODEL;
  const edgePercent = bet?.edgePercent ?? 0;
  const confidence = bet?.confidence ?? DEFAULT_CONFIDENCE;
  const americanOdds =
    bet?.americanOdds ?? decimalToAmerican(1 / Math.max(0.05, impliedProbability));

  return {
    raw: legText,
    label: legLabel(legText, bet),
    matched: Boolean(bet),
    impliedProbability,
    modelProbability,
    edgePercent,
    confidence,
    americanOdds,
  };
}

function averagePairwiseCorrelation(bets: KalshiBet[]): number {
  if (bets.length < 2) return bets.length > 0 ? 0.08 : 0;

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < bets.length; i++) {
    for (let j = i + 1; j < bets.length; j++) {
      total += betCorrelation(bets[i]!, bets[j]!);
      pairs++;
    }
  }
  return pairs > 0 ? total / pairs : 0;
}

function clampRating(value: number): number {
  return Math.round(Math.min(10, Math.max(1, value)) * 10) / 10;
}

function computeRating(
  legs: ParlayLegAnalysis[],
  parlayEv: number,
  avgCorrelation: number,
  matchedRatio: number
): number {
  if (legs.length === 0) return 1;

  const avgLegEdge =
    legs.reduce((sum, leg) => sum + leg.edgePercent, 0) / legs.length;
  const avgConfidence =
    legs.reduce((sum, leg) => sum + leg.confidence, 0) / legs.length;

  const edgeScore = Math.min(3.5, Math.max(0, avgLegEdge / 2.5));
  const parlayEvScore = Math.min(2.5, Math.max(-1, parlayEv / 4));
  const diversificationScore = Math.min(2, (1 - avgCorrelation) * 2);
  const confidenceScore = avgConfidence * 1.5;
  const legPenalty = legs.length > 4 ? (legs.length - 4) * 0.45 : 0;
  const matchPenalty = (1 - matchedRatio) * 1.5;

  return clampRating(
    2.5 +
      edgeScore +
      parlayEvScore +
      diversificationScore +
      confidenceScore -
      legPenalty -
      matchPenalty
  );
}

function buildWarnings(
  legs: ParlayLegAnalysis[],
  avgCorrelation: number,
  matchedRatio: number
): string[] {
  const warnings: string[] = [];

  if (matchedRatio < 1) {
    warnings.push(
      "Some legs could not be matched to live Kalshi markets — estimates use neutral priors."
    );
  }
  if (avgCorrelation >= 0.55) {
    warnings.push(
      "Legs are highly correlated (same game or player); joint variance is elevated."
    );
  } else if (avgCorrelation >= 0.35) {
    warnings.push("Moderate correlation between legs reduces diversification benefit.");
  }
  if (legs.length >= 5) {
    warnings.push("Five or more legs add heavy variance — long-shot parlay territory.");
  }
  if (legs.every((leg) => leg.edgePercent <= 0)) {
    warnings.push("No leg shows positive model edge at current prices.");
  }

  return warnings;
}

function buildAnalysisParagraph(
  legs: ParlayLegAnalysis[],
  parlayEv: number,
  modelProbability: number,
  impliedProbability: number,
  combinedAmericanOdds: number,
  avgCorrelation: number,
  rating: number,
  warnings: string[]
): string {
  const legSummary = legs
    .map((leg) => {
      const edge = leg.matched ? formatEvPercent(leg.edgePercent) : "unscored";
      return `${leg.label} (${edge} edge)`;
    })
    .join(", ");

  const correlationNote =
    avgCorrelation >= 0.55
      ? "The legs are tightly linked — outcomes will tend to move together, which raises boom-or-bust variance."
      : avgCorrelation >= 0.3
        ? "There is moderate overlap between legs, so diversification is only partial."
        : "The legs are largely independent across games and sports, which is favorable for parlay construction.";

  const evNote =
    parlayEv > 2
      ? `The model prices this combo at ${(modelProbability * 100).toFixed(1)}% versus ${(impliedProbability * 100).toFixed(1)}% implied (${formatAmericanOdds(combinedAmericanOdds)}), suggesting positive parlay EV of ${formatEvPercent(parlayEv)}.`
      : parlayEv > 0
        ? `Fair hit rate is roughly ${(modelProbability * 100).toFixed(1)}% against ${(impliedProbability * 100).toFixed(1)}% implied — a thin ${formatEvPercent(parlayEv)} edge that depends on price precision.`
        : `At ${formatAmericanOdds(combinedAmericanOdds)}, the book implies ${(impliedProbability * 100).toFixed(1)}% while the model sees ${(modelProbability * 100).toFixed(1)}%, pointing to negative or neutral parlay EV.`;

  const ratingNote =
    rating >= 8
      ? "Overall this is a strong slip with solid leg quality and reasonable structure."
      : rating >= 6
        ? "This is a playable combo with some positives, but sizing should stay conservative."
        : rating >= 4
          ? "Mixed signals — consider trimming correlated legs or waiting for better prices."
          : "Weak profile: low edge, heavy correlation, or too many long shots.";

  const warningNote =
    warnings.length > 0 ? ` Note: ${warnings[0]}` : "";

  return `This ${legs.length}-leg parlay combines ${legSummary}. ${correlationNote} ${evNote} ${ratingNote}${warningNote}`;
}

export function analyzeParlay(
  input: string,
  catalog: KalshiBet[] = []
): ParlayAnalysisResult {
  const rawLegs = splitParlayInput(input);

  if (rawLegs.length === 0) {
    return {
      legs: [],
      legCount: 0,
      matchedCount: 0,
      combinedAmericanOdds: 0,
      impliedProbability: 0,
      modelProbability: 0,
      edgePercent: 0,
      avgCorrelation: 0,
      avgLegEdge: 0,
      rating: 1,
      analysis:
        "Enter at least one leg — separate picks with commas, new lines, slashes, or “and”.",
      warnings: ["No legs detected in your input."],
    };
  }

  const legs = rawLegs.map((legText) => {
    const bet = matchLegToBet(legText, catalog);
    return buildLegAnalysis(legText, bet);
  });

  const matchedCount = legs.filter((leg) => leg.matched).length;
  const matchedRatio = matchedCount / legs.length;

  const impliedProbability = parlayImpliedProbability(
    legs.map((leg) => leg.impliedProbability)
  );
  const combinedAmericanOdds = decimalToAmerican(1 / Math.max(0.001, impliedProbability));

  const matchedBets = rawLegs
    .map((legText) => matchLegToBet(legText, catalog))
    .filter((b): b is KalshiBet => Boolean(b));

  const avgCorrelation = averagePairwiseCorrelation(matchedBets);
  const modelProbability = parlayModelProbability(
    legs.map((leg) => leg.modelProbability),
    avgCorrelation
  );
  const edgePercent = parlayExpectedValuePercent(
    modelProbability,
    legs.map((leg) => leg.americanOdds)
  );
  const avgLegEdge =
    legs.reduce((sum, leg) => sum + leg.edgePercent, 0) / legs.length;

  const warnings = buildWarnings(legs, avgCorrelation, matchedRatio);
  const rating = computeRating(legs, edgePercent, avgCorrelation, matchedRatio);
  const analysis = buildAnalysisParagraph(
    legs,
    edgePercent,
    modelProbability,
    impliedProbability,
    combinedAmericanOdds,
    avgCorrelation,
    rating,
    warnings
  );

  return {
    legs,
    legCount: legs.length,
    matchedCount,
    combinedAmericanOdds,
    impliedProbability,
    modelProbability,
    edgePercent,
    avgCorrelation,
    avgLegEdge,
    rating,
    analysis,
    warnings,
  };
}
