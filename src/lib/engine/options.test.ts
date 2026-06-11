import { describe, expect, it } from "vitest";
import { runOptionsEngine, type OptionTx } from "./options";

let nextId = 1;
function fill(partial: Partial<OptionTx> & Pick<OptionTx, "date" | "type">): OptionTx {
  return {
    id: nextId++,
    occKey: "AMC|2026-01-16|5000000|C",
    underlying: "AMC",
    expiry: "2026-01-16",
    strikeMicro: 5_000_000,
    right: "C",
    qtyMicro: 1_000_000,
    amountCents: null,
    feesCents: null,
    ...partial,
  };
}

describe("runOptionsEngine", () => {
  it("pairs a long call open/close into one closed cycle", () => {
    const r = runOptionsEngine([
      fill({ date: "2025-04-07", type: "option_buy_to_open", qtyMicro: 2_000_000, amountCents: -17133, feesCents: -133 }),
      fill({ date: "2025-05-16", type: "option_sell_to_close", qtyMicro: -2_000_000, amountCents: 12068, feesCents: -132 }),
    ]);
    expect(r.positions).toHaveLength(1);
    const p = r.positions[0];
    expect(p.direction).toBe("long");
    expect(p.status).toBe("closed");
    expect(p.outcome).toBe("closed");
    expect(p.realizedCents).toBe(-17133 + 12068);
    expect(p.peakContracts).toBe(2);
    expect(p.feesCents).toBe(265);
    expect(p.dteAtOpen).toBe(284);
  });

  it("handles short premium expiring worthless as a win", () => {
    const r = runOptionsEngine([
      fill({
        date: "2025-03-21", type: "option_sell_to_open",
        occKey: "F|2025-04-17|9000000|P", expiry: "2025-04-17", right: "P",
        qtyMicro: -1_000_000, amountCents: 3134,
      }),
      fill({
        date: "2025-04-17", type: "option_expired",
        occKey: "F|2025-04-17|9000000|P", expiry: "2025-04-17", right: "P",
        qtyMicro: -1_000_000, amountCents: 0,
      }),
    ]);
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].direction).toBe("short");
    expect(r.positions[0].outcome).toBe("expired");
    expect(r.positions[0].realizedCents).toBe(3134);
  });

  it("supports partial closes and re-entry as separate cycles", () => {
    const far = { occKey: "AMC|2099-01-15|5000000|C", expiry: "2099-01-15" };
    const r = runOptionsEngine([
      fill({ ...far, date: "2025-01-02", type: "option_buy_to_open", qtyMicro: 2_000_000, amountCents: -200 }),
      fill({ ...far, date: "2025-01-10", type: "option_sell_to_close", qtyMicro: -1_000_000, amountCents: 150 }),
      fill({ ...far, date: "2025-01-20", type: "option_sell_to_close", qtyMicro: -1_000_000, amountCents: 170 }),
      fill({ ...far, date: "2025-02-03", type: "option_buy_to_open", qtyMicro: 1_000_000, amountCents: -90 }),
    ]);
    expect(r.positions).toHaveLength(2);
    expect(r.positions[0].status).toBe("closed");
    expect(r.positions[0].realizedCents).toBe(-200 + 150 + 170);
    expect(r.positions[1].status).toBe("open");
    expect(r.positions[1].realizedCents).toBeNull();
  });

  it("treats assignment as a terminal outcome", () => {
    const r = runOptionsEngine([
      fill({
        date: "2025-02-10", type: "option_sell_to_open",
        occKey: "NVDA|2025-02-21|120000000|P", expiry: "2025-02-21", right: "P",
        qtyMicro: -1_000_000, amountCents: 20434,
      }),
      fill({
        date: "2025-02-21", type: "option_assigned",
        occKey: "NVDA|2025-02-21|120000000|P", expiry: "2025-02-21", right: "P",
        qtyMicro: -1_000_000, amountCents: 0,
      }),
    ]);
    expect(r.positions[0].outcome).toBe("assigned");
    expect(r.positions[0].realizedCents).toBe(20434);
  });

  it("auto-expires stale positions whose expiry passed", () => {
    const r = runOptionsEngine([
      fill({
        date: "2024-06-01", type: "option_sell_to_open",
        occKey: "X|2024-07-19|10000000|C", expiry: "2024-07-19",
        qtyMicro: -1_000_000, amountCents: 500,
      }),
    ]);
    expect(r.positions[0].status).toBe("closed");
    expect(r.positions[0].outcome).toBe("expired");
    expect(r.positions[0].realizedCents).toBe(500);
    expect(r.warnings.length).toBe(1);
  });
});
