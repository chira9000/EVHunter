"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Bookmark, TrendingUp } from "lucide-react";
import type { BetOpportunity } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EvBadge } from "@/components/bets/ev-badge";
import { OddsSparkline } from "@/components/bets/odds-sparkline";
import { formatAmericanOdds } from "@/lib/betting-math";
import { formatPercent } from "@/lib/utils";
import { useWatchlistStore } from "@/stores/watchlist-store";

export function BetCard({ bet }: { bet: BetOpportunity }) {
  const { add, remove, has } = useWatchlistStore();
  const saved = has(bet.id);

  const title = bet.playerName ?? bet.teamName ?? bet.matchup;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden hover:border-emerald-500/20 transition-colors">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-zinc-500 mt-0.5">{bet.matchup}</p>
          </div>
          <EvBadge evPercent={bet.evPercent} tier={bet.evTier} />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{bet.betType.replace("_", " ")}</Badge>
            <Badge variant="secondary">{bet.sportsbook}</Badge>
            {bet.injuryFlag && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Injury
              </Badge>
            )}
          </div>

          <p className="text-sm font-medium text-zinc-200">{bet.marketDescription}</p>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Current" value={formatAmericanOdds(bet.americanOdds)} />
            <Stat label="Fair" value={formatAmericanOdds(bet.fairAmericanOdds)} />
            <Stat label="Implied" value={formatPercent(bet.impliedProbability)} />
            <Stat label="Model" value={formatPercent(bet.modelProbability)} />
            <Stat label="Kelly ¼" value={formatPercent(bet.kellyFraction, 1)} />
            <Stat label="Confidence" value={formatPercent(bet.confidence)} />
            {bet.hitRate != null && (
              <Stat label="Hit rate" value={formatPercent(bet.hitRate)} />
            )}
            {bet.clv != null && (
              <Stat label="CLV" value={`${(bet.clv * 100).toFixed(1)}%`} highlight />
            )}
          </div>

          {bet.newsSnippet && (
            <p className="text-xs text-amber-400/90 border-l-2 border-amber-500/50 pl-2">
              {bet.newsSnippet}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <OddsSparkline data={bet.lineMovement} />
              {bet.steamScore != null && bet.steamScore > 0.6 && (
                <span className="flex items-center gap-1 text-[10px] text-orange-400">
                  <TrendingUp className="h-3 w-3" /> Steam
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (saved ? remove(bet.id) : add(bet))}
              aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
            >
              <Bookmark
                className={saved ? "fill-emerald-400 text-emerald-400" : "h-4 w-4"}
              />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p
        className={
          highlight
            ? "font-mono font-semibold text-emerald-400"
            : "font-mono text-zinc-200"
        }
      >
        {value}
      </p>
    </div>
  );
}
