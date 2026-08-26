import type { KalshiSportKey } from "@/types/kalshi";
import type { StatKey, TeamForm } from "./types";

const SEARCH_BASE = "https://site.web.api.espn.com/apis/common/v3/search";
const CORE_BASE = "https://site.web.api.espn.com/apis/common/v3/sports";

const ESPN_SPORT: Partial<Record<KalshiSportKey, { path: string; league: string }>> = {
  NBA: { path: "basketball/nba", league: "nba" },
  NFL: { path: "football/nfl", league: "nfl" },
  MLB: { path: "baseball/mlb", league: "mlb" },
  SOCCER: { path: "soccer/eng.1", league: "eng.1" },
};

const NBA_STAT: Partial<Record<StatKey, string>> = {
  points: "points",
  rebounds: "totalRebounds",
  assists: "assists",
};

const NFL_STAT: Partial<Record<StatKey, string>> = {
  passingYards: "passingYards",
  rushingYards: "rushingYards",
  receivingYards: "receivingYards",
  receptions: "receptions",
  passingTouchdowns: "passingTouchdowns",
  touchdowns: "rushingTouchdowns",
  anytimeTd: "anytimeTd",
};

interface EspnSearchItem {
  id: string;
  displayName: string;
  sport?: string;
  league?: string;
}

interface EspnGamelog {
  labels?: string[];
  names?: string[];
  seasonTypes?: {
    categories?: { events?: { stats: string[] }[] }[];
  }[];
}

function currentSeason(): number {
  const m = new Date().getMonth();
  return m < 6 ? new Date().getFullYear() - 1 : new Date().getFullYear();
}

function parseNum(v: string | undefined): number {
  if (!v || v === "-") return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export async function searchEspnPlayerId(
  sport: KalshiSportKey,
  name: string
): Promise<string | null> {
  const config = ESPN_SPORT[sport];
  if (!config) return null;
  const { league } = config;
  const params = new URLSearchParams({
    query: name,
    limit: "8",
    type: "player",
  });
  const res = await fetch(`${SEARCH_BASE}?${params}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: EspnSearchItem[] };
  const items = data.items ?? [];
  const normalized = name.toLowerCase();
  const match = items.find(
    (i) =>
      i.league === league &&
      i.displayName.toLowerCase() === normalized
  );
  const fuzzy = items.find((i) => i.league === league);
  return (match ?? fuzzy)?.id ?? null;
}

function extractEspnValues(
  log: EspnGamelog,
  statKey: StatKey,
  limit: number
): number[] {
  const names = log.names ?? log.labels ?? [];
  const values: number[] = [];

  for (const seasonType of log.seasonTypes ?? []) {
    for (const category of seasonType.categories ?? []) {
      for (const event of category.events ?? []) {
        const row = Object.fromEntries(
          names.map((n, i) => [n, event.stats[i]])
        );
        let v = 0;
        if (statKey === "points") v = parseNum(row.points);
        else if (statKey === "rebounds") v = parseNum(row.totalRebounds);
        else if (statKey === "assists") v = parseNum(row.assists);
        else if (statKey === "passingYards") v = parseNum(row.passingYards);
        else if (statKey === "rushingYards") v = parseNum(row.rushingYards);
        else if (statKey === "receivingYards") v = parseNum(row.receivingYards);
        else if (statKey === "receptions") v = parseNum(row.receptions);
        else if (statKey === "passingTouchdowns")
          v = parseNum(row.passingTouchdowns);
        else if (statKey === "touchdowns")
          v =
            parseNum(row.rushingTouchdowns) + parseNum(row.receivingTouchdowns);
        else if (statKey === "anytimeTd")
          v =
            parseNum(row.rushingTouchdowns) +
            parseNum(row.receivingTouchdowns) +
            parseNum(row.passingTouchdowns);
        values.push(v);
      }
    }
  }

  return values.slice(0, limit);
}

export async function fetchEspnGameLog(
  sport: KalshiSportKey,
  playerId: string,
  statKey: StatKey,
  limit = 12
): Promise<number[]> {
  if (sport === "NBA" && !NBA_STAT[statKey]) return [];
  if (sport === "NFL" && !NFL_STAT[statKey]) return [];
  const config = ESPN_SPORT[sport];
  if (!config) return [];

  const { path } = config;
  const res = await fetch(
    `${CORE_BASE}/${path}/athletes/${playerId}/gamelog`,
    { signal: AbortSignal.timeout(12_000) }
  );
  if (!res.ok) return [];
  const log = (await res.json()) as EspnGamelog;
  return extractEspnValues(log, statKey, limit);
}

/** Recent team form from ESPN schedule (last N completed games). */
export async function fetchEspnTeamForm(
  sport: KalshiSportKey,
  teamAbbr: string,
  limit = 10
): Promise<TeamForm | null> {
  const config = ESPN_SPORT[sport];
  if (!config) return null;
  const { path, league } = config;
  const teamsRes = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${path}/teams`,
    { signal: AbortSignal.timeout(12_000) }
  );
  if (!teamsRes.ok) return null;
  const teamsData = (await teamsRes.json()) as {
    sports?: { leagues?: { teams?: { team: { abbreviation: string; id: string } }[] }[] }[];
  };
  const teams =
    teamsData.sports?.[0]?.leagues?.[0]?.teams?.map((t) => t.team) ?? [];
  const abbr = teamAbbr.toUpperCase();
  const team = teams.find((t) => t.abbreviation.toUpperCase() === abbr);
  if (!team) return null;

  const season = currentSeason();
  const schedRes = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${team.id}/schedule?season=${season}`,
    { signal: AbortSignal.timeout(12_000) }
  );
  if (!schedRes.ok) return null;
  const sched = (await schedRes.json()) as {
    events?: {
      competitions?: {
        status: { type: { completed: boolean } };
        competitors: { homeAway: string; winner?: boolean; score?: string; team: { abbreviation: string } }[];
      }[];
    }[];
  };

  let wins = 0;
  let losses = 0;
  let marginSum = 0;
  let games = 0;

  for (const event of (sched.events ?? []).reverse()) {
    const comp = event.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    const us = comp.competitors.find(
      (c) => c.team.abbreviation.toUpperCase() === abbr
    );
    const them = comp.competitors.find((c) => c !== us);
    if (!us || !them) continue;
    const ourScore = parseNum(us.score);
    const theirScore = parseNum(them.score);
    if (us.winner) wins++;
    else losses++;
    marginSum += ourScore - theirScore;
    games++;
    if (games >= limit) break;
  }

  if (games === 0) return null;
  return {
    sport,
    teamAbbr: abbr,
    wins,
    losses,
    winRate: wins / games,
    avgMargin: marginSum / games,
    gamesSampled: games,
  };
}

export function isEspnPlayerStat(sport: KalshiSportKey, statKey: StatKey): boolean {
  if (sport === "NBA") return Boolean(NBA_STAT[statKey]);
  if (sport === "NFL") return Boolean(NFL_STAT[statKey]);
  return false;
}
