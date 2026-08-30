import { NextRequest, NextResponse } from "next/server";
import { getRecommendedPicks } from "@/services/kalshi/pick-tracker";
import { KALSHI_SPORT_KEYS } from "@/types/kalshi";
import type { KalshiSportKey, RecommendedPick } from "@/types/kalshi";

const CSV_COLUMNS: (keyof RecommendedPick)[] = [
  "sport",
  "betType",
  "matchup",
  "marketTitle",
  "playerName",
  "statType",
  "line",
  "selection",
  "modelProbability",
  "edgePercent",
  "yesAsk",
  "gameDate",
  "recommendedAt",
  "expiresAt",
  "status",
  "result",
  "settledAt",
  "marketTicker",
];

function toCsvValue(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function picksToCsv(picks: RecommendedPick[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = picks.map((pick) =>
    CSV_COLUMNS.map((col) => toCsvValue(pick[col])).join(",")
  );
  return [header, ...rows].join("\n");
}

function yesterdayIsoDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const sportParam = searchParams.get("sport")?.toUpperCase();
  const sport =
    sportParam && (KALSHI_SPORT_KEYS as string[]).includes(sportParam)
      ? (sportParam as KalshiSportKey)
      : undefined;

  let date = searchParams.get("date") ?? undefined;
  if (!date && searchParams.get("range") === "yesterday") {
    date = yesterdayIsoDate();
  }

  const picks = await getRecommendedPicks();
  const filtered = picks.filter((pick) => {
    if (sport && pick.sport !== sport) return false;
    if (date && !pick.recommendedAt.startsWith(date)) return false;
    return true;
  });

  const csv = picksToCsv(filtered);
  const filename = ["evhunter-picks", sport, date]
    .filter(Boolean)
    .join("-")
    .concat(".csv");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
