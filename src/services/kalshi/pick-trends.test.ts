import { describe, expect, it } from "vitest";
import type { RecommendedPick } from "@/types/kalshi";
import { bearsActiveExclusion } from "./portfolio-select";
import { analyzePickTrends } from "./pick-trends";

const NOW = new Date("2026-06-10T12:00:00.000Z");

function pick(overrides: Partial<RecommendedPick> = {}): RecommendedPick {
  return {
    marketTicker: `T-${Math.random()}`,
    sport: "MLB",
    betType: "player_prop",
    selection: "Pitcher 5+ strikeouts",
    matchup: "NYY @ BOS",
    marketTitle: "Pitcher: 5+ strikeouts",
    statType: "strikeouts",
    modelProbability: 0.55,
    edgePercent: 6,
    yesAsk: 0.5,
    gameDate: "2026-06-10",
    expiresAt: "2026-06-10T20:00:00.000Z",
    recommendedAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    status: "lost",
    settledAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    result: "no",
    ...overrides,
  };
}

function settledHoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

describe("analyzePickTrends", () => {
  it("reports zero settled picks with no flags when history is empty", () => {
    const report = analyzePickTrends([], NOW);
    expect(report.windows.map((w) => w.settled)).toEqual([0, 0, 0]);
    expect(report.exclusionRules).toHaveLength(0);
  });

  it("flags a statType losing badly within the last day and excludes it", () => {
    const picks = [
      pick({ status: "lost", settledAt: settledHoursAgo(1) }),
      pick({ status: "lost", settledAt: settledHoursAgo(2) }),
      pick({ status: "lost", settledAt: settledHoursAgo(3) }),
      pick({ status: "won", settledAt: settledHoursAgo(4) }),
    ];
    const report = analyzePickTrends(picks, NOW);

    const oneDay = report.windows.find((w) => w.window === "1d")!;
    expect(oneDay.settled).toBe(4);
    expect(oneDay.flagged.some((f) => f.dimension === "statType" && f.value === "strikeouts")).toBe(true);

    const rule = report.exclusionRules.find(
      (r) => r.dimension === "statType" && r.value === "strikeouts"
    );
    expect(rule).toBeDefined();
    expect(
      bearsActiveExclusion(
        { sport: "MLB", betType: "player_prop", statType: "strikeouts", edgePercent: 6, modelProbability: 0.55 },
        report.exclusionRules
      )
    ).toBeDefined();
  });

  it("does not flag a segment that is winning", () => {
    const picks = [
      pick({ status: "won", settledAt: settledHoursAgo(1) }),
      pick({ status: "won", settledAt: settledHoursAgo(2) }),
      pick({ status: "won", settledAt: settledHoursAgo(3) }),
      pick({ status: "lost", settledAt: settledHoursAgo(4) }),
    ];
    const report = analyzePickTrends(picks, NOW);
    const oneDay = report.windows.find((w) => w.window === "1d")!;
    expect(oneDay.flagged).toHaveLength(0);
    expect(report.exclusionRules).toHaveLength(0);
  });

  it("excludes picks outside the settlement window from that window's stats", () => {
    const picks = [
      pick({ status: "lost", settledAt: settledHoursAgo(30) }),
      pick({ status: "lost", settledAt: settledHoursAgo(30) }),
    ];
    const report = analyzePickTrends(picks, NOW);
    const oneDay = report.windows.find((w) => w.window === "1d")!;
    const allTime = report.windows.find((w) => w.window === "all")!;
    expect(oneDay.settled).toBe(0);
    expect(allTime.settled).toBe(2);
  });

  it("does not flag a whole sport on a small sample", () => {
    const picks = Array.from({ length: 5 }, () =>
      pick({ status: "lost", sport: "NFL", statType: undefined, betType: "moneyline" })
    );
    const report = analyzePickTrends(picks, NOW);
    expect(report.exclusionRules.some((r) => r.dimension === "sport")).toBe(false);
  });

  it("flags a whole sport once the all-time sample is large and consistently bad", () => {
    const picks = Array.from({ length: 14 }, (_, i) =>
      pick({
        status: i < 12 ? "lost" : "won",
        sport: "NFL",
        statType: undefined,
        betType: "moneyline",
        settledAt: settledHoursAgo(200),
      })
    );
    const report = analyzePickTrends(picks, NOW);
    const rule = report.exclusionRules.find((r) => r.dimension === "sport" && r.value === "NFL");
    expect(rule).toBeDefined();
  });
});
