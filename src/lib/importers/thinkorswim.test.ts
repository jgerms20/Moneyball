import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseThinkorswimStatement, parseTosExpiry } from "./thinkorswim";

const fixture = fs.readFileSync(
  path.join(__dirname, "__fixtures__", "tos-statement.csv"),
  "utf8",
);

describe("parseTosExpiry", () => {
  it("parses thinkorswim expiry format", () => {
    expect(parseTosExpiry("16 JAN 26")).toBe("2026-01-16");
    expect(parseTosExpiry("21 FEB 25")).toBe("2025-02-21");
    expect(parseTosExpiry("not a date")).toBeNull();
  });
});

describe("parseThinkorswimStatement", () => {
  const result = parseThinkorswimStatement(fixture);

  it("finds the trade history section and the account hint", () => {
    expect(result.accountHint).toBe("865-XXXXX1");
    expect(result.transactions).toHaveLength(7);
  });

  it("carries exec time and spread onto continuation legs", () => {
    const legs = result.transactions.filter((t) => t.date === "2025-01-15");
    expect(legs).toHaveLength(2);
    expect(legs[1].execTime).toBe(legs[0].execTime);
    expect(legs[1].strategyLabel).toBe("VERTICAL");
    expect(legs[1].type).toBe("option_sell_to_open");
    expect(legs[1].option?.strikeMicro).toBe(590_000_000);
  });

  it("derives signed cash from price * contracts * 100", () => {
    const bto580 = result.transactions.find(
      (t) => t.option?.strikeMicro === 580_000_000 && t.type === "option_buy_to_open",
    );
    expect(bto580?.amountCents).toBe(-31000); // 1 * 3.10 * 100
    const sto590 = result.transactions.find(
      (t) => t.option?.strikeMicro === 590_000_000 && t.type === "option_sell_to_open",
    );
    expect(sto590?.amountCents).toBe(10500);
  });

  it("parses stock legs without strikes", () => {
    const stock = result.transactions.find((t) => t.symbol === "F");
    expect(stock?.type).toBe("buy");
    expect(stock?.option).toBeNull();
    expect(stock?.qtyMicro).toBe(100_000_000);
  });

  it("stops before the next section", () => {
    expect(result.transactions.every((t) => t.symbol !== "Net Liquidating Value")).toBe(true);
  });
});
