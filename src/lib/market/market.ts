/**
 * Market context: daily SPY (1993->), QQQ (2019->), VIX (1990->) plus
 * monthly S&P 500 levels, loaded from CSVs bundled in src/data/market and
 * refreshable from the network (stooq, then FRED) when deployed somewhere
 * with open egress. Degrades gracefully offline: you just see a "data as of"
 * date instead of an error.
 */

import fs from "node:fs";
import path from "node:path";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { DB } from "../db/client";
import { marketDays } from "../db/schema";
import { PRICE_SCALE } from "../model/money";
import { parseCsvLines } from "../importers/csv";

const BUNDLE_DIR = path.join(process.cwd(), "src", "data", "market");

function toMicro(v: string): number | null {
  const f = parseFloat(v);
  return Number.isFinite(f) ? Math.round(f * PRICE_SCALE) : null;
}

interface DayRow {
  symbol: string;
  date: string;
  closeMicro: number;
  highMicro?: number | null;
  lowMicro?: number | null;
}

function upsertDays(db: DB, rows: DayRow[]): number {
  let n = 0;
  db.transaction(() => {
    for (const r of rows) {
      const res = db
        .insert(marketDays)
        .values({
          symbol: r.symbol,
          date: r.date,
          closeMicro: r.closeMicro,
          highMicro: r.highMicro ?? null,
          lowMicro: r.lowMicro ?? null,
        })
        .onConflictDoUpdate({
          target: [marketDays.symbol, marketDays.date],
          set: { closeMicro: r.closeMicro },
        })
        .run();
      n += res.changes > 0 ? 1 : 0;
    }
  });
  return n;
}

/** Load the bundled CSV snapshots into market_days. Idempotent. */
export function loadBundledMarketData(db: DB): { symbol: string; rows: number }[] {
  const out: { symbol: string; rows: number }[] = [];

  // spy_vix_daily.csv: Date,VIX,SPY
  const spyVix = path.join(BUNDLE_DIR, "spy_vix_daily.csv");
  if (fs.existsSync(spyVix)) {
    const lines = parseCsvLines(fs.readFileSync(spyVix, "utf8"));
    const spyRows: DayRow[] = [];
    for (const l of lines.slice(1)) {
      const [date, , spy] = l.fields;
      const close = toMicro(spy);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && close != null) {
        spyRows.push({ symbol: "SPY", date, closeMicro: close });
      }
    }
    out.push({ symbol: "SPY", rows: upsertDays(db, spyRows) });
  }

  // vix_daily.csv: DATE,OPEN,HIGH,LOW,CLOSE
  const vix = path.join(BUNDLE_DIR, "vix_daily.csv");
  if (fs.existsSync(vix)) {
    const lines = parseCsvLines(fs.readFileSync(vix, "utf8"));
    const rows: DayRow[] = [];
    for (const l of lines.slice(1)) {
      const [date, , high, low, close] = l.fields;
      const c = toMicro(close);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && c != null) {
        rows.push({ symbol: "VIX", date, closeMicro: c, highMicro: toMicro(high), lowMicro: toMicro(low) });
      }
    }
    out.push({ symbol: "VIX", rows: upsertDays(db, rows) });
  }

  // qqq_daily_2019_2025.csv: Date,Adj Close,Close,High,Low,Open,Volume
  const qqq = path.join(BUNDLE_DIR, "qqq_daily_2019_2025.csv");
  if (fs.existsSync(qqq)) {
    const lines = parseCsvLines(fs.readFileSync(qqq, "utf8"));
    const rows: DayRow[] = [];
    for (const l of lines.slice(1)) {
      const [date, adjClose, , high, low] = l.fields;
      const c = toMicro(adjClose);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && c != null) {
        rows.push({ symbol: "QQQ", date, closeMicro: c, highMicro: toMicro(high), lowMicro: toMicro(low) });
      }
    }
    out.push({ symbol: "QQQ", rows: upsertDays(db, rows) });
  }

  // qqq_daily_2026.csv: date,value (adjusted close)
  const qqq26 = path.join(BUNDLE_DIR, "qqq_daily_2026.csv");
  if (fs.existsSync(qqq26)) {
    const lines = parseCsvLines(fs.readFileSync(qqq26, "utf8"));
    const rows: DayRow[] = [];
    for (const l of lines.slice(1)) {
      const [date, value] = l.fields;
      const c = toMicro(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && c != null) {
        rows.push({ symbol: "QQQ", date, closeMicro: c });
      }
    }
    out.push({ symbol: "QQQ(2026)", rows: upsertDays(db, rows) });
  }

  // per-ticker daily history (src/data/market/tickers/SYM.csv), two formats:
  //   big_movers:  "Unnamed: 0,DateTime,Open,High,Low,Close,Volume"
  //   brownbear:   "Date,Adj Close,Close,High,Low,Open,Volume"
  const tickersDir = path.join(BUNDLE_DIR, "tickers");
  if (fs.existsSync(tickersDir)) {
    let tickerRows = 0;
    let tickerCount = 0;
    for (const file of fs.readdirSync(tickersDir)) {
      if (!file.endsWith(".csv")) continue;
      const symbol = file.replace(/\.csv$/, "").toUpperCase();
      const lines = parseCsvLines(fs.readFileSync(path.join(tickersDir, file), "utf8"));
      if (lines.length < 2) continue;
      const header = lines[0].fields.map((f) => f.trim());
      const rows: DayRow[] = [];
      if (header[1] === "DateTime") {
        for (const l of lines.slice(1)) {
          const [, date, , high, low, close] = l.fields;
          const c = toMicro(close);
          if (/^\d{4}-\d{2}-\d{2}/.test(date) && c != null) {
            rows.push({
              symbol, date: date.slice(0, 10), closeMicro: c,
              highMicro: toMicro(high), lowMicro: toMicro(low),
            });
          }
        }
      } else if (header[0] === "Date" && header[1] === "Adj Close") {
        for (const l of lines.slice(1)) {
          const [date, adjClose, , high, low] = l.fields;
          const c = toMicro(adjClose);
          if (/^\d{4}-\d{2}-\d{2}$/.test(date) && c != null) {
            rows.push({ symbol, date, closeMicro: c, highMicro: toMicro(high), lowMicro: toMicro(low) });
          }
        }
      }
      if (rows.length > 0) {
        tickerRows += upsertDays(db, rows);
        tickerCount++;
      }
    }
    out.push({ symbol: `tickers(${tickerCount})`, rows: tickerRows });
  }

  return out;
}

