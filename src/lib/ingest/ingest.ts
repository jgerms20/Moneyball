/**
 * Writes a ParseResult into the database with cross-file dedupe.
 *
 * Dedupe strategy: each canonical row gets a natural-key hash of its
 * economically meaningful fields. Within one file, identical rows get
 * ordinals 0..n-1 (two genuinely identical $50 buys on the same day both
 * survive). Across overlapping exports the same (key, ordinal) pair is
 * skipped, so re-importing a wider date range never double-counts.
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "../db/client";
import {
  accounts,
  importFiles,
  skippedRows,
  taxDividends,
  taxForms,
  taxLots,
  transactions,
} from "../db/schema";
import type { CanonicalTx, Parsed1099, ParseResult } from "../model/types";
import { occKey } from "../model/types";

export function txNaturalKey(accountId: string, t: CanonicalTx): string {
  const h = createHash("sha1");
  h.update(
    [
      accountId,
      t.date,
      t.execTime ?? "",
      t.type,
      t.symbol ?? "",
      t.cusip ?? "",
      t.option ? occKey(t.option) : "",
      t.qtyMicro ?? "",
      t.priceMicro ?? "",
      t.amountCents ?? "",
      t.settleDate ?? "",
    ].join("|"),
  );
  return h.digest("hex").slice(0, 24);
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export interface IngestOptions {
  db: DB;
  fileName: string;
  fileContent: string | Buffer;
  accountId: string;
  accountLabel?: string;
  broker?: string;
  book?: "equity" | "options";
  kind?: "brokerage" | "ira";
}

export interface IngestSummary {
  importFileId: number | null;
  imported: number;
  deduped: number;
  skipped: number;
  alreadyImportedFile: boolean;
  warnings: string[];
}

export function ensureAccount(
  db: DB,
  id: string,
  opts: { broker?: string; label?: string; book?: string; kind?: string } = {},
): void {
  const existing = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (existing) return;
  db.insert(accounts)
    .values({
      id,
      broker: opts.broker ?? id.split(":")[0] ?? "unknown",
      label: opts.label ?? id,
      book: opts.book ?? "equity",
      kind: opts.kind ?? "brokerage",
      createdAt: new Date().toISOString(),
    })
    .run();
}

export function ingestParseResult(opts: IngestOptions, result: ParseResult): IngestSummary {
  const { db } = opts;
  const fileSha = sha256(opts.fileContent);
  const existingFile = db
    .select()
    .from(importFiles)
    .where(eq(importFiles.sha256, fileSha))
    .get();
  if (existingFile) {
    return {
      importFileId: existingFile.id,
      imported: 0,
      deduped: 0,
      skipped: 0,
      alreadyImportedFile: true,
      warnings: [`File already imported on ${existingFile.importedAt} (identical content).`],
    };
  }

  ensureAccount(db, opts.accountId, {
    broker: opts.broker,
    label: opts.accountLabel,
    book: opts.book,
    kind: opts.kind,
  });

  const fileRow = db
    .insert(importFiles)
    .values({
      fileName: opts.fileName,
      source: result.source,
      sha256: fileSha,
      accountId: opts.accountId,
      importedAt: new Date().toISOString(),
      warnings: JSON.stringify(result.warnings ?? []),
    })
    .returning({ id: importFiles.id })
    .get();

  let imported = 0;
  let deduped = 0;

  const keyCounts = new Map<string, number>();
  db.transaction(() => {
    for (const t of result.transactions) {
      const key = txNaturalKey(opts.accountId, t);
      const ordinal = keyCounts.get(key) ?? 0;
      keyCounts.set(key, ordinal + 1);
      const inserted = db
        .insert(transactions)
        .values({
          accountId: opts.accountId,
          importFileId: fileRow.id,
          source: result.source,
          txKey: key,
          keyOrdinal: ordinal,
          date: t.date,
          execTime: t.execTime ?? null,
          settleDate: t.settleDate ?? null,
          type: t.type,
          action: t.action,
          symbol: t.symbol ?? null,
          cusip: t.cusip ?? null,
          description: t.description ?? null,
          occKey: t.option ? occKey(t.option) : null,
          underlying: t.option?.underlying ?? null,
          expiry: t.option?.expiry ?? null,
          strikeMicro: t.option?.strikeMicro ?? null,
          right: t.option?.right ?? null,
          multiplier: t.option?.multiplier ?? null,
          qtyMicro: t.qtyMicro ?? null,
          priceMicro: t.priceMicro ?? null,
          amountCents: t.amountCents ?? null,
          feesCents: t.feesCents ?? null,
          commissionCents: t.commissionCents ?? null,
          cashBalanceCents: t.cashBalanceCents ?? null,
          strategyLabel: t.strategyLabel ?? null,
          raw: JSON.stringify(t.raw),
        })
        .onConflictDoNothing()
        .run();
      if (inserted.changes > 0) imported++;
      else deduped++;
    }
  });

  for (const s of result.skipped) {
    db.insert(skippedRows)
      .values({ importFileId: fileRow.id, lineNo: s.lineNo, raw: s.raw, reason: s.reason })
      .run();
  }

  db.update(importFiles)
    .set({ rowsImported: imported, rowsDeduped: deduped, rowsSkipped: result.skipped.length })
    .where(eq(importFiles.id, fileRow.id))
    .run();

  return {
    importFileId: fileRow.id,
    imported,
    deduped,
    skipped: result.skipped.length,
    alreadyImportedFile: false,
    warnings: result.warnings,
  };
}

/* ------------------------------ 1099 ingest ------------------------------ */

