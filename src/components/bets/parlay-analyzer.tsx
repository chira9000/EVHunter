"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { ParlayAnalysisResult } from "@/types/kalshi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAmericanOdds, formatEvPercent } from "@/lib/betting-math";

const EXAMPLE =
  "Jayson Tatum 28+ points, Milwaukee Bucks ML, Aaron Judge 1+ hits";

function ratingColor(rating: number): string {
  if (rating >= 8) return "text-emerald-400";
  if (rating >= 6) return "text-lime-400";
  if (rating >= 4) return "text-amber-400";
  return "text-red-400";
}

function ratingLabel(rating: number): string {
  if (rating >= 8) return "Strong";
  if (rating >= 6) return "Solid";
  if (rating >= 4) return "Mixed";
  return "Weak";
}

export function ParlayAnalyzer() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParlayAnalysisResult | null>(null);

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kalshi/parlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as ParlayAnalysisResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your parlay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type each leg on its own line or separate with commas…&#10;e.g. Tatum 28+ points, Bucks ML, Judge 1+ hits"
              rows={8}
              className="w-full resize-y rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={analyze} disabled={loading || !text.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Analyze parlay
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setText(EXAMPLE)}
                type="button"
              >
                Load example
              </Button>
            </div>
            <p className="text-xs text-zinc-600">
              Legs are matched against live Kalshi model edges when possible. Unmatched
              picks use neutral estimates.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-3">
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {!result && !loading && !error && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-zinc-600">
            Enter a combo and click Analyze to get a rating and breakdown.
          </div>
        )}

        {result && result.legCount > 0 && (
          <>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-6 p-6">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    Parlay rating
                  </p>
                  <p
                    className={cn(
                      "font-mono text-5xl font-bold tabular-nums",
                      ratingColor(result.rating)
                    )}
                  >
                    {result.rating.toFixed(1)}
                    <span className="text-2xl text-zinc-600">/10</span>
                  </p>
                  <p className={cn("text-sm font-medium", ratingColor(result.rating))}>
                    {ratingLabel(result.rating)}
                  </p>
                </div>
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: "Combined odds",
                      value: formatAmericanOdds(result.combinedAmericanOdds),
                    },
                    {
                      label: "Model hit %",
                      value: `${(result.modelProbability * 100).toFixed(1)}%`,
                    },
                    {
                      label: "Implied hit %",
                      value: `${(result.impliedProbability * 100).toFixed(1)}%`,
                    },
                    {
                      label: "Parlay EV",
                      value: formatEvPercent(result.edgePercent),
                    },
                    {
                      label: "Avg leg edge",
                      value: formatEvPercent(result.avgLegEdge),
                    },
                    {
                      label: "Correlation",
                      value: `${(result.avgCorrelation * 100).toFixed(0)}%`,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg bg-white/5 px-3 py-2"
                    >
                      <p className="text-xs text-zinc-500">{stat.label}</p>
                      <p className="font-mono text-sm text-zinc-200">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-zinc-300">
                  {result.analysis}
                </p>
                {result.warnings.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {result.warnings.map((warning) => (
                      <li
                        key={warning}
                        className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90"
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Leg breakdown</CardTitle>
                <span className="text-xs text-zinc-500">
                  {result.matchedCount}/{result.legCount} matched to Kalshi
                </span>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.legs.map((leg) => (
                  <div
                    key={leg.raw}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-200">{leg.label}</p>
                      <p className="truncate text-xs text-zinc-600">{leg.raw}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!leg.matched && (
                        <Badge variant="secondary" className="text-zinc-500">
                          Unmatched
                        </Badge>
                      )}
                      <span className="font-mono text-xs text-zinc-400">
                        {formatAmericanOdds(leg.americanOdds)}
                      </span>
                      <span className="font-mono text-xs text-emerald-400/90">
                        {formatEvPercent(leg.edgePercent)}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
