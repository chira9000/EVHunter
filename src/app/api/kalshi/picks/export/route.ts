import { NextRequest, NextResponse } from "next/server";
import { getRecommendedPicksForExport } from "@/services/kalshi/pick-tracker";
import { KALSHI_SPORT_KEYS, type KalshiSportKey, type RecommendedPick } from "@/types/kalshi";

const CSV_COLUMNS = [
  "recommendedAt",
  "sport",
  "betType",
  "selection",
  "matchup",
  "marketTicker",
  "playerName",
  "statType",
  "line",
  "modelProbability",
  "edgePercent",
  "yesAsk",
  "gameDate",
  "expiresAt",
  "status",
  "result",
  "settledAt",
] as const satisfies readonly (keyof RecommendedPick)[];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function parseSports(param: string | null): KalshiSportKey[] | undefined {
  if (!param) return undefined;
  const valid = new Set<string>(KALSHI_SPORT_KEYS);
  const sports = param
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => valid.has(s)) as KalshiSportKey[];
  return sports.length > 0 ? sports : undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const hoursParam = Number(searchParams.get("hours"));
  const sinceHours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : 24;
  const sports = parseSports(searchParams.get("sport"));

  const picks = await getRecommendedPicksForExport({ sinceHours, sports });

  const lines = [
    CSV_COLUMNS.join(","),
    ...picks.map((pick) =>
      CSV_COLUMNS.map((col) => csvEscape(pick[col])).join(",")
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="kalshi-picks-${sinceHours}h-${Date.now()}.csv"`,
    },
  });
}
