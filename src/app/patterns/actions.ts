"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { clusterTags } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type ClusterTagReason = "liquidity" | "consolidation" | "capitulation" | "other";

export async function upsertClusterTag(formData: FormData): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() as ClusterTagReason;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!accountId || !date || !reason) return;

  const validReasons: ClusterTagReason[] = ["liquidity", "consolidation", "capitulation", "other"];
  if (!validReasons.includes(reason)) return;

  const db = getDb();
  const now = new Date().toISOString();

  db.insert(clusterTags)
    .values({ accountId, date, reason, note, createdAt: now })
    .onConflictDoUpdate({
      target: [clusterTags.accountId, clusterTags.date],
      set: { reason, note, createdAt: now },
    })
    .run();

  revalidatePath("/patterns");
}
