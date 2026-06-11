"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { swotVersions } from "@/lib/db/schema";
import { getPatterns, getOverview } from "@/lib/queries";
import { generateSwot } from "@/lib/swot";

export async function regenerateSwot(): Promise<void> {
  const patterns = getPatterns();
  const overview = getOverview();
  const swot = generateSwot(patterns, overview);

  const db = getDb();
  db.insert(swotVersions)
    .values({
      createdAt: new Date().toISOString(),
      payload: JSON.stringify(swot),
    })
    .run();

  revalidatePath("/swot");
}
