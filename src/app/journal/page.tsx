import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { journalEntries } from "@/lib/db/schema";
import { getOverview } from "@/lib/queries";
import { PageHeader, Badge, Empty } from "@/components/ui";
import { ReflectionForm } from "@/components/journal/ReflectionForm";
import { ThesisForm } from "@/components/journal/ThesisForm";
import { ChecklistForm } from "@/components/journal/ChecklistForm";

export const dynamic = "force-dynamic";

// ── helpers ─────────────────────────────────────────────────────────────────

function ageDays(dateStr: string): number {
  const then = Date.parse(dateStr + "T12:00:00Z"); // noon UTC: no off-by-one in any real timezone
  const now = Date.now();
  return Math.floor((now - then) / 86_400_000);
}

function BrassDots({ conviction }: { conviction: number | null }) {
  const n = conviction ?? 0;
  return (
    <span className="inline-flex gap-0.5 text-brass">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= n ? "text-brass" : "text-faint"}>
          {i <= n ? "●" : "○"}
        </span>
      ))}
    </span>
  );
}

// ── tab types ────────────────────────────────────────────────────────────────

type Tab = "reflections" | "theses" | "checklist";
const VALID_TABS: Tab[] = ["reflections", "theses", "checklist"];

function isValidTab(t: string | undefined): t is Tab {
  return VALID_TABS.includes(t as Tab);
}

// ── page ────────────────────────────────────────────────────────────────────

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = isValidTab(tabParam) ? tabParam : "reflections";

  // Query journal entries directly (no modification to queries.ts)
  const db = getDb();
  const allEntries = db
    .select()
    .from(journalEntries)
    .orderBy(desc(journalEntries.createdAt))
    .all();

  const reflections = allEntries.filter((e) => e.kind === "reflection");
  const theses = allEntries.filter((e) => e.kind === "thesis");
  const checklists = allEntries.filter((e) => e.kind === "checklist");

  // Holdings for thesis "position closed" detection
  const { holdings } = getOverview();
  const holdingSymbols = new Set(holdings.map((h) => h.symbol.toUpperCase()));

  const tabLink = (t: Tab) =>
    `/journal?tab=${t}` as const;

  const tabClass = (t: Tab) =>
    t === tab
      ? "border-b-2 border-brass text-brass-bright pb-2 text-sm font-medium"
      : "border-b-2 border-transparent text-muted pb-2 text-sm hover:text-foreground transition-colors";

  return (
    <div>
      <PageHeader
        kicker="journal"
        title="Trade Journal"
        subtitle="Reflections, theses, and pre-trade checklists — your thinking on record."
      />

      {/* Tab nav */}
      <nav className="mb-8 flex gap-6 border-b border-line">
        <Link href={tabLink("reflections")} className={tabClass("reflections")}>
          Reflections
        </Link>
        <Link href={tabLink("theses")} className={tabClass("theses")}>
          Thesis Tracker
        </Link>
        <Link href={tabLink("checklist")} className={tabClass("checklist")}>
          Pre-Trade Checklist
        </Link>
      </nav>

      {/* ── Reflections ─────────────────────────────────────────────────── */}
      {tab === "reflections" && (
        <div className="flex flex-col gap-6">
          <ReflectionForm />

          {reflections.length === 0 ? (
            <Empty>No reflections yet — write your first one above.</Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {reflections.map((entry) => (
                <article key={entry.id} className="card px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs text-muted font-mono">
                      {entry.date}
                    </span>
                    {entry.symbol && (
                      <Badge tone="brass">{entry.symbol}</Badge>
                    )}
                  </div>
                  {entry.title && (
                    <h3 className="font-serif text-lg text-foreground mb-1">
                      {entry.title}
                    </h3>
                  )}
                  <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">
                    {entry.body}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Thesis Tracker ──────────────────────────────────────────────── */}
      {tab === "theses" && (
        <div className="flex flex-col gap-6">
          <ThesisForm />

          {theses.length === 0 ? (
            <Empty>No theses yet — file your first one above.</Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {theses.map((entry) => {
                const symbol = entry.symbol ?? "";
                const closed =
                  symbol !== "" && !holdingSymbols.has(symbol.toUpperCase());
                const age = ageDays(entry.date);

                return (
                  <article
                    key={entry.id}
                    className="card px-5 py-4 flex flex-col gap-3"
                  >
                    {/* Header row */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-mono font-medium text-foreground">
                        {symbol}
                      </span>
                      <BrassDots conviction={entry.conviction} />
                      <span className="text-xs text-faint">
                        {age === 0
                          ? "today"
                          : age === 1
                          ? "1 day ago"
                          : `${age} days old`}
                      </span>
                      <span className="text-xs text-muted">
                        {entry.date}
                      </span>
                    </div>

                    {/* Position closed nudge */}
                    {closed && (
                      <div className="rounded-md border border-loss/30 bg-loss/5 px-3 py-2 text-xs text-loss">
                        Position closed — write the epilogue.
                      </div>
                    )}

                    {/* Body */}
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-faint mb-1">
                        Why I bought
                      </div>
                      <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">
                        {entry.body}
                      </p>
                    </div>

                    {/* Exit plan + invalidation */}
                    {(entry.exitPlan || entry.invalidation) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-line">
                        {entry.exitPlan && (
                          <div>
                            <div className="text-[11px] uppercase tracking-widest text-faint mb-1">
                              Exit plan
                            </div>
                            <p className="text-sm text-muted whitespace-pre-wrap">
                              {entry.exitPlan}
                            </p>
                          </div>
                        )}
                        {entry.invalidation && (
                          <div>
                            <div className="text-[11px] uppercase tracking-widest text-faint mb-1">
                              What would prove me wrong
                            </div>
                            <p className="text-sm text-muted whitespace-pre-wrap">
                              {entry.invalidation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Pre-Trade Checklist ─────────────────────────────────────────── */}
      {tab === "checklist" && (
        <div className="flex flex-col gap-6">
          {/* Nudge copy — informs, never blocks */}
          <p className="text-sm text-muted">
            A 20-second gut-check before you pull the trigger. Nudges inform —
            they never block a trade, and they never fire on Belief Bucket
            tickers.
          </p>

          <ChecklistForm />

          {checklists.length === 0 ? (
            <Empty>No checklists yet — fill one out above before your next trade.</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {checklists.map((entry) => {
                let parsed: {
                  thesis?: string;
                  maxLoss?: string;
                  exitPlan?: string;
                  withinLoss?: string;
                  positionSize?: string;
                } = {};
                try {
                  parsed = entry.payload ? JSON.parse(entry.payload) : {};
                } catch {
                  /* ignore malformed payload */
                }

                const withinLoss = parsed.withinLoss === "yes";

                return (
                  <div
                    key={entry.id}
                    className="card px-4 py-3 flex flex-col gap-1"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-muted font-mono">
                        {entry.date}
                      </span>
                      {entry.symbol && (
                        <Badge tone="brass">{entry.symbol}</Badge>
                      )}
                      {parsed.maxLoss && (
                        <span className="text-xs text-muted font-mono">
                          max loss ${parsed.maxLoss}
                        </span>
                      )}
                      <span className="text-xs text-muted capitalize">
                        size:{" "}
                        <span className="text-foreground">
                          {parsed.positionSize ?? "—"}
                        </span>
                      </span>
                      {withinLoss && (
                        <span className="text-xs text-loss font-medium">
                          within 48h of a loss
                        </span>
                      )}
                    </div>
                    {parsed.thesis && (
                      <p className="text-sm text-muted">
                        {parsed.thesis}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
