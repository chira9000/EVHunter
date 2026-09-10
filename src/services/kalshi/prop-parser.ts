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
  h: "hits",
  strikeouts: "strikeouts",
  strikeout: "strikeouts",
  k: "strikeouts",
  ks: "strikeouts",
  "k's": "strikeouts",
  so: "strikeouts",
  sos: "strikeouts",
  "home runs": "homeRuns",
  "home run": "homeRuns",
  homers: "homeRuns",
  homer: "homeRuns",
  hr: "homeRuns",
  hrs: "homeRuns",
  rbi: "rbi",
  rbis: "rbi",
  "total bases": "totalBases",
  tb: "totalBases",
  points: "points",
  point: "points",
  pts: "points",
  pt: "points",
  rebounds: "rebounds",
  rebound: "rebounds",
  reb: "rebounds",
  rebs: "rebounds",
  boards: "rebounds",
  assists: "assists",
  assist: "assists",
  ast: "assists",
  asts: "assists",
  dimes: "assists",
  "passing yards": "passingYards",
  "pass yards": "passingYards",
  "passing yds": "passingYards",
  "pass yds": "passingYards",
  "rushing yards": "rushingYards",
  "rush yards": "rushingYards",
  "rushing yds": "rushingYards",
  "rush yds": "rushingYards",
  "receiving yards": "receivingYards",
  "rec yards": "receivingYards",
  "receiving yds": "receivingYards",
  "rec yds": "receivingYards",
  receptions: "receptions",
  reception: "receptions",
  rec: "receptions",
  recs: "receptions",
  catches: "receptions",
  catch: "receptions",
  "passing touchdowns": "passingTouchdowns",
  "pass touchdowns": "passingTouchdowns",
  "passing tds": "passingTouchdowns",
  "pass tds": "passingTouchdowns",
  "passing td": "passingTouchdowns",
  "pass td": "passingTouchdowns",
  touchdowns: "touchdowns",
  touchdown: "touchdowns",
  td: "touchdowns",
  tds: "touchdowns",
  "anytime touchdown": "anytimeTd",
  "anytime td": "anytimeTd",
  atd: "anytimeTd",
};

/** Resolve a free-text stat phrase to a StatKey, tolerating case, punctuation, and singular/plural drift. */
function resolveStatKey(raw: string): StatKey | undefined {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[.?]/g, "")
    .replace(/\s+/g, " ");
  if (STAT_ALIASES[cleaned]) return STAT_ALIASES[cleaned];

  const noApostrophe = cleaned.replace(/['']/g, "");
  if (STAT_ALIASES[noApostrophe]) return STAT_ALIASES[noApostrophe];

  const singular = cleaned.endsWith("s") ? cleaned.slice(0, -1) : cleaned;
  if (STAT_ALIASES[singular]) return STAT_ALIASES[singular];

  const plural = `${cleaned}s`;
  if (STAT_ALIASES[plural]) return STAT_ALIASES[plural];

  return undefined;
}

/** Parse Kalshi prop titles like "Trea Turner: 3+ hits?" */
export function parsePropTitle(title: string): ParsedKalshiProp | null {
  const plusMatch = title.match(/^(.+?):\s*(\d+)\+\s*(.+?)\??$/i);
  if (plusMatch) {
    const playerName = plusMatch[1]!.trim();
    const line = parseInt(plusMatch[2]!, 10);
    const statRaw = plusMatch[3]!.trim().toLowerCase();
    const statKey = resolveStatKey(statRaw);
    if (!statKey || !Number.isFinite(line)) return null;
    return {
      playerName,
      line,
      statKey,
      marketLabel: `${line}+ ${statRaw}`,
    };
  }

  const willMatch = title.match(
    /^Will (.+?) (?:record |score |get |have )?(\d+)\+ (.+?)\??$/i
  );
  if (willMatch) {
    const playerName = willMatch[1]!.trim();
    const line = parseInt(willMatch[2]!, 10);
    const statRaw = willMatch[3]!.trim().toLowerCase();
    const statKey = resolveStatKey(statRaw);
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
