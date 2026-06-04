const DEFAULT_BASE = "https://api.elections.kalshi.com/trade-api/v2";

export interface KalshiMarketRaw {
  ticker: string;
  event_ticker: string;
  title: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  volume_24h_fp?: string;
  expected_expiration_time?: string;
  close_time?: string;
  status?: string;
}

interface MarketsPage {
  markets: KalshiMarketRaw[];
  cursor?: string;
}

export const KALSHI_GAME_SERIES: Record<
  "MLB" | "NFL" | "NBA",
  { seriesTicker: string; sport: "MLB" | "NFL" | "NBA" }
> = {
  MLB: { seriesTicker: "KXMLBGAME", sport: "MLB" },
  NFL: { seriesTicker: "KXNFLGAME", sport: "NFL" },
  NBA: { seriesTicker: "KXNBAGAME", sport: "NBA" },
};

function baseUrl(): string {
  return process.env.KALSHI_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_BASE;
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

    const res = await fetch(`${baseUrl()}/markets?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Kalshi API error ${res.status} for ${seriesTicker}`);
    }

    const data = (await res.json()) as MarketsPage;
    all.push(...(data.markets ?? []));
    cursor = data.cursor;
    if (!cursor || (data.markets?.length ?? 0) === 0) break;
  }

  return all;
}

export function parsePrice(value?: string): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
