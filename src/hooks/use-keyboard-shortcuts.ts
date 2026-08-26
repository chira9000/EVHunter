"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS: Record<string, string> = {
  d: "/dashboard",
  e: "/explorer",
  p: "/players",
  a: "/arbitrage",
  y: "/parlays",
  w: "/watchlist",
  m: "/models",
  s: "/settings",
  h: "/",
};

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (!e.altKey) return;
      const path = SHORTCUTS[e.key];
      if (path) {
        e.preventDefault();
        router.push(path);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
}
