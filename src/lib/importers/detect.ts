/**
 * Sniff which importer a file belongs to from its content (and filename hint).
 */

import type { ImportSource } from "../model/types";

export function detectFormat(
  content: string,
  fileName?: string,
): Exclude<ImportSource, "demo_seed"> | null {
  const head = content.slice(0, 4000);

  if (head.startsWith("%PDF") || fileName?.toLowerCase().endsWith(".pdf")) {
    return "fidelity_1099_pdf";
  }
  // extracted 1099 text
  if (/TAX\s+REPORTING\s+STATEMENT|Form\s+1099|Form\s+5498/i.test(head) && !head.includes("Run Date")) {
    return "fidelity_1099_pdf";
  }
  if (/Run Date\s*,\s*Action\s*,\s*Symbol/i.test(head)) return "fidelity_history_csv";
  if (/Account Trade History|Exec Time.*Spread.*Pos Effect|Account Statement for/i.test(head)) {
    return "thinkorswim_statement";
  }
  if (/"?Date"?\s*,\s*"?Action"?\s*,\s*"?Symbol"?\s*,\s*"?Description"?/i.test(head)) {
    return "schwab_csv";
  }
  if (/Fees & Comm/i.test(head)) return "schwab_csv";
  return null;
}
