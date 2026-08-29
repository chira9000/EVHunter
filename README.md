# EVHunter

**EVHunter** is a quantitative sports betting research platform that identifies positive expected value (+EV) opportunities by combining live sportsbook odds, normalized line data, historical statistics, and a swappable predictive modeling engine.

![Stack](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748)

## Features

- **Live odds aggregation** from multiple sportsbooks (The Odds API + mock mode)
- **Normalized schema** for games, teams, players, props, odds, predictions
- **Predictive engine** with rolling averages, opponent adjustment, pace metrics
- **EV calculations**: implied prob, no-vig fair odds, EV%, Kelly criterion, CLV
- **Arbitrage scanner** and steam/sharp indicators
- **Dashboard** with virtualized table, sparklines, filters, auto-refresh
- **Dark glassmorphism UI** inspired by Bloomberg / TradingView / DraftKings
- **NextAuth** authentication, watchlist, CSV export, Discord webhooks
- **Redis caching** with in-memory fallback
- **Background odds ingestion** via cron API route

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| UI | shadcn-style Radix components, Recharts, Framer Motion |
| State | Zustand |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis (ioredis) |
| Auth | NextAuth v5 |
| Tests | Vitest |

## Project Structure

```
evhunter/
├── prisma/
│   ├── schema.prisma      # Normalized betting schema
│   └── seed.ts            # Sample data
├── src/
│   ├── app/               # Pages & API routes
│   │   ├── (app)/         # Authenticated shell pages
│   │   └── api/           # REST endpoints
│   ├── components/        # UI components
│   ├── hooks/             # useBets, keyboard shortcuts
│   ├── lib/               # betting-math, env, redis, prisma
│   ├── models/            # Swappable predictive models
│   ├── services/          # odds ingestion, EV engine, arbitrage
│   ├── stores/            # Zustand stores
│   └── types/             # Shared TypeScript types
├── docker-compose.yml
├── Dockerfile
└── vitest.config.ts
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (optional for mock mode)
- Redis 7+ (optional)

### 1. Install dependencies

```bash
cd evhunter
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Set `USE_MOCK_DATA=true` to run without external APIs or database.

### 3. Database (optional)

```bash
docker compose up -d postgres redis
npm run db:push
npm run db:seed
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3002/dashboard](http://localhost:3002/dashboard) in your browser (EVHunter uses port **3002** so it does not conflict with other Next.js apps on 3000; the dev terminal only shows API logs — the UI loads in the browser).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm test` | Run unit tests (EV math) |
| `npm run db:push` | Push Prisma schema |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Prisma Studio GUI |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/bets` | GET | Filtered +EV opportunities |
| `/api/kalshi/bets` | GET | Daily Kalshi edges + recommended pick hit rate |
| `/api/arbitrage` | GET | Arbitrage opportunities |
| `/api/odds/stream` | GET | SSE real-time updates |
| `/api/cron/odds` | GET | Odds ingestion job |
| `/api/cron/kalshi-settle` | GET | Settle recommended Kalshi picks vs market results |
| `/api/export/csv` | GET | CSV export |
| `/api/auth/*` | * | NextAuth handlers |

## Pages

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/dashboard` | Kalshi props (incl. NBA points) & moneylines + pick hit rate |
| `/explorer` | Bet cards with full analytics |
| `/players` | Player analytics & charts |
| `/arbitrage` | Cross-book arbitrage |
| `/watchlist` | Saved bets |
| `/models` | Model performance & calibration |
| `/settings` | Account & preferences |

## Keyboard Shortcuts

Hold **⌥ (Alt)** + key:

| Key | Page |
|-----|------|
| D | Dashboard |
| E | Explorer |
| P | Players |
| A | Arbitrage |
| W | Watchlist |
| M | Models |
| S | Settings |

## EV Formulas

Implemented in `src/lib/betting-math.ts`:

- **American → Decimal**: `odds/100 + 1` (positive) or `100/|odds| + 1` (negative)
- **Implied probability**: `1 / decimal`
- **No-vig fair odds**: multiplicative normalization of two-way market
- **EV%**: `(trueProb × decimal) - 1` × 100
- **Kelly**: `(bp - q) / b` with optional fractional Kelly
- **CLV**: `closingImplied - betImplied`
- **Arbitrage%**: `(1 / Σ implied) - 1` × 100

## Predictive Models

Register models in `src/models/rolling-average-model.ts`:

```typescript
import { getModel } from "@/models/rolling-average-model";

const output = getModel("rolling-average").predict(input);
```

Add new models by implementing the `PredictiveModel` interface in `src/models/types.ts`.

## Deployment (Vercel)

1. Connect repository to Vercel
2. Set environment variables from `.env.example`
3. Add Vercel Postgres or external `DATABASE_URL`
4. Enable cron in `vercel.json` for odds ingestion
5. Set `CRON_SECRET` and pass as `Authorization: Bearer <secret>`

## Docker

```bash
docker compose up --build
```

## Testing

```bash
npm test
```

Tests cover all core betting math utilities.

## Mock Data Mode

When `USE_MOCK_DATA=true` or `ODDS_API_KEY` is unset, the app serves realistic sample opportunities from `src/services/mock/data.ts` — no external API calls required.

## Responsible Gambling

This software is for **research and educational purposes**. Sports betting involves risk. Only wager what you can afford to lose. Comply with local laws. 21+ where applicable.

## License

MIT
