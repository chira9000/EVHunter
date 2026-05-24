import Link from "next/link";
import { ArrowRight, BarChart3, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070b12] text-zinc-100 terminal-grid">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 font-mono text-sm font-bold text-emerald-400">
          <Zap className="h-5 w-5" />
          EVHUNTER
        </div>
        <nav className="flex gap-3">
          <Link href="/dashboard">
            <Button variant="ghost">Dashboard</Button>
          </Link>
          <Link href="/dashboard">
            <Button>
              Launch Terminal <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-24 text-center">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-emerald-500/80">
          Quantitative Sports Research
        </p>
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
          Hunt positive EV
          <span className="block text-emerald-400">before the market closes</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400">
          EVHunter aggregates live sportsbook odds, normalizes lines across books, and
          compares model-implied probabilities to find mispriced bets — with CLV tracking,
          arbitrage detection, and a Bloomberg-meets-sportsbook terminal UI.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/dashboard">
            <Button size="lg" className="ev-glow">
              Open Dashboard
            </Button>
          </Link>
          <Link href="/explorer">
            <Button size="lg" variant="secondary">
              Explore Bets
            </Button>
          </Link>
        </div>

        <div className="mt-24 grid gap-6 sm:grid-cols-3 text-left">
          {[
            {
              icon: BarChart3,
              title: "Predictive Engine",
              desc: "Rolling averages, opponent-adjusted stats, pace metrics — ML-ready architecture.",
            },
            {
              icon: Shield,
              title: "No-Vig Fair Odds",
              desc: "True probability vs implied. EV%, Kelly sizing, and CLV in one view.",
            },
            {
              icon: Zap,
              title: "Real-Time Edge",
              desc: "Steam moves, sharp indicators, arbitrage scanner, and webhook alerts.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="glass-panel rounded-xl p-6 transition hover:border-emerald-500/20"
            >
              <f.icon className="mb-3 h-8 w-8 text-emerald-400" />
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-sm text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">
        For research and entertainment. Gamble responsibly. 21+ where applicable.
      </footer>
    </div>
  );
}
