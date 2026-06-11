/**
 * Importer for Fidelity consolidated 1099 (1099-B / DIV / INT), 1099-R and
 * Form 5498 PDFs. Works on *extracted text* (see pdf.ts for the PDF step),
 * so it is fixture-testable without binary PDFs.
 *
 * The pdf text mashes table cells together; rows look like:
 *   security:  "AMC ENTMT HLDGS INC CL A NEW,AMC,00165C302"
 *   lot:       " Sale5.00008/05/2411/26/2424.0824.70-0.62"
 *   dividend:  " 03/17/250.300.30"
 * Quantities have 3+ decimals, dates are MM/DD/YY, money always has exactly
 * two decimals — that makes the concatenated numbers unambiguous.
 */

import { usDateToIso } from "./csv";
import { parseCents } from "../model/money";
import { QTY_SCALE } from "../model/money";
import type {
  Parsed1099,
  TaxDividend1099,
  TaxLot1099,
} from "../model/types";

// Regexes tolerate both packed ("Sale5.00008/05/24...") and spaced
// ("Sale 5.000 08/05/24 ...") pdf text extraction styles.
const MONEY_TOKEN_RE = /-?[\d,]+\.\d{2}/g;
const LOT_RE =
  /^\s{0,3}(Sale|Sold|Short sale|Redemption|Exchange|Merger|Spinoff|Tender)\s*([\d,]+\.\d{3,6})\s*(\d{2}\/\d{2}\/\d{2}|VARIOUS)\s*(\d{2}\/\d{2}\/\d{2})(.*)$/;
const DIV_ROW_RE = /^\s{0,3}(\d{2}\/\d{2}\/\d{2})((?:\s*-?[\d,]+\.\d{2})+)\s*$/;
const SECURITY_RE = /^(\S.{1,80}?),\s*([A-Z][A-Z0-9.]{0,5}),\s*([0-9A-Z]{9})\s*$/;
const SECURITY_NO_SYMBOL_RE = /^(\S.{1,80}?),\s*\(?([0-9A-Z]{9})\)?\s*$/;

