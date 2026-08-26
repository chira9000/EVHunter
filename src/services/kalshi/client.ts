const DEFAULT_BASE = "https://api.elections.kalshi.com/trade-api/v2";

export interface KalshiMarketRaw {
  ticker: string;
  event_ticker: string;
  title: string;
  yes_sub_title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  volume_24h_fp?: string;
  expected_expiration_time?: string;
  close_time?: string;
  status?: string;
  /** Present after determination: yes | no | scalar */
  result?: string;
  settlement_ts?: string;
}

interface MarketsPage {
  markets: KalshiMarketRaw[];
  cursor?: string;
}

import type { KalshiSportKey } from "@/types/kalshi";

/** Game-winner series; World Cup & Wimbledon first for active tournaments */
export const KALSHI_GAME_SERIES: { seriesTicker: string; sport: KalshiSportKey }[] = [
  { seriesTicker: "KXWCGAME", sport: "SOCCER" },
  { seriesTicker: "KXATPMATCH", sport: "TENNIS" },
  { seriesTicker: "KXWTAMATCH", sport: "TENNIS" },
  { seriesTicker: "KXMLBGAME", sport: "MLB" },
  { seriesTicker: "KXNFLGAME", sport: "NFL" },
  { seriesTicker: "KXNBAGAME", sport: "NBA" },
  { seriesTicker: "KXEPLGAME", sport: "SOCCER" },
  { seriesTicker: "KXMLSGAME", sport: "SOCCER" },
  { seriesTicker: "KXUCLGAME", sport: "SOCCER" },
  { seriesTicker: "KXLALIGAGAME", sport: "SOCCER" },
  { seriesTicker: "KXBUNDESLIGAGAME", sport: "SOCCER" },
  { seriesTicker: "KXSERIEAGAME", sport: "SOCCER" },
  { seriesTicker: "KXLIGUE1GAME", sport: "SOCCER" },
  { seriesTicker: "KXUEFAGAME", sport: "SOCCER" },
  { seriesTicker: "KXATPGAME", sport: "TENNIS" },
  { seriesTicker: "KXWTAGAME", sport: "TENNIS" },
];

function baseUrl(): string {
  return process.env.KALSHI_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_BASE;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchKalshiPage(
  url: string,
  retries = 4
): Promise<MarketsPage> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(20_000),
    });

    if (res.status === 429) {
      await sleep(800 * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Kalshi API error ${res.status}`);
    }

    return (await res.json()) as MarketsPage;
  }

  throw new Error("Kalshi API rate limited (429)");
}

export async function fetchMarketsForSeries(
  seriesTicker: string,
  options?: { maxPages?: number }
): Promise<KalshiMarketRaw[]> {
  const maxPages = options?.maxPages ?? 20;
  const all: KalshiMarketRaw[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      series_ticker: seriesTicker,
      status: "open",
      limit: "200",
    });
    if (cursor) params.set("cursor", cursor);

    try {
      const data = await fetchKalshiPage(`${baseUrl()}/markets?${params}`);
      all.push(...(data.markets ?? []));
      cursor = data.cursor;
      if (!cursor || (data.markets?.length ?? 0) === 0) break;
      await sleep(120);
    } catch {
      break;
    }
  }

  return all;
}

/** Single market by ticker (any status — used for settlement result). */
export async function fetchMarketByTicker(
  ticker: string
): Promise<KalshiMarketRaw | null> {
  try {
    const res = await fetch(`${baseUrl()}/markets/${encodeURIComponent(ticker)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { market?: KalshiMarketRaw };
    return data.market ?? null;
  } catch {
    return null;
  }
}

export function parsePrice(value?: string): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