/** Symbols with bundled per-ticker history. */
export function availableTickerSymbols(): string[] {
  const dir = path.join(BUNDLE_DIR, "tickers");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => f.replace(/\.csv$/, "").toUpperCase());
}

/** Try to refresh from the network. Quietly returns what worked. */
export async function refreshMarketData(db: DB): Promise<{ source: string; rows: number }[]> {
  const results: { source: string; rows: number }[] = [];
  const symbols: { stooq: string; ours: string }[] = [
    { stooq: "spy.us", ours: "SPY" },
    { stooq: "qqq.us", ours: "QQQ" },
  ];
  for (const s of symbols) {
    try {
      const res = await fetch(`https://stooq.com/q/d/l/?s=${s.stooq}&i=d`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.startsWith("Date,")) continue;
      const lines = parseCsvLines(text);
      const rows: DayRow[] = [];
      for (const l of lines.slice(1)) {
        const [date, , high, low, close] = l.fields;
        const c = toMicro(close);
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && c != null) {
          rows.push({ symbol: s.ours, date, closeMicro: c, highMicro: toMicro(high), lowMicro: toMicro(low) });
        }
      }
      results.push({ source: `stooq:${s.stooq}`, rows: upsertDays(db, rows) });
    } catch {
      // offline / blocked: bundled data still serves
    }
  }
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/datasets/finance-vix/main/data/vix-daily.csv",
      { signal: AbortSignal.timeout(20_000) },
    );
    if (res.ok) {
      const lines = parseCsvLines(await res.text());
      const rows: DayRow[] = [];
      for (const l of lines.slice(1)) {
        const [date, , high, low, close] = l.fields;
        const c = toMicro(close);
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && c != null) {
          rows.push({ symbol: "VIX", date, closeMicro: c, highMicro: toMicro(high), lowMicro: toMicro(low) });
        }
      }
      results.push({ source: "github:finance-vix", rows: upsertDays(db, rows) });
    }
  } catch {
    /* ignore */
  }
  return results;
}

/* ----------------------------- context engine ---------------------------- */

