import { env, isMockMode } from "@/lib/env";
import { cacheGet, cacheSet } from "@/lib/redis";
import { sleep } from "@/lib/utils";
import type { Sport } from "@prisma/client";

export interface OddsApiEvent {
  id: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  bookmakers: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: { name: string; price: number; point?: number }[];
    }[];
  }[];
}

const RATE_LIMIT_DELAY_MS = 200;

export class OddsApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl =
      env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com/v4";
    this.apiKey = env.ODDS_API_KEY ?? "";
  }

  private sportKey(sport: Sport): string {
    const map: Record<Sport, string> = {
      NBA: "basketball_nba",
      NFL: "americanfootball_nfl",
      MLB: "baseball_mlb",
      NHL: "icehockey_nhl",
      NCAAF: "americanfootball_ncaaf",
      NCAAB: "basketball_ncaab",
      MLS: "soccer_usa_mls",
      EPL: "soccer_epl",
    };
    return map[sport];
  }

  async fetchOdds(sport: Sport, markets = "h2h,spreads,totals"): Promise<OddsApiEvent[]> {
    if (isMockMode()) {
      return this.mockOdds(sport);
    }

    const cacheKey = `odds:${sport}:${markets}`;
    const cached = await cacheGet<OddsApiEvent[]>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/sports/${this.sportKey(sport)}/odds?apiKey=${this.apiKey}&regions=us&markets=${markets}&oddsFormat=american`;
    const res = await fetch(url);
    if (res.status === 429) {
      await sleep(2000);
      return this.fetchOdds(sport, markets);
    }
    if (!res.ok) throw new Error(`Odds API error: ${res.status}`);
    const data = (await res.json()) as OddsApiEvent[];
    await cacheSet(cacheKey, data, 120);
    await sleep(RATE_LIMIT_DELAY_MS);
    return data;
  }

  private mockOdds(sport: Sport): OddsApiEvent[] {
    return [
      {
        id: `mock-${sport}-1`,
        sport,
        homeTeam: "Home Team",
        awayTeam: "Away Team",
        commenceTime: new Date(Date.now() + 86400000).toISOString(),
        bookmakers: [
          {
            key: "draftkings",
            title: "DraftKings",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Home Team", price: -150 },
                  { name: "Away Team", price: 130 },
                ],
              },
            ],
          },
        ],
      },
    ];
  }
}

export const oddsApiClient = new OddsApiClient();
