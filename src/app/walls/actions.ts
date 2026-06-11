"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { designations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function addDesignation(formData: FormData): Promise<void> {
  const symbol = String(formData.get("symbol") ?? "")
    .trim()
    .toUpperCase();
  const bucketRaw = String(formData.get("bucket") ?? "belief").trim();
  const bucket =
    (["belief", "quality", "meme", "watch"] as const).find((b) => b === bucketRaw) ?? "belief";
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!symbol) return;

  const db = getDb();
  db.insert(designations)
    .values({
      symbol,
      bucket,
      note: note ?? undefined,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: designations.symbol,
      set: { bucket, note },
    })
    .run();

  revalidatePath("/walls");
}

export async function removeDesignation(formData: FormData): Promise<void> {
  const symbol = String(formData.get("symbol") ?? "")
    .trim()
    .toUpperCase();
  if (!symbol) return;

  const db = getDb();
  db.delete(designations).where(eq(designations.symbol, symbol)).run();

  revalidatePath("/walls");
}
