import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { getOverview, getPatterns, getRecentTransactions } from "@/lib/queries";
import { formatCents } from "@/lib/model/money";

export const dynamic = "force-dynamic";

function apiKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const row = getDb().select().from(settings).where(eq(settings.key, "anthropic_api_key")).get();
  return row?.value ?? null;
}

/** Compact, receipt-bearing context the model can reason over. */
function buildContext(): string {
  const o = getOverview();
  const p = getPatterns();
  const recent = getRecentTransactions(40).map((t) => ({
    date: t.date, type: t.type, symbol: t.symbol, qty: t.qtyMicro != null ? t.qtyMicro / 1e6 : null,
    amount: t.amountCents != null ? formatCents(t.amountCents) : null,
  }));
  return JSON.stringify(
    {
      years: o.years,
      cumulativeRealized: formatCents(o.cumulativeRealizedCents),
      holdings: o.holdings.slice(0, 30).map((h) => ({
        symbol: h.symbol, qty: h.qtyMicro / 1e6, cost: formatCents(h.costCents),
        value: formatCents(h.marketValueCents), unrealized: formatCents(h.unrealizedCents),
      })),
      optionsVitals: o.optionsVitals,
      beliefBucket: o.beliefBucket,
      crashBuyer: {
        score: p.crashBuyer.score,
        bestDay: p.crashBuyer.bestDay,
        drawdownBuyDays: p.crashBuyer.drawdownBuyDays,
        deployedInDrawdown: formatCents(p.crashBuyer.deployedInDrawdownCents),
      },
      clusterSellDays: p.clusters.map((c) => ({
        date: c.date, sells: c.sells, grade: c.timingGrade, reason: c.taggedReason,
        proceeds: formatCents(c.proceedsCents),
      })),
      prematureExits: p.premature.exits.slice(0, 8),
      roundTrips: p.roundTrips,
      medianHoldingDays: p.holding.medianHoldingDays,
      recentTransactions: recent,
    },
    null,
    1,
  );
}

const SYSTEM = `You are "The Mirror" — the reflective voice of Trader Mirror, a private trading
psychology platform for a single user. You speak like an honest friend at a jazz bar:
warm, direct, evidence-first, never moralizing, never shaming. The user's belief-bucket
positions (e.g. AMC) are a chosen relationship — never nag about them.
Answer questions about the user's own trading using ONLY the JSON data provided.
Cite concrete numbers and dates as receipts. If the data can't answer, say so plainly.
You are not a financial advisor; you describe what happened and what patterns show,
not what to buy or sell.`;

export async function POST(req: Request) {
  const key = apiKey();
  if (!key) {
    return NextResponse.json(
      { error: "No Anthropic API key configured. Add one below or set ANTHROPIC_API_KEY." },
      { status: 400 },
    );
  }
  const body = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: `The user's trading data:\n${buildContext()}` },
      ],
      messages: body.messages.slice(-12),
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "That API key was rejected by Anthropic." }, { status: 401 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Anthropic API error: ${err.message}` }, { status: 502 });
    }
    throw err;
  }
}
