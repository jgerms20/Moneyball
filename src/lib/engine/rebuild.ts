/**
 * Rebuilds derived state (lots, closures, option positions) from the
 * canonical transactions table. Idempotent: wipes and recomputes.
 */

import { asc, eq, inArray } from "drizzle-orm";
import type { DB } from "../db/client";
import {
  accounts,
  lotClosures,
  lots,
  optionFills,
  optionPositions,
  transactions,
} from "../db/schema";
import { runLotEngine } from "./lots";
import { runOptionsEngine } from "./options";
import { OPTION_TYPES } from "../model/types";

export interface RebuildSummary {
  accounts: number;
  openLots: number;
  closures: number;
  optionPositions: number;
  warnings: string[];
}

export function rebuildDerived(db: DB): RebuildSummary {
  const warnings: string[] = [];
  db.delete(lots).run();
  db.delete(lotClosures).run();
  db.delete(optionPositions).run();
  db.delete(optionFills).run();

  const accts = db.select().from(accounts).all();
  let openLotCount = 0;
  let closureCount = 0;
  let positionCount = 0;

  for (const acct of accts) {
    const txs = db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, acct.id))
      .orderBy(asc(transactions.date), asc(transactions.id))
      .all();

    const equityTxs = txs.filter((t) => !OPTION_TYPES.has(t.type as never) && t.occKey == null);
    const optionTxs = txs.filter((t) => t.occKey != null);

    const lotResult = runLotEngine(
      equityTxs.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        symbol: t.symbol,
        cusip: t.cusip,
        description: t.description,
        qtyMicro: t.qtyMicro,
        amountCents: t.amountCents,
      })),
    );
    warnings.push(...lotResult.warnings.map((w) => `[${acct.label}] ${w}`));

    for (const lot of lotResult.openLots) {
      db.insert(lots)
        .values({
          accountId: acct.id,
          symbol: lot.symbol,
          openDate: lot.openDate,
          openTxId: lot.openTxId,
          qtyMicro: lot.qtyMicro,
          remainingMicro: lot.remainingMicro,
          costCents: lot.costCents,
          costRemainingCents: lot.costRemainingCents,
          isMoneyMarket: lot.isMoneyMarket,
        })
        .run();
      openLotCount++;
    }
    for (const c of lotResult.closures) {
      db.insert(lotClosures)
        .values({
          accountId: acct.id,
          symbol: c.symbol,
          openDate: c.openDate,
          closeDate: c.closeDate,
          closeTxId: c.closeTxId,
          qtyMicro: c.qtyMicro,
          proceedsCents: c.proceedsCents,
          basisCents: c.basisCents,
          gainCents: c.gainCents,
          holdingDays: c.holdingDays,
          orphan: c.orphan,
          isMoneyMarket: c.isMoneyMarket,
        })
        .run();
      closureCount++;
    }

    const optResult = runOptionsEngine(
      optionTxs.map((t) => ({
        id: t.id,
        date: t.date,
        execTime: t.execTime,
        type: t.type,
        occKey: t.occKey!,
        underlying: t.underlying ?? t.symbol ?? "?",
        expiry: t.expiry ?? "?",
        strikeMicro: t.strikeMicro ?? 0,
        right: t.right ?? "?",
        qtyMicro: t.qtyMicro,
        amountCents: t.amountCents,
        feesCents: t.feesCents,
        strategyLabel: t.strategyLabel,
      })),
    );
    warnings.push(...optResult.warnings.map((w) => `[${acct.label}] ${w}`));

    for (const p of optResult.positions) {
      const row = db
        .insert(optionPositions)
        .values({
          accountId: acct.id,
          occKey: p.occKey,
          underlying: p.underlying,
          expiry: p.expiry,
          strikeMicro: p.strikeMicro,
          right: p.right,
          direction: p.direction,
          openedAt: p.openedAt,
          closedAt: p.closedAt,
          peakContracts: p.peakContracts,
          openPremiumCents: p.openPremiumCents,
          closePremiumCents: p.closePremiumCents,
          realizedCents: p.realizedCents,
          feesCents: p.feesCents,
          status: p.status,
          outcome: p.outcome,
          dteAtOpen: p.dteAtOpen,
          strategyLabel: p.strategyLabel,
        })
        .returning({ id: optionPositions.id })
        .get();
      positionCount++;
      for (const f of p.fills) {
        db.insert(optionFills).values({ positionId: row.id, txId: f.txId, role: f.role }).run();
      }
    }
  }

  return {
    accounts: accts.length,
    openLots: openLotCount,
    closures: closureCount,
    optionPositions: positionCount,
    warnings,
  };
}
