/**
 * Server-side data access for pages. Everything the UI shows funnels
 * through here so pages stay thin and sub-systems stay testable.
 */

import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, type DB } from "./db/client";
import {
  accounts,
  designations,
  importFiles,
  lotClosures,
  lots,
  optionPositions,
  settings,
  skippedRows,
  taxDividends,
  taxForms,
  taxLots,
  transactions,
} from "./db/schema";
import { loadBundledMarketData, getSeries, getMarketContext, marketDataRange, contextFromSeries, type MarketContext } from "./market/market";
import {
  beliefBucketSymbols,
  clusterSellDays,
  convictionHalfLife,
  crashBuyerReport,
  prematureExits,
  roundTripWinners,
  type ClusterSellDay,
  type CrashBuyerReport,
  type HoldingStats,
  type PrematureExit,
  type RoundTrip,
} from "./engine/patterns";
import { PRICE_SCALE, QTY_SCALE } from "./model/money";

let marketLoaded = false;
export function db(): DB {
  const d = getDb();
  if (!marketLoaded) {
    // first touch after boot: make sure bundled market data is present
    const have = marketDataRange(d, "SPY");
    if (!have) loadBundledMarketData(d);
    marketLoaded = true;
  }
  return d;
}

/* -------------------------------- overview ------------------------------- */

export interface YearRow {
  year: number;
  engineGainCents: number | null;
  taxGainCents: number | null;
  dividendsCents: number;
  depositsCents: number;
  withdrawalsCents: number;
}

export interface Overview {
  hasData: boolean;
  isDemo: boolean;
  accounts: { id: string; label: string; broker: string; book: string; txCount: number; firstDate: string | null; lastDate: string | null }[];
  years: YearRow[];
  cumulativeRealizedCents: number;
  orphanProceedsCents: number;
  holdings: Holding[];
  optionsVitals: OptionsVitals | null;
  beliefBucket: BeliefBucket[];
  dataHealth: {
    importFiles: number;
    skippedRows: number;
    marketAsOf: string | null;
    warnings: string[];
  };
}

export interface Holding {
  accountId: string;
  symbol: string;
  qtyMicro: number;
  costCents: number | null;
  lastCloseMicro: number | null;
  lastCloseDate: string | null;
  marketValueCents: number | null;
  unrealizedCents: number | null;
  isMoneyMarket: boolean;
}

export interface OptionsVitals {
  totalPositions: number;
  open: number;
  closed: number;
  winRatePct: number | null;
  realizedCents: number;
  premiumSoldCents: number;
  premiumBoughtCents: number;
  medianDteAtOpen: number | null;
}

export interface BeliefBucket {
  symbol: string;
  note: string | null;
  qtyMicro: number;
  costCents: number;
  marketValueCents: number | null;
  realizedCents: number;
  lifetimePnlCents: number | null;
  portfolioSharePct: number | null;
}

