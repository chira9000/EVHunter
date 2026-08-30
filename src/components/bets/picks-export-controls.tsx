"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KALSHI_SPORT_KEYS, type KalshiSportKey } from "@/types/kalshi";

function triggerDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function PicksExportControls() {
  const [sport, setSport] = useState<KalshiSportKey>(KALSHI_SPORT_KEYS[0]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => triggerDownload("/api/export/picks?range=yesterday")}
        title="Download a CSV of every pick recommended yesterday"
      >
        <Download className="h-4 w-4" /> Yesterday&apos;s picks
      </Button>

      <div className="flex items-center gap-1">
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value as KalshiSportKey)}
          aria-label="Sport to export"
          className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          {KALSHI_SPORT_KEYS.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {s}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            triggerDownload(`/api/export/picks?sport=${sport}`)
          }
          title={`Download a CSV of all tracked ${sport} picks`}
        >
          <Download className="h-4 w-4" /> By sport
        </Button>
      </div>
    </div>
  );
}
