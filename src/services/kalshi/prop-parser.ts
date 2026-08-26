import type { KalshiSportKey } from "@/types/kalshi";
import type { StatKey } from "@/services/stats/types";

export interface ParsedKalshiProp {
  playerName: string;
  line: number;
  statKey: StatKey;
  marketLabel: string;
}

const STAT_ALIASES: Record<string, StatKey> = {
  hits: "hits",
  hit: "hits",
  strikeouts: "strikeouts",
  strikeout: "strikeouts",
  "home runs": "homeRuns",
  "home run": "homeRuns",
  homers: "homeRuns",
  rbi: "rbi",
  rbis: "rbi",
  "total bases": "totalBases",
  points: "points",
  rebounds: "rebounds",
  assists: "assists",
  "passing yards": "passingYards",
  "rushing yards": "rushingYards",
  "receiving yards": "receivingYards",
  receptions: "receptions",
  "passing touchdowns": "passingTouchdowns",
  touchdowns: "touchdowns",
  "anytime touchdown": "anytimeTd",
  "anytime td": "anytimeTd",
};

/** Parse Kalshi prop titles like "Trea Turner: 3+ hits?" */
export function parsePropTitle(title: string): ParsedKalshiProp | null {
  const plusMatch = title.match(/^(.+?):\s*(\d+)\+\s*(.+?)\??$/i);
  if (plusMatch) {
    const playerName = plusMatch[1]!.trim();
    const line = parseInt(plusMatch[2]!, 10);
    const statRaw = plusMatch[3]!.trim().toLowerCase();
    const statKey = STAT_ALIASES[statRaw];
    if (!statKey || !Number.isFinite(line)) return null;
    return {
      playerName,
      line,
      statKey,
      marketLabel: `${line}+ ${statRaw}`,
    };
  }

  const willMatch = title.match(
    /^Will (.+?) (?:record |score |get )?(\d+)\+ (.+?)\??$/i
  );
  if (willMatch) {
    const playerName = willMatch[1]!.trim();
    const line = parseInt(willMatch[2]!, 10);
    const statRaw = willMatch[3]!.trim().toLowerCase();
    const statKey = STAT_ALIASES[statRaw];
    if (!statKey || !Number.isFinite(line)) return null;
    return { playerName, line, statKey, marketLabel: `${line}+ ${statRaw}` };
  }

  return null;
}

/** Event tickers embed matchup codes e.g. CWSPHI → CWS @ PHI */
export function matchupFromEventTicker(
  eventTicker: string,
  sport: KalshiSportKey
): string {
  const parts = eventTicker.split("-");
  const code = parts[1] ?? "";
  const match = code.match(/\d{2}[A-Z]{3}\d{2}(.+)/i);
  const teams = match?.[1];
  if (!teams || teams.length < 4) return eventTicker;

  const mid = Math.floor(teams.length / 2);
  const away = teams.slice(0, mid);
  const home = teams.slice(mid);
  return `${away} @ ${home} (${sport})`;
}

export function teamAbbrFromMarketTicker(ticker: string): string | null {
  const parts = ticker.split("-");
  const last = parts[parts.length - 1];
  if (!last) return null;
  const m = last.match(/^([A-Z]{2,4})/);
  return m?.[1] ?? last.slice(0, 3);
}
