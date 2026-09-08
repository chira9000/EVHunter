import { NextResponse } from "next/server";
import { isKalshiMockMode } from "@/lib/env";
import { americanToDecimal } from "@/lib/betting-math";
import { analyzeParlay } from "@/services/kalshi/parlay-analysis";
import { fetchKalshiBestBets } from "@/services/kalshi/best-bets";
import { getPickCalibrationModel } from "@/services/kalshi/pick-tracker";
import { getMockKalshiBetsResponse } from "@/services/mock/kalshi-data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      text?: string;
      offeredAmericanOdds?: number;
    };
    const text = body.text?.trim() ?? "";
    const offeredDecimalOdds =
      typeof body.offeredAmericanOdds === "number" &&
      Number.isFinite(body.offeredAmericanOdds) &&
      body.offeredAmericanOdds !== 0
        ? americanToDecimal(body.offeredAmericanOdds)
        : undefined;

    const catalog = isKalshiMockMode()
      ? getMockKalshiBetsResponse().bets
      : (await fetchKalshiBestBets()).bets;

    // Falls back to an empty (uncalibrated) model if no settled history is available yet.
    const calibrationModel = isKalshiMockMode()
      ? null
      : await getPickCalibrationModel();

    const result = analyzeParlay(text, catalog, {
      offeredDecimalOdds,
      calibrationModel,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to analyze parlay";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
