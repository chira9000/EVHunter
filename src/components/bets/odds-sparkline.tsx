"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  Tooltip,
} from "recharts";
import type { LineMovementPoint } from "@/types";

export function OddsSparkline({ data }: { data: LineMovementPoint[] }) {
  if (!data.length) {
    return <div className="h-8 w-24 rounded bg-foreground/5" aria-hidden />;
  }

  const chartData = data.map((d, i) => ({
    i,
    odds: d.americanOdds,
    prob: d.impliedProb,
  }));

  const trend =
    data[data.length - 1]!.americanOdds - data[0]!.americanOdds;
  const color = trend < 0 ? "#10b981" : trend > 0 ? "#f87171" : "#71717a";

  return (
    <div className="h-8 w-24" role="img" aria-label="Odds movement sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 11,
            }}
            formatter={(v) => [v, "Odds"]}
          />
          <Line
            type="monotone"
            dataKey="odds"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
