"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { refreshMarketData } from "@/lib/market/market";
import { rebuildDerived } from "@/lib/engine/rebuild";

export async function refreshMarketAction(): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  try {
    const results = await refreshMarketData(db);
    const total = results.reduce((a, r) => a + r.rows, 0);
    revalidatePath("/data");
    return {
      ok: true,
      message:
        results.length === 0
          ? "No network sources responded — bundled data is still current."
          : `Refreshed ${total} rows from ${results.map((r) => r.source).join(", ")}.`,
    };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

export async function rebuildDerivedAction(): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  try {
    const result = rebuildDerived(db);
    revalidatePath("/data");
    return {
      ok: true,
      message: `Rebuilt: ${result.openLots} open lots, ${result.closures} closures, ${result.optionPositions} option positions across ${result.accounts} accounts.`,
    };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}
