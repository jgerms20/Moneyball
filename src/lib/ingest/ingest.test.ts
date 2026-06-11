import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDb } from "../db/client";
import { parseFidelityHistoryCsv } from "../importers/fidelity-history";
import { ingestParseResult } from "./ingest";
import { transactions } from "../db/schema";

const fixturesDir = path.join(__dirname, "..", "importers", "__fixtures__");
const full = fs.readFileSync(path.join(fixturesDir, "fidelity-history.csv"), "utf8");
const overlap = fs.readFileSync(path.join(fixturesDir, "fidelity-history-overlap.csv"), "utf8");

describe("ingest + dedupe across overlapping exports", () => {
  it("dedupes overlapping rows but keeps genuine same-day duplicates", () => {
    const { db } = createDb(":memory:");
    const r1 = ingestParseResult(
      { db, fileName: "a.csv", fileContent: full, accountId: "fidelity:TEST" },
      parseFidelityHistoryCsv(full),
    );
    // fixture contains two IDENTICAL NVDA buys on 04/04 -- both must import
    expect(r1.imported).toBe(15);
    expect(r1.deduped).toBe(0);

    const r2 = ingestParseResult(
      { db, fileName: "b.csv", fileContent: overlap, accountId: "fidelity:TEST" },
      parseFidelityHistoryCsv(overlap),
    );
    // overlap file: GOOGL buy + RTX sell + 1 NVDA buy already known; CEG dividend is new
    expect(r2.imported).toBe(1);
    expect(r2.deduped).toBe(3);

    const all = db.select().from(transactions).all();
    expect(all).toHaveLength(16);
    const nvda = all.filter((t) => t.symbol === "NVDA" && t.date === "2025-04-04");
    expect(nvda).toHaveLength(2);
    expect(new Set(nvda.map((t) => t.keyOrdinal)).size).toBe(2);
  });

  it("refuses to double-import an identical file", () => {
    const { db } = createDb(":memory:");
    ingestParseResult(
      { db, fileName: "a.csv", fileContent: full, accountId: "fidelity:TEST" },
      parseFidelityHistoryCsv(full),
    );
    const again = ingestParseResult(
      { db, fileName: "a-renamed.csv", fileContent: full, accountId: "fidelity:TEST" },
      parseFidelityHistoryCsv(full),
    );
    expect(again.alreadyImportedFile).toBe(true);
    expect(again.imported).toBe(0);
  });
});
