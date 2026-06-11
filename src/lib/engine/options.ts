/**
 * Options position engine.
 *
 * Groups fills by (account, OCC key) and pairs open/close into position
 * "cycles": a cycle starts when net contracts leave zero and ends when they
 * return to zero (or the contract expires/assigns). Realized P&L for a cycle
 * is simply its accumulated signed cash. Works for long and short positions,
 * partial closes, and re-entries (each re-entry is a fresh cycle).
 */

import { QTY_SCALE } from "../model/money";

export interface OptionTx {
  id: number;
  date: string;
  execTime?: string | null;
  type: string;
  occKey: string;
  underlying: string;
  expiry: string;
  strikeMicro: number;
  right: string;
  qtyMicro: number | null;
  amountCents: number | null;
  feesCents: number | null;
  strategyLabel?: string | null;
}

export interface OptionPositionCycle {
  occKey: string;
  underlying: string;
  expiry: string;
  strikeMicro: number;
  right: string;
  direction: "long" | "short";
  openedAt: string;
  closedAt: string | null;
  peakContracts: number;
  openPremiumCents: number;
  closePremiumCents: number;
  realizedCents: number | null;
  feesCents: number;
  status: "open" | "closed";
  outcome: "closed" | "expired" | "assigned" | "exercised" | null;
  dteAtOpen: number | null;
  strategyLabel: string | null;
  fills: { txId: number; role: "open" | "close" | "expire" | "assign" | "exercise" }[];
}

export interface OptionsEngineResult {
  positions: OptionPositionCycle[];
  warnings: string[];
}

const OPENS = new Set(["option_buy_to_open", "option_sell_to_open"]);
const CLOSES = new Set(["option_buy_to_close", "option_sell_to_close"]);
const TERMINALS = new Set(["option_expired", "option_assigned", "option_exercise"]);

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function runOptionsEngine(txs: OptionTx[]): OptionsEngineResult {
  const warnings: string[] = [];
  const positions: OptionPositionCycle[] = [];
  const byKey = new Map<string, OptionTx[]>();
  for (const t of txs) {
    const list = byKey.get(t.occKey) ?? [];
    list.push(t);
    byKey.set(t.occKey, list);
  }

  for (const [key, list] of byKey) {
    list.sort((a, b) => (a.execTime ?? a.date).localeCompare(b.execTime ?? b.date) || a.id - b.id);
    let cycle: OptionPositionCycle | null = null;
    let net = 0; // signed contracts

    const closeCycle = (
      at: string,
      outcome: OptionPositionCycle["outcome"],
    ) => {
      if (!cycle) return;
      cycle.closedAt = at;
      cycle.status = "closed";
      cycle.outcome = outcome;
      cycle.realizedCents = cycle.openPremiumCents + cycle.closePremiumCents;
      positions.push(cycle);
      cycle = null;
    };

    for (const t of list) {
      const contracts = Math.round((t.qtyMicro ?? 0) / QTY_SCALE);
      const cash = t.amountCents ?? 0;
      const fees = Math.abs(t.feesCents ?? 0);

      if (OPENS.has(t.type)) {
        const signed =
          t.type === "option_buy_to_open" ? Math.abs(contracts) : -Math.abs(contracts);
        if (!cycle) {
          cycle = {
            occKey: key,
            underlying: t.underlying,
            expiry: t.expiry,
            strikeMicro: t.strikeMicro,
            right: t.right,
            direction: signed > 0 ? "long" : "short",
            openedAt: t.execTime ?? t.date,
            closedAt: null,
            peakContracts: Math.abs(signed),
            openPremiumCents: cash,
            closePremiumCents: 0,
            realizedCents: null,
            feesCents: fees,
            status: "open",
            outcome: null,
            dteAtOpen: daysBetween(t.date, t.expiry),
            strategyLabel: t.strategyLabel ?? null,
            fills: [{ txId: t.id, role: "open" }],
          };
        } else {
          cycle.openPremiumCents += cash;
          cycle.feesCents += fees;
          cycle.fills.push({ txId: t.id, role: "open" });
        }
        net += signed;
        if (cycle) cycle.peakContracts = Math.max(cycle.peakContracts, Math.abs(net));
        continue;
      }

      if (CLOSES.has(t.type)) {
        const signed =
          t.type === "option_buy_to_close" ? Math.abs(contracts) : -Math.abs(contracts);
        if (!cycle) {
          warnings.push(`${t.date} ${key}: close with no open position (partial export?).`);
          cycle = {
            occKey: key,
            underlying: t.underlying,
            expiry: t.expiry,
            strikeMicro: t.strikeMicro,
            right: t.right,
            direction: signed > 0 ? "short" : "long", // closing direction implies original
            openedAt: t.execTime ?? t.date,
            closedAt: null,
            peakContracts: Math.abs(signed),
            openPremiumCents: 0,
            closePremiumCents: cash,
            realizedCents: null,
            feesCents: fees,
            status: "open",
            outcome: null,
            dteAtOpen: null,
            strategyLabel: t.strategyLabel ?? null,
            fills: [{ txId: t.id, role: "close" }],
          };
          net += signed;
          closeCycle(t.execTime ?? t.date, "closed");
          continue;
        }
        cycle.closePremiumCents += cash;
        cycle.feesCents += fees;
        cycle.fills.push({ txId: t.id, role: "close" });
        net += signed;
        if (net === 0) closeCycle(t.execTime ?? t.date, "closed");
        continue;
      }

      if (TERMINALS.has(t.type)) {
        const role =
          t.type === "option_expired" ? "expire" : t.type === "option_assigned" ? "assign" : "exercise";
        const outcome =
          t.type === "option_expired" ? "expired" : t.type === "option_assigned" ? "assigned" : "exercised";
        if (!cycle) {
          warnings.push(`${t.date} ${key}: ${role} with no open position (partial export?).`);
          continue;
        }
        cycle.fills.push({ txId: t.id, role });
        if (cash !== 0) cycle.closePremiumCents += cash;
        cycle.feesCents += Math.abs(t.feesCents ?? 0);
        net = 0;
        closeCycle(t.execTime ?? t.date, outcome);
        continue;
      }
    }

    if (cycle != null) {
      const c: OptionPositionCycle = cycle;
      // still open: contract may have silently expired in the past
      if (Date.parse(c.expiry) < Date.now() - 86_400_000 * 5) {
        warnings.push(
          `${key}: position still open past expiry ${c.expiry}; treating as expired worthless.`,
        );
        c.closedAt = c.expiry;
        c.status = "closed";
        c.outcome = "expired";
        c.realizedCents = c.openPremiumCents + c.closePremiumCents;
      }
      positions.push(c);
    }
  }

  positions.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  return { positions, warnings };
}
