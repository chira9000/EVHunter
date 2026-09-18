"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
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
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Zap className="h-4 w-4 text-accent" aria-hidden />
          <span className="font-mono text-sm font-semibold tracking-wide">
            EVHunter
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
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
                <kbd className="ml-auto hidden font-mono text-[10px] text-muted-foreground lg:inline">
                  ⌥{item.key}
                </kbd>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:pl-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
