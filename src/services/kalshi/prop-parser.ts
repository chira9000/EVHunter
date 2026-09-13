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

/** Known team codes, used to split concatenated matchup codes like NYMNYY → NYM + NYY. */
const TEAM_ABBREVIATIONS: Partial<Record<KalshiSportKey, Set<string>>> = {
  MLB: new Set([
    "ARI", "ATL", "BAL", "BOS", "CHC", "CWS", "CIN", "CLE", "COL", "DET",
    "HOU", "KC", "LAA", "LAD", "MIA", "MIL", "MIN", "NYM", "NYY", "OAK",
    "ATH", "PHI", "PIT", "SD", "SEA", "SF", "STL", "TB", "TEX", "TOR", "WSH",
  ]),
  NBA: new Set([
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
    "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
    "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
  ]),
  NFL: new Set([
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN",
    "DET", "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA",
    "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB",
    "TEN", "WAS",
  ]),
};

/** Find a known team code at the start of `fragment`, trying longest first. */
function matchTeamPrefix(
  fragment: string,
  sport: KalshiSportKey
): string | null {
  const dict = TEAM_ABBREVIATIONS[sport];
  if (!dict) return null;
  for (const len of [4, 3, 2]) {
    const candidate = fragment.slice(0, len);
    if (dict.has(candidate)) return candidate;
  }
  return null;
}

/** Event tickers embed matchup codes e.g. ...DENKC → DEN @ KC */
export function matchupFromEventTicker(
  eventTicker: string,
  sport: KalshiSportKey
): string {
  const parts = eventTicker.split("-");
  const code = parts[1] ?? "";
  const match = code.match(/^\d{2}[A-Z]{3}\d{2}\d*([A-Z]+)$/i);
  const teams = match?.[1];
  if (!teams || teams.length < 4) return eventTicker;

  const dict = TEAM_ABBREVIATIONS[sport];
  if (dict) {
    for (const len of [2, 3, 4]) {
      const away = teams.slice(0, len);
      const home = teams.slice(len);
      if (home.length >= 2 && dict.has(away) && dict.has(home)) {
        return `${away} @ ${home} (${sport})`;
      }
    }
  }

  const mid = Math.floor(teams.length / 2);
  const away = teams.slice(0, mid);
  const home = teams.slice(mid);
  return `${away} @ ${home} (${sport})`;
}

/**
 * Team abbreviation for a market's own selection/player. For prop tickers the
 * final segment is the numeric line (e.g. "...-NYYAJUDGE99-3"), so fall back
 * to the segment before it; pass `sport` to resolve the code precisely via
 * the known team list instead of a blind character-count guess.
 */
export function teamAbbrFromMarketTicker(
  ticker: string,
  sport?: KalshiSportKey
): string | null {
  const parts = ticker.split("-");
  let last = parts[parts.length - 1];
  if (last && /^\d+$/.test(last)) {
    last = parts[parts.length - 2];
  }
  if (!last) return null;

  if (sport) {
    const matched = matchTeamPrefix(last, sport);
    if (matched) return matched;
  }

  const m = last.match(/^([A-Z]{2,4})/);
  return m?.[1] ?? last.slice(0, 3);
}
