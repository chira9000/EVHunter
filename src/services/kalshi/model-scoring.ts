import type { Sport } from "@prisma/client";
import { expectedValuePercent, impliedProbabilityToAmerican } from "@/lib/betting-math";
import { getModel } from "@/models/rolling-average-model";
import {
  getRecentPlayerStats,
  getTeamRecentForm,
  hitRateOverLine,
} from "@/services/stats";
import {
  fetchMlbPitcherExpectedInnings,
  searchMlbPlayerId,
} from "@/services/stats/mlb-statsapi";
import type { StatKey } from "@/services/stats/types";
import type { KalshiSportKey } from "@/types/kalshi";
import { parsePrice, type KalshiMarketRaw } from "./client";
import { parsePropTitle, teamAbbrFromMarketTicker } from "./prop-parser";
import {
  computeInjuryUncertainty,
  computeVolatility,
} from "./portfolio-select";

export interface ModelScoredMarket {
  modelProbability: number;
  confidence: number;
  hitRate: number;
  edgePercent: number;
  fairAmericanOdds: number;
  volatility: number;
  injuryUncertainty: number;
  expectedInnings?: number;
  playerName?: string;
  statType?: string;
  line?: number;
}

function teamWinProbability(
  winRate: number,
  avgMargin: number,
  sport: KalshiSportKey
): number {
  const marginBoost =
    sport === "NBA"
      ? avgMargin * 0.015
      : sport === "NFL"
        ? avgMargin * 0.02
        : sport === "SOCCER"
          ? avgMargin * 0.008
          : sport === "TENNIS"
            ? avgMargin * 0.012
            : avgMargin * 0.01;
  const prob = 0.42 + winRate * 0.35 + marginBoost;
  return Math.min(0.82, Math.max(0.18, prob));
}

export async function scorePlayerProp(
  market: KalshiMarketRaw,
  sport: KalshiSportKey
): Promise<ModelScoredMarket | null> {
  const parsed = parsePropTitle(market.title);
  if (!parsed) return null;

  const yesAsk = parsePrice(market.yes_ask_dollars);
  if (yesAsk <= 0 || yesAsk >= 1) return null;

  const series = await getRecentPlayerStats(
    sport,
    parsed.playerName,
    parsed.statKey
  );
  if (!series || series.values.length < 3) return null;

  const model = getModel("rolling-average");
  const output = model.predict({
    sport: sport as Sport,
    statKey: parsed.statKey,
    playerStats: series.values,
    opponentDefenseRank: 15,
    paceFactor: 100,
    line: parsed.line - 0.5,
    marketType: "over",
  });

  const edgePercent = expectedValuePercent(
    output.trueProbability,
    impliedProbabilityToAmerican(yesAsk)
  );

  const volatility = computeVolatility(series.values);
  const injuryUncertainty = computeInjuryUncertainty(
    series.gamesSampled,
    output.confidence
  );

  let expectedInnings: number | undefined;
  if (sport === "MLB" && parsed.statKey === "strikeouts") {
    const id = await searchMlbPlayerId(parsed.playerName);
    if (id) expectedInnings = await fetchMlbPitcherExpectedInnings(id);
  }

  return {
    modelProbability: output.trueProbability,
    confidence: output.confidence,
    hitRate: hitRateOverLine(series.values, parsed.line),
    edgePercent,
    fairAmericanOdds: output.fairAmericanOdds,
    volatility,
    injuryUncertainty,
    expectedInnings,
    playerName: parsed.playerName,
    statType: parsed.statKey,
    line: parsed.line,
  };
}

export async function scoreMoneyline(
  market: KalshiMarketRaw,
  sport: KalshiSportKey,
  noVigFair: number,
  noVigEdge: number
): Promise<ModelScoredMarket> {
  const yesAsk = parsePrice(market.yes_ask_dollars);
  const catalog = sport === "SOCCER" || sport === "TENNIS";
  const abbr = catalog ? null : teamAbbrFromMarketTicker(market.ticker);
  let modelProbability = noVigFair;
  let confidence = catalog ? 0.45 : 0.5;
  let hitRate = 0;
  let form = null as Awaited<ReturnType<typeof getTeamRecentForm>>;

  if (abbr && !catalog) {
    form = await getTeamRecentForm(sport, abbr);
    if (form && form.gamesSampled >= 3) {
      modelProbability = teamWinProbability(
        form.winRate,
        form.avgMargin,
        sport
      );
      confidence = Math.min(0.85, 0.45 + form.gamesSampled * 0.04);
      hitRate = form.winRate;
    }
  }

  const edgePercent =
    yesAsk > 0 && yesAsk < 1
      ? catalog
        ? ((noVigFair - yesAsk) / yesAsk) * 100
        : expectedValuePercent(
            modelProbability,
            impliedProbabilityToAmerican(yesAsk)
          )
      : noVigEdge;

  const gamesSampled = form?.gamesSampled ?? 0;
  const volatility = form ? Math.min(1, Math.abs(form.avgMargin) / 20) : 0.4;
  const injuryUncertainty = computeInjuryUncertainty(gamesSampled, confidence);

  return {
    modelProbability,
    confidence,
    hitRate,
    edgePercent,
    fairAmericanOdds: impliedProbabilityToAmerican(modelProbability),
    volatility,
    injuryUncertainty,
  };
}

export const PROP_SERIES: Record<
  KalshiSportKey,
  { seriesTicker: string; statKey: StatKey }[]
> = {
  MLB: [
    { seriesTicker: "KXMLBHIT", statKey: "hits" },
    { seriesTicker: "KXMLBKS", statKey: "strikeouts" },
    { seriesTicker: "KXMLBHR", statKey: "homeRuns" },
    { seriesTicker: "KXMLBRBI", statKey: "rbi" },
    { seriesTicker: "KXMLBTB", statKey: "totalBases" },
  ],
  NBA: [
    { seriesTicker: "KXNBAPTS", statKey: "points" },
    { seriesTicker: "KXNBAREB", statKey: "rebounds" },
    { seriesTicker: "KXNBAAST", statKey: "assists" },
  ],
  NFL: [
    { seriesTicker: "KXNFLPASSYDS", statKey: "passingYards" },
    { seriesTicker: "KXNFLRSHYDS", statKey: "rushingYards" },
    { seriesTicker: "KXNFLRECYDS", statKey: "receivingYards" },
    { seriesTicker: "KXNFLREC", statKey: "receptions" },
    { seriesTicker: "KXNFLANYTD", statKey: "anytimeTd" },
    { seriesTicker: "KXNFLPASSTDS", statKey: "passingTouchdowns" },
    { seriesTicker: "KXNFLGAMETD", statKey: "touchdowns" },
  ],
  SOCCER: [],
  TENNIS: [],
};
