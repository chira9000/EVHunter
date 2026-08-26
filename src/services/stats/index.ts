import type { KalshiSportKey } from "@/types/kalshi";
import {
  fetchEspnGameLog,
  fetchEspnTeamForm,
  isEspnPlayerStat,
  searchEspnPlayerId,
} from "./espn-client";
import {
  fetchMlbGameLog,
  isMlbStat,
  searchMlbPlayerId,
} from "./mlb-statsapi";
import type { PlayerStatSeries, StatKey, TeamForm } from "./types";

const playerCache = new Map<string, PlayerStatSeries>();
const teamCache = new Map<string, TeamForm>();

function cacheKey(
  sport: KalshiSportKey,
  player: string,
  statKey: StatKey
): string {
  return `${sport}:${player.toLowerCase()}:${statKey}`;
}

export async function getRecentPlayerStats(
  sport: KalshiSportKey,
  playerName: string,
  statKey: StatKey,
  limit = 12
): Promise<PlayerStatSeries | null> {
  const key = cacheKey(sport, playerName, statKey);
  const cached = playerCache.get(key);
  if (cached) return cached;

  let values: number[] = [];

  if (sport === "MLB" && isMlbStat(statKey)) {
    const id = await searchMlbPlayerId(playerName);
    if (id) values = await fetchMlbGameLog(id, statKey, limit);
  } else if (isEspnPlayerStat(sport, statKey)) {
    const id = await searchEspnPlayerId(sport, playerName);
    if (id) values = await fetchEspnGameLog(sport, id, statKey, limit);
  }

  if (values.length === 0) return null;

  const series: PlayerStatSeries = {
    sport,
    playerName,
    statKey,
    values,
    gamesSampled: values.length,
    season: new Date().getFullYear(),
  };
  playerCache.set(key, series);
  return series;
}

export async function getTeamRecentForm(
  sport: KalshiSportKey,
  teamAbbr: string
): Promise<TeamForm | null> {
  const key = `${sport}:${teamAbbr.toUpperCase()}`;
  const cached = teamCache.get(key);
  if (cached) return cached;

  const form = await fetchEspnTeamForm(sport, teamAbbr);
  if (form) teamCache.set(key, form);
  return form;
}

export function hitRateOverLine(values: number[], line: number): number {
  if (values.length === 0) return 0;
  const clears = values.filter((v) => v >= line).length;
  return clears / values.length;
}
