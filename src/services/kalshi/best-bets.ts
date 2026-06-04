import {
  expectedValuePercent,
  impliedProbabilityToAmerican,
  noVigFairProbabilities,
} from "@/lib/betting-math";
import type { KalshiBet, KalshiSportKey } from "@/types/kalshi";
import {
  fetchMarketsForSeries,
  KALSHI_GAME_SERIES,
  parsePrice,
  type KalshiMarketRaw,
} from "./client";

/** Upcoming game window (hours) for daily slate */
const DAILY_HORIZON_HOURS = 96;

function parseExpiration(market: KalshiMarketRaw): Date | null {
  const raw = market.expected_expiration_time ?? market.close_time;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isDailyUpcoming(market: KalshiMarketRaw, now = new Date()): boolean {
  const exp = parseExpiration(market);
  if (!exp) return false;
  const ms = exp.getTime() - now.getTime();
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
  const willMatch = title.match(/Will (.+?) win the (.+?) Pro Football game\?/i);
  if (willMatch) return `${willMatch[2]!.trim()} (${willMatch[1]!.trim()})`;
  return title;
}

function selectionLabel(title: string, ticker: string): string {
  const code = selectionFromTicker(ticker);
  const willMatch = title.match(/^Will (.+?) win/i);
  if (willMatch) return willMatch[1]!.trim();
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

function buildBetFromPair(
  market: KalshiMarketRaw,
  sport: KalshiSportKey,
  midA: number,
  midB: number,
  sideMid: number
): KalshiBet | null {
  const yesAsk = parsePrice(market.yes_ask_dollars);
  const yesBid = parsePrice(market.yes_bid_dollars);
  if (yesAsk <= 0 || yesAsk >= 1) return null;

  const midPrice = sideMid;
  if (midA <= 0 || midB <= 0) return null;

  const { fairA } = noVigFairProbabilities(midA, midB);
  const edgePercent = expectedValuePercent(fairA, impliedProbabilityToAmerican(yesAsk));
  const spreadPercent = (yesAsk - yesBid) * 100;

  const exp = parseExpiration(market);
  return {
    id: market.ticker,
    sport,
    eventTicker: market.event_ticker,
    marketTicker: market.ticker,
    matchup: matchupFromTitle(market.title),
    selection: selectionLabel(market.title, market.ticker),
    marketTitle: market.title,
    yesAsk,
    yesBid,
    midPrice,
    impliedProbability: yesAsk,
    fairProbability: fairA,
    edgePercent,
    americanOdds: impliedProbabilityToAmerican(yesAsk),
    fairAmericanOdds: impliedProbabilityToAmerican(fairA),
    spreadPercent,
    volume24h: parseFloat(market.volume_24h_fp ?? "0") || 0,
    gameDate: gameDateFromMarket(market),
    expiresAt: exp?.toISOString() ?? "",
    kalshiUrl: kalshiMarketUrl(market.ticker),
  };
}

function pairMarketsToBets(
  markets: KalshiMarketRaw[],
  sport: KalshiSportKey
): KalshiBet[] {
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
    if (group.length < 2) continue;

    const withMid = group
      .map((m) => ({ m, mid: midPriceFor(m) }))
      .filter((x) => x.mid > 0 && x.mid < 1);

    if (withMid.length < 2) continue;

    const a = withMid[0]!;
    const b = withMid[1]!;
    const betA = buildBetFromPair(a.m, sport, a.mid, b.mid, a.mid);
    const betB = buildBetFromPair(b.m, sport, b.mid, a.mid, b.mid);
    if (betA) bets.push(betA);
    if (betB) bets.push(betB);
  }

  return bets;
}

/**
 * Best Kalshi plays first (highest edge at the ask), rank 1, 2, 3… ascending down the page.
 */
export function rankKalshiBets(bets: KalshiBet[]): KalshiBet[] {
  return [...bets].sort((a, b) => {
    if (b.edgePercent !== a.edgePercent) return b.edgePercent - a.edgePercent;
    return a.sport.localeCompare(b.sport) || a.matchup.localeCompare(b.matchup);
  });
}

export async function fetchKalshiBestBets(): Promise<KalshiBet[]> {
  const all: KalshiBet[] = [];

  for (const { seriesTicker, sport } of Object.values(KALSHI_GAME_SERIES)) {
    const markets = await fetchMarketsForSeries(seriesTicker);
    all.push(...pairMarketsToBets(markets, sport));
  }

  return rankKalshiBets(all);
}

