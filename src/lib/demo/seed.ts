/**
 * Synthetic demo data: a believable two-book trader (Fidelity-style equity
 * DCA with a meme phase, crash-bottom buys, cluster sells; plus an options
 * book with CSPs, verticals and a few lottery tickets). Deterministic.
 */

import type { CanonicalTx, ParseResult } from "../model/types";
import { QTY_SCALE, PRICE_SCALE } from "../model/money";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QUALITY = ["GOOGL", "MSFT", "AMZN", "COST", "JPM", "NVDA", "META", "LLY"];
const MEME = ["AMC", "BB", "SKLZ", "PLTR"];
const PRICES: Record<string, number> = {
  GOOGL: 140, MSFT: 380, AMZN: 170, COST: 800, JPM: 200, NVDA: 110, META: 480, LLY: 750,
  AMC: 5, BB: 3, SKLZ: 8, PLTR: 25, SPY: 550, QQQ: 470,
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function isWeekday(d: Date): boolean {
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6;
}

function nextWeekday(d: Date): Date {
  let x = new Date(d);
  while (!isWeekday(x)) x = addDays(x, 1);
  return x;
}

export function generateDemoEquity(): ParseResult {
  const rng = mulberry32(20210301);
  const txs: CanonicalTx[] = [];
  let date = new Date(Date.UTC(2023, 0, 6));
  const end = new Date(Date.UTC(2026, 4, 29));

  const drift: Record<string, number> = {};
  const px = (sym: string): number => {
    drift[sym] = (drift[sym] ?? 1) * (1 + (rng() - 0.46) * 0.05);
    return PRICES[sym] * drift[sym];
  };

  let week = 0;
  while (date < end) {
    week++;
    const friday = nextWeekday(date);
    // weekly $50 deposit
    txs.push({
      date: iso(friday), type: "transfer_in", action: "Electronic Funds Transfer Received (Cash)",
      symbol: null, qtyMicro: null, amountCents: 5000, raw: "demo",
    });
    // most weeks: a ~$50 fractional buy; meme phase early, quality later
    if (rng() < 0.8) {
      const memePhase = friday < new Date(Date.UTC(2024, 0, 1));
      const pool = memePhase && rng() < 0.45 ? MEME : QUALITY;
      const sym = pool[Math.floor(rng() * pool.length)];
      const price = px(sym);
      const dollars = 35 + rng() * 40;
      const qty = dollars / price;
      txs.push({
        date: iso(friday), type: "buy", action: `YOU BOUGHT ${sym} (demo)`, symbol: sym,
        qtyMicro: Math.round(qty * QTY_SCALE),
        priceMicro: Math.round(price * PRICE_SCALE),
        amountCents: -Math.round(dollars * 100),
        raw: "demo",
      });
    }
    // quarterly dividends
    if (week % 13 === 0) {
      for (const sym of ["MSFT", "JPM", "COST"]) {
        txs.push({
          date: iso(friday), type: "dividend", action: `DIVIDEND RECEIVED ${sym} (demo)`,
          symbol: sym, qtyMicro: null, amountCents: Math.round(20 + rng() * 120), raw: "demo",
        });
      }
    }
    // occasional life-event withdrawal
    if (week % 17 === 0) {
      txs.push({
        date: iso(addDays(friday, 3)), type: "transfer_out",
        action: "Electronic Funds Transfer Paid (Cash)", symbol: null,
        amountCents: -Math.round(20000 + rng() * 60000), raw: "demo",
      });
    }
    date = addDays(date, 7);
  }

  // April 2025 crash-bottom buys (the signature move)
  for (const [sym, dollars] of [["AMZN", 178], ["META", 100], ["NVDA", 94], ["JPM", 69], ["AMD", 55]] as const) {
    txs.push({
      date: "2025-04-03", type: "buy", action: `YOU BOUGHT ${sym} (demo crash buy)`,
      symbol: sym, qtyMicro: Math.round((dollars / (PRICES[sym] ?? 100)) * 0.85 * QTY_SCALE),
      amountCents: -dollars * 100, raw: "demo",
    });
  }

  // a cluster sell day (consolidation near highs)
  for (const sym of ["BB", "SKLZ", "PLTR", "AMC", "AMZN", "GOOGL"]) {
    txs.push({
      date: "2024-11-26", type: "sell", action: `YOU SOLD ${sym} (demo consolidation)`,
      symbol: sym, qtyMicro: -Math.round((2 + rng() * 5) * QTY_SCALE),
      amountCents: Math.round(3000 + rng() * 15000), raw: "demo",
    });
  }

  txs.sort((a, b) => a.date.localeCompare(b.date));
  return { source: "demo_seed", transactions: txs, skipped: [], warnings: [] };
}

export function generateDemoOptions(): ParseResult {
  const rng = mulberry32(20240701);
  const txs: CanonicalTx[] = [];
  let date = new Date(Date.UTC(2024, 6, 5));
  const end = new Date(Date.UTC(2026, 4, 22));
  const unders = ["SPY", "QQQ", "AMC", "NVDA"];

  while (date < end) {
    const day = nextWeekday(date);
    if (rng() < 0.5) {
      const u = unders[Math.floor(rng() * unders.length)];
      const right = rng() < 0.5 ? "C" : "P";
      const dte = rng() < 0.25 ? Math.floor(1 + rng() * 6) : Math.floor(7 + rng() * 45);
      const expiry = iso(nextWeekday(addDays(day, dte)));
      const strike = Math.round((PRICES[u] ?? 100) * (0.9 + rng() * 0.2));
      const credit = rng() < 0.45; // CSP / covered-call style
      const premium = Math.max(5, Math.round((rng() * 3 + 0.2) * 100)); // cents per share
      const option = {
        underlying: u, expiry, strikeMicro: strike * PRICE_SCALE,
        right: right as "C" | "P", multiplier: 100,
      };
      const openCash = credit ? premium * 100 / 100 : -premium;
      txs.push({
        date: iso(day),
        execTime: `${iso(day)}T10:${String(Math.floor(rng() * 50) + 10)}:00`,
        type: credit ? "option_sell_to_open" : "option_buy_to_open",
        action: credit ? "Sell to Open" : "Buy to Open",
        symbol: u, option,
        qtyMicro: 1 * QTY_SCALE,
        priceMicro: Math.round((premium / 100) * PRICE_SCALE),
        amountCents: credit ? premium : -premium,
        feesCents: -66,
        strategyLabel: dte < 7 ? "SINGLE" : rng() < 0.3 ? "VERTICAL" : "SINGLE",
        raw: "demo",
      });
      // resolve before expiry: ~60% closed, ~30% expired, ~10% assigned
      const roll = rng();
      const closeDay = nextWeekday(addDays(day, Math.max(1, dte - 1)));
      if (roll < 0.6) {
        const pnlMult = rng() < (credit ? 0.65 : 0.42) ? (credit ? 0.4 : 1.8) : credit ? 1.9 : 0.35;
        const closePremium = Math.max(1, Math.round(premium * pnlMult));
        txs.push({
          date: iso(closeDay),
          execTime: `${iso(closeDay)}T13:11:00`,
          type: credit ? "option_buy_to_close" : "option_sell_to_close",
          action: credit ? "Buy to Close" : "Sell to Close",
          symbol: u, option,
          qtyMicro: -1 * QTY_SCALE,
          priceMicro: Math.round((closePremium / 100) * PRICE_SCALE),
          amountCents: credit ? -closePremium : closePremium,
          feesCents: -66,
          raw: "demo",
        });
      } else if (roll < 0.9) {
        txs.push({
          date: expiry, type: "option_expired", action: "Expired",
          symbol: u, option, qtyMicro: -1 * QTY_SCALE, amountCents: 0, raw: "demo",
        });
      } else {
        txs.push({
          date: expiry, type: "option_assigned", action: "Assigned",
          symbol: u, option, qtyMicro: -1 * QTY_SCALE, amountCents: 0, raw: "demo",
        });
      }
    }
    date = addDays(date, Math.floor(1 + rng() * 4));
  }

  txs.sort((a, b) => (a.execTime ?? a.date).localeCompare(b.execTime ?? b.date));
  return { source: "demo_seed", transactions: txs, skipped: [], warnings: [] };
}
