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
    return <div className="h-8 w-24 rounded bg-white/5" aria-hidden />;
  }

  const chartData = data.map((d, i) => ({
    i,
    odds: d.americanOdds,
    prob: d.impliedProb,
  }));

  const trend =
    data[data.length - 1]!.americanOdds - data[0]!.americanOdds;
  const color = trend < 0 ? "#34d399" : trend > 0 ? "#f87171" : "#94a3b8";

  return (
    <div className="h-8 w-24" role="img" aria-label="Odds movement sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid rgba(255,255,255,0.1)",
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
