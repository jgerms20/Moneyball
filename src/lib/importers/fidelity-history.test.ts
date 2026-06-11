import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFidelityHistoryCsv } from "./fidelity-history";

const fixture = fs.readFileSync(
  path.join(__dirname, "__fixtures__", "fidelity-history.csv"),
  "utf8",
);

describe("parseFidelityHistoryCsv", () => {
  const result = parseFidelityHistoryCsv("﻿" + fixture); // exercise BOM too

  it("imports every transaction row and skips footers", () => {
    expect(result.transactions).toHaveLength(15);
    // disclaimers + "Date downloaded" line are skipped, visibly
    expect(result.skipped.length).toBeGreaterThanOrEqual(4);
    expect(result.skipped.every((s) => s.reason.length > 0)).toBe(true);
  });

  it("handles the EX-DIV action prefix as a buy", () => {
    const googl = result.transactions.find((t) => t.symbol === "GOOGL");
    expect(googl?.type).toBe("buy");
    expect(googl?.qtyMicro).toBe(805000);
    expect(googl?.amountCents).toBe(-25828);
    expect(googl?.settleDate).toBe("2025-12-04");
  });

  it('handles "DIVIDEND RECEIVED as of" rows', () => {
    const intc = result.transactions.find((t) => t.symbol === "INTC");
    expect(intc?.type).toBe("dividend");
    expect(intc?.amountCents).toBe(100);
  });

  it("treats EFT rows (blank or single-space symbol) as transfers", () => {
    const xfers = result.transactions.filter((t) => t.type.startsWith("transfer"));
    expect(xfers).toHaveLength(2);
    expect(xfers.every((t) => t.symbol === null)).toBe(true);
    expect(xfers.find((t) => t.type === "transfer_out")?.amountCents).toBe(-35700);
  });

  it("classifies merger payout/from rows and keeps CUSIP symbols", () => {
    const payout = result.transactions.find((t) => t.type === "merger_out");
    expect(payout?.cusip).toBe("577096100");
    expect(payout?.symbol).toBeNull();
    expect(payout?.qtyMicro).toBe(-2017000);
    const into = result.transactions.find((t) => t.type === "merger_in");
    expect(into?.symbol).toBe("CSGP");
  });

  it("classifies reverse split pairs", () => {
    const out = result.transactions.find((t) => t.type === "split_out");
    const inn = result.transactions.find((t) => t.type === "split_in");
    expect(out?.qtyMicro).toBe(-50000000);
    expect(inn?.qtyMicro).toBe(5000000);
  });

  it("reverses to chronological order", () => {
    const dates = result.transactions.map((t) => t.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("keeps sells negative and reinvestments as buys", () => {
    const sell = result.transactions.find((t) => t.symbol === "RTX");
    expect(sell?.type).toBe("sell");
    expect(sell?.qtyMicro).toBe(-750000);
    const reinvest = result.transactions.find((t) => t.type === "reinvest");
    expect(reinvest?.symbol).toBe("SPAXX");
  });
});