export interface MarketContext {
  date: string;
  /** trading day used (the requested date or the prior session) */
  asOf: string | null;
  spyCloseMicro: number | null;
  /** % below trailing 252-session high, 0..-100 */
  drawdownPct: number | null;
  /** where today sits in the trailing 52-week range, 0 (low) .. 1 (high) */
  rangePosition: number | null;
  /** 5-session return, % */
  fiveDayReturnPct: number | null;
  vixClose: number | null;
  regime:
    | "calm"
    | "pullback"
    | "correction"
    | "bear"
    | "panic"
    | "recovery"
    | "unknown";
}

export interface MarketSeriesPoint {
  date: string;
  closeMicro: number;
}

export function getSeries(db: DB, symbol: string, from?: string, to?: string): MarketSeriesPoint[] {
  const conds = [eq(marketDays.symbol, symbol)];
  if (from) conds.push(gte(marketDays.date, from));
  if (to) conds.push(lte(marketDays.date, to));
  return db
    .select({ date: marketDays.date, closeMicro: marketDays.closeMicro })
    .from(marketDays)
    .where(and(...conds))
    .orderBy(asc(marketDays.date))
    .all();
}

export function marketDataRange(db: DB, symbol: string): { min: string; max: string } | null {
  const row = db
    .select({
      min: sql<string>`min(${marketDays.date})`,
      max: sql<string>`max(${marketDays.date})`,
    })
    .from(marketDays)
    .where(eq(marketDays.symbol, symbol))
    .get();
  return row?.min && row?.max ? { min: row.min, max: row.max } : null;
}

/**
 * Compute context for a single date with a preloaded series (fast path for
 * batch use). `series` must be ascending by date and cover ~1y before `date`.
 */
export function contextFromSeries(
  spy: MarketSeriesPoint[],
  vix: MarketSeriesPoint[],
  date: string,
): MarketContext {
  // index of last session <= date
  let idx = -1;
  for (let i = spy.length - 1; i >= 0; i--) {
    if (spy[i].date <= date) {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    return {
      date, asOf: null, spyCloseMicro: null, drawdownPct: null, rangePosition: null,
      fiveDayReturnPct: null, vixClose: null, regime: "unknown",
    };
  }
  const today = spy[idx];
  const windowStart = Math.max(0, idx - 251);
  let high = -Infinity;
  let low = Infinity;
  for (let i = windowStart; i <= idx; i++) {
    if (spy[i].closeMicro > high) high = spy[i].closeMicro;
    if (spy[i].closeMicro < low) low = spy[i].closeMicro;
  }
  const drawdownPct = high > 0 ? ((today.closeMicro - high) / high) * 100 : null;
  const rangePosition = high > low ? (today.closeMicro - low) / (high - low) : null;
  const fiveAgo = spy[Math.max(0, idx - 5)];
  const fiveDayReturnPct =
    fiveAgo.closeMicro > 0 ? ((today.closeMicro - fiveAgo.closeMicro) / fiveAgo.closeMicro) * 100 : null;

  let vixClose: number | null = null;
  for (let i = vix.length - 1; i >= 0; i--) {
    if (vix[i].date <= date) {
      vixClose = vix[i].closeMicro / PRICE_SCALE;
      break;
    }
  }

  let regime: MarketContext["regime"] = "unknown";
  if (drawdownPct != null) {
    const dd = drawdownPct;
    const vixHigh = (vixClose ?? 0) >= 30;
    if (dd <= -20) regime = vixHigh ? "panic" : "bear";
    else if (dd <= -10) regime = vixHigh ? "panic" : "correction";
    else if (dd <= -4) regime = "pullback";
    else if ((fiveDayReturnPct ?? 0) >= 4 && (rangePosition ?? 1) < 0.7) regime = "recovery";
    else regime = "calm";
  }

  return {
    date,
    asOf: today.date,
    spyCloseMicro: today.closeMicro,
    drawdownPct,
    rangePosition,
    fiveDayReturnPct,
    vixClose,
    regime,
  };
}

export function getMarketContext(db: DB, date: string): MarketContext {
  const from = new Date(Date.parse(date) - 400 * 86_400_000).toISOString().slice(0, 10);
  const spy = getSeries(db, "SPY", from, date);
  const vix = getSeries(db, "VIX", from, date);
  return contextFromSeries(spy, vix, date);
}
