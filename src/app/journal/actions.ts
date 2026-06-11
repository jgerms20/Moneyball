"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { journalEntries } from "@/lib/db/schema";

export async function createReflection(formData: FormData): Promise<void> {
  const date = String(formData.get("date") ?? "").trim();
  const symbol =
    String(formData.get("symbol") ?? "").trim().toUpperCase() || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();

  if (!date || !body) return;

  const now = new Date().toISOString();
  const db = getDb();
  db.insert(journalEntries)
    .values({
      date,
      symbol: symbol ?? undefined,
      kind: "reflection",
      title: title ?? undefined,
      body,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  revalidatePath("/journal");
}

export async function createThesis(formData: FormData): Promise<void> {
  const date = String(formData.get("date") ?? "").trim();
  const symbol = String(formData.get("symbol") ?? "")
    .trim()
    .toUpperCase();
  const body = String(formData.get("body") ?? "").trim();
  const exitPlan = String(formData.get("exitPlan") ?? "").trim() || null;
  const invalidation =
    String(formData.get("invalidation") ?? "").trim() || null;
  const convictionRaw = parseInt(
    String(formData.get("conviction") ?? "3"),
    10,
  );
  const conviction =
    convictionRaw >= 1 && convictionRaw <= 5 ? convictionRaw : 3;

  if (!date || !symbol || !body) return;

  const now = new Date().toISOString();
  const db = getDb();
  db.insert(journalEntries)
    .values({
      date,
      symbol,
      kind: "thesis",
      body,
      conviction,
      exitPlan: exitPlan ?? undefined,
      invalidation: invalidation ?? undefined,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  revalidatePath("/journal");
}

export async function createChecklist(formData: FormData): Promise<void> {
  const date = String(formData.get("date") ?? "").trim();
  const symbol =
    String(formData.get("symbol") ?? "").trim().toUpperCase() || null;
  const thesis = String(formData.get("thesis") ?? "").trim();
  const maxLoss = String(formData.get("maxLoss") ?? "").trim();
  const exitPlan = String(formData.get("exitPlan") ?? "").trim() || null;
  const withinLoss = String(formData.get("withinLoss") ?? "no").trim();
  const positionSize = String(
    formData.get("positionSize") ?? "normal",
  ).trim();

  if (!date || !thesis) return;

  const payload = JSON.stringify({
    thesis,
    maxLoss,
    exitPlan,
    withinLoss,
    positionSize,
  });

  const now = new Date().toISOString();
  const db = getDb();
  db.insert(journalEntries)
    .values({
      date,
      symbol: symbol ?? undefined,
      kind: "checklist",
      body: thesis,
      payload,
      exitPlan: exitPlan ?? undefined,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  revalidatePath("/journal");
}