function tokensToCents(tail: string): number[] {
  const matches = tail.match(MONEY_TOKEN_RE) ?? [];
  return matches.map((m) => parseCents(m) ?? 0);
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

export function parseFidelity1099Text(text: string): Parsed1099 {
  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];
  const lots: TaxLot1099[] = [];
  const dividends: TaxDividend1099[] = [];

  let year: number | null = null;
  const yearMatch =
    text.match(/(\d{4})\s+TAX\s+REPORTING\s+STATEMENT/) ||
    text.match(/Summary of (\d{4}) Proceeds/) ||
    text.match(/(\d{4})\s+Form\s+5498/) ||
    text.match(/Form\s+1099-R[\s\S]{0,80}?(\d{4})/);
  if (yearMatch) year = parseInt(yearMatch[1], 10);

  const accountMatch =
    text.match(/\b([A-Z]\d{2}-\d{6})\b/) || text.match(/Account Number\s+([\d-]{6,})/);
  const accountNo = accountMatch ? accountMatch[1] : null;

  const recipientMatch = text.match(/Account No\.\s*([A-Z][A-Z'.\s-]{2,40})$/m);
  const recipient = recipientMatch ? recipientMatch[1].trim() : null;

  // ----- streaming state -----
  type Mode = "none" | "lots" | "dividends";
  let mode: Mode = "none";
  let term: "short" | "long" | "unknown" = "unknown";
  let basisReported = true;
  let security: { description: string; symbol: string | null; cusip: string | null } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const sq = squash(line);

    // section headers (these repeat on every page)
    if (sq.includes("shorttermtransactions") && sq.includes("basis")) {
      mode = "lots";
      term = "short";
      basisReported = !sq.includes("basisisnotreported");
      continue;
    }
    if (sq.includes("longtermtransactions") && sq.includes("basis")) {
      mode = "lots";
      term = "long";
      basisReported = !sq.includes("basisisnotreported");
      continue;
    }
    if (sq.includes("termisunknown")) {
      mode = "lots";
      term = "unknown";
      basisReported = false;
      continue;
    }
    if (sq.includes("totalordinarydividendsanddistributionsdetail")) {
      mode = "dividends";
      security = null;
      continue;
    }
    if (sq === "totals" || sq.startsWith("subtotals")) continue;

    if (mode === "lots") {
      const lot = line.match(LOT_RE);
      if (lot) {
        const qty = parseFloat(lot[2].replace(/,/g, ""));
        const acquiredIso = lot[3] === "VARIOUS" ? "VARIOUS" : usDateToIso(lot[3]);
        const soldIso = usDateToIso(lot[4]);
        const tail = lot[5];
        const toks = tokensToCents(tail);
        if (!soldIso || !acquiredIso || toks.length < 1 || Number.isNaN(qty)) {
          warnings.push(`Unparseable lot row: "${line.trim().slice(0, 120)}"`);
          continue;
        }
        let proceeds = 0;
        let basis: number | null = null;
        let wash: number | null = null;
        let gain: number | null = null;
        if (toks.length >= 5) {
          [proceeds, basis, , wash, gain] = toks; // proceeds, basis, mkt discount, wash, gain
        } else if (toks.length === 4) {
          [proceeds, basis, wash, gain] = toks;
        } else if (toks.length === 3) {
          [proceeds, basis, gain] = toks;
        } else if (toks.length === 2) {
          [proceeds, basis] = toks;
        } else {
          [proceeds] = toks;
        }
        const washFlag = /W\s*$/.test(tail.trim()) || (wash != null && wash !== 0);
        lots.push({
          description: security?.description ?? "UNKNOWN",
          symbol: security?.symbol ?? null,
          cusip: security?.cusip ?? null,
          qtyMicro: Math.round(qty * QTY_SCALE),
          acquired: acquiredIso,
          sold: soldIso,
          proceedsCents: proceeds,
          basisCents: basis,
          washDisallowedCents: washFlag ? (wash ?? 0) : wash,
          gainCents: gain,
          term,
          basisReported,
        });
        continue;
      }
    }

    if (mode === "dividends") {
      const div = line.match(DIV_ROW_RE);
      if (div) {
        const date = usDateToIso(div[1]);
        const toks = tokensToCents(div[2]);
        if (!date || toks.length === 0) continue;
        dividends.push({
          description: security?.description ?? "UNKNOWN",
          symbol: security?.symbol ?? null,
          cusip: security?.cusip ?? null,
          date,
          ordinaryCents: toks[0],
          qualifiedCents: toks.length > 1 ? toks[1] : null,
        });
        continue;
      }
    }

    if (mode !== "none") {
      const sec = line.match(SECURITY_RE);
      if (sec) {
        security = { description: sec[1].trim(), symbol: sec[2], cusip: sec[3] };
        continue;
      }
      const secNoSym = line.match(SECURITY_NO_SYMBOL_RE);
      if (secNoSym && !/\d{2}\/\d{2}\/\d{2}/.test(line)) {
        security = { description: secNoSym[1].trim(), symbol: null, cusip: secNoSym[2] };
        continue;
      }
    }
  }

  // ----- summary boxes -----
  const box = (re: RegExp): number | null => {
    const m = text.match(re);
    return m ? parseCents(m[1]) : null;
  };
  const summary: Parsed1099["summary"] = {
    totalOrdinaryDividendsCents: box(/1a Total Ordinary Dividends[. ]*([\d,]+\.\d{2})/),
    qualifiedDividendsCents: box(/1b Qualified Dividends[. ]*([\d,]+\.\d{2})/),
    interestCents: box(/\b1\s+Interest Income[. ]*([\d,]+\.\d{2})/),
    proceedsTotals: [],
  };

  // proceeds summary block: header line then 6 concatenated numbers
  for (let i = 0; i < lines.length; i++) {
    const sq = squash(lines[i]);
    const isSummaryRow =
      (sq.includes("termtransactionsforwhichbasis") || sq.includes("termisunknown")) &&
      i + 1 < lines.length;
    if (!isSummaryRow) continue;
    // numbers may sit on the same line (spaced extraction) or the next (packed)
    let toks = tokensToCents(lines[i]);
    if (toks.length !== 6) toks = tokensToCents(lines[i + 1]);
    if (toks.length === 6) {
      summary.proceedsTotals!.push({
        term: sq.startsWith("short") ? "short" : sq.startsWith("long") ? "long" : "unknown",
        basisReported: !sq.includes("basisisnotreported"),
        proceedsCents: toks[0],
        basisCents: toks[1],
        washCents: toks[3],
        gainCents: toks[4],
      });
    }
  }

  // ----- 1099-R -----
  let retirement: Parsed1099["retirement"] = null;
  if (/Form\s+1099-R/i.test(text)) {
    retirement = {
      grossCents: box(/1\s+Gross distribution[. ]*\$?([\d,]+\.\d{2})/i),
      taxableCents: box(/2a\s+Taxable amount[. ]*\$?([\d,]+\.\d{2})/i),
      fedWithheldCents: box(/4\s+Federal income tax withheld[. ]*\$?([\d,]+\.\d{2})/i),
      distributionCode: (() => {
        const m = text.match(/7\s+Distribution code(?:\(s\))?\.*\s*:?\s*([0-9A-Z]{1,2})\b/i);
        return m ? m[1] : null;
      })(),
      iraSepSimple: /IRA\/SEP\/SIMPLE/i.test(text),
    };
  }

  // ----- Form 5498 -----
  let form5498: Parsed1099["form5498"] = null;
  if (/Form\s+5498/i.test(text)) {
    form5498 = {
      accountNo,
      rolloverCents: box(/Rollover contributions[. ]*\$?([\d,]+\.\d{2})/i),
      fmvCents: box(/Fair market value of account[. ]*\$?([\d,]+\.\d{2})/i),
      iraType: (() => {
        const m = text.match(/IRA Type\.+\s*([A-Za-z* ]+)/);
        return m ? m[1].trim().replace(/\*+$/, "") : null;
      })(),
    };
  }

  // sanity check: do parsed lots match the summary?
  if (summary.proceedsTotals && summary.proceedsTotals.length > 0 && lots.length > 0) {
    const parsedProceeds = lots.reduce((a, l) => a + l.proceedsCents, 0);
    const summaryProceeds = summary.proceedsTotals.reduce((a, t) => a + t.proceedsCents, 0);
    if (Math.abs(parsedProceeds - summaryProceeds) > 100) {
      warnings.push(
        `Per-lot proceeds (${parsedProceeds}c) do not match the summary (${summaryProceeds}c); some lots may be missing.`,
      );
    }
  }

  return { year, accountNo, recipient, lots, dividends, summary, retirement, form5498, warnings };
}
