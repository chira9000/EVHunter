import type { LineMovementPoint } from "@/types";

/** Detect steam moves: rapid implied prob shift across short window */
export function detectSteamMove(
  movement: LineMovementPoint[],
  threshold = 0.025
): { isSteam: boolean; steamScore: number; direction: "up" | "down" | "flat" } {
  if (movement.length < 3) {
    return { isSteam: false, steamScore: 0, direction: "flat" };
  }
  const recent = movement.slice(-4);
  const delta = recent[recent.length - 1]!.impliedProb - recent[0]!.impliedProb;
  const velocity = Math.abs(delta) / recent.length;
  const steamScore = Math.min(1, velocity / threshold);
  return {
    isSteam: Math.abs(delta) >= threshold,
    steamScore,
    direction: delta > 0.005 ? "up" : delta < -0.005 ? "down" : "flat",
  };
}

/** Sharp vs public: higher score = sharper book alignment */
export function sharpVsPublicIndicator(
  sharpImplied: number,
  publicImplied: number
): number {
  const divergence = Math.abs(sharpImplied - publicImplied);
  return Math.min(1, divergence * 5);
}