export interface Ingest1099Summary {
  importFileId: number;
  lots: number;
  lotsDeduped: number;
  dividends: number;
  dividendsDeduped: number;
  forms: number;
  warnings: string[];
}

export function ingest1099(
  opts: { db: DB; fileName: string; fileContent: string | Buffer },
  parsed: Parsed1099,
): Ingest1099Summary {
  const { db } = opts;
  const fileSha = sha256(opts.fileContent);
  const existingFile = db.select().from(importFiles).where(eq(importFiles.sha256, fileSha)).get();
  if (existingFile) {
    return {
      importFileId: existingFile.id,
      lots: 0,
      lotsDeduped: 0,
      dividends: 0,
      dividendsDeduped: 0,
      forms: 0,
      warnings: [`File already imported on ${existingFile.importedAt} (identical content).`],
    };
  }

  const fileRow = db
    .insert(importFiles)
    .values({
      fileName: opts.fileName,
      source: "fidelity_1099_pdf",
      sha256: fileSha,
      accountId: parsed.accountNo,
      importedAt: new Date().toISOString(),
      warnings: JSON.stringify(parsed.warnings ?? []),
    })
    .returning({ id: importFiles.id })
    .get();

  const year = parsed.year ?? 0;
  let lotsInserted = 0;
  let lotsDeduped = 0;
  const lotKeyCounts = new Map<string, number>();
  for (const lot of parsed.lots) {
    const base = [
      year, parsed.accountNo, lot.cusip ?? lot.symbol ?? lot.description, lot.qtyMicro,
      lot.acquired, lot.sold, lot.proceedsCents, lot.basisCents,
    ].join("|");
    const n = lotKeyCounts.get(base) ?? 0;
    lotKeyCounts.set(base, n + 1);
    const res = db
      .insert(taxLots)
      .values({
        year,
        accountNo: parsed.accountNo,
        importFileId: fileRow.id,
        description: lot.description,
        symbol: lot.symbol ?? null,
        cusip: lot.cusip ?? null,
        qtyMicro: lot.qtyMicro,
        acquired: lot.acquired,
        sold: lot.sold,
        proceedsCents: lot.proceedsCents,
        basisCents: lot.basisCents,
        washDisallowedCents: lot.washDisallowedCents,
        gainCents: lot.gainCents,
        term: lot.term,
        basisReported: lot.basisReported,
        dedupeKey: sha256(`${base}|${n}`).slice(0, 24),
      })
      .onConflictDoNothing()
      .run();
    if (res.changes > 0) lotsInserted++;
    else lotsDeduped++;
  }

  let divInserted = 0;
  let divDeduped = 0;
  const divKeyCounts = new Map<string, number>();
  for (const d of parsed.dividends) {
    const base = [year, parsed.accountNo, d.cusip ?? d.symbol ?? d.description, d.date, d.ordinaryCents].join("|");
    const n = divKeyCounts.get(base) ?? 0;
    divKeyCounts.set(base, n + 1);
    const res = db
      .insert(taxDividends)
      .values({
        year,
        accountNo: parsed.accountNo,
        importFileId: fileRow.id,
        description: d.description,
        symbol: d.symbol ?? null,
        cusip: d.cusip ?? null,
        date: d.date,
        ordinaryCents: d.ordinaryCents,
        qualifiedCents: d.qualifiedCents,
        dedupeKey: sha256(`${base}|${n}`).slice(0, 24),
      })
      .onConflictDoNothing()
      .run();
    if (res.changes > 0) divInserted++;
    else divDeduped++;
  }

  let forms = 0;
  if (parsed.summary && (parsed.lots.length > 0 || parsed.summary.totalOrdinaryDividendsCents != null)) {
    db.insert(taxForms)
      .values({
        year,
        accountNo: parsed.accountNo,
        importFileId: fileRow.id,
        form: "consolidated-1099",
        payload: JSON.stringify(parsed.summary),
      })
      .run();
    forms++;
  }
  if (parsed.retirement) {
    db.insert(taxForms)
      .values({
        year, accountNo: parsed.accountNo, importFileId: fileRow.id,
        form: "1099-R", payload: JSON.stringify(parsed.retirement),
      })
      .run();
    forms++;
  }
  if (parsed.form5498) {
    db.insert(taxForms)
      .values({
        year, accountNo: parsed.form5498.accountNo ?? parsed.accountNo, importFileId: fileRow.id,
        form: "5498", payload: JSON.stringify(parsed.form5498),
      })
      .run();
    forms++;
  }

  db.update(importFiles)
    .set({ rowsImported: lotsInserted + divInserted + forms, rowsDeduped: lotsDeduped + divDeduped })
    .where(eq(importFiles.id, fileRow.id))
    .run();

  return {
    importFileId: fileRow.id,
    lots: lotsInserted,
    lotsDeduped,
    dividends: divInserted,
    dividendsDeduped: divDeduped,
    forms,
    warnings: parsed.warnings,
  };
}
