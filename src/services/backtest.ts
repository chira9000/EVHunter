import type { Sport } from "@prisma/client";
import { expectedValuePercent } from "@/lib/betting-math";

export interface BacktestBet {
  trueProbability: number;
  americanOdds: number;
  won: boolean;
  stake: number;
}

export interface BacktestResult {
  sampleSize: number;
  hitRate: number;
  roi: number;
  totalProfit: number;
  avgEv: number;
}

export function runBacktest(bets: BacktestBet[]): BacktestResult {
  let wins = 0;
  let totalStaked = 0;
  let totalProfit = 0;
  let evSum = 0;

  for (const bet of bets) {
    const ev = expectedValuePercent(bet.trueProbability, bet.americanOdds);
    evSum += ev;
    totalStaked += bet.stake;
    const decimal =
      bet.americanOdds > 0
        ? bet.americanOdds / 100 + 1
        : 100 / Math.abs(bet.americanOdds) + 1;
    if (bet.won) {
      wins++;
      totalProfit += bet.stake * (decimal - 1);
    } else {
      totalProfit -= bet.stake;
    }
  }

  return {
    sampleSize: bets.length,
    hitRate: bets.length ? wins / bets.length : 0,
    roi: totalStaked ? totalProfit / totalStaked : 0,
    totalProfit,
    avgEv: bets.length ? evSum / bets.length : 0,
  };
}

export function generateSampleBacktest(_sport: Sport): BacktestResult {
  const bets: BacktestBet[] = Array.from({ length: 200 }, () => {
    const trueProbability = 0.45 + Math.random() * 0.15;
    const americanOdds = trueProbability > 0.52 ? -115 : 105;
    const implied = trueProbability - 0.03 + Math.random() * 0.06;
    const won = Math.random() < implied;
    return {
      trueProbability,
      americanOdds,
      won,
      stake: 100,
    };
  });
  return { ...runBacktest(bets), sampleSize: bets.length };
}
