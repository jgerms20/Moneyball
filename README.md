# Trader Mirror

A private, single-user trading intelligence & psychology platform. It ingests
brokerage history (Fidelity CSVs, Fidelity 1099/5498 PDFs, Schwab and
thinkorswim exports), rebuilds your positions with a FIFO lot engine and an
options pairing engine, scores every decision against what the market was
doing that day, and mirrors back who you are as a trader — patterns, blind
spots, wins, and evolution.

## What's inside

- **The Mirror** — realized P&L by year (verified to the penny against the 1099s), money in vs out, reconstructed holdings marked to bundled closes, options vital signs, belief-bucket card, and a rotating insight of the day with receipts.
- **Timeline** — life of the account with market-regime shading; every day gets a context verdict (SPY drawdown, 52-week range position, VIX).
- **Patterns** — Crash Buyer Score, cluster-sell days (you tag the reason, the engine grades the timing), premature exits with "left on the table," round-trip winners, conviction half-life.
- **Options Psyche** — strategy breakdown, DTE habits, win/loss anatomy, tilt detector (trades within 48h of a loss), and the Two Traders side-by-side.
- **SWOT of Me** — versioned, regenerable, every claim with evidence.
- **Wins Wall & Tuition Ledger** — trophies and lessons priced in dollars, never shame. Belief Bucket lives apart, by design.
- **Journal** — reflections, thesis tracker with invalidation criteria, 20-second pre-trade checklist.
- **Education** — nine modules where your own trades are the case studies, including an options strategy library and how professionals (and their machines) actually think.
- **Ask the Mirror** — optional Claude-powered chat over your local data (bring your own API key).

## Quick start

```bash
npm install
npm run seed:demo                      # synthetic data -> data/demo.db
TRADER_MIRROR_DB=data/demo.db npm run dev
```

With real exports — either drop files onto the **Data** page in the running
app, or import from the CLI:

```bash
npm run import -- data/imports/History_for_Account_*.csv data/imports/*1099*.pdf
npm run dev
```

## Commands

| command | what it does |
| --- | --- |
| `npm run dev` | start the app (default db: `data/trader-mirror.db`) |
| `npm run import -- <files...>` | autodetect + import exports, rebuild derived state |
| `npm run seed:demo` | build a synthetic demo database (`data/demo.db`) |
| `npm test` | fixture tests for importers, engines, dedupe, market context |
| `npm run db:generate` | regenerate SQL migrations after schema changes |

## Architecture

- Next.js (App Router) + TypeScript + Tailwind, SQLite via better-sqlite3 +
  Drizzle. Money is integer cents; share quantities are integer micro-shares
  (fractional shares like 0.137 are everywhere); option strikes are
  micro-dollars.
- `src/lib/importers/` — pure, fixture-tested parsers for all four formats.
  Real exports are messy: skipped rows are logged visibly, never crashed on.
- `src/lib/ingest/` — natural-key + per-file-ordinal dedupe so overlapping
  exports merge cleanly while genuine same-day duplicate trades survive.
- `src/lib/engine/` — FIFO lot engine (orphan-sell aware for partial
  histories) and options position cycle engine (open/close/expire/assign).
- `src/lib/market/` — bundled SPY/QQQ/VIX daily history with regime context
  (drawdown, 52-week range position, VIX); refreshable from the network when
  deployed with open egress.
- `data/` is gitignored: your real financial data never leaves the machine
  the app runs on.

## Privacy & deployment

Set `TRADER_MIRROR_ACCESS_CODE` to require a passcode when hosting the app
anywhere reachable from the internet. Without it the app is open (fine for
localhost). The SQLite file lives on a persistent volume; see `Dockerfile`.
