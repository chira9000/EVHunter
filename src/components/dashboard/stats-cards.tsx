import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStats } from "@/types";

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const items = [
    { label: "+EV Opportunities", value: stats.totalOpportunities.toString() },
    { label: "Avg EV", value: `+${stats.avgEv.toFixed(2)}%` },
    { label: "Top Sport", value: stats.topSport },
    { label: "Arbitrage", value: stats.arbitrageCount.toString() },
    { label: "Steam Moves", value: stats.steamMoves.toString() },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-normal uppercase tracking-wider text-zinc-500">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-emerald-400">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
