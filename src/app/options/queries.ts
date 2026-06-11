/**
 * Server-only helpers for the Options Psyche page.
 * Computes monthly aggregates for stress-correlation overlay.
 */
import "server-only";
import { sql, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { optionPositions } from "@/lib/db/schema";

export interface MonthlyOptionCount {
  month: string; // YYYY-MM
  tradeCount: number;
  realizedCents: number;
}

/** Trades opened per calendar month (for stress-correlation chart). */
export function getMonthlyOptionCounts(): MonthlyOptionCount[] {
  const d = getDb();
  const rows = d
    .select({
      month: sql<string>`substr(${optionPositions.openedAt}, 1, 7)`,
      tradeCount: sql<number>`count(*)`,
      realizedCents: sql<number>`coalesce(sum(${optionPositions.realizedCents}), 0)`,
    })
    .from(optionPositions)
    .groupBy(sql`substr(${optionPositions.openedAt}, 1, 7)`)
    .orderBy(asc(sql`substr(${optionPositions.openedAt}, 1, 7)`))
    .all();
  return rows.map((r) => ({
    month: r.month,
    tradeCount: Number(r.tradeCount),
    realizedCents: Number(r.realizedCents),
  }));
}
