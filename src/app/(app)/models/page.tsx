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
import { mockModelPerformance } from "@/services/mock/data";
import { formatPercent } from "@/lib/utils";

export default function ModelsPage() {
  const model = mockModelPerformance[0]!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Model Performance</h1>
        <p className="text-sm text-zinc-500">
          Backtest results and calibration — ML models pluggable via registry
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Sample" value={model.sampleSize.toLocaleString()} />
        <StatCard label="Hit Rate" value={formatPercent(model.hitRate)} />
        <StatCard label="ROI" value={formatPercent(model.roi)} />
        <StatCard label="Brier" value={model.brierScore.toFixed(3)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CardTitle>{model.modelKey}</CardTitle>
          <Badge variant="secondary">v{model.version}</Badge>
          <Badge>{model.sport}</Badge>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.calibration}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="bucket" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} domain={[0, 1]} />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.1)",
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
                stroke="#38bdf8"
                name="Actual"
                strokeDasharray="4 4"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Future ML Integration</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Swap models via <code className="text-emerald-400">modelRegistry</code> in{" "}
          <code className="text-zinc-400">src/models/rolling-average-model.ts</code>.
          Stub <code className="text-zinc-400">ml-stub</code> reserved for TensorFlow /
          PyTorch / ONNX pipelines.
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs uppercase text-zinc-500">{label}</p>
        <p className="font-mono text-2xl font-bold text-emerald-400">{value}</p>
      </CardContent>
    </Card>
  );
}
