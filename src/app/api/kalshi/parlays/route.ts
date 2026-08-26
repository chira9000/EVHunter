import { NextResponse } from "next/server";
import { isKalshiMockMode } from "@/lib/env";
import { analyzeParlay } from "@/services/kalshi/parlay-analysis";
import { fetchKalshiBestBets } from "@/services/kalshi/best-bets";
import { getMockKalshiBetsResponse } from "@/services/mock/kalshi-data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim() ?? "";

    const catalog = isKalshiMockMode()
      ? getMockKalshiBetsResponse().bets
      : (await fetchKalshiBestBets()).bets;

    const result = analyzeParlay(text, catalog);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to analyze parlay";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
