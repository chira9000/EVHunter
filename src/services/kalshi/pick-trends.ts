import type { RecommendedPick } from "@/types/kalshi";
import {
  describeSegment,
  segmentsFor,
  type DimensionSegment,
  type ExclusionRule,
  type TrendDimension,
} from "./portfolio-select";

export type TrendWindow = "1d" | "2d" | "all";

export interface TrendSegmentStat {
  dimension: TrendDimension;
  value: string;
  settled: number;
  wins: number;
  losses: number;
  hitRate: number;
}

export interface TrendWindowReport {
  window: TrendWindow;
  label: string;
  settled: number;
  wins: number;
  losses: number;
  hitRate: number;
  /** Segments whose miss rate crossed the flag threshold for this window. */
  flagged: TrendSegmentStat[];
  summary: string;
  bullets: string[];
}

export interface PickTrendReport {
  generatedAt: string;
  windows: TrendWindowReport[];
  /** Union of flagged segments across windows — applied as hard filters on the next portfolio selection. */
  exclusionRules: ExclusionRule[];
}

const WINDOW_DEFS: { window: TrendWindow; label: string; hours: number | null }[] = [
  { window: "1d", label: "Last 24 hours", hours: 24 },
  { window: "2d", label: "Last 48 hours", hours: 48 },
  { window: "all", label: "All-time", hours: null },
];

/** Minimum settled sample and max hit-rate to flag a segment as a losing trend, per window. */
const FLAG_RULES: Partial<Record<TrendDimension, Partial<Record<TrendWindow, { minSettled: number; maxHitRate: number }>>>> = {
  // Whole-sport exclusions are high blast-radius — only ever flagged on a large all-time sample.
  sport: { all: { minSettled: 12, maxHitRate: 0.4 } },
  sport_betType: {
    "1d": { minSettled: 3, maxHitRate: 0.34 },
    "2d": { minSettled: 4, maxHitRate: 0.38 },
    all: { minSettled: 6, maxHitRate: 0.4 },
  },
  statType: {
    "1d": { minSettled: 3, maxHitRate: 0.34 },
    "2d": { minSettled: 4, maxHitRate: 0.38 },
    all: { minSettled: 6, maxHitRate: 0.4 },
  },
  edgeBucket: {
    "1d": { minSettled: 4, maxHitRate: 0.34 },
    "2d": { minSettled: 5, maxHitRate: 0.38 },
    all: { minSettled: 8, maxHitRate: 0.4 },
  },
  probabilityBucket: {
    "1d": { minSettled: 4, maxHitRate: 0.34 },
    "2d": { minSettled: 5, maxHitRate: 0.38 },
    all: { minSettled: 8, maxHitRate: 0.4 },
  },
};

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function picksSettledWithin(
  picks: RecommendedPick[],
  hours: number | null,
  now: Date
): RecommendedPick[] {
  const settled = picks.filter((p) => p.status === "won" || p.status === "lost");
  if (hours == null) return settled;
  const cutoff = now.getTime() - hours * 60 * 60 * 1000;
  return settled.filter((p) => {
    const settledAt = new Date(p.settledAt ?? "").getTime();
    return !Number.isNaN(settledAt) && settledAt >= cutoff;
  });
}

function aggregateSegments(picks: RecommendedPick[]): Map<string, TrendSegmentStat> {
  const map = new Map<string, TrendSegmentStat>();

  for (const pick of picks) {
    const segments: DimensionSegment[] = segmentsFor(pick);
    for (const seg of segments) {
      const key = `${seg.dimension}:${seg.value}`;
      const entry = map.get(key) ?? {
        dimension: seg.dimension,
        value: seg.value,
        settled: 0,
        wins: 0,
        losses: 0,
        hitRate: 0,
      };
      entry.settled += 1;
      if (pick.status === "won") entry.wins += 1;
      else entry.losses += 1;
      map.set(key, entry);
    }
  }

  for (const entry of map.values()) {
    entry.hitRate = entry.settled > 0 ? entry.wins / entry.settled : 0;
  }
  return map;
}

function flaggedSegmentsFor(
  window: TrendWindow,
  segments: Map<string, TrendSegmentStat>
): TrendSegmentStat[] {
  const flagged: TrendSegmentStat[] = [];
  for (const seg of segments.values()) {
    const rule = FLAG_RULES[seg.dimension]?.[window];
    if (!rule) continue;
    if (seg.settled < rule.minSettled) continue;
    if (seg.hitRate > rule.maxHitRate) continue;
    flagged.push(seg);
  }
  return flagged.sort((a, b) => a.hitRate - b.hitRate || b.settled - a.settled);
}

function bulletFor(seg: TrendSegmentStat): string {
  const label = describeSegment(seg.dimension, seg.value);
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capitalized}: ${seg.wins}/${seg.settled} (${pct(seg.hitRate)}) — excluded from next batch`;
}

function summaryFor(
  label: string,
  settled: number,
  wins: number,
  hitRate: number,
  flaggedCount: number
): string {
  if (settled === 0) return `${label}: no settled picks yet.`;
  const base = `${label}: ${wins}/${settled} hit (${pct(hitRate)}).`;
  if (flaggedCount === 0) return `${base} No concerning trends.`;
  return `${base} ${flaggedCount} losing trend${flaggedCount > 1 ? "s" : ""} flagged.`;
}

function buildExclusionRules(windows: TrendWindowReport[]): ExclusionRule[] {
  const byKey = new Map<string, ExclusionRule>();

  for (const report of windows) {
    for (const seg of report.flagged) {
      const key = `${seg.dimension}:${seg.value}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.windows.push(report.window);
        if (seg.settled >= existing.settled) {
          existing.hitRate = seg.hitRate;
          existing.settled = seg.settled;
        }
      } else {
        byKey.set(key, {
          dimension: seg.dimension,
          value: seg.value,
          hitRate: seg.hitRate,
          settled: seg.settled,
          windows: [report.window],
          reason: describeSegment(seg.dimension, seg.value),
        });
      }
    }
  }

  return [...byKey.values()];
}

/** Analyze 1-day, 2-day, and all-time settlement history for losing trends. */
export function analyzePickTrends(
  picks: RecommendedPick[],
  now: Date = new Date()
): PickTrendReport {
  const windows: TrendWindowReport[] = WINDOW_DEFS.map(({ window, label, hours }) => {
    const settledPicks = picksSettledWithin(picks, hours, now);
    const segments = aggregateSegments(settledPicks);
    const flagged = flaggedSegmentsFor(window, segments);
    const wins = settledPicks.filter((p) => p.status === "won").length;
    const losses = settledPicks.length - wins;
    const hitRate = settledPicks.length > 0 ? wins / settledPicks.length : 0;

    return {
      window,
      label,
      settled: settledPicks.length,
      wins,
      losses,
      hitRate,
      flagged,
      summary: summaryFor(label, settledPicks.length, wins, hitRate, flagged.length),
      bullets: flagged.map(bulletFor),
    };
  });

  return {
    generatedAt: now.toISOString(),
    windows,
    exclusionRules: buildExclusionRules(windows),
  };
}
