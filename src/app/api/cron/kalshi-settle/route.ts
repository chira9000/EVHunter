import { NextRequest, NextResponse } from "next/server";
import { env, isKalshiMockMode } from "@/lib/env";
import { settleRecommendedPicks, getPickHitRateStats } from "@/services/kalshi/pick-tracker";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isKalshiMockMode()) {
    return NextResponse.json({
      ok: true,
      mock: true,
      ...(await getPickHitRateStats()),
    });
  }

  try {
    const result = await settleRecommendedPicks();
    const stats = await getPickHitRateStats();
    return NextResponse.json({ ok: true, ...result, hitRate: stats });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Settlement failed" },
      { status: 500 }
    );
  }
}
