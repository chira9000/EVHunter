import {
  expectedValuePercent,
  impliedProbabilityToAmerican,
  noVigFairProbabilities,
  noVigFairProbabilitiesMulti,
} from "@/lib/betting-math";
import type { KalshiBet, KalshiBetType, KalshiSportKey } from "@/types/kalshi";
import {
  fetchMarketsForSeries,
  KALSHI_GAME_SERIES,
  parsePrice,
  type KalshiMarketRaw,
} from "./client";
import { matchupFromEventTicker, parsePropTitle } from "./prop-parser";
import {
  PROP_SERIES,
  scoreMoneyline,
  scorePlayerProp,
} from "./model-scoring";
import { selectKalshiPortfolio } from "./portfolio-select";
import { getActivePickExclusionRules } from "./pick-tracker";

/** Upcoming game window (hours) for daily slate */
const DAILY_HORIZON_HOURS = 96;
const SCORE_CONCURRENCY = 8;

function parseExpiration(market: KalshiMarketRaw): Date | null {
  const raw = market.expected_expiration_time ?? market.close_time;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isDailyUpcoming(market: KalshiMarketRaw): boolean {
  const now = Date.now();
  const exp = parseExpiration(market);
  if (!exp) return false;
  const ms = exp.getTime() - now;
  return ms > 0 && ms <= DAILY_HORIZON_HOURS * 60 * 60 * 1000;
}

function eventKey(market: KalshiMarketRaw): string {
  return market.event_ticker || market.ticker.replace(/-[^-]+$/, "");
}

function selectionFromTicker(ticker: string): string {
  const parts = ticker.split("-");
  return parts[parts.length - 1] ?? ticker;
}

function matchupFromTitle(title: string): string {
  const winnerMatch = title.match(/^(.+?)\s+Winner\??$/i);
  if (winnerMatch) return winnerMatch[1]!.trim();
  const tennisMatch = title.match(/win the (.+?):\s*.+ match\?/i);
  if (tennisMatch) return tennisMatch[1]!.trim();
  const willMatch = title.match(/Will (.+?) win the (.+?) Pro Football game\?/i);
  if (willMatch) return `${willMatch[2]!.trim()} (${willMatch[1]!.trim()})`;
  return title;
}

function selectionLabel(
  title: string,
  ticker: string,
  market?: KalshiMarketRaw
): string {
  if (market?.yes_sub_title) {
    return market.yes_sub_title.replace(/^Reg Time:\s*/i, "").trim();
  }
  const code = selectionFromTicker(ticker);
  const willMatch = title.match(/^Will (.+?) win/i);
  if (willMatch) return willMatch[1]!.trim();
  const prop = parsePropTitle(title);
  if (prop) return `${prop.playerName} ${prop.marketLabel}`;
  return code;
}

function gameDateFromMarket(market: KalshiMarketRaw): string {
  const exp = parseExpiration(market);
  return exp ? exp.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function kalshiMarketUrl(ticker: string): string {
  return `https://kalshi.com/markets/${ticker.toLowerCase()}`;
}

function midPriceFor(market: KalshiMarketRaw): number {
  const yesAsk = parsePrice(market.yes_ask_dollars);
  const yesBid = parsePrice(market.yes_bid_dollars);
  if (yesAsk <= 0 || yesAsk >= 1) return 0;
  if (yesBid > 0 && yesAsk > yesBid) return (yesBid + yesAsk) / 2;
  return yesAsk;
}

function statsSource(sport: KalshiSportKey, betType: KalshiBetType): KalshiBet["statsSource"] {
  if (betType === "player_prop" && sport === "MLB") return "mlb-statsapi";
  return "espn";
}

function baseBetFields(
  market: KalshiMarketRaw,
  sport: KalshiSportKey,
  betType: KalshiBetType,
  matchup: string
): Omit<
  KalshiBet,
  | "fairProbability"
  | "modelProbability"
  | "confidence"
  | "hitRate"
  | "edgePercent"
  | "fairAmericanOdds"
  | "playerName"
  | "statType"
  | "line"
  | "volatility"
  | "injuryUncertainty"
  | "expectedInnings"
> {
  const yesAsk = parsePrice(market.yes_ask_dollars);
  const yesBid = parsePrice(market.yes_bid_dollars);
  const midPrice = midPriceFor(market);
  const exp = parseExpiration(market);

  return {
    id: market.ticker,
    sport,
    betType,
    eventTicker: market.event_ticker,
    marketTicker: market.ticker,
    matchup,
    selection: selectionLabel(market.title, market.ticker, market),
    marketTitle: market.title,
    yesAsk,
    yesBid,
    midPrice,
    impliedProbability: yesAsk,
    americanOdds: impliedProbabilityToAmerican(yesAsk),
    spreadPercent: (yesAsk - yesBid) * 100,
    volume24h: parseFloat(market.volume_24h_fp ?? "0") || 0,
    gameDate: gameDateFromMarket(market),
    expiresAt: exp?.toISOString() ?? "",
    kalshiUrl: kalshiMarketUrl(market.ticker),
    statsSource: statsSource(sport, betType),
  };
}

async function buildMoneylineBets(
  markets: KalshiMarketRaw[],
  sport: KalshiSportKey
): Promise<KalshiBet[]> {
  const byEvent = new Map<string, KalshiMarketRaw[]>();
  for (const m of markets) {
    if (!isDailyUpcoming(m)) continue;
    const key = eventKey(m);
    const list = byEvent.get(key) ?? [];
    list.push(m);
    byEvent.set(key, list);
  }

  const bets: KalshiBet[] = [];

  for (const [, group] of byEvent) {
    const withMid = group
      .map((m) => ({ m, mid: midPriceFor(m) }))
      .filter((x) => x.mid > 0 && x.mid < 1);
    if (withMid.length < 2) continue;

    if (sport === "SOCCER" && withMid.length >= 3) {
      const fairProbs = noVigFairProbabilitiesMulti(withMid.map((x) => x.mid));
      for (let i = 0; i < withMid.length; i++) {
        const side = withMid[i]!;
        const yesAsk = parsePrice(side.m.yes_ask_dollars);
        if (yesAsk <= 0 || yesAsk >= 1) continue;
        const fair = fairProbs[i]!;
        const noVigEdge = expectedValuePercent(
          fair,
          impliedProbabilityToAmerican(yesAsk)
        );
        const scored = await scoreMoneyline(side.m, sport, fair, noVigEdge);
        const base = baseBetFields(
          side.m,
          sport,
          "moneyline",
          matchupFromTitle(side.m.title)
        );
        bets.push({
          ...base,
          fairProbability: fair,
          modelProbability: scored.modelProbability,
          confidence: scored.confidence,
          hitRate: scored.hitRate,
          edgePercent: scored.edgePercent,
          fairAmericanOdds: scored.fairAmericanOdds,
          volatility: scored.volatility,
          injuryUncertainty: scored.injuryUncertainty,
        });
      }
      continue;
    }

    if (withMid.length < 2) continue;
    const a = withMid[0]!;
    const b = withMid[1]!;
    const { fairA } = noVigFairProbabilities(a.mid, b.mid);

    for (const side of [a, b]) {
      const yesAsk = parsePrice(side.m.yes_ask_dollars);
      if (yesAsk <= 0 || yesAsk >= 1) continue;
      const fair =
        side === a ? fairA : noVigFairProbabilities(b.mid, a.mid).fairA;
      const noVigEdge = expectedValuePercent(
        fair,
        impliedProbabilityToAmerican(yesAsk)
      );
      const scored = await scoreMoneyline(side.m, sport, fair, noVigEdge);
      const base = baseBetFields(
        side.m,
        sport,
        "moneyline",
        matchupFromTitle(side.m.title)
      );
      bets.push({
        ...base,
        fairProbability: fair,
        modelProbability: scored.modelProbability,
        confidence: scored.confidence,
        hitRate: scored.hitRate,
        edgePercent: scored.edgePercent,
        fairAmericanOdds: scored.fairAmericanOdds,
        volatility: scored.volatility,
        injuryUncertainty: scored.injuryUncertainty,
      });
    }
  }

  return bets;
}

async function buildPropBets(
  markets: KalshiMarketRaw[],
  sport: KalshiSportKey
): Promise<KalshiBet[]> {
  const daily = markets.filter((m) => isDailyUpcoming(m)).slice(0, 35);
  const bets: KalshiBet[] = [];

  for (let i = 0; i < daily.length; i += SCORE_CONCURRENCY) {
    const batch = daily.slice(i, i + SCORE_CONCURRENCY);
    const scored = await Promise.all(
      batch.map(async (m) => {
        const model = await scorePlayerProp(m, sport);
        if (!model) return null;
        const base = baseBetFields(
          m,
          sport,
          "player_prop",
          matchupFromEventTicker(m.event_ticker, sport)
        );
        const bet: KalshiBet = {
          ...base,
          fairProbability: model.modelProbability,
          modelProbability: model.modelProbability,
          confidence: model.confidence,
          hitRate: model.hitRate,
          edgePercent: model.edgePercent,
          fairAmericanOdds: model.fairAmericanOdds,
          playerName: model.playerName,
          statType: model.statType,
          line: model.line,
          volatility: model.volatility,
          injuryUncertainty: model.injuryUncertainty,
          expectedInnings: model.expectedInnings,
        };
        return bet;
      })
    );
    for (const b of scored) {
      if (b) bets.push(b);
    }
  }

  return bets;
}

export function rankKalshiBets(bets: KalshiBet[]): KalshiBet[] {
  return selectKalshiPortfolio(bets).bets;
}

const PROP_SERIES_CONCURRENCY = 3;

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

export async function fetchKalshiBestBets(): Promise<{
  bets: KalshiBet[];
  propsScored: number;
  moneylinesScored: number;
  filteredCount: number;
  survivorCount: number;
}> {
  const gameResults = await Promise.all(
    KALSHI_GAME_SERIES.map(async ({ seriesTicker, sport }) => {
      const markets = await fetchMarketsForSeries(seriesTicker, { maxPages: 6 });
      const ml = await buildMoneylineBets(markets, sport);
      return ml;
    })
  );

  const propSeries = (Object.keys(PROP_SERIES) as KalshiSportKey[]).flatMap((sport) =>
    PROP_SERIES[sport].map((entry) => ({ sport, ...entry }))
  );

  const propResults = await mapWithConcurrency(
    propSeries,
    PROP_SERIES_CONCURRENCY,
    async ({ sport, seriesTicker }) => {
      const markets = await fetchMarketsForSeries(seriesTicker, { maxPages: 5 });
      if (markets.length === 0) return [] as KalshiBet[];
      return buildPropBets(markets, sport);
    }
  );

  const all = [...gameResults.flat(), ...propResults.flat()];
  const exclusionRules = await getActivePickExclusionRules();
  const portfolio = selectKalshiPortfolio(all, exclusionRules);

  return {
    bets: portfolio.bets,
    propsScored: propResults.flat().length,
    moneylinesScored: gameResults.flat().length,
    filteredCount: portfolio.filteredCount,
    survivorCount: portfolio.survivorCount,
  };
}
