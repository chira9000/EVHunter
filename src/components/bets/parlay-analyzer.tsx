"use client";

import { useMemo, useRef, useState } from "react";
import { Search, Sparkles, Loader2, X } from "lucide-react";
import type {
  KalshiBet,
  ParlayAnalysisResult,
  ParlayCorrelationRisk,
  ParlayQualityLabel,
} from "@/types/kalshi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAmericanOdds, formatEvPercent } from "@/lib/betting-math";
import { useKalshiBets } from "@/hooks/use-kalshi-bets";

const EXAMPLE =
  "Jayson Tatum 28+ points, Milwaukee Bucks ML, Aaron Judge 1+ hits";

const MAX_SEARCH_RESULTS = 8;

function normalizeQuery(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function searchHaystack(bet: KalshiBet): string {
  return normalizeQuery(
    [bet.selection, bet.marketTitle, bet.playerName, bet.matchup, bet.sport]
      .filter(Boolean)
      .join(" ")
  );
}

function pct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function qualityColor(label: ParlayQualityLabel): string {
  if (label === "excellent") return "text-accent";
  if (label === "good") return "text-accent";
  if (label === "fair") return "text-warning";
  return "text-danger";
}

function qualityText(label: ParlayQualityLabel): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function correlationColor(risk: ParlayCorrelationRisk): string {
  if (risk === "low") return "text-accent";
  if (risk === "medium") return "text-warning";
  return "text-danger";
}

export function ParlayAnalyzer() {
  const [text, setText] = useState("");
  const [offeredOdds, setOfferedOdds] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParlayAnalysisResult | null>(null);

  const { bets, loading: betsLoading } = useKalshiBets();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const existingLegs = useMemo(
    () =>
      new Set(
        text
          .split(/\n|,/)
          .map((s) => normalizeQuery(s))
          .filter(Boolean)
      ),
    [text]
  );

  const searchResults = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return [];
    const terms = q.split(" ").filter(Boolean);
    return bets
      .filter((bet) => {
        const haystack = searchHaystack(bet);
        return terms.every((t) => haystack.includes(t));
      })
      .sort((a, b) => {
        const aStarts = searchHaystack(a).startsWith(q) ? 1 : 0;
        const bStarts = searchHaystack(b).startsWith(q) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        return b.edgePercent - a.edgePercent;
      })
      .slice(0, MAX_SEARCH_RESULTS);
  }, [bets, query]);

  const showResults = searchFocused && query.trim().length > 0;

  function addLeg(bet: KalshiBet) {
    const legText = bet.selection;
    if (existingLegs.has(normalizeQuery(legText))) {
      setQuery("");
      return;
    }
    setText((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${legText}` : legText;
    });
    setQuery("");
    setActiveIndex(0);
    searchInputRef.current?.focus();
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults || searchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const bet = searchResults[activeIndex];
      if (bet) addLeg(bet);
    } else if (e.key === "Escape") {
      setQuery("");
      searchInputRef.current?.blur();
    }
  }

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const offeredAmericanOdds = offeredOdds.trim()
        ? Number(offeredOdds.trim().replace(/^\+/, ""))
        : undefined;
      const res = await fetch("/api/kalshi/parlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          offeredAmericanOdds:
            offeredAmericanOdds != null && Number.isFinite(offeredAmericanOdds)
              ? offeredAmericanOdds
              : undefined,
        }),
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
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search legs — player, team, or market…"
                  className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {query && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {showResults && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-border bg-surface"
                >
                  {betsLoading && bets.length === 0 && (
                    <p className="px-3 py-3 text-xs text-muted-foreground">Loading live legs…</p>
                  )}
                  {!betsLoading && searchResults.length === 0 && (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                      No legs match &ldquo;{query}&rdquo;.
                    </p>
                  )}
                  {searchResults.map((bet, i) => {
                    const added = existingLegs.has(normalizeQuery(bet.selection));
                    return (
                      <button
                        key={bet.id}
                        type="button"
                        onClick={() => addLeg(bet)}
                        onMouseEnter={() => setActiveIndex(i)}
                        disabled={added}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                          i === activeIndex && !added ? "bg-foreground/10" : "hover:bg-foreground/5",
                          added && "cursor-default opacity-50"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{bet.selection}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {bet.matchup} · {bet.sport.toUpperCase()}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {added ? (
                            <Badge variant="secondary">Added</Badge>
                          ) : (
                            <>
                              <span className="font-mono text-xs text-muted-foreground">
                                {formatAmericanOdds(bet.americanOdds)}
                              </span>
                              <span
                                className={cn(
                                  "font-mono text-xs",
                                  bet.edgePercent > 0 ? "text-accent" : "text-muted-foreground"
                                )}
                              >
                                {formatEvPercent(bet.edgePercent)}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type each leg on its own line or separate with commas…&#10;e.g. Tatum 28+ points, Bucks ML, Judge 1+ hits"
              rows={8}
              className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Offered odds (optional — American, e.g. +450)
              </label>
              <input
                value={offeredOdds}
                onChange={(e) => setOfferedOdds(e.target.value)}
                placeholder="Leave blank to estimate from leg prices"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
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
            <p className="text-xs text-muted-foreground">
              Legs are matched against live Kalshi model edges when possible and
              calibrated against settled pick history. Unmatched picks use neutral
              estimates.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-3">
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        {!result && !loading && !error && (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Enter a combo and click Analyze to get a quality score and breakdown.
          </div>
        )}

        {result && result.legCount > 0 && (
          <>
            <Card>
              <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
                <div className="shrink-0 text-center sm:border-r sm:border-border sm:pr-6 sm:text-left">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Quality score
                  </p>
                  <p
                    className={cn(
                      "font-mono text-4xl font-bold tabular-nums",
                      qualityColor(result.qualityLabel)
                    )}
                  >
                    {result.qualityScore.toFixed(3)}
                  </p>
                  <p className={cn("text-sm font-medium", qualityColor(result.qualityLabel))}>
                    {qualityText(result.qualityLabel)}
                  </p>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
                  {[
                    {
                      label: "Calibrated hit %",
                      value: pct(result.parlayProbability),
                    },
                    {
                      label: "Break-even %",
                      value: pct(result.breakEvenProbability),
                    },
                    {
                      label: "Expected value",
                      value: formatEvPercent(result.edgePercent),
                    },
                    {
                      label: `Odds (${result.offeredOddsSource === "user" ? "offered" : "estimated"})`,
                      value: formatAmericanOdds(result.combinedAmericanOdds),
                    },
                    {
                      label: "Legs",
                      value: `${result.legCount} (${result.matchedCount} matched)`,
                    },
                    {
                      label: "Avg leg confidence",
                      value: pct(result.avgLegConfidence),
                    },
                    {
                      label: "Correlation risk",
                      value: (
                        <span className={correlationColor(result.correlationRisk)}>
                          {result.correlationRisk.charAt(0).toUpperCase() +
                            result.correlationRisk.slice(1)}
                        </span>
                      ),
                    },
                    {
                      label: "Confidence factor",
                      value: result.confidenceFactor.toFixed(2),
                    },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="font-mono text-sm">{stat.value}</p>
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
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {result.analysis}
                </p>
                {result.warnings.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {result.warnings.map((warning) => (
                      <li
                        key={warning}
                        className="border-l-2 border-warning/50 pl-2 text-xs text-warning"
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
                <span className="text-xs text-muted-foreground">
                  {result.matchedCount}/{result.legCount} matched to Kalshi
                </span>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {result.legs.map((leg) => (
                  <div
                    key={leg.raw}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{leg.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{leg.raw}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!leg.matched && <Badge variant="secondary">Unmatched</Badge>}
                      {leg.poorlyCalibrated && (
                        <Badge variant="warning">Calibration shift</Badge>
                      )}
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatAmericanOdds(leg.americanOdds)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground" title="Raw model probability">
                        {pct(leg.modelProbability)}
                      </span>
                      <span
                        className="font-mono text-xs text-accent"
                        title="Calibrated probability"
                      >
                        → {pct(leg.calibratedProbability)}
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