export function getOverview(): Overview {
  const d = db();
  const acctRows = d.select().from(accounts).all();
  const isDemo = d.select().from(settings).where(eq(settings.key, "demo")).get()?.value === "1";

  const acctsOut = acctRows.map((a) => {
    const stats = d
      .select({
        n: sql<number>`count(*)`,
        min: sql<string | null>`min(${transactions.date})`,
        max: sql<string | null>`max(${transactions.date})`,
      })
      .from(transactions)
      .where(eq(transactions.accountId, a.id))
      .get();
    return {
      id: a.id, label: a.label, broker: a.broker, book: a.book,
      txCount: stats?.n ?? 0, firstDate: stats?.min ?? null, lastDate: stats?.max ?? null,
    };
  });

  // yearly rows
  const years = new Map<number, YearRow>();
  const yearOf = (date: string) => parseInt(date.slice(0, 4), 10);
  const row = (y: number): YearRow => {
    let r = years.get(y);
    if (!r) {
      r = { year: y, engineGainCents: null, taxGainCents: null, dividendsCents: 0, depositsCents: 0, withdrawalsCents: 0 };
      years.set(y, r);
    }
    return r;
  };

  for (const c of d
    .select()
    .from(lotClosures)
    .where(and(eq(lotClosures.isMoneyMarket, false), isNotNull(lotClosures.gainCents)))
    .all()) {
    const r = row(yearOf(c.closeDate));
    r.engineGainCents = (r.engineGainCents ?? 0) + (c.gainCents ?? 0);
  }
  for (const t of d.select().from(taxLots).all()) {
    const r = row(t.year);
    r.taxGainCents = (r.taxGainCents ?? 0) + (t.gainCents ?? 0);
  }
  for (const t of d
    .select()
    .from(transactions)
    .where(eq(transactions.type, "dividend"))
    .all()) {
    row(yearOf(t.date)).dividendsCents += t.amountCents ?? 0;
  }
  for (const t of d
    .select()
    .from(transactions)
    .where(eq(transactions.type, "transfer_in"))
    .all()) {
    row(yearOf(t.date)).depositsCents += t.amountCents ?? 0;
  }
  for (const t of d
    .select()
    .from(transactions)
    .where(eq(transactions.type, "transfer_out"))
    .all()) {
    row(yearOf(t.date)).withdrawalsCents += Math.abs(t.amountCents ?? 0);
  }

  const yearsOut = [...years.values()].sort((a, b) => a.year - b.year);
  const cumulativeRealizedCents = yearsOut.reduce(
    (a, y) => a + (y.taxGainCents ?? y.engineGainCents ?? 0),
    0,
  );
  const orphanProceedsCents = d
    .select({ s: sql<number>`coalesce(sum(${lotClosures.proceedsCents}),0)` })
    .from(lotClosures)
    .where(and(eq(lotClosures.orphan, true), eq(lotClosures.isMoneyMarket, false)))
    .get()?.s ?? 0;

  const holdings = getHoldings(d);
  const beliefBucket = getBeliefBucket(d, holdings);

  const skipped = d.select({ n: sql<number>`count(*)` }).from(skippedRows).get()?.n ?? 0;
  const files = d.select({ n: sql<number>`count(*)` }).from(importFiles).get()?.n ?? 0;
  const spyRange = marketDataRange(d, "SPY");

  return {
    hasData: acctsOut.some((a) => a.txCount > 0),
    isDemo,
    accounts: acctsOut,
    years: yearsOut,
    cumulativeRealizedCents,
    orphanProceedsCents,
    holdings,
    optionsVitals: getOptionsVitals(d),
    beliefBucket,
    dataHealth: { importFiles: files, skippedRows: skipped, marketAsOf: spyRange?.max ?? null, warnings: [] },
  };
}

export function getHoldings(d: DB = db()): Holding[] {
  const open = d.select().from(lots).all();
  const bySymbol = new Map<string, Holding>();
  for (const l of open) {
    const k = `${l.accountId}|${l.symbol}`;
    const h = bySymbol.get(k) ?? {
      accountId: l.accountId, symbol: l.symbol, qtyMicro: 0, costCents: 0,
      lastCloseMicro: null, lastCloseDate: null, marketValueCents: null,
      unrealizedCents: null, isMoneyMarket: l.isMoneyMarket,
    };
    h.qtyMicro += l.remainingMicro;
    h.costCents = (h.costCents ?? 0) + (l.costRemainingCents ?? 0);
    bySymbol.set(k, h);
  }
  // mark to the most recent bundled close
  for (const h of bySymbol.values()) {
    const series = getSeries(d, h.symbol);
    if (series.length > 0) {
      const last = series[series.length - 1];
      h.lastCloseMicro = last.closeMicro;
      h.lastCloseDate = last.date;
      h.marketValueCents = Math.round((h.qtyMicro / QTY_SCALE) * (last.closeMicro / (PRICE_SCALE / 100)));
      if (h.costCents != null) h.unrealizedCents = h.marketValueCents - h.costCents;
    } else if (h.isMoneyMarket) {
      h.marketValueCents = Math.round(h.qtyMicro / (QTY_SCALE / 100));
    }
  }
  return [...bySymbol.values()]
    .filter((h) => h.qtyMicro > 0)
    .sort((a, b) => (b.marketValueCents ?? 0) - (a.marketValueCents ?? 0));
}

function getOptionsVitals(d: DB): OptionsVitals | null {
  const ps = d.select().from(optionPositions).all();
  if (ps.length === 0) return null;
  const closed = ps.filter((p) => p.status === "closed");
  const wins = closed.filter((p) => (p.realizedCents ?? 0) > 0).length;
  const premiumSold = ps.reduce((a, p) => a + Math.max(0, p.openPremiumCents), 0);
  const premiumBought = ps.reduce((a, p) => a + Math.min(0, p.openPremiumCents), 0);
  const dtes = ps.map((p) => p.dteAtOpen).filter((x): x is number => x != null).sort((a, b) => a - b);
  return {
    totalPositions: ps.length,
    open: ps.length - closed.length,
    closed: closed.length,
    winRatePct: closed.length > 0 ? Math.round((wins / closed.length) * 100) : null,
    realizedCents: closed.reduce((a, p) => a + (p.realizedCents ?? 0), 0),
    premiumSoldCents: premiumSold,
    premiumBoughtCents: premiumBought,
    medianDteAtOpen: dtes.length > 0 ? dtes[Math.floor(dtes.length / 2)] : null,
  };
}

