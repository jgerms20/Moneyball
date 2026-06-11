"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { designations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function addDesignation(formData: FormData): Promise<void> {
  const symbol = String(formData.get("symbol") ?? "")
    .trim()
    .toUpperCase();
  const bucket = String(formData.get("bucket") ?? "belief").trim() as
    | "belief"
    | "quality"
    | "meme"
    | "watch";
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!symbol) return;

  const db = getDb();
  // upsert: if symbol exists update bucket+note, else insert
  const existing = db
    .select()
    .from(designations)
    .where(eq(designations.symbol, symbol))
    .get();

  if (existing) {
    db.update(designations)
      .set({ bucket, note: note ?? undefined })
      .where(eq(designations.symbol, symbol))
      .run();
  } else {
    db.insert(designations)
      .values({
        symbol,
        bucket,
        note: note ?? undefined,
        createdAt: new Date().toISOString(),
      })
      .run();
  }

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
