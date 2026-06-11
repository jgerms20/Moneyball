"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

export async function saveApiKey(formData: FormData) {
  const key = String(formData.get("apiKey") ?? "").trim();
  const db = getDb();
  if (key) {
    db.insert(settings)
      .values({ key: "anthropic_api_key", value: key })
      .onConflictDoUpdate({ target: settings.key, set: { value: key } })
      .run();
  }
  revalidatePath("/ask");
}

export async function clearApiKey() {
  const db = getDb();
  db.delete(settings).where(eq(settings.key, "anthropic_api_key")).run();
  revalidatePath("/ask");
}