function getBeliefBucket(d: DB, holdings: Holding[]): BeliefBucket[] {
  const beliefs = d.select().from(designations).where(eq(designations.bucket, "belief")).all();
  if (beliefs.length === 0) return [];
  const totalMv = holdings.reduce((a, h) => a + (h.marketValueCents ?? 0), 0);
  return beliefs.map((b) => {
    const hs = holdings.filter((h) => h.symbol === b.symbol);
    const qty = hs.reduce((a, h) => a + h.qtyMicro, 0);
    const cost = hs.reduce((a, h) => a + (h.costCents ?? 0), 0);
    const mv = hs.reduce((a, h) => a + (h.marketValueCents ?? 0), 0);
    const realized = d
      .select({ s: sql<number>`coalesce(sum(${lotClosures.gainCents}),0)` })
      .from(lotClosures)
      .where(and(eq(lotClosures.symbol, b.symbol), isNotNull(lotClosures.gainCents)))
      .get()?.s ?? 0;
    return {
      symbol: b.symbol,
      note: b.note,
      qtyMicro: qty,
      costCents: cost,
      marketValueCents: mv || null,
      realizedCents: realized,
      lifetimePnlCents: mv ? realized + (mv - cost) : null,
      portfolioSharePct: totalMv > 0 && mv ? (mv / totalMv) * 100 : null,
    };
  });
}

/* -------------------------------- timeline ------------------------------- */

export interface TimelineDay {
  date: string;
  events: {
    id: number;
    type: string;
    symbol: string | null;
    description: string | null;
    qtyMicro: number | null;
    amountCents: number | null;
    accountId: string;
    occKey: string | null;
  }[];
  buysCents: number;
  sellsCents: number;
  context: MarketContext;
}

