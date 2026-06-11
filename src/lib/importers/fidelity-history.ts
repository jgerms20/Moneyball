/**
 * Importer for Fidelity "History_for_Account_XXXX.csv" exports.
 *
 * Format quirks handled:
 *  - optional BOM, 2 junk/blank lines before the header
 *  - trailing disclaimer paragraphs and a "Date downloaded ..." line
 *  - Action strings with prefixes/suffixes:
 *      "YOU BOUGHT EX-DIV DATE 12/08/25RECORD DATE ... ALPHABET INC ..."
 *      "DIVIDEND RECEIVED as of Sep-01-2024 INTEL CORP ..."
 *  - EFT rows with empty or single-space Symbol and "No Description"
 *  - MERGER rows where Symbol is a 9-char CUSIP (e.g. 577096100)
 *  - REVERSE SPLIT pairs (negative qty out / positive qty in)
 *  - sells with negative Quantity, fractional shares everywhere
 */

import { parseCsvLines, zipRow, usDateToIso } from "./csv";
import { parseCents, parsePriceMicro, parseQtyMicro } from "../model/money";
import type { CanonicalTx, ParseResult, SkippedRow, TxType } from "../model/types";

const HEADER_PREFIX = ["Run Date", "Action", "Symbol", "Description"];

function looksLikeHeader(fields: string[]): boolean {
  return HEADER_PREFIX.every(
    (h, i) => (fields[i] ?? "").trim().toLowerCase() === h.toLowerCase(),
  );
}

const CUSIP_RE = /^[0-9A-Z]{9}$/;

export function classifyFidelityAction(action: string, qtyMicro: number | null): {
  type: TxType;
} {
  const a = action.trim().toUpperCase();
  if (a.startsWith("YOU BOUGHT")) return { type: "buy" };
  if (a.startsWith("YOU SOLD")) return { type: "sell" };
  if (a.startsWith("REINVESTMENT")) return { type: "reinvest" };
  if (a.startsWith("DIVIDEND RECEIVED")) return { type: "dividend" };
  if (a.startsWith("INTEREST")) return { type: "interest" };
  if (a.startsWith("ELECTRONIC FUNDS TRANSFER RECEIVED")) return { type: "transfer_in" };
  if (a.startsWith("ELECTRONIC FUNDS TRANSFER PAID")) return { type: "transfer_out" };
  if (a.includes("MERGER")) {
    if (a.includes("MER PAYOUT")) return { type: "merger_out" };
    if (a.includes("MER FROM")) return { type: "merger_in" };
    return { type: (qtyMicro ?? 0) < 0 ? "merger_out" : "merger_in" };
  }
  if (a.includes("REVERSE SPLIT") || a.includes("SPLIT R/S") || /\bSPLIT\b/.test(a)) {
    return { type: (qtyMicro ?? 0) < 0 ? "split_out" : "split_in" };
  }
  if (a.includes("SPINOFF") || a.includes("SPIN OFF") || a.includes("DISTRIBUTION SPIN")) {
    return { type: "spinoff_in" };
  }
  if (a.startsWith("TRANSFERRED FROM") || a.includes("TRANSFER OF ASSETS")) {
    return { type: (qtyMicro ?? 0) < 0 ? "shares_out" : "shares_in" };
  }
  if (a.includes("FEE") || a.includes("FOREIGN TAX")) return { type: "fee" };
  return { type: "other" };
}

export function parseFidelityHistoryCsv(content: string): ParseResult {
  const lines = parseCsvLines(content);
  const transactions: CanonicalTx[] = [];
  const skipped: SkippedRow[] = [];
  const warnings: string[] = [];

  const headerIdx = lines.findIndex((l) => looksLikeHeader(l.fields));
  if (headerIdx === -1) {
    return {
      source: "fidelity_history_csv",
      transactions,
      skipped: lines.map((l) => ({ lineNo: l.lineNo, raw: l.raw, reason: "no header found" })),
      warnings: ["Could not find the Fidelity history header row."],
    };
  }
  const header = lines[headerIdx].fields.map((f) => f.trim());

  for (const line of lines.slice(headerIdx + 1)) {
    const first = (line.fields[0] ?? "").trim();
    // Trailing disclaimers: long quoted prose rows or "Date downloaded ..."
    if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(first)) {
      const isProse =
        line.fields.length <= 2 ||
        /^date downloaded/i.test(first) ||
        first.length > 60;
      skipped.push({
        lineNo: line.lineNo,
        raw: line.raw.slice(0, 300),
        reason: isProse ? "non-transaction footer row" : "first column is not a date",
      });
      continue;
    }

    const row = zipRow(header, line.fields);
    const date = usDateToIso(row["Run Date"]);
    const action = row["Action"] ?? "";
    if (!date || !action) {
      skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: "missing date or action" });
      continue;
    }

    const qtyMicro = parseQtyMicro(row["Quantity"]);
    const { type } = classifyFidelityAction(action, qtyMicro);

    let symbol: string | null = (row["Symbol"] ?? "").trim() || null;
    let cusip: string | null = null;
    if (symbol && CUSIP_RE.test(symbol) && /\d/.test(symbol) && symbol.length === 9) {
      cusip = symbol;
      symbol = null;
    }

    const amountCents = parseCents(row["Amount ($)"]);
    if (type === "other" && amountCents == null && qtyMicro == null) {
      skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: `unrecognized action: ${action.slice(0, 80)}` });
      continue;
    }

    transactions.push({
      date,
      settleDate: usDateToIso(row["Settlement Date"]),
      type,
      action,
      symbol,
      cusip,
      description: (row["Description"] ?? "").trim() || null,
      qtyMicro,
      priceMicro: parsePriceMicro(row["Price ($)"]),
      amountCents,
      feesCents: parseCents(row["Fees ($)"]),
      commissionCents: parseCents(row["Commission ($)"]),
      cashBalanceCents: parseCents(row["Cash Balance ($)"]),
      raw: row,
    });
  }

  // Fidelity exports are roughly newest-first; normalize to chronological
  // order (stable sort keeps intra-day file order, reversed).
  transactions.reverse();
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  const unknown = transactions.filter((t) => t.type === "other").length;
  if (unknown > 0) warnings.push(`${unknown} rows had unrecognized actions and were imported as "other".`);

  return { source: "fidelity_history_csv", transactions, skipped, warnings };
}
