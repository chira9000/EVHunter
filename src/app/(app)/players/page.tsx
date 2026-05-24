"use client";

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
import { mockPlayers } from "@/services/mock/data";
export default function PlayersPage() {
  const player = mockPlayers[0]!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Player Analytics</h1>
        <p className="text-sm text-zinc-500">
          Rolling, opponent-adjusted, and pace-adjusted metrics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {player.name} — {player.team} ({player.sport})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <MetricBlock title="Rolling Avg" data={player.rollingAvg} />
          <MetricBlock title="Opponent Adj." data={player.opponentAdjusted} />
          <MetricBlock title="Recent Weighted" data={player.recentWeighted} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points trend (last 10)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={player.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="game" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
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
      <h3 className="mb-2 text-xs uppercase text-zinc-500">{title}</h3>
      <dl className="space-y-1">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <dt className="text-zinc-400 capitalize">{k}</dt>
            <dd className="font-mono text-zinc-200">{v.toFixed(1)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
