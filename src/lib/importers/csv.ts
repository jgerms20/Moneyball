/**
 * Small, forgiving CSV parser (RFC4180-ish): quoted fields, embedded commas,
 * embedded quotes (""), CRLF, and a BOM. Real brokerage exports are messy,
 * so this never throws on a bad line — callers decide what to skip.
 */

export function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Split a single CSV line into fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export interface CsvLine {
  lineNo: number; // 1-based, within the original file
  fields: string[];
  raw: string;
}

/** Parse whole content into lines of fields. Keeps empty lines out, preserves original line numbers. */
export function parseCsvLines(content: string): CsvLine[] {
  const text = stripBom(content).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = text.split("\n");
  const out: CsvLine[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (raw.trim() === "") continue;
    out.push({ lineNo: i + 1, fields: splitCsvLine(raw), raw });
  }
  return out;
}

/** Map a header row + data row into an object keyed by trimmed header names. */
export function zipRow(header: string[], fields: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) {
    const key = header[i].trim();
    if (!key) continue;
    obj[key] = (fields[i] ?? "").trim();
  }
  return obj;
}

/** Convert "MM/DD/YYYY" or "MM/DD/YY" to ISO "YYYY-MM-DD"; returns null if not a date. */
export function usDateToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}or\d{4}|\d{2}|\d{4})$/) ||
    raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  let yyyy = m[3];
  if (yyyy.length === 2) {
    const yy = parseInt(yyyy, 10);
    yyyy = yy >= 70 ? `19${yyyy}` : `20${yyyy}`;
  }
  return `${yyyy}-${mm}-${dd}`;
}
