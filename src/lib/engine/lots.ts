/**
 * FIFO lot engine for the equity book.
 *
 * Pure function over chronologically ordered canonical transactions.
 * Handles: buys, reinvestments, sells (fractional everywhere), merger
 * in/out, (reverse) split pairs, spinoffs, share transfers, and the ugly
 * truth of partial exports: a sell with no known lots produces an "orphan"
 * closure with unknown basis instead of crashing or silently inventing P&L.
 */

import { allocateCents } from "../model/money";

export interface EngineTx {
  id: number;
  date: string;
  type: string;
  symbol: string | null;
  cusip: string | null;
  description?: string | null;
  qtyMicro: number | null;
  amountCents: number | null;
}

export interface OpenLot {
  symbol: string;
  openDate: string;
  openTxId: number | null;
  qtyMicro: number;
  remainingMicro: number;
  costCents: number | null; // original cost of the full lot; null = unknown basis
  costRemainingCents: number | null;
  isMoneyMarket: boolean;
}

export interface Closure {
  symbol: string;
  openDate: string | null;
  closeDate: string;
  closeTxId: number | null;
  qtyMicro: number;
  proceedsCents: number;
  basisCents: number | null;
  gainCents: number | null;
  holdingDays: number | null;
  orphan: boolean;
  isMoneyMarket: boolean;
}

export interface LotEngineResult {
  openLots: OpenLot[];
  closures: Closure[];
  warnings: string[];
}

function isMoneyMarketSymbol(symbol: string | null, description?: string | null): boolean {
  if (!symbol) return false;
  if (symbol === "SPAXX" || symbol === "FDRXX" || symbol === "SPRXX") return true;
  return (description ?? "").toUpperCase().includes("MONEY MARKET");
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

const OPEN_TYPES = new Set(["buy", "reinvest", "merger_in", "spinoff_in", "shares_in", "split_in"]);
const CLOSE_TYPES = new Set(["sell", "merger_out", "shares_out", "split_out"]);

export function runLotEngine(txs: EngineTx[]): LotEngineResult {
  const warnings: string[] = [];
  const closures: Closure[] = [];
  /** open lots per symbol key, FIFO order */
  const book = new Map<string, OpenLot[]>();

  const keyOf = (t: EngineTx) => t.symbol ?? (t.cusip ? `cusip:${t.cusip}` : null);

  // Pre-scan for split pairs: same date, symbol-ish, one negative + one positive qty.
  const splitPairs = new Map<number, { ratioNum: number; ratioDen: number }>(); // keyed by split_in tx id
  const consumedSplitOuts = new Set<number>();
  const splitIns = txs.filter((t) => t.type === "split_in" && (t.qtyMicro ?? 0) > 0);
  for (const sin of splitIns) {
    const out = txs.find(
      (t) =>
        t.type === "split_out" &&
        !consumedSplitOuts.has(t.id) &&
        t.date === sin.date &&
        (t.qtyMicro ?? 0) < 0,
    );
    if (out && out.qtyMicro && sin.qtyMicro) {
      consumedSplitOuts.add(out.id);
      splitPairs.set(sin.id, { ratioNum: sin.qtyMicro, ratioDen: -out.qtyMicro });
    }
  }

  for (const t of txs) {
    const key = keyOf(t);
    if (!key) continue;
    const qty = t.qtyMicro ?? 0;
    const mm = isMoneyMarketSymbol(t.symbol, t.description);

    if (t.type === "split_in" && splitPairs.has(t.id)) {
      // rescale every open lot of this symbol; basis unchanged
      const { ratioNum, ratioDen } = splitPairs.get(t.id)!;
      const lots = book.get(key) ?? [];
      for (const lot of lots) {
        lot.qtyMicro = Math.round((lot.qtyMicro * ratioNum) / ratioDen);
        lot.remainingMicro = Math.round((lot.remainingMicro * ratioNum) / ratioDen);
      }
      continue;
    }
    if (t.type === "split_out" && consumedSplitOuts.has(t.id)) continue;

    if (OPEN_TYPES.has(t.type)) {
      if (qty <= 0) {
        warnings.push(`${t.date} ${key}: ${t.type} with non-positive quantity, ignored.`);
        continue;
      }
      const cost =
        t.amountCents != null
          ? Math.abs(t.amountCents)
          : t.type === "shares_in" || t.type === "spinoff_in"
            ? null
            : 0;
      const lots = book.get(key) ?? [];
      lots.push({
        symbol: key,
        openDate: t.date,
        openTxId: t.id,
        qtyMicro: qty,
        remainingMicro: qty,
        costCents: cost,
        costRemainingCents: cost,
        isMoneyMarket: mm,
      });
      book.set(key, lots);
      continue;
    }

    if (CLOSE_TYPES.has(t.type)) {
      let toClose = Math.abs(qty);
      if (toClose === 0) continue;
      const totalProceeds = t.amountCents ?? 0;
      const lots = book.get(key) ?? [];

      // collect consumed slices first so proceeds can be allocated exactly
      const slices: { lot: OpenLot | null; qtyMicro: number }[] = [];
      while (toClose > 0 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(lot.remainingMicro, toClose);
        slices.push({ lot, qtyMicro: take });
        lot.remainingMicro -= take;
        toClose -= take;
        if (lot.remainingMicro === 0) lots.shift();
      }
      if (toClose > 0) {
        slices.push({ lot: null, qtyMicro: toClose }); // orphan remainder
        if (!mm) {
          warnings.push(
            `${t.date} ${key}: sold ${(Math.abs(qty) / 1e6).toFixed(6)} but only ${((Math.abs(qty) - toClose) / 1e6).toFixed(6)} had known lots (pre-history not imported?).`,
          );
        }
      }

      const proceedsParts = allocateCents(totalProceeds, slices.map((s) => s.qtyMicro));
      slices.forEach((slice, i) => {
        const proceeds = proceedsParts[i];
        if (slice.lot) {
          const lot = slice.lot;
          let basis: number | null = null;
          if (lot.costCents != null && lot.costRemainingCents != null) {
            // proportional share of remaining cost, exact-cent via rounding;
            // when the lot is fully consumed use the exact remainder
            basis =
              lot.remainingMicro === 0
                ? lot.costRemainingCents
                : Math.round((lot.costCents * slice.qtyMicro) / lot.qtyMicro);
            lot.costRemainingCents -= basis;
          }
          closures.push({
            symbol: key,
            openDate: lot.openDate,
            closeDate: t.date,
            closeTxId: t.id,
            qtyMicro: slice.qtyMicro,
            proceedsCents: proceeds,
            basisCents: basis,
            gainCents: basis != null ? proceeds - basis : null,
            holdingDays: daysBetween(lot.openDate, t.date),
            orphan: false,
            isMoneyMarket: lot.isMoneyMarket || mm,
          });
        } else {
          closures.push({
            symbol: key,
            openDate: null,
            closeDate: t.date,
            closeTxId: t.id,
            qtyMicro: slice.qtyMicro,
            proceedsCents: proceeds,
            basisCents: null,
            gainCents: null,
            holdingDays: null,
            orphan: true,
            isMoneyMarket: mm,
          });
        }
      });
      continue;
    }
  }

  const openLots = [...book.values()].flat().filter((l) => l.remainingMicro > 0);
  return { openLots, closures, warnings };
}
