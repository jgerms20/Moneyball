/**
 * Money & quantity primitives.
 *
 * All money is stored as integer cents. Share quantities are stored as
 * integer micro-shares (1e-6) because fractional quantities like 0.137
 * are everywhere in this data. Prices are stored as integer micro-dollars
 * (1e-6) so option prices (0.85) and odd fills (94.0933) survive intact.
 */

export const QTY_SCALE = 1_000_000; // micro-shares
export const PRICE_SCALE = 1_000_000; // micro-dollars

/** Parse a money string ("$1,234.56", "-$85.65", "(1,234.56)", "1234.5") into cents. */
export function parseCents(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === "" || s === "--" || s === "N/A") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("-")) {
    negative = !negative ? true : negative;
    s = s.slice(1);
  }
  if (s === "" || !/^\d*(\.\d+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents =
    (whole === "" ? 0 : parseInt(whole, 10)) * 100 +
    Math.round(parseFloat(`0.${frac || "0"}`) * 100);
  return negative ? -cents : cents;
}

/** Parse a quantity string ("0.137", "-2", "+1", "55") into micro-shares. */
export function parseQtyMicro(raw: string | null | undefined): number | null {
  return parseScaled(raw, QTY_SCALE);
}

/** Parse a price string into micro-dollars. */
export function parsePriceMicro(raw: string | null | undefined): number | null {
  return parseScaled(raw, PRICE_SCALE);
}

function parseScaled(raw: string | null | undefined, scale: number): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === "" || s === "--" || s === "N/A") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (s === "" || !/^\d*(\.\d+)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "000000000").slice(0, String(scale).length - 1);
  const value =
    (whole === "" ? 0 : parseInt(whole, 10)) * scale + parseInt(fracPadded || "0", 10);
  return negative ? -value : value;
}

/** cents -> "$1,234.56" (negatives as "-$1,234.56") */
export function formatCents(cents: number | null | undefined, opts?: { sign?: boolean }): string {
  if (cents == null) return "—";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (negative) return `-${s}`;
  return opts?.sign && cents > 0 ? `+${s}` : s;
}

/** micro-shares -> human string, trimming trailing zeros ("0.137", "55") */
export function formatQty(qtyMicro: number | null | undefined): string {
  if (qtyMicro == null) return "—";
  const v = qtyMicro / QTY_SCALE;
  return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** Proportionally allocate `totalCents` across parts (micro units), exact to the cent. */
export function allocateCents(totalCents: number, partsMicro: number[]): number[] {
  const totalMicro = partsMicro.reduce((a, b) => a + b, 0);
  if (totalMicro === 0) return partsMicro.map(() => 0);
  const out: number[] = [];
  let allocated = 0;
  for (let i = 0; i < partsMicro.length; i++) {
    if (i === partsMicro.length - 1) {
      out.push(totalCents - allocated);
    } else {
      const share = Math.round((totalCents * partsMicro[i]) / totalMicro);
      out.push(share);
      allocated += share;
    }
  }
  return out;
}
