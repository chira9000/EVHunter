import type { BetOpportunity } from "@/types";

export async function sendDiscordWebhook(
  webhookUrl: string,
  opportunity: BetOpportunity
): Promise<boolean> {
  const embed = {
    title: `+EV Alert: ${opportunity.evPercent.toFixed(2)}%`,
    description: `${opportunity.marketDescription} — ${opportunity.matchup}`,
    color: opportunity.evPercent >= 5 ? 0x22c55e : 0x3b82f6,
    fields: [
      { name: "Book", value: opportunity.sportsbook, inline: true },
      { name: "Odds", value: `${opportunity.americanOdds}`, inline: true },
      { name: "Model Prob", value: `${(opportunity.modelProbability * 100).toFixed(1)}%`, inline: true },
      { name: "Kelly (¼)", value: `${(opportunity.kellyFraction * 100).toFixed(1)}%`, inline: true },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
  return res.ok;
}

export function checkEvThreshold(
  opportunities: BetOpportunity[],
  minEvPercent: number
): BetOpportunity[] {
  return opportunities.filter((o) => o.evPercent >= minEvPercent);
}
