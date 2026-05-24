"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { useAppStore } from "@/stores/app-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme
    );
  }, [theme]);

  return <SessionProvider>{children}</SessionProvider>;
}
