import type { Sport } from "@prisma/client";
import { getModel } from "@/models/rolling-average-model";
import { getRecentPlayerStats } from "@/services/stats";
import type { StatKey } from "@/services/stats/types";
import type { KalshiSportKey } from "@/types/kalshi";
import { fetchMarketsForSeries, parsePrice, type KalshiMarketRaw } from "./client";
import { PROP_SERIES } from "./model-scoring";
import {
  matchupFromEventTicker,
  parsePropTitle,
  teamAbbrFromMarketTicker,
} from "./prop-parser";

const SEARCH_CONCURRENCY = 4;
const MAX_PAGES_PER_SERIES = 6;

export const STAT_LABELS: Record<StatKey, string> = {
  hits: "Hits",
  strikeouts: "Strikeouts",
  homeRuns: "Home Runs",
  rbi: "RBI",
  totalBases: "Total Bases",
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
  passingYards: "Passing Yards",
  rushingYards: "Rushing Yards",
  receivingYards: "Receiving Yards",
  receptions: "Receptions",
  passingTouchdowns: "Passing TDs",
  touchdowns: "Touchdowns",
  anytimeTd: "Anytime TD",
  wins: "Wins",
};

export interface PlayerSearchStat {
  statKey: StatKey;
  label: string;
  /** Most recent game first */
  values: number[];
  gamesSampled: number;
  rollingAvg: number;
  opponentAdjusted: number;
  recentWeighted: number;
}

export interface PlayerSearchMarket {
  ticker: string;
  title: string;
  statKey: StatKey;
  label: string;
  line: number;
  yesAsk: number;
  yesBid: number;
  matchup: string;
  expiresAt: string;
  kalshiUrl: string;
}

export interface PlayerSearchResult {
  playerName: string;
  sport: KalshiSportKey;
  team: string | null;
  stats: PlayerSearchStat[];
  trendStatKey: StatKey | null;
  trendData: { game: string; value: number }[];
  markets: PlayerSearchMarket[];
}

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesPlayer(candidate: string, query: string): boolean {
  const c = normalize(candidate);
  const q = normalize(query);
  if (!q || !c) return false;
  if (c.includes(q) || q.includes(c)) return true;

  const cTokens = c.split(/\s+/);
  const qTokens = q.split(/\s+/);
  return qTokens.every((qt) => cTokens.some((ct) => ct.startsWith(qt)));
}

function mostCommon<T>(items: T[]): T {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  let best: T = items[0]!;
  let bestCount = 0;
  for (const [item, count] of counts) {
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }
  return best;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

interface MatchedProp {
  sport: KalshiSportKey;
  statKey: StatKey;
  playerName: string;
  market: KalshiMarketRaw;
  line: number;
}

/** Kalshi doesn't expose a player search endpoint, so we page through every
 * player-prop series, parse the player name out of each market title, and
 * keep the ones that fuzzy-match the query. */
async function findMatchingProps(query: string): Promise<MatchedProp[]> {
  const seriesEntries = (Object.keys(PROP_SERIES) as KalshiSportKey[]).flatMap(
    (sport) => PROP_SERIES[sport].map((entry) => ({ sport, ...entry }))
  );

  const perSeries = await mapWithConcurrency(
    seriesEntries,
    SEARCH_CONCURRENCY,
    async ({ sport, seriesTicker, statKey }) => {
      const markets = await fetchMarketsForSeries(seriesTicker, {
        maxPages: MAX_PAGES_PER_SERIES,
      });
      const matched: MatchedProp[] = [];
      for (const market of markets) {
        const parsed = parsePropTitle(market.title);
        if (!parsed || !matchesPlayer(parsed.playerName, query)) continue;
        matched.push({
          sport,
          statKey,
          playerName: parsed.playerName,
          market,
          line: parsed.line,
        });
      }
      return matched;
    }
  );

  return perSeries.flat();
}

export async function searchKalshiPlayer(
  query: string
): Promise<PlayerSearchResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const matches = await findMatchingProps(trimmed);
  if (matches.length === 0) return null;

  const playerName = mostCommon(matches.map((m) => m.playerName));
  const playerMatches = matches.filter((m) => m.playerName === playerName);
  const sport = mostCommon(playerMatches.map((m) => m.sport));
  const sportMatches = playerMatches.filter((m) => m.sport === sport);

  const team = teamAbbrFromMarketTicker(sportMatches[0]!.market.ticker, sport);

  const statKeys = Array.from(new Set(sportMatches.map((m) => m.statKey)));
  const model = getModel("rolling-average");

  const stats: PlayerSearchStat[] = [];
  for (const statKey of statKeys) {
    const series = await getRecentPlayerStats(sport, playerName, statKey, 12);
    if (!series || series.values.length === 0) continue;

    const output = model.predict({
      sport: sport as Sport,
      statKey,
      playerStats: series.values,
      opponentDefenseRank: 15,
      paceFactor: 100,
      line: series.values[0] ?? 0,
      marketType: "over",
    });

    stats.push({
      statKey,
      label: STAT_LABELS[statKey],
      values: series.values,
      gamesSampled: series.gamesSampled,
      rollingAvg: output.features.roll10 ?? 0,
      opponentAdjusted: output.features.opponentAdjusted ?? 0,
      recentWeighted: output.features.weighted ?? 0,
    });
  }

  if (stats.length === 0) return null;

  const trendStat =
    stats.find((s) => s.values.length >= stats[0]!.values.length) ?? stats[0]!;
  const trendData = [...trendStat.values]
    .reverse()
    .map((value, i) => ({ game: `G${i + 1}`, value }));

  const markets: PlayerSearchMarket[] = sportMatches.map(({ market, statKey, line }) => ({
    ticker: market.ticker,
    title: market.title,
    statKey,
    label: STAT_LABELS[statKey],
    line,
    yesAsk: parsePrice(market.yes_ask_dollars),
    yesBid: parsePrice(market.yes_bid_dollars),
    matchup: matchupFromEventTicker(market.event_ticker, sport),
    expiresAt: market.expected_expiration_time ?? market.close_time ?? "",
    kalshiUrl: `https://kalshi.com/markets/${market.ticker.toLowerCase()}`,
  }));

  return {
    playerName,
    sport,
    team,
    stats,
    trendStatKey: trendStat.statKey,
    trendData,
    markets,
  };
}
