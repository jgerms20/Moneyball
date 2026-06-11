"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { annotations } from "@/lib/db/schema";

export async function addAnnotation(formData: FormData): Promise<void> {
  const date = String(formData.get("date") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "life").trim() as "life" | "market" | "account";

  if (!date || !label) return;

  const db = getDb();
  db.insert(annotations)
    .values({
      date,
      label,
      body: body ?? undefined,
      kind,
      createdAt: new Date().toISOString(),
    })
    .run();

  revalidatePath("/timeline");
}
