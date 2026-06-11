import { describe, expect, it } from "vitest";
import {
  allocateCents,
  formatCents,
  parseCents,
  parsePriceMicro,
  parseQtyMicro,
} from "./money";

describe("parseCents", () => {
  it("parses plain and negative amounts", () => {
    expect(parseCents("1234.56")).toBe(123456);
    expect(parseCents("-258.28")).toBe(-25828);
    expect(parseCents("50")).toBe(5000);
    expect(parseCents("-357")).toBe(-35700);
  });
  it("parses Schwab-style $ and parens", () => {
    expect(parseCents("$0.85")).toBe(85);
    expect(parseCents("-$85.65")).toBe(-8565);
    expect(parseCents("(1,234.56)")).toBe(-123456);
    expect(parseCents("$12,000.00")).toBe(1200000);
  });
  it("returns null for junk", () => {
    expect(parseCents("")).toBeNull();
    expect(parseCents("  ")).toBeNull();
    expect(parseCents("N/A")).toBeNull();
    expect(parseCents(undefined)).toBeNull();
  });
});

describe("quantities and prices", () => {
  it("keeps fractional shares exact", () => {
    expect(parseQtyMicro("0.137")).toBe(137000);
    expect(parseQtyMicro("-0.75")).toBe(-750000);
    expect(parseQtyMicro("+1")).toBe(1000000);
    expect(parseQtyMicro("55")).toBe(55000000);
  });
  it("keeps odd prices exact", () => {
    expect(parsePriceMicro("968.85")).toBe(968850000);
    expect(parsePriceMicro("0.64")).toBe(640000);
    expect(parsePriceMicro("94.0933")).toBe(94093300);
  });
});

describe("allocateCents", () => {
  it("allocates exactly to the cent", () => {
    const parts = allocateCents(10000, [333333, 333333, 333334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(parts[0]).toBe(3333);
  });
  it("handles zero quantity", () => {
    expect(allocateCents(500, [0, 0])).toEqual([0, 0]);
  });
});

describe("formatCents", () => {
  it("formats negatives and signs", () => {
    expect(formatCents(-123456)).toBe("-$1,234.56");
    expect(formatCents(50, { sign: true })).toBe("+$0.50");
  });
});
