import { describe, expect, it } from "vitest";
import { contextFromSeries, type MarketSeriesPoint } from "./market";
import { PRICE_SCALE } from "../model/money";

function series(points: [string, number][]): MarketSeriesPoint[] {
  return points.map(([date, close]) => ({ date, closeMicro: Math.round(close * PRICE_SCALE) }));
}

describe("contextFromSeries", () => {
  const spy = series([
    ["2025-03-31", 560],
    ["2025-04-01", 561],
    ["2025-04-02", 564],
    ["2025-04-03", 537],
    ["2025-04-04", 505],
    ["2025-04-07", 504],
  ]);
  const vix = series([
    ["2025-04-02", 21.5],
    ["2025-04-03", 30.0],
    ["2025-04-04", 45.3],
  ]);

  it("computes drawdown from the trailing high", () => {
    const ctx = contextFromSeries(spy, vix, "2025-04-04");
    expect(ctx.asOf).toBe("2025-04-04");
    expect(ctx.drawdownPct).toBeCloseTo(((505 - 564) / 564) * 100, 1);
    expect(ctx.vixClose).toBeCloseTo(45.3, 5);
    expect(ctx.regime).toBe("panic");
  });

  it("uses the prior session for non-trading days", () => {
    const ctx = contextFromSeries(spy, vix, "2025-04-06");
    expect(ctx.asOf).toBe("2025-04-04");
  });

  it("returns unknown before data begins", () => {
    const ctx = contextFromSeries(spy, vix, "2020-01-01");
    expect(ctx.regime).toBe("unknown");
    expect(ctx.spyCloseMicro).toBeNull();
  });
});
