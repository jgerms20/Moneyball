import { describe, expect, it } from "vitest";
import { runLotEngine, type EngineTx } from "./lots";

let nextId = 1;
function tx(partial: Partial<EngineTx> & Pick<EngineTx, "date" | "type">): EngineTx {
  return {
    id: nextId++,
    symbol: "TEST",
    cusip: null,
    qtyMicro: null,
    amountCents: null,
    ...partial,
  };
}

describe("runLotEngine", () => {
  it("matches FIFO with fractional shares and exact cents", () => {
    const r = runLotEngine([
      tx({ date: "2024-01-02", type: "buy", qtyMicro: 1_000_000, amountCents: -10000 }), // 1 @ $100
      tx({ date: "2024-02-02", type: "buy", qtyMicro: 500_000, amountCents: -6000 }), // 0.5 @ $120
      tx({ date: "2024-03-02", type: "sell", qtyMicro: -1_200_000, amountCents: 15600 }), // 1.2 @ $130
    ]);
    expect(r.closures).toHaveLength(2);
    const [first, second] = r.closures;
    expect(first.qtyMicro).toBe(1_000_000);
    expect(first.basisCents).toBe(10000);
    expect(second.qtyMicro).toBe(200_000);
    expect(second.basisCents).toBe(2400); // 0.2/0.5 of $60
    expect(first.proceedsCents + second.proceedsCents).toBe(15600);
    expect(first.gainCents! + second.gainCents!).toBe(15600 - 12400);
    expect(r.openLots).toHaveLength(1);
    expect(r.openLots[0].remainingMicro).toBe(300_000);
    expect(r.openLots[0].costRemainingCents).toBe(3600);
  });

  it("creates orphan closures for sells beyond known lots", () => {
    const r = runLotEngine([
      tx({ date: "2024-01-02", type: "buy", qtyMicro: 1_000_000, amountCents: -5000 }),
      tx({ date: "2024-06-02", type: "sell", qtyMicro: -3_000_000, amountCents: 30000 }),
    ]);
    expect(r.closures).toHaveLength(2);
    const orphan = r.closures.find((c) => c.orphan)!;
    expect(orphan.qtyMicro).toBe(2_000_000);
    expect(orphan.basisCents).toBeNull();
    expect(orphan.gainCents).toBeNull();
    expect(orphan.proceedsCents).toBe(20000);
    expect(r.warnings.length).toBe(1);
  });

  it("rescales lots through a reverse split pair without realizing P&L", () => {
    const r = runLotEngine([
      tx({ date: "2023-01-10", type: "buy", qtyMicro: 50_000_000, amountCents: -25000 }), // 50 sh
      tx({ date: "2023-07-29", type: "split_out", qtyMicro: -50_000_000 }),
      tx({ date: "2023-07-29", type: "split_in", qtyMicro: 5_000_000 }),
      tx({ date: "2023-09-01", type: "sell", qtyMicro: -5_000_000, amountCents: 26000 }),
    ]);
    expect(r.closures).toHaveLength(1);
    expect(r.closures[0].basisCents).toBe(25000);
    expect(r.closures[0].gainCents).toBe(1000);
    expect(r.closures[0].orphan).toBe(false);
  });

  it("handles merger out as a closure with payout proceeds", () => {
    const r = runLotEngine([
      tx({ date: "2024-05-01", type: "buy", qtyMicro: 2_017_000, amountCents: -700 }),
      tx({ date: "2025-02-28", type: "merger_out", qtyMicro: -2_017_000, amountCents: 555 }),
      tx({ date: "2025-02-28", type: "merger_in", symbol: "CSGP", qtyMicro: 72_000, amountCents: 549 }),
    ]);
    expect(r.closures).toHaveLength(1);
    expect(r.closures[0].proceedsCents).toBe(555);
    expect(r.closures[0].gainCents).toBe(555 - 700);
    expect(r.openLots.find((l) => l.symbol === "CSGP")?.costCents).toBe(549);
  });

  it("flags money market lots so analytics can exclude them", () => {
    const r = runLotEngine([
      tx({
        date: "2024-01-31", type: "reinvest", symbol: "SPAXX",
        description: "FIDELITY GOVERNMENT MONEY MARKET", qtyMicro: 200_000, amountCents: -20,
      }),
    ]);
    expect(r.openLots[0].isMoneyMarket).toBe(true);
  });

  it("treats shares transferred in as unknown basis, not zero", () => {
    const r = runLotEngine([
      tx({ date: "2024-01-02", type: "shares_in", qtyMicro: 1_000_000, amountCents: null }),
      tx({ date: "2024-03-02", type: "sell", qtyMicro: -1_000_000, amountCents: 9000 }),
    ]);
    expect(r.closures[0].basisCents).toBeNull();
    expect(r.closures[0].gainCents).toBeNull();
    expect(r.closures[0].orphan).toBe(false);
  });
});
