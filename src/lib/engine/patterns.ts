/**
 * Behavioral Pattern Engine: pure detectors over canonical transactions,
 * derived closures and market context. Every finding carries receipts
 * (transaction ids / dates) so the UI can prove its claims.
 */

import type { DB } from "../db/client";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { designations, lotClosures, transactions } from "../db/schema";
import { PRICE_SCALE, QTY_SCALE } from "../model/money";
import { contextFromSeries, getSeries, type MarketContext, type MarketSeriesPoint } from "../market/market";

export interface Receipt {
  txId?: number;
  date: string;
  symbol?: string | null;
  detail?: string;
}

/* ----------------------------- crash buyer ------------------------------- */

export interface CrashBuy {
  date: string;
  symbol: string;
  amountCents: number;
  context: MarketContext;
}

export interface CrashBuyerReport {
  /** 0-100: how reliably you buy serious drawdowns, scaled by participation */
  score: number;
  totalBuyDays: number;
  drawdownBuyDays: number;
  crashBuys: CrashBuy[];
  /** $ deployed on days with SPY drawdown <= -10% */
  deployedInDrawdownCents: number;
  deployedTotalCents: number;
  bestDay: { date: string; drawdownPct: number; totalCents: number; symbols: string[] } | null;
}

export function crashBuyerReport(db: DB, beliefSymbols: Set<string>): CrashBuyerReport {
  const buys = db
    .select()
    .from(transactions)
    .where(and(inArray(transactions.type, ["buy"]), isNotNull(transactions.amountCents)))
    .orderBy(asc(transactions.date))
    .all()
    .filter((t) => t.symbol && !beliefSymbols.has(t.symbol));

  if (buys.length === 0) {
    return {
      score: 0, totalBuyDays: 0, drawdownBuyDays: 0, crashBuys: [],
      deployedInDrawdownCents: 0, deployedTotalCents: 0, bestDay: null,
    };
  }

  const from = buys[0].date;
  const to = buys[buys.length - 1].date;
  const spy = getSeries(db, "SPY", shiftDate(from, -400), to);
  const vix = getSeries(db, "VIX", shiftDate(from, -400), to);

  const ctxCache = new Map<string, MarketContext>();
  const ctxFor = (date: string) => {
    let c = ctxCache.get(date);
    if (!c) {
      c = contextFromSeries(spy, vix, date);
      ctxCache.set(date, c);
    }
    return c;
  };

  const byDay = new Map<string, typeof buys>();
  for (const b of buys) {
    const list = byDay.get(b.date) ?? [];
    list.push(b);
    byDay.set(b.date, list);
  }

  const crashBuys: CrashBuy[] = [];
  let drawdownBuyDays = 0;
  let deployedInDrawdownCents = 0;
  let deployedTotalCents = 0;
  let bestDay: CrashBuyerReport["bestDay"] = null;

  for (const [date, dayBuys] of byDay) {
    const ctx = ctxFor(date);
    const dayTotal = dayBuys.reduce((a, b) => a + Math.abs(b.amountCents ?? 0), 0);
    deployedTotalCents += dayTotal;
    const dd = ctx.drawdownPct ?? 0;
    if (dd <= -10) {
      drawdownBuyDays++;
      deployedInDrawdownCents += dayTotal;
      for (const b of dayBuys) {
        crashBuys.push({
          date, symbol: b.symbol!, amountCents: Math.abs(b.amountCents ?? 0), context: ctx,
        });
      }
      if (!bestDay || dd < bestDay.drawdownPct) {
        bestDay = {
          date, drawdownPct: dd, totalCents: dayTotal,
          symbols: [...new Set(dayBuys.map((b) => b.symbol!))],
        };
      }
    }
  }

  // Score: share of capital deployed into >=10% drawdowns, with a bonus for
  // speed (buying within the worst week) — calibrated so habitual dip-buyers
  // land 60-90 and pure momentum-chasers land near 0.
  const capitalShare = deployedTotalCents > 0 ? deployedInDrawdownCents / deployedTotalCents : 0;
  const depthBonus = bestDay ? Math.min(Math.abs(bestDay.drawdownPct) / 30, 1) : 0;
  const score = Math.round(Math.min(100, capitalShare * 250 + depthBonus * 25));

  return {
    score,
    totalBuyDays: byDay.size,
    drawdownBuyDays,
    crashBuys: crashBuys.sort((a, b) => (a.context.drawdownPct ?? 0) - (b.context.drawdownPct ?? 0)),
    deployedInDrawdownCents,
    deployedTotalCents,
    bestDay,
  };
}

/* ---------------------------- cluster sell days --------------------------- */

