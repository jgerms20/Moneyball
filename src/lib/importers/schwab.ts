/**
 * Importer for Schwab transaction history CSV ("Export" on schwab.com History).
 *
 * Layout: optional title line ("Transactions for account ... as of ..."),
 * then a header row: Date, Action, Symbol, Description, Quantity, Price,
 * "Fees & Comm", Amount. Money fields look like "$0.85" / "-$85.65".
 * Dates may be "MM/DD/YYYY" or "MM/DD/YYYY as of MM/DD/YYYY".
 *
 * Option symbols are OCC-ish: "AMC 01/16/2026 5.00 C".
 */

import { parseCsvLines, zipRow, usDateToIso } from "./csv";
import { parseCents, parsePriceMicro, parseQtyMicro } from "../model/money";
import { PRICE_SCALE, QTY_SCALE } from "../model/money";
import type { CanonicalTx, OptionRef, ParseResult, SkippedRow, TxType } from "../model/types";

const OPTION_SYMBOL_RE = /^([A-Z][A-Z0-9./]{0,9})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+(?:\.\d+)?)\s+([CP])$/;

export function parseSchwabOptionSymbol(symbol: string): OptionRef | null {
  const m = symbol.trim().match(OPTION_SYMBOL_RE);
  if (!m) return null;
  const expiry = usDateToIso(m[2]);
  if (!expiry) return null;
  return {
    underlying: m[1],
    expiry,
    strikeMicro: Math.round(parseFloat(m[3]) * PRICE_SCALE),
    right: m[4] as "C" | "P",
    multiplier: 100,
  };
}

function classify(action: string, isOption: boolean): TxType {
  const a = action.trim().toLowerCase();
  switch (a) {
    case "buy to open":
      return "option_buy_to_open";
    case "sell to open":
      return "option_sell_to_open";
    case "buy to close":
      return "option_buy_to_close";
    case "sell to close":
      return "option_sell_to_close";
    case "expired":
      return "option_expired";
    case "assigned":
      return "option_assigned";
    case "exchange or exercise":
      return "option_exercise";
    case "buy":
    case "reinvest shares":
      return isOption ? "option_buy_to_open" : a === "buy" ? "buy" : "reinvest";
    case "sell":
      return isOption ? "option_sell_to_close" : "sell";
    case "cash dividend":
    case "qualified dividend":
    case "non-qualified div":
    case "pr yr cash div":
    case "reinvest dividend":
      return "dividend";
    case "credit interest":
    case "bank interest":
      return "interest";
    case "moneylink transfer":
    case "moneylink deposit":
    case "wire received":
    case "journal":
      return "transfer_in"; // sign of Amount decides; fixed below
    case "moneylink withdrawal":
    case "wire sent":
      return "transfer_out";
    case "service fee":
    case "misc cash entry":
    case "foreign tax paid":
      return "fee";
    case "stock split":
      return "split_in";
    case "security transfer":
      return "shares_in"; // sign fixed below
    default:
      return "other";
  }
}

export function parseSchwabCsv(content: string): ParseResult {
  const lines = parseCsvLines(content);
  const transactions: CanonicalTx[] = [];
  const skipped: SkippedRow[] = [];
  const warnings: string[] = [];
  let accountHint: string | null = null;

  const headerIdx = lines.findIndex(
    (l) =>
      (l.fields[0] ?? "").trim().toLowerCase() === "date" &&
      l.fields.some((f) => f.trim().toLowerCase() === "action"),
  );
  if (headerIdx === -1) {
    return {
      source: "schwab_csv",
      transactions,
      skipped: lines.map((l) => ({ lineNo: l.lineNo, raw: l.raw, reason: "no header found" })),
      warnings: ["Could not find the Schwab header row."],
    };
  }

  for (const line of lines.slice(0, headerIdx)) {
    const m = line.raw.match(/account\s+([\w.\s-]*\.{0,3}[\w-]+)\s+as of/i);
    if (m) accountHint = m[1].trim();
  }

  const header = lines[headerIdx].fields.map((f) => f.trim());

  for (const line of lines.slice(headerIdx + 1)) {
    const row = zipRow(header, line.fields);
    const rawDate = (row["Date"] ?? "").trim();
    if (!rawDate || /^transactions total/i.test(rawDate)) {
      skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: "footer/empty row" });
      continue;
    }
    // "07/01/2024 as of 06/28/2024" -> trade date is the "as of" date
    const asOf = rawDate.match(/^(\d{2}\/\d{2}\/\d{4})\s+as of\s+(\d{2}\/\d{2}\/\d{4})$/i);
    const date = usDateToIso(asOf ? asOf[2] : rawDate);
    if (!date) {
      skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: `unparseable date: ${rawDate}` });
      continue;
    }

    const action = (row["Action"] ?? "").trim();
    const symbolRaw = (row["Symbol"] ?? "").trim();
    const option = symbolRaw ? parseSchwabOptionSymbol(symbolRaw) : null;
    let type = classify(action, option != null);

    const amountCents = parseCents(row["Amount"]);
    let qtyMicro = parseQtyMicro(row["Quantity"]);

    if (type === "other" && amountCents == null && qtyMicro == null) {
      skipped.push({ lineNo: line.lineNo, raw: line.raw.slice(0, 300), reason: `unrecognized action: ${action}` });
      continue;
    }

    // Schwab reports positive quantities; make sells/closes negative.
    if (qtyMicro != null && qtyMicro > 0) {
      if (
        type === "sell" ||
        type === "option_sell_to_close" ||
        type === "option_sell_to_open" ||
        type === "shares_out"
      ) {
        qtyMicro = -qtyMicro;
      }
      // Expirations/assignments remove whatever was held; engine resolves sign.
    }

    // Transfers/journals: trust the cash sign over the action label.
    if ((type === "transfer_in" || type === "transfer_out") && amountCents != null) {
      type = amountCents >= 0 ? "transfer_in" : "transfer_out";
    }
    if (type === "shares_in" && qtyMicro != null && qtyMicro < 0) type = "shares_out";

    transactions.push({
      date,
      type,
      action,
      symbol: option ? option.underlying : symbolRaw || null,
      description: (row["Description"] ?? "").trim() || null,
      option,
      qtyMicro,
      priceMicro: parsePriceMicro(row["Price"]),
      amountCents,
      feesCents: parseCents(row["Fees & Comm"]),
      raw: row,
    });
  }

  // Schwab exports are roughly newest-first ("as of" rows break strict
  // ordering); reverse then stable-sort by date.
  transactions.reverse();
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  const unknown = transactions.filter((t) => t.type === "other").length;
  if (unknown > 0) warnings.push(`${unknown} rows had unrecognized actions and were imported as "other".`);

  return { source: "schwab_csv", accountHint, transactions, skipped, warnings };
}

/** Contracts as whole numbers for option rows (Schwab quantity is contracts). */
export function contractsFromQtyMicro(qtyMicro: number | null | undefined): number {
  if (qtyMicro == null) return 0;
  return Math.round(qtyMicro / QTY_SCALE);
}
