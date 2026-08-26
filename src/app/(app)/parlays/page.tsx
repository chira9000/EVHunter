"use client";

import { ParlayAnalyzer } from "@/components/bets/parlay-analyzer";

export default function ParlaysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parlay Analyzer</h1>
        <p className="text-sm text-zinc-500">
          Paste a combo you built — get a model-backed paragraph analysis and a 1–10
          rating based on leg edge, correlation, and parlay EV.
        </p>
      </div>
      <ParlayAnalyzer />
    </div>
  );
}
