"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  Scale,
  Layers,
  Bookmark,
  LineChart,
  Settings,
  Zap,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "D" },
  { href: "/explorer", label: "Explorer", icon: Search, key: "E" },
  { href: "/players", label: "Players", icon: Users, key: "P" },
  { href: "/arbitrage", label: "Arbitrage", icon: Scale, key: "A" },
  { href: "/parlays", label: "Parlays", icon: Layers, key: "Y" },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark, key: "W" },
  { href: "/models", label: "Models", icon: LineChart, key: "M" },
  { href: "/settings", label: "Settings", icon: Settings, key: "S" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  useKeyboardShortcuts();

  return (
    <div className="flex min-h-screen bg-[#070b12] text-zinc-100">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-white/5 bg-zinc-950/80 backdrop-blur-xl transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-white/5 px-4">
          <Zap className="h-5 w-5 text-emerald-400" aria-hidden />
          <span className="font-mono text-sm font-bold tracking-wider text-emerald-400">
            EVHUNTER
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 p-2" aria-label="Main">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
                <kbd className="ml-auto hidden rounded bg-white/5 px-1 font-mono text-[10px] text-zinc-500 lg:inline">
                  ⌥{item.key}
                </kbd>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/5 p-3">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:pl-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/5 bg-zinc-950/70 px-4 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
