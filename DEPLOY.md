# Deploying Trader Mirror

Trader Mirror is a single-user Next.js server app with a SQLite file on disk.
Deploy it anywhere that gives you a persistent volume — Fly.io, Railway,
Render, a $5 VPS, or a box in your closet. It is **not** designed for
serverless platforms (Vercel/Netlify functions) because the database is a
local file.

## Environment variables

| var | purpose |
| --- | --- |
| `TRADER_MIRROR_ACCESS_CODE` | **Set this when hosting publicly.** Passcode gate for the whole site. |
| `TRADER_MIRROR_DB` | SQLite path (default `data/trader-mirror.db`). Point it at the persistent volume. |
| `ANTHROPIC_API_KEY` | Optional — enables "Ask the Mirror" without pasting a key in the UI. |

## Docker (any host)

```bash
docker build -t trader-mirror .
docker volume create tm-data
docker run -d -p 3000:3000 -v tm-data:/app/data \
  -e TRADER_MIRROR_ACCESS_CODE=pick-something-long trader-mirror
```

Then open the site, go to **Data**, and drop in your Fidelity/Schwab/
thinkorswim exports. Imports happen server-side; the files and database
never leave the machine.

## Fly.io (quick path)

```bash
fly launch --no-deploy        # accept the generated fly.toml
fly volumes create tm_data --size 1
# add to fly.toml:
#   [mounts]
#     source = "tm_data"
#     destination = "/app/data"
fly secrets set TRADER_MIRROR_ACCESS_CODE=pick-something-long
fly deploy
```

## Market data freshness

The repo ships with bundled daily history (SPY 1993→2026, VIX 1990→2026,
QQQ 2019→2026, plus ~33 individual tickers). On a host with open egress the
**Data → Refresh market data** button pulls current prices from stooq and
the public VIX dataset. Without egress everything still works from the
bundled snapshot — context verdicts just show their "as of" date.

## Updating

```bash
git pull && npm ci && npm run build && systemctl restart trader-mirror  # or fly deploy / docker rebuild
```

The SQLite schema migrates automatically on boot (drizzle migrations in
`drizzle/`).
