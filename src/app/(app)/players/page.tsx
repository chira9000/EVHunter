"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePlayerSearch } from "@/hooks/use-player-search";
import type { PlayerSearchStat } from "@/services/kalshi/player-search";

export default function PlayersPage() {
  const [query, setQuery] = useState("");
  const { result, loading, error, search } = usePlayerSearch();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Player Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Search a player to pull their live Kalshi prop markets and rolling,
          opponent-adjusted, and pace-adjusted stats.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a player, e.g. Jayson Tatum"
          className="max-w-sm"
        />
        <Button type="submit" disabled={loading || query.trim().length === 0}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {loading && (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {!loading && !error && !result && (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Search for a player to pull live stats from their Kalshi prop markets.
        </p>
      )}

      {!loading && result && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {result.playerName}
                {result.team ? ` — ${result.team}` : ""} ({result.sport})
              </CardTitle>
              <Badge variant="secondary">
                {result.markets.length} live market
                {result.markets.length === 1 ? "" : "s"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {result.stats.map((stat) => (
                <StatRow key={stat.statKey} stat={stat} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {result.stats.find((s) => s.statKey === result.trendStatKey)
                  ?.label ?? "Trend"}{" "}
                (last {result.trendData.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="game" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                    }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Live Kalshi markets</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {result.markets.map((m) => (
                <a
                  key={m.ticker}
                  href={m.kalshiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-foreground/5"
                >
                  <span>
                    {m.line}+ {m.label} — {m.matchup}
                  </span>
                  <span className="font-mono text-accent">
                    {Math.round(m.yesAsk * 100)}¢
                  </span>
                </a>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatRow({ stat }: { stat: PlayerSearchStat }) {
  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        {stat.label} ({stat.gamesSampled} games)
      </h3>
      <div className="grid gap-6 md:grid-cols-3">
        <MetricBlock
          title="Rolling Avg"
          data={{ [stat.label]: stat.rollingAvg }}
        />
        <MetricBlock
          title="Opponent Adj."
          data={{ [stat.label]: stat.opponentAdjusted }}
        />
        <MetricBlock
          title="Recent Weighted"
          data={{ [stat.label]: stat.recentWeighted }}
        />
      </div>
    </div>
  );
}

function MetricBlock({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{title}</h4>
      <dl className="space-y-1">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <dt className="capitalize text-muted-foreground">{k}</dt>
            <dd className="font-mono">{v.toFixed(1)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
