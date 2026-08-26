import { cacheGet, cacheSet } from "@/lib/redis";
import type {
  KalshiBet,
  KalshiSportKey,
  PickHitRateStats,
  RecommendedPick,
  SportHitRate,
} from "@/types/kalshi";
import { fetchMarketByTicker } from "./client";

const STORE_KEY = "kalshi:recommended-picks";
const STORE_TTL_SEC = 60 * 60 * 24 * 45; // 45 days
const MAX_PICKS = 500;
/** Wait this long after market expiry before polling Kalshi for a result. */
const SETTLE_GRACE_MS = 90 * 60 * 1000;
const SETTLE_BATCH = 12;
const RECENT_LIMIT = 25;

export function betToRecommendedPick(
  bet: KalshiBet,
  recommendedAt = new Date().toISOString()
): RecommendedPick {
  return {
    marketTicker: bet.marketTicker,
    sport: bet.sport,
    betType: bet.betType,
    selection: bet.selection,
    matchup: bet.matchup,
    marketTitle: bet.marketTitle,
    playerName: bet.playerName,
    statType: bet.statType,
    line: bet.line,
    modelProbability: bet.modelProbability,
    edgePercent: bet.edgePercent,
    yesAsk: bet.yesAsk,
    gameDate: bet.gameDate,
    expiresAt: bet.expiresAt,
    recommendedAt,
    status: "pending",
  };
}

/** Upsert portfolio bets into the tracked pick store (dedupe by marketTicker). */
export function mergeRecommendedPicks(
  existing: RecommendedPick[],
  bets: KalshiBet[],
  now = new Date()
): RecommendedPick[] {
  const byTicker = new Map(existing.map((p) => [p.marketTicker, p]));
  const recommendedAt = now.toISOString();

  for (const bet of bets) {
    const prev = byTicker.get(bet.marketTicker);
    if (prev) {
      if (prev.status !== "pending") continue;
      byTicker.set(bet.marketTicker, {
        ...prev,
        selection: bet.selection,
        matchup: bet.matchup,
        marketTitle: bet.marketTitle,
        modelProbability: bet.modelProbability,
        edgePercent: bet.edgePercent,
        yesAsk: bet.yesAsk,
        expiresAt: bet.expiresAt || prev.expiresAt,
        gameDate: bet.gameDate || prev.gameDate,
      });
      continue;
    }
    byTicker.set(bet.marketTicker, betToRecommendedPick(bet, recommendedAt));
  }

  const merged = [...byTicker.values()].sort((a, b) =>
    b.recommendedAt.localeCompare(a.recommendedAt)
  );
  return merged.slice(0, MAX_PICKS);
}

export function applySettlementResult(
  pick: RecommendedPick,
  result: string | undefined | null,
  settledAt = new Date().toISOString()
): RecommendedPick {
  const normalized = (result ?? "").toLowerCase();
  if (normalized === "yes") {
    return { ...pick, status: "won", result: "yes", settledAt };
  }
  if (normalized === "no") {
    return { ...pick, status: "lost", result: "no", settledAt };
  }
  return pick;
}

export function isReadyToSettle(pick: RecommendedPick, now = Date.now()): boolean {
  if (pick.status !== "pending") return false;
  if (!pick.expiresAt) return false;
  const exp = new Date(pick.expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return now >= exp + SETTLE_GRACE_MS;
}

export function computePickHitRateStats(
  picks: RecommendedPick[],
  recentLimit = RECENT_LIMIT
): PickHitRateStats {
  let wins = 0;
  let losses = 0;
  let pending = 0;
  const bySportAcc: Partial<
    Record<KalshiSportKey, { settled: number; wins: number }>
  > = {};

  for (const p of picks) {
    if (p.status === "pending") {
      pending += 1;
      continue;
    }
    if (p.status === "void") continue;

    const sportBucket = bySportAcc[p.sport] ?? { settled: 0, wins: 0 };
    sportBucket.settled += 1;
    if (p.status === "won") {
      wins += 1;
      sportBucket.wins += 1;
    } else if (p.status === "lost") {
      losses += 1;
    }
    bySportAcc[p.sport] = sportBucket;
  }

  const settled = wins + losses;
  const bySport: Partial<Record<KalshiSportKey, SportHitRate>> = {};
  for (const [sport, bucket] of Object.entries(bySportAcc) as [
    KalshiSportKey,
    { settled: number; wins: number },
  ][]) {
    bySport[sport] = {
      settled: bucket.settled,
      wins: bucket.wins,
      hitRate: bucket.settled > 0 ? bucket.wins / bucket.settled : 0,
    };
  }

  const recent = picks
    .filter((p) => p.status === "won" || p.status === "lost")
    .sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? ""))
    .slice(0, recentLimit);

  return {
    settled,
    wins,
    losses,
    pending,
    hitRate: settled > 0 ? wins / settled : 0,
    bySport,
    recent,
  };
}

async function loadPicks(): Promise<RecommendedPick[]> {
  const stored = await cacheGet<RecommendedPick[]>(STORE_KEY);
  return Array.isArray(stored) ? stored : [];
}

async function savePicks(picks: RecommendedPick[]): Promise<void> {
  await cacheSet(STORE_KEY, picks, STORE_TTL_SEC);
}

export async function recordRecommendedPicks(bets: KalshiBet[]): Promise<void> {
  if (bets.length === 0) return;
  const existing = await loadPicks();
  const merged = mergeRecommendedPicks(existing, bets);
  await savePicks(merged);
}

export async function settleRecommendedPicks(options?: {
  fetchMarket?: (ticker: string) => Promise<{ result?: string } | null>;
  now?: Date;
}): Promise<{ checked: number; settled: number }> {
  const fetchMarket = options?.fetchMarket ?? fetchMarketByTicker;
  const now = options?.now ?? new Date();
  const picks = await loadPicks();
  const ready = picks.filter((p) => isReadyToSettle(p, now.getTime()));
  if (ready.length === 0) {
    return { checked: 0, settled: 0 };
  }

  const byTicker = new Map(picks.map((p) => [p.marketTicker, p]));
  let settled = 0;
  const batch = ready.slice(0, SETTLE_BATCH);

  for (const pick of batch) {
    const market = await fetchMarket(pick.marketTicker);
    if (!market) continue;
    const updated = applySettlementResult(
      pick,
      market.result,
      now.toISOString()
    );
    if (updated.status !== pick.status) {
      byTicker.set(pick.marketTicker, updated);
      settled += 1;
    }
  }

  if (settled > 0) {
    await savePicks(
      [...byTicker.values()].sort((a, b) =>
        b.recommendedAt.localeCompare(a.recommendedAt)
      )
    );
  }

  return { checked: batch.length, settled };
}

export async function getPickHitRateStats(): Promise<PickHitRateStats> {
  const picks = await loadPicks();
  return computePickHitRateStats(picks);
}

/** Record portfolio, settle due picks, return aggregate stats. */
export async function syncRecommendedPickTracking(
  bets: KalshiBet[]
): Promise<PickHitRateStats> {
  await recordRecommendedPicks(bets);
  await settleRecommendedPicks();
  return getPickHitRateStats();
}