export function getTimeline(yearFilter?: number): TimelineDay[] {
  const d = db();
  const txs = d
    .select()
    .from(transactions)
    .orderBy(asc(transactions.date), asc(transactions.id))
    .all()
    .filter((t) => !yearFilter || t.date.startsWith(String(yearFilter)));
  if (txs.length === 0) return [];

  const from = txs[0].date;
  const to = txs[txs.length - 1].date;
  const spy = getSeries(d, "SPY", shift(from, -400), to);
  const vix = getSeries(d, "VIX", shift(from, -400), to);

  const byDay = new Map<string, TimelineDay>();
  for (const t of txs) {
    let day = byDay.get(t.date);
    if (!day) {
      day = {
        date: t.date,
        events: [],
        buysCents: 0,
        sellsCents: 0,
        context: contextFromSeries(spy, vix, t.date),
      };
      byDay.set(t.date, day);
    }
    day.events.push({
      id: t.id, type: t.type, symbol: t.symbol, description: t.description,
      qtyMicro: t.qtyMicro, amountCents: t.amountCents, accountId: t.accountId, occKey: t.occKey,
    });
    if (t.type === "buy" || t.type === "reinvest") day.buysCents += Math.abs(t.amountCents ?? 0);
    if (t.type === "sell") day.sellsCents += t.amountCents ?? 0;
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function getSpySeries(from?: string, to?: string) {
  return getSeries(db(), "SPY", from, to);
}

export function getTickerSeries(symbol: string, from?: string, to?: string) {
  return getSeries(db(), symbol, from, to);
}

export function contextForDate(date: string): MarketContext {
  return getMarketContext(db(), date);
}

/* -------------------------------- patterns ------------------------------- */

export interface PatternsReport {
  crashBuyer: CrashBuyerReport;
  clusters: ClusterSellDay[];
  premature: { exits: PrematureExit[]; totalLeftOnTableCents: number; noDataSymbols: string[] };
  roundTrips: RoundTrip[];
  holding: HoldingStats;
  beliefSymbols: string[];
}

export function getPatterns(): PatternsReport {
  const d = db();
  const beliefs = beliefBucketSymbols(d);
  return {
    crashBuyer: crashBuyerReport(d, beliefs),
    clusters: clusterSellDays(d),
    premature: prematureExits(d, beliefs),
    roundTrips: roundTripWinners(d, beliefs),
    holding: convictionHalfLife(d),
    beliefSymbols: [...beliefs],
  };
}

/* --------------------------------- options ------------------------------- */

export interface OptionsReport {
  vitals: OptionsVitals | null;
  positions: (typeof optionPositions.$inferSelect)[];
  byStrategy: { label: string; count: number; realizedCents: number; winRatePct: number | null }[];
  dteBuckets: { label: string; count: number; realizedCents: number; winRatePct: number | null }[];
  tilt: TiltReport;
}

export interface TiltReport {
  /** trades opened within 48h after a realized loss */
  tiltTrades: number;
  baselineTrades: number;
  tiltWinRatePct: number | null;
  baselineWinRatePct: number | null;
  tiltAvgSizeCents: number | null;
  baselineAvgSizeCents: number | null;
  examples: { openedAt: string; underlying: string; realizedCents: number | null; afterLossAt: string }[];
}

export function getOptionsReport(): OptionsReport {
  const d = db();
  const ps = d.select().from(optionPositions).orderBy(asc(optionPositions.openedAt)).all();
  const closed = ps.filter((p) => p.status === "closed" && p.realizedCents != null);

  const groupStats = (key: (p: (typeof ps)[number]) => string) => {
    const m = new Map<string, { count: number; realized: number; wins: number; closed: number }>();
    for (const p of ps) {
      const k = key(p);
      const g = m.get(k) ?? { count: 0, realized: 0, wins: 0, closed: 0 };
      g.count++;
      if (p.status === "closed" && p.realizedCents != null) {
        g.closed++;
        g.realized += p.realizedCents;
        if (p.realizedCents > 0) g.wins++;
      }
      m.set(k, g);
    }
    return [...m.entries()].map(([label, g]) => ({
      label,
      count: g.count,
      realizedCents: g.realized,
      winRatePct: g.closed > 0 ? Math.round((g.wins / g.closed) * 100) : null,
    }));
  };

  const strategyOf = (p: (typeof ps)[number]) => {
    if (p.strategyLabel && p.strategyLabel !== "SINGLE") return p.strategyLabel;
    if (p.direction === "short" && p.right === "P") return "SHORT PUT (CSP)";
    if (p.direction === "short" && p.right === "C") return "SHORT CALL";
    if (p.direction === "long" && p.right === "C") return "LONG CALL";
    return "LONG PUT";
  };
  const dteBucketOf = (p: (typeof ps)[number]) => {
    const dte = p.dteAtOpen;
    if (dte == null) return "unknown";
    if (dte < 7) return "<7 DTE (lottery)";
    if (dte <= 21) return "7-21 DTE";
    if (dte <= 45) return "22-45 DTE";
    return ">45 DTE";
  };

  // tilt: openings within 48h after a closed losing position
  const losses = closed
    .filter((p) => p.realizedCents! < 0 && p.closedAt)
    .map((p) => p.closedAt!)
    .sort();
  const isTilt = (openedAt: string) => {
    for (const l of losses) {
      if (l <= openedAt) {
        const dt = Date.parse(openedAt) - Date.parse(l);
        if (dt >= 0 && dt <= 48 * 3600 * 1000) return l;
      }
    }
    return null;
  };
  const tiltPs = ps
    .map((p) => ({ p, after: isTilt(p.openedAt) }))
    .filter((x) => x.after != null);
  const basePs = ps.filter((p) => !tiltPs.some((t) => t.p.id === p.id));
  const winRate = (xs: (typeof ps)[number][]) => {
    const cl = xs.filter((p) => p.status === "closed" && p.realizedCents != null);
    if (cl.length === 0) return null;
    return Math.round((cl.filter((p) => p.realizedCents! > 0).length / cl.length) * 100);
  };
  const avgSize = (xs: (typeof ps)[number][]) => {
    if (xs.length === 0) return null;
    return Math.round(xs.reduce((a, p) => a + Math.abs(p.openPremiumCents), 0) / xs.length);
  };

  return {
    vitals: getOptionsVitals(d),
    positions: ps,
    byStrategy: groupStats(strategyOf).sort((a, b) => b.count - a.count),
    dteBuckets: groupStats(dteBucketOf),
    tilt: {
      tiltTrades: tiltPs.length,
      baselineTrades: basePs.length,
      tiltWinRatePct: winRate(tiltPs.map((x) => x.p)),
      baselineWinRatePct: winRate(basePs),
      tiltAvgSizeCents: avgSize(tiltPs.map((x) => x.p)),
      baselineAvgSizeCents: avgSize(basePs),
      examples: tiltPs.slice(0, 8).map((x) => ({
        openedAt: x.p.openedAt,
        underlying: x.p.underlying,
        realizedCents: x.p.realizedCents,
        afterLossAt: x.after!,
      })),
    },
  };
}

/* ------------------------------ tax documents ---------------------------- */

export function getTaxData() {
  const d = db();
  return {
    lots: d.select().from(taxLots).orderBy(asc(taxLots.sold)).all(),
    dividends: d.select().from(taxDividends).orderBy(asc(taxDividends.date)).all(),
    forms: d.select().from(taxForms).orderBy(desc(taxForms.year)).all(),
  };
}

export function getRecentTransactions(limit = 50) {
  const d = db();
  return d
    .select()
    .from(transactions)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(limit)
    .all();
}

function shift(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
}
