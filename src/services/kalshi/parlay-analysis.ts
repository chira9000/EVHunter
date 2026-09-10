import { decimalToAmerican, parlayImpliedProbability } from "@/lib/betting-math";
import type { KalshiBet, ParlayAnalysisResult, ParlayLegAnalysis } from "@/types/kalshi";
import { calibrateProbability, type CalibrationModel } from "./calibration";
import { parsePropTitle, type ParsedKalshiProp } from "./prop-parser";
import {
  scoreParlay,
  type ParlayScoringLegInput,
  type ParlayScoringWeights,
} from "./parlay-scoring";

const DEFAULT_IMPLIED = 0.52;
// Neutral (no assumed edge) rather than negative — an unmatched leg shouldn't be
// treated as a bad bet by default, just an unknown one.
const DEFAULT_MODEL = 0.52;
const DEFAULT_CONFIDENCE = 0.45;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const MONEYLINE_NOISE = /\b(money ?line|ml|to win|straight up|su|win|the)\b/g;

/** Strip odds/qualifier noise so "Bucks ML" and "Milwaukee Bucks" reduce to comparable team text. */
function normalizeTeamText(value: string): string {
  return normalizeText(value)
    .replace(MONEYLINE_NOISE, " ")
    .replace(/\b\d{2,4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the two team strings share a distinctive word (city or nickname), e.g. "bucks" in both. */
function teamNamesOverlap(a: string, b: string): boolean {
  const wordsA = a.split(" ").filter((w) => w.length >= 3);
  const wordsB = new Set(b.split(" ").filter((w) => w.length >= 3));
  return wordsA.some((w) => wordsB.has(w));
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

  // "Name 3+ stat"
  const plusMatch = text.match(/^(.+?)\s+(\d+)\+\s*(.+)$/i);
  if (plusMatch) {
    const playerName = plusMatch[1]!.trim();
    const line = parseInt(plusMatch[2]!, 10);
    const statRaw = plusMatch[3]!.trim().toLowerCase();
    if (!Number.isFinite(line)) return null;
    return parsePropTitle(`${playerName}: ${line}+ ${statRaw}`);
  }

  // "Name over 2.5 stat" / "Name o2 stat" — over/under phrasing, converted to
  // the equivalent Kalshi "N+" threshold (over 2.5 → 3+, over 2 → 3+).
  const overMatch = text.match(/^(.+?)\s+(?:over|o)\s*(\d+(?:\.5)?)\s+(.+)$/i);
  if (overMatch) {
    const playerName = overMatch[1]!.trim();
    const rawLine = parseFloat(overMatch[2]!);
    const statRaw = overMatch[3]!.trim().toLowerCase();
    if (!Number.isFinite(rawLine)) return null;
    const line = Number.isInteger(rawLine) ? rawLine + 1 : Math.ceil(rawLine);
    return parsePropTitle(`${playerName}: ${line}+ ${statRaw}`);
  }

  return null;
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

  const normTeam = normalizeTeamText(legText);
  for (const bet of bets) {
    if (bet.betType !== "moneyline") continue;
    const team = normalizeTeamText(bet.selection);
    if (normTeam === team || normTeam.includes(team) || team.includes(normTeam)) return bet;
    if (teamNamesOverlap(normTeam, team)) return bet;
    if (bet.matchup) {
      const matchupTeam = normalizeTeamText(bet.matchup.split("@")[0] ?? "");
      if (matchupTeam && (normTeam.includes(matchupTeam) || teamNamesOverlap(normTeam, matchupTeam))) {
        return bet;
      }
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

function buildLegAnalysis(
  legText: string,
  bet: KalshiBet | undefined,
  calibrationModel: CalibrationModel | null
): ParlayLegAnalysis {
  const impliedProbability = bet?.yesAsk ?? bet?.impliedProbability ?? DEFAULT_IMPLIED;
  const rawModelProbability = bet?.modelProbability ?? DEFAULT_MODEL;
  const edgePercent = bet?.edgePercent ?? 0;
  const confidence = bet?.confidence ?? DEFAULT_CONFIDENCE;
  const americanOdds =
    bet?.americanOdds ?? decimalToAmerican(1 / Math.max(0.05, impliedProbability));

  // Calibration needs a known sport/betType segment — only meaningful for matched legs.
  const calibration = bet
    ? calibrateProbability(bet, rawModelProbability, calibrationModel)
    : {
        calibratedProbability: rawModelProbability,
        calibrationConfidence: 0,
        sampleSize: 0,
      };

  return {
    raw: legText,
    label: legLabel(legText, bet),
    matched: Boolean(bet),
    sport: bet?.sport,
    statType: bet?.statType,
    impliedProbability,
    modelProbability: rawModelProbability,
    calibratedProbability: calibration.calibratedProbability,
    calibrationConfidence: calibration.calibrationConfidence,
    calibrationSampleSize: calibration.sampleSize,
    poorlyCalibrated: false, // finalized by scoreParlay, which knows the shift threshold
    edgePercent,
    confidence,
    americanOdds,
  };
}

function buildAnalysisSummary(
  legs: ParlayLegAnalysis[],
  score: ReturnType<typeof scoreParlay>
): string {
  const pct = (p: number) => `${(p * 100).toFixed(1)}%`;
  const legSummary = legs.map((leg) => leg.label).join(", ");

  const evNote =
    score.expectedValue > 0
      ? `Calibrated hit probability of ${pct(score.parlayProbability)} clears the ${pct(score.breakEvenProbability)} break-even implied by the ${score.offeredOddsSource === "user" ? "offered" : "estimated"} price, for +${(score.expectedValue * 100).toFixed(1)}% EV.`
      : `Calibrated hit probability of ${pct(score.parlayProbability)} falls short of the ${pct(score.breakEvenProbability)} break-even implied by the ${score.offeredOddsSource === "user" ? "offered" : "estimated"} price (${(score.expectedValue * 100).toFixed(1)}% EV).`;

  const correlationNote =
    score.correlationRisk === "high"
      ? "Correlation risk is high — legs are tightly linked, so the true joint probability is less certain than independence would suggest."
      : score.correlationRisk === "medium"
        ? "Correlation risk is moderate — some overlap between legs limits diversification."
        : "Correlation risk is low — legs are largely independent.";

  const qualityNote = `Quality score ${score.qualityScore.toFixed(3)} (${score.qualityLabel}).`;

  return `This ${legs.length}-leg parlay combines ${legSummary}. ${evNote} ${correlationNote} ${qualityNote}`;
}

export interface AnalyzeParlayOptions {
  /** Decimal odds actually offered for the parlay; falls back to the product of leg American odds. */
  offeredDecimalOdds?: number;
  /** Empirical calibration model from settled pick history — omit/null to use raw model probabilities untouched. */
  calibrationModel?: CalibrationModel | null;
  /** Override any subset of the default scoring weights (see parlay-scoring.ts) — the hook for backtest-tuned values. */
  weights?: Partial<ParlayScoringWeights>;
}

function emptyResult(analysis: string, warnings: string[]): ParlayAnalysisResult {
  const score = scoreParlay([]);
  return {
    legs: [],
    legCount: 0,
    matchedCount: 0,
    combinedAmericanOdds: 0,
    impliedProbability: 0,
    parlayProbability: 0,
    breakEvenProbability: 0,
    decimalOdds: score.decimalOdds,
    offeredOddsSource: score.offeredOddsSource,
    expectedValue: 0,
    edgePercent: 0,
    avgCorrelation: 0,
    avgLegEdge: 0,
    avgLegConfidence: 0,
    pairwiseCorrelations: [],
    correlationRisk: "low",
    correlationFactor: score.correlationFactor,
    confidenceFactor: score.confidenceFactor,
    qualityScore: 0,
    qualityLabel: "poor",
    weightsUsed: score.weightsUsed,
    analysis,
    warnings,
  };
}

/**
 * Analyze a free-text parlay: match each leg to a live market, calibrate its
 * model probability against settled history, estimate pairwise correlation,
 * and score the combo. Leg parsing/matching is unchanged from before — only
 * the scoring methodology (calibration, correlation-aware EV, quality score)
 * is new; see parlay-scoring.ts and calibration.ts.
 */
export function analyzeParlay(
  input: string,
  catalog: KalshiBet[] = [],
  options: AnalyzeParlayOptions = {}
): ParlayAnalysisResult {
  const rawLegs = splitParlayInput(input);

  if (rawLegs.length === 0) {
    return emptyResult(
      "Enter at least one leg — separate picks with commas, new lines, slashes, or “and”.",
      ["No legs detected in your input."]
    );
  }

  const calibrationModel = options.calibrationModel ?? null;

  const matches = rawLegs.map((legText) => ({
    legText,
    bet: matchLegToBet(legText, catalog),
  }));
  const legs = matches.map(({ legText, bet }) =>
    buildLegAnalysis(legText, bet, calibrationModel)
  );

  const impliedProbability = parlayImpliedProbability(
    legs.map((leg) => leg.impliedProbability)
  );

  const scoringLegs: ParlayScoringLegInput[] = legs.map((leg, i) => ({
    raw: leg.raw,
    label: leg.label,
    matched: leg.matched,
    sport: leg.sport,
    betType: matches[i]!.bet?.betType,
    statType: leg.statType,
    rawModelProbability: leg.modelProbability,
    calibratedProbability: leg.calibratedProbability,
    calibrationConfidence: leg.calibrationConfidence,
    calibrationSampleSize: leg.calibrationSampleSize,
    modelConfidence: leg.confidence,
    impliedProbability: leg.impliedProbability,
    americanOdds: leg.americanOdds,
    bet: matches[i]!.bet,
  }));

  const score = scoreParlay(scoringLegs, {
    offeredDecimalOdds: options.offeredDecimalOdds,
    weights: options.weights,
  });

  // Fold the finalized poorlyCalibrated flag (computed inside scoreParlay, which
  // knows the shift threshold) back onto the legs we return to callers.
  const finalizedLegs: ParlayLegAnalysis[] = legs.map((leg, i) => ({
    ...leg,
    poorlyCalibrated: score.legs[i]!.poorlyCalibrated,
  }));

  const combinedAmericanOdds = decimalToAmerican(score.decimalOdds);
  const avgCorrelation =
    score.pairwiseCorrelations.length > 0
      ? score.pairwiseCorrelations.reduce((s, p) => s + p.correlation, 0) /
        score.pairwiseCorrelations.length
      : 0;
  const avgLegEdge =
    legs.reduce((sum, leg) => sum + leg.edgePercent, 0) / legs.length;

  const analysis = buildAnalysisSummary(finalizedLegs, score);

  return {
    legs: finalizedLegs,
    legCount: score.legCount,
    matchedCount: score.matchedCount,
    combinedAmericanOdds,
    impliedProbability,
    parlayProbability: score.parlayProbability,
    breakEvenProbability: score.breakEvenProbability,
    decimalOdds: score.decimalOdds,
    offeredOddsSource: score.offeredOddsSource,
    expectedValue: score.expectedValue,
    edgePercent: score.expectedValue * 100,
    avgCorrelation,
    avgLegEdge,
    avgLegConfidence: score.avgLegConfidence,
    pairwiseCorrelations: score.pairwiseCorrelations,
    correlationRisk: score.correlationRisk,
    correlationFactor: score.correlationFactor,
    confidenceFactor: score.confidenceFactor,
    qualityScore: score.qualityScore,
    qualityLabel: score.qualityLabel,
    weightsUsed: score.weightsUsed,
    analysis,
    warnings: score.warnings,
  };
}
