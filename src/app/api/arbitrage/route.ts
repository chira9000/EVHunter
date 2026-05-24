import { NextResponse } from "next/server";
import { findArbitrageOpportunities } from "@/services/arbitrage";

export async function GET() {
  const opportunities = findArbitrageOpportunities();
  return NextResponse.json({ opportunities });
}
