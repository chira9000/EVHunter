"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatGroup } from "@/components/ui/stat-group";
import { mockModelPerformance } from "@/services/mock/data";
import { formatPercent } from "@/lib/utils";

export default function ModelsPage() {
  const model = mockModelPerformance[0]!;

  const stats = [
    { label: "Sample", value: model.sampleSize.toLocaleString() },
    { label: "Hit Rate", value: formatPercent(model.hitRate) },
    { label: "ROI", value: formatPercent(model.roi) },
    { label: "Brier", value: model.brierScore.toFixed(3) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Model Performance</h1>
        <p className="text-sm text-muted-foreground">
          Backtest results and calibration — ML models pluggable via registry
        </p>
      </div>

      <StatGroup items={stats} className="md:grid-cols-4" />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CardTitle>{model.modelKey}</CardTitle>
          <Badge variant="secondary">v{model.version}</Badge>
          <Badge>{model.sport}</Badge>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.calibration}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 1]} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                }}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#10b981"
                name="Predicted"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#71717a"
                name="Actual"
                strokeDasharray="4 4"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Swap models via <code className="text-accent">modelRegistry</code> in{" "}
        <code>src/models/rolling-average-model.ts</code>. Stub{" "}
        <code>ml-stub</code> reserved for TensorFlow / PyTorch / ONNX pipelines.
      </p>
    </div>
  );
}