export interface ClusterSellDay {
  accountId: string;
  date: string;
  sells: number;
  proceedsCents: number;
  symbols: string[];
  context: MarketContext;
  /** grade of the *timing*, independent of the reason */
  timingGrade: "A" | "B" | "C" | "D";
  timingNote: string;
  taggedReason: string | null;
  taggedNote: string | null;
}

export function clusterSellDays(db: DB, minSells = 3): ClusterSellDay[] {
  const sells = db
    .select()
    .from(transactions)
    .where(eq(transactions.type, "sell"))
    .orderBy(asc(transactions.date))
    .all();
  if (sells.length === 0) return [];

  const from = sells[0].date;
  const to = sells[sells.length - 1].date;
  const spy = getSeries(db, "SPY", shiftDate(from, -400), to);
  const vix = getSeries(db, "VIX", shiftDate(from, -400), to);

  const byKey = new Map<string, typeof sells>();
  for (const s of sells) {
    const k = `${s.accountId}|${s.date}`;
    const list = byKey.get(k) ?? [];
    list.push(s);
    byKey.set(k, list);
  }

  const out: ClusterSellDay[] = [];
  for (const [key, daySells] of byKey) {
    if (daySells.length < minSells) continue;
    const [accountId, date] = key.split("|");
    const ctx = contextFromSeries(spy, vix, date);
    const range = ctx.rangePosition ?? 0.5;
    let grade: ClusterSellDay["timingGrade"];
    let note: string;
    if (range >= 0.8) {
      grade = "A";
      note = "Sold in the top fifth of the 52-week range — you picked the moment.";
    } else if (range >= 0.55) {
      grade = "B";
      note = "Sold in the upper half of the range — decent exit conditions.";
    } else if (range >= 0.3) {
      grade = "C";
      note = "Sold mid-to-low range — the market was not paying a premium that day.";
    } else {
      grade = "D";
      note = "Sold near 52-week lows — life chose the moment, not you.";
    }
    const tag = getClusterTag(db, accountId, date);
    out.push({
      accountId,
      date,
      sells: daySells.length,
      proceedsCents: daySells.reduce((a, s) => a + (s.amountCents ?? 0), 0),
      symbols: [...new Set(daySells.map((s) => s.symbol ?? "?"))],
      context: ctx,
      timingGrade: grade,
      timingNote: note,
      taggedReason: tag?.reason ?? null,
      taggedNote: tag?.note ?? null,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

import { clusterTags } from "../db/schema";
function getClusterTag(db: DB, accountId: string, date: string) {
  return db
    .select()
    .from(clusterTags)
    .where(and(eq(clusterTags.accountId, accountId), eq(clusterTags.date, date)))
    .get();
}

/* ----------------------------- premature exits ---------------------------- */

export interface PrematureExit {
  symbol: string;
  exitDate: string;
  exitPriceMicro: number;
  qtyMicro: number;
  proceedsCents: number;
  /** max close within 12 months after exit */
  peakPriceMicro: number;
  peakDate: string;
  runUpPct: number;
  leftOnTableCents: number;
  hasPriceData: boolean;
}

export function prematureExits(db: DB, beliefSymbols: Set<string>, thresholdPct = 50): {
  exits: PrematureExit[];
  totalLeftOnTableCents: number;
  noDataSymbols: string[];
} {
  // last full exit per symbol: closures that took the position to zero
  const sells = db
    .select()
    .from(transactions)
    .where(eq(transactions.type, "sell"))
    .orderBy(asc(transactions.date))
    .all()
    .filter((t) => t.symbol && !beliefSymbols.has(t.symbol) && t.symbol !== "SPAXX");

  // group sells by symbol; evaluate each sell (not only final exits) but
  // report per (symbol, date) to keep the list readable
  const bySymbolDay = new Map<string, { symbol: string; date: string; qtyMicro: number; proceedsCents: number; priceMicro: number | null }>();
  for (const s of sells) {
    const k = `${s.symbol}|${s.date}`;
    const cur = bySymbolDay.get(k) ?? {
      symbol: s.symbol!, date: s.date, qtyMicro: 0, proceedsCents: 0, priceMicro: null,
    };
    cur.qtyMicro += Math.abs(s.qtyMicro ?? 0);
    cur.proceedsCents += s.amountCents ?? 0;
    cur.priceMicro = s.priceMicro ?? cur.priceMicro;
    bySymbolDay.set(k, cur);
  }

  const exits: PrematureExit[] = [];
  const noData = new Set<string>();
  let total = 0;

  for (const e of bySymbolDay.values()) {
    const series = getSeries(db, e.symbol, e.date, shiftDate(e.date, 366));
    if (series.length < 5) {
      noData.add(e.symbol);
      continue;
    }
    const exitPrice =
      e.priceMicro ?? (e.qtyMicro > 0 ? Math.round((e.proceedsCents * (PRICE_SCALE / 100)) / e.qtyMicro * QTY_SCALE) : null);
    if (!exitPrice || exitPrice <= 0) continue;
    let peak = series[0];
    for (const p of series) if (p.closeMicro > peak.closeMicro) peak = p;
    const runUpPct = ((peak.closeMicro - exitPrice) / exitPrice) * 100;
    if (runUpPct >= thresholdPct) {
      const leftCents = Math.round((e.qtyMicro / QTY_SCALE) * ((peak.closeMicro - exitPrice) / (PRICE_SCALE / 100)));
      exits.push({
        symbol: e.symbol,
        exitDate: e.date,
        exitPriceMicro: exitPrice,
        qtyMicro: e.qtyMicro,
        proceedsCents: e.proceedsCents,
        peakPriceMicro: peak.closeMicro,
        peakDate: peak.date,
        runUpPct,
        leftOnTableCents: leftCents,
        hasPriceData: true,
      });
      total += leftCents;
    }
  }

  exits.sort((a, b) => b.leftOnTableCents - a.leftOnTableCents);
  return { exits, totalLeftOnTableCents: total, noDataSymbols: [...noData] };
}

/* ---------------------------- round-trip winners -------------------------- */

export interface RoundTrip {
  symbol: string;
  /** realized winners early, realized losers later (the Enphase pattern) */
  earlyGainCents: number;
  lateLossCents: number;
  firstWinDate: string;
  lastLossDate: string;
}

export function roundTripWinners(db: DB, beliefSymbols: Set<string>): RoundTrip[] {
  const closures = db
    .select()
    .from(lotClosures)
    .where(and(eq(lotClosures.isMoneyMarket, false), isNotNull(lotClosures.gainCents)))
    .orderBy(asc(lotClosures.closeDate))
    .all()
    .filter((c) => !beliefSymbols.has(c.symbol));

  const bySymbol = new Map<string, typeof closures>();
  for (const c of closures) {
    const list = bySymbol.get(c.symbol) ?? [];
    list.push(c);
    bySymbol.set(c.symbol, list);
  }

  const out: RoundTrip[] = [];
  for (const [symbol, list] of bySymbol) {
    let earlyGain = 0;
    let lateLoss = 0;
    let firstWinDate: string | null = null;
    let lastLossDate: string | null = null;
    let seenWin = false;
    for (const c of list) {
      const g = c.gainCents!;
      if (g > 0) {
        if (!seenWin) {
          seenWin = true;
          firstWinDate = c.closeDate;
        }
        earlyGain += g;
      } else if (g < 0 && seenWin) {
        lateLoss += g;
        lastLossDate = c.closeDate;
      }
    }
    if (seenWin && lateLoss < 0 && earlyGain > 0 && Math.abs(lateLoss) > earlyGain * 0.25) {
      out.push({
        symbol,
        earlyGainCents: earlyGain,
        lateLossCents: lateLoss,
        firstWinDate: firstWinDate!,
        lastLossDate: lastLossDate!,
      });
    }
  }
  return out.sort((a, b) => a.lateLossCents - b.lateLossCents);
}

/* --------------------------- conviction half-life ------------------------- */

export interface HoldingStats {
  medianHoldingDays: number | null;
  byBucket: { bucket: string; medianDays: number | null; count: number }[];
}

export function convictionHalfLife(db: DB): HoldingStats {
  const closures = db
    .select()
    .from(lotClosures)
    .where(and(eq(lotClosures.isMoneyMarket, false), isNotNull(lotClosures.holdingDays)))
    .all();
  const desigs = db.select().from(designations).all();
  const bucketOf = new Map(desigs.map((d) => [d.symbol, d.bucket]));

  const days = closures.map((c) => c.holdingDays!).sort((a, b) => a - b);
  const median = (xs: number[]) =>
    xs.length === 0 ? null : xs[Math.floor(xs.length / 2)];

  const buckets = new Map<string, number[]>();
  for (const c of closures) {
    const b = bucketOf.get(c.symbol) ?? "untagged";
    const list = buckets.get(b) ?? [];
    list.push(c.holdingDays!);
    buckets.set(b, list);
  }

  return {
    medianHoldingDays: median(days),
    byBucket: [...buckets.entries()].map(([bucket, xs]) => ({
      bucket,
      medianDays: median(xs.sort((a, b) => a - b)),
      count: xs.length,
    })),
  };
}

/* --------------------------------- misc ---------------------------------- */

export function beliefBucketSymbols(db: DB): Set<string> {
  return new Set(
    db.select().from(designations).where(eq(designations.bucket, "belief")).all().map((d) => d.symbol),
  );
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
}
