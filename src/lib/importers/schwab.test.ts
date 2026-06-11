import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSchwabCsv, parseSchwabOptionSymbol } from "./schwab";

const fixture = fs.readFileSync(
  path.join(__dirname, "__fixtures__", "schwab-transactions.csv"),
  "utf8",
);

describe("parseSchwabOptionSymbol", () => {
  it("parses OCC-ish symbols", () => {
    const o = parseSchwabOptionSymbol("AMC 01/16/2026 5.00 C");
    expect(o).toEqual({
      underlying: "AMC",
      expiry: "2026-01-16",
      strikeMicro: 5_000_000,
      right: "C",
      multiplier: 100,
    });
    expect(parseSchwabOptionSymbol("NVDA 02/21/2025 120.00 P")?.right).toBe("P");
    expect(parseSchwabOptionSymbol("AMC")).toBeNull();
  });
});

describe("parseSchwabCsv", () => {
  const result = parseSchwabCsv(fixture);

  it("reads the title line for an account hint and skips the totals row", () => {
    expect(result.accountHint).toContain("123");
    expect(result.skipped.some((s) => /footer|empty/.test(s.reason))).toBe(true);
  });

  it("imports all transaction rows in chronological order", () => {
    expect(result.transactions).toHaveLength(10);
    const dates = result.transactions.map((t) => t.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("classifies option opens/closes and money with $ signs", () => {
    const bto = result.transactions.find((t) => t.type === "option_buy_to_open");
    expect(bto?.option?.expiry).toBe("2026-01-16");
    expect(bto?.amountCents).toBe(-17133);
    expect(bto?.feesCents).toBe(133);
    const stc = result.transactions.find((t) => t.type === "option_sell_to_close");
    expect(stc?.qtyMicro).toBe(-2_000_000);
    expect(stc?.amountCents).toBe(12068);
  });

  it('handles "as of" dates on expirations', () => {
    const exp = result.transactions.find((t) => t.type === "option_expired");
    expect(exp?.date).toBe("2025-04-16");
  });

  it("handles assignment plus the resulting share purchase", () => {
    const assigned = result.transactions.find((t) => t.type === "option_assigned");
    expect(assigned?.option?.strikeMicro).toBe(120_000_000);
    const shareBuy = result.transactions.find(
      (t) => t.type === "buy" && t.symbol === "NVDA" && t.option == null,
    );
    expect(shareBuy?.qtyMicro).toBe(100_000_000);
    expect(shareBuy?.amountCents).toBe(-1_200_000);
  });

  it("classifies cash movements", () => {
    expect(result.transactions.find((t) => t.type === "transfer_in")?.amountCents).toBe(50000);
    expect(result.transactions.find((t) => t.type === "interest")?.amountCents).toBe(42);
  });
});
