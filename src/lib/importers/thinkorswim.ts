/**
 * Importer for thinkorswim "Account Statement" CSV exports
 * (Monitor -> Account Statement -> export).
 *
 * The file is multi-section: "Cash Balance", "Futures Statements",
 * "Account Trade History", "Profits and Losses", "Account Summary", ...
 * Each section is a title line, then a header row, then rows; sections are
 * separated by blank lines. We parse Account Trade History into canonical
 * option/equity fills and surface other sections' row counts as warnings.
 *
 * Account Trade History columns (first column is blank):
 *   ,Exec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Net Price,Order Type
 * Multi-leg orders leave Exec Time/Spread blank on continuation rows.
 */

import { parseCsvLines, zipRow } from "./csv";
import { parseCents, parsePriceMicro, parseQtyMicro, PRICE_SCALE, QTY_SCALE } from "../model/money";
import type { CanonicalTx, OptionRef, ParseResult, SkippedRow, TxType } from "../model/types";

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** "16 JAN 26" or "16 JAN 2026" -> "2026-01-16" */
export function parseTosExpiry(raw: string): string | null {
  const m = raw.trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{2}|\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${month}-${m[1].padStart(2, "0")}`;
}

/** "1/15/25 10:30:15" -> { date: "2025-01-15", iso: "2025-01-15T10:30:15" } */
export function parseTosExecTime(raw: string): { date: string; iso: string } | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const date = `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const iso = `${date}T${m[4].padStart(2, "0")}:${m[5]}:${m[6] ?? "00"}`;
  return { date, iso };
}

function classify(side: string, posEffect: string, instrumentType: string): TxType {
  const isOption = instrumentType === "CALL" || instrumentType === "PUT";
  const buying = side === "BUY";
  const opening = posEffect.includes("OPEN");
  if (!isOption) return buying ? "buy" : "sell";
  if (buying && opening) return "option_buy_to_open";
  if (buying && !opening) return "option_buy_to_close";
  if (!buying && opening) return "option_sell_to_open";
  return "option_sell_to_close";
}

export function parseThinkorswimStatement(content: string): ParseResult {
  const lines = parseCsvLines(content);
  const transactions: CanonicalTx[] = [];
  const skipped: SkippedRow[] = [];
  const warnings: string[] = [];
  let accountHint: string | null = null;

  const acctLine = lines.find((l) => /account statement for/i.test(l.raw));
  if (acctLine) {
    const m = acctLine.raw.match(/account statement for\s+([\w*.-]+)/i);
    if (m) accountHint = m[1];
  }

  // Locate the Account Trade History section.
  const sectionIdx = lines.findIndex((l) =>
    l.fields.some((f) => f.trim().toLowerCase() === "account trade history"),
  );
  if (sectionIdx === -1) {
    const sections = lines
      .filter((l) => l.fields.filter(Boolean).length === 1 && /^[A-Za-z][A-Za-z\s]+$/.test(l.fields.find(Boolean) ?? ""))
      .map((l) => l.raw.replace(/,+$/, "").trim());
    return {
      source: "thinkorswim_statement",
      accountHint,
      transactions,
      skipped: [],
      warnings: [
        `No "Account Trade History" section found. Sections present: ${sections.join(", ") || "none detected"}.`,
      ],
    };
  }

  const headerLine = lines[sectionIdx + 1];
  if (!headerLine || !headerLine.fields.some((f) => f.trim() === "Exec Time")) {
    return {
      source: "thinkorswim_statement",
      accountHint,
      transactions,
      skipped: [],
      warnings: ["Found Account Trade History but its header row is missing an 'Exec Time' column."],
    };
  }
  const header = headerLine.fields.map((f) => f.trim());

  let lastExec: { date: string; iso: string } | null = null;
  let lastSpread: string | null = null;

  for (const line of lines.slice(sectionIdx + 2)) {
    const nonEmpty = line.fields.filter((f) => f.trim() !== "");
    // a new section title (single non-empty cell, alphabetic) ends trade history
    if (nonEmpty.length <= 1 && /^[A-Za-z][A-Za-z\s&]+$/.test(nonEmpty[0] ?? "")) break;

    const row = zipRow(header, line.fields);
    const execRaw = (row["Exec Time"] ?? "").trim();
    const exec = execRaw ? parseTosExecTime(execRaw) : lastExec;
    if (execRaw && !exec) {
      skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: `bad exec time: ${execRaw}` });
      continue;
    }
    if (!exec) {
      skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: "row without exec time context" });
      continue;
    }
    lastExec = exec;
    const spread = (row["Spread"] ?? "").trim() || lastSpread;
    lastSpread = spread;

    const side = (row["Side"] ?? "").trim().toUpperCase();
    const posEffect = (row["Pos Effect"] ?? "").trim().toUpperCase();
    const instrumentType = (row["Type"] ?? "").trim().toUpperCase();
    const symbol = (row["Symbol"] ?? "").trim().toUpperCase();
    const qtyMicro = parseQtyMicro(row["Qty"]);
    const priceMicro = parsePriceMicro(row["Price"]);

    if (!side || !symbol || qtyMicro == null) {
      skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: "missing side/symbol/qty" });
      continue;
    }

    let option: OptionRef | null = null;
    if (instrumentType === "CALL" || instrumentType === "PUT") {
      const expiry = parseTosExpiry((row["Exp"] ?? "").trim());
      const strikeMicro = parsePriceMicro(row["Strike"]);
      if (!expiry || strikeMicro == null) {
        skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: "option row missing expiry/strike" });
        continue;
      }
      option = {
        underlying: symbol,
        expiry,
        strikeMicro,
        right: instrumentType === "CALL" ? "C" : "P",
        multiplier: 100,
      };
    }

    const type = classify(side, posEffect, instrumentType);
    const contracts = qtyMicro / QTY_SCALE;
    // thinkorswim trade history has no cash amount column; derive it.
    const amountCents =
      priceMicro != null
        ? -Math.round((contracts * priceMicro * (option ? option.multiplier : 1)) / (PRICE_SCALE / 100))
        : null;

    transactions.push({
      date: exec.date,
      execTime: exec.iso,
      type,
      action: `${side} ${posEffect}`.trim(),
      symbol,
      option,
      qtyMicro,
      priceMicro,
      amountCents,
      strategyLabel: spread,
      raw: row,
    });
  }

  transactions.sort((a, b) => (a.execTime ?? a.date).localeCompare(b.execTime ?? b.date));

  return { source: "thinkorswim_statement", accountHint, transactions, skipped, warnings };
}
