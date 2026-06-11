import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFidelity1099Text } from "./fidelity-1099";

const packed = fs.readFileSync(
  path.join(__dirname, "__fixtures__", "fidelity-1099-packed.txt"),
  "utf8",
);
const spaced = fs.readFileSync(
  path.join(__dirname, "__fixtures__", "fidelity-1099-spaced.txt"),
  "utf8",
);
const retirement = fs.readFileSync(
  path.join(__dirname, "__fixtures__", "form5498-and-1099r.txt"),
  "utf8",
);

for (const [name, text] of [
  ["packed (pdf-parse v1 style)", packed],
  ["spaced (pdf-parse v2 style)", spaced],
] as const) {
  describe(`parseFidelity1099Text - ${name}`, () => {
    const r = parseFidelity1099Text(text);

    it("finds year and account", () => {
      expect(r.year).toBe(2024);
      expect(r.accountNo).toBe("Z99-123456");
    });

    it("extracts every lot with term and basis flags", () => {
      expect(r.lots).toHaveLength(8);
      expect(r.lots.filter((l) => l.term === "short")).toHaveLength(4);
      expect(r.lots.filter((l) => l.term === "long")).toHaveLength(4);
      expect(r.lots.every((l) => l.basisReported)).toBe(true);
    });

    it("parses Merger disposition rows with (f) basis markers", () => {
      const merger = r.lots.find((l) => l.cusip === "577096100");
      expect(merger).toMatchObject({
        qtyMicro: 1_000_000,
        acquired: "2021-12-03",
        sold: "2025-02-28",
        proceedsCents: 275,
        basisCents: 275,
        gainCents: 0,
      });
      expect(merger?.symbol).toBeNull();
    });

    it("parses a concrete lot exactly", () => {
      const amc = r.lots.find((l) => l.symbol === "EXC0");
      expect(amc).toMatchObject({
        qtyMicro: 5_000_000,
        acquired: "2024-08-05",
        sold: "2024-11-26",
        proceedsCents: 2408,
        basisCents: 2470,
        gainCents: -62,
      });
    });

    it("handles wash sale rows (4 money tokens)", () => {
      const wash = r.lots.find((l) => (l.washDisallowedCents ?? 0) !== 0);
      expect(wash).toMatchObject({
        proceedsCents: 4000,
        basisCents: 4704,
        washDisallowedCents: 704,
        gainCents: 0,
      });
    });

    it("extracts dividend detail with per-security context", () => {
      expect(r.dividends).toHaveLength(6);
      const wdgt = r.dividends.filter((d) => d.symbol === "WDGT");
      expect(wdgt).toHaveLength(4);
      expect(wdgt[0]).toMatchObject({ date: "2024-03-17", ordinaryCents: 30, qualifiedCents: 30 });
      const single = r.dividends.find((d) => d.symbol === "SMPL" && d.date === "2024-02-13");
      expect(single?.qualifiedCents).toBeNull();
    });

    it("reads summary boxes and proceeds totals", () => {
      expect(r.summary.totalOrdinaryDividendsCents).toBe(3743);
      expect(r.summary.qualifiedDividendsCents).toBe(2880);
      const st = r.summary.proceedsTotals?.find((t) => t.term === "short");
      expect(st?.gainCents).toBe(-1838);
    });

    it("does not warn about lot/summary mismatch when totals line up", () => {
      expect(r.warnings.filter((w) => w.includes("do not match"))).toHaveLength(0);
    });
  });
}

describe("parseFidelity1099Text - 5498 and 1099-R", () => {
  const r = parseFidelity1099Text(retirement);

  it("reads Form 5498 boxes", () => {
    expect(r.form5498?.rolloverCents).toBe(305675);
    expect(r.form5498?.fmvCents).toBe(94396);
    expect(r.form5498?.iraType).toContain("IRA");
  });

  it("reads 1099-R distribution fields factually", () => {
    expect(r.retirement?.grossCents).toBe(210000);
    expect(r.retirement?.taxableCents).toBe(210000);
    expect(r.retirement?.fedWithheldCents).toBe(21000);
    expect(r.retirement?.distributionCode).toBe("1");
    expect(r.retirement?.iraSepSimple).toBe(true);
  });
});
