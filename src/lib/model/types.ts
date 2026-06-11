/**
 * Canonical transaction model. Every importer normalizes into this shape;
 * everything downstream (engines, UI) consumes only this.
 */

export type Broker = "fidelity" | "schwab" | "thinkorswim" | "demo";

export type ImportSource =
  | "fidelity_history_csv"
  | "schwab_csv"
  | "thinkorswim_statement"
  | "fidelity_1099_pdf"
  | "demo_seed";

export type TxType =
  // equities & cash
  | "buy"
  | "sell"
  | "reinvest" // dividend reinvestment purchase
  | "dividend"
  | "interest"
  | "transfer_in" // cash in (EFT received, deposit)
  | "transfer_out" // cash out (EFT paid, withdrawal)
  | "fee"
  // corporate actions
  | "merger_out" // shares exchanged away (often cash payout)
  | "merger_in" // shares received from a merger
  | "split_out" // (reverse) split: old shares removed
  | "split_in" // (reverse) split: new shares added
  | "spinoff_in"
  | "shares_in" // security transfer in (basis unknown unless provided)
  | "shares_out"
  // options
  | "option_buy_to_open"
  | "option_sell_to_open"
  | "option_buy_to_close"
  | "option_sell_to_close"
  | "option_expired"
  | "option_assigned"
  | "option_exercise"
  | "other";

export const OPTION_TYPES: ReadonlySet<TxType> = new Set([
  "option_buy_to_open",
  "option_sell_to_open",
  "option_buy_to_close",
  "option_sell_to_close",
  "option_expired",
  "option_assigned",
  "option_exercise",
]);

export interface OptionRef {
  underlying: string;
  /** ISO date YYYY-MM-DD */
  expiry: string;
  /** micro-dollars */
  strikeMicro: number;
  right: "C" | "P";
  multiplier: number; // almost always 100
}

/** Stable key for an option contract, e.g. "AMC|2026-01-16|5000000|C" */
export function occKey(o: OptionRef): string {
  return `${o.underlying}|${o.expiry}|${o.strikeMicro}|${o.right}`;
}

export interface CanonicalTx {
  /** ISO date YYYY-MM-DD (trade/run date) */
  date: string;
  /** ISO datetime when known (thinkorswim exec time) */
  execTime?: string | null;
  settleDate?: string | null;
  type: TxType;
  /** original action string, for receipts */
  action: string;
  symbol?: string | null;
  cusip?: string | null;
  description?: string | null;
  option?: OptionRef | null;
  /** signed micro-shares (sells negative); for options, signed contracts * 1e6 */
  qtyMicro?: number | null;
  /** micro-dollars per share/contract-unit */
  priceMicro?: number | null;
  /** signed cents, cash effect on the account (buys negative) */
  amountCents?: number | null;
  feesCents?: number | null;
  commissionCents?: number | null;
  /** running cash balance if the source provides it */
  cashBalanceCents?: number | null;
  /** e.g. thinkorswim spread label: SINGLE, VERTICAL, IRON CONDOR */
  strategyLabel?: string | null;
  /** raw source row for receipts/debugging */
  raw: Record<string, string> | string;
}

export interface SkippedRow {
  lineNo: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  source: ImportSource;
  /** account identifier found in the file, if any */
  accountHint?: string | null;
  transactions: CanonicalTx[];
  skipped: SkippedRow[];
  warnings: string[];
}

/* ----------------------------- 1099 documents ---------------------------- */

export interface TaxLot1099 {
  description: string;
  symbol?: string | null;
  cusip?: string | null;
  qtyMicro: number;
  /** ISO date or "VARIOUS" */
  acquired: string;
  sold: string; // ISO date
  proceedsCents: number;
  basisCents: number | null;
  washDisallowedCents: number | null;
  gainCents: number | null;
  term: "short" | "long" | "unknown";
  basisReported: boolean;
}

export interface TaxDividend1099 {
  description: string;
  symbol?: string | null;
  cusip?: string | null;
  date: string; // ISO
  ordinaryCents: number;
  qualifiedCents: number | null;
}

export interface Retirement1099R {
  grossCents: number | null;
  taxableCents: number | null;
  fedWithheldCents: number | null;
  distributionCode: string | null;
  iraSepSimple: boolean;
}

export interface Form5498 {
  accountNo: string | null;
  rolloverCents: number | null;
  fmvCents: number | null;
  iraType: string | null;
}

export interface Parsed1099 {
  year: number | null;
  accountNo: string | null;
  recipient: string | null;
  lots: TaxLot1099[];
  dividends: TaxDividend1099[];
  summary: {
    totalOrdinaryDividendsCents?: number | null;
    qualifiedDividendsCents?: number | null;
    interestCents?: number | null;
    proceedsTotals?: {
      term: "short" | "long" | "unknown";
      basisReported: boolean;
      proceedsCents: number;
      basisCents: number;
      washCents: number;
      gainCents: number;
    }[];
  };
  retirement?: Retirement1099R | null;
  form5498?: Form5498 | null;
  warnings: string[];
}
