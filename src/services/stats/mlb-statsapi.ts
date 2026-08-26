import type { StatKey } from "./types";

const BASE = "https://statsapi.mlb.com/api/v1";

const HITTING_STATS = new Set<StatKey>([
  "hits",
  "homeRuns",
  "rbi",
  "totalBases",
]);

const PITCHING_STATS = new Set<StatKey>(["strikeouts"]);

function currentSeason(): number {
  return new Date().getFullYear();
}

function statFromSplit(statKey: StatKey, stat: Record<string, number>): number {
  switch (statKey) {
    case "hits":
      return stat.hits ?? 0;
    case "homeRuns":
      return stat.homeRuns ?? 0;
    case "rbi":
      return stat.rbi ?? 0;
    case "totalBases":
      return stat.totalBases ?? 0;
    case "strikeouts":
      return stat.strikeOuts ?? 0;
    default:
      return 0;
  }
}

export async function searchMlbPlayerId(name: string): Promise<number | null> {
  const params = new URLSearchParams({ names: name });
  const res = await fetch(`${BASE}/people/search?${params}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { people?: { id: number; fullName: string }[] };
  const people = data.people ?? [];
  if (people.length === 0) return null;
  const normalized = name.toLowerCase();
  const exact = people.find((p) => p.fullName.toLowerCase() === normalized);
  return (exact ?? people[0])!.id;
}

export async function fetchMlbGameLog(
  playerId: number,
  statKey: StatKey,
  limit = 12
): Promise<number[]> {
  const group = PITCHING_STATS.has(statKey) ? "pitching" : "hitting";
  const season = currentSeason();
  const params = new URLSearchParams({
    stats: "gameLog",
    group,
    season: String(season),
  });
  const res = await fetch(`${BASE}/people/${playerId}/stats?${params}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    stats?: { splits?: { stat: Record<string, number> }[] }[];
  };
  const splits = data.stats?.[0]?.splits ?? [];
  const values = splits
    .map((s) => statFromSplit(statKey, s.stat))
    .filter((v) => Number.isFinite(v))
    .slice(-limit)
    .reverse();
  return values;
}

/** Rolling average innings pitched for MLB pitchers (last N starts). */
export async function fetchMlbPitcherExpectedInnings(
  playerId: number,
  limit = 5
): Promise<number | undefined> {
  const season = currentSeason();
  const params = new URLSearchParams({
    stats: "gameLog",
    group: "pitching",
    season: String(season),
  });
  const res = await fetch(`${BASE}/people/${playerId}/stats?${params}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as {
    stats?: { splits?: { stat: Record<string, string | number> }[] }[];
  };
  const splits = data.stats?.[0]?.splits ?? [];
  const innings = splits
    .map((s) => {
      const ip = s.stat.inningsPitched;
      if (typeof ip === "string") {
        const [whole, frac] = ip.split(".");
        const outs = frac ? parseInt(frac.charAt(0) ?? "0", 10) : 0;
        return parseInt(whole ?? "0", 10) + outs / 3;
      }
      if (typeof ip === "number") return ip;
      return 0;
    })
    .filter((v) => v > 0)
    .slice(-limit);
  if (innings.length === 0) return undefined;
  return innings.reduce((a, b) => a + b, 0) / innings.length;
}

export function isMlbStat(statKey: StatKey): boolean {
  return HITTING_STATS.has(statKey) || PITCHING_STATS.has(statKey);
}
