import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { swotVersions } from "@/lib/db/schema";
import { getPatterns, getOverview } from "@/lib/queries";
import { generateSwot, type Swot, type SwotItem } from "@/lib/swot";
import { PageHeader } from "@/components/ui";
import { regenerateSwot } from "./actions";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ helpers */

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function itemCount(swot: Swot): number {
  return (
    swot.strengths.length +
    swot.weaknesses.length +
    swot.opportunities.length +
    swot.threats.length
  );
}

function extractClaims(swot: Swot): string[] {
  return [
    ...swot.strengths.map((i) => `S: ${i.claim}`),
    ...swot.weaknesses.map((i) => `W: ${i.claim}`),
    ...swot.opportunities.map((i) => `O: ${i.claim}`),
    ...swot.threats.map((i) => `T: ${i.claim}`),
  ];
}

/* ------------------------------------------------------------------ sub-components */

function SwotCard({
  title,
  items,
  borderClass,
  labelClass,
}: {
  title: string;
  items: SwotItem[];
  borderClass: string;
  labelClass: string;
}) {
  return (
    <div
      className={`card flex flex-col gap-5 p-6 ${borderClass}`}
      style={{ borderWidth: "1px" }}
    >
      <h2 className={`font-display text-xl ${labelClass}`}>{title}</h2>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <p className="font-serif text-base leading-snug text-foreground">
            {item.claim}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 pl-0">
            {item.evidence.map((ev, j) => (
              <li key={j} className="text-xs text-faint leading-relaxed">
                · {ev}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function SwotPage() {
  const db = getDb();

  // Load versions newest-first
  const versions = db
    .select()
    .from(swotVersions)
    .orderBy(desc(swotVersions.createdAt))
    .all();

  let swot: Swot;
  let isLivePreview = false;
  let savedAt: string | null = null;

  if (versions.length > 0) {
    swot = JSON.parse(versions[0].payload) as Swot;
    savedAt = versions[0].createdAt;
  } else {
    // No saved version — generate live
    swot = generateSwot(getPatterns(), getOverview());
    isLivePreview = true;
  }

  /* ---------- diff: what changed vs the previous version ---------- */
  let addedClaims: string[] = [];
  let removedClaims: string[] = [];

  if (versions.length >= 2) {
    const currentClaims = new Set(extractClaims(swot));
    const prevSwot = JSON.parse(versions[1].payload) as Swot;
    const prevClaims = new Set(extractClaims(prevSwot));

    addedClaims = [...currentClaims].filter((c) => !prevClaims.has(c));
    removedClaims = [...prevClaims].filter((c) => !currentClaims.has(c));
  }

  return (
    <div>
      <PageHeader
        kicker="self-assessment"
        title="SWOT of Me"
        subtitle="Derived from your trading history. Every claim has a receipt — no opinions, no moralizing."
      />

      {/* ── Live preview banner ── */}
      {isLivePreview && (
        <div className="mb-6 rounded-lg border border-brass/40 bg-surface px-5 py-3 text-sm text-brass-bright">
          live preview — not yet saved. Hit "Regenerate &amp; save" to persist this version.
        </div>
      )}

      {/* ── Saved-at label ── */}
      {savedAt && (
        <p className="mb-6 text-xs text-faint">
          Last saved: {fmtDateTime(savedAt)}
        </p>
      )}

      {/* ── 2×2 SWOT grid ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-10">
        <SwotCard
          title="Strengths"
          items={swot.strengths}
          borderClass="border-gain/40"
          labelClass="text-gain"
        />
        <SwotCard
          title="Weaknesses"
          items={swot.weaknesses}
          borderClass="border-loss/40"
          labelClass="text-loss"
        />
        <SwotCard
          title="Opportunities"
          items={swot.opportunities}
          borderClass="border-brass/50"
          labelClass="text-brass-bright"
        />
        <SwotCard
          title="Threats"
          items={swot.threats}
          borderClass="border-panic/50"
          labelClass="text-panic"
        />
      </div>

      {/* ── Regenerate & save button ── */}
      <form action={regenerateSwot} className="mb-12">
        <button
          type="submit"
          className="rounded-md border border-brass/50 bg-surface px-5 py-2.5 text-sm text-brass-bright transition-colors hover:bg-surface2 hover:border-brass"
        >
          Regenerate &amp; save
        </button>
        <p className="mt-2 text-xs text-faint">
          Runs all pattern detectors fresh and stores a new snapshot.
        </p>
      </form>

      {/* ── What changed (diff) ── */}
      {versions.length >= 2 && (addedClaims.length > 0 || removedClaims.length > 0) && (
        <section className="mb-10">
          <h2 className="font-display text-xl text-foreground mb-3">What changed</h2>
          <div className="card px-5 py-4 flex flex-col gap-4">
            {addedClaims.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-widest text-gain mb-2">
                  Added ({addedClaims.length})
                </div>
                <ul className="flex flex-col gap-1">
                  {addedClaims.map((c, i) => (
                    <li key={i} className="text-sm text-foreground">
                      <span className="text-gain mr-1">+</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {removedClaims.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-widest text-loss mb-2">
                  Removed ({removedClaims.length})
                </div>
                <ul className="flex flex-col gap-1">
                  {removedClaims.map((c, i) => (
                    <li key={i} className="text-sm text-muted">
                      <span className="text-loss mr-1">−</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Version history ── */}
      {versions.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl text-foreground mb-3">Version history</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-2 text-left text-[11px] uppercase tracking-widest text-faint font-normal">
                    Saved at
                  </th>
                  <th className="px-5 py-2 text-left text-[11px] uppercase tracking-widest text-faint font-normal num">
                    S
                  </th>
                  <th className="px-5 py-2 text-left text-[11px] uppercase tracking-widest text-faint font-normal num">
                    W
                  </th>
                  <th className="px-5 py-2 text-left text-[11px] uppercase tracking-widest text-faint font-normal num">
                    O
                  </th>
                  <th className="px-5 py-2 text-left text-[11px] uppercase tracking-widest text-faint font-normal num">
                    T
                  </th>
                  <th className="px-5 py-2 text-left text-[11px] uppercase tracking-widest text-faint font-normal num">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v, i) => {
                  const vSwot = JSON.parse(v.payload) as Swot;
                  return (
                    <tr
                      key={v.id}
                      className={`border-b border-line/50 ${i === 0 ? "bg-surface2" : ""}`}
                    >
                      <td className="px-5 py-2 text-muted">
                        {fmtDateTime(v.createdAt)}
                        {i === 0 && (
                          <span className="ml-2 text-[10px] uppercase tracking-widest text-brass-bright">
                            current
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2 num text-gain">
                        {vSwot.strengths.length}
                      </td>
                      <td className="px-5 py-2 num text-loss">
                        {vSwot.weaknesses.length}
                      </td>
                      <td className="px-5 py-2 num text-brass-bright">
                        {vSwot.opportunities.length}
                      </td>
                      <td className="px-5 py-2 num text-panic">
                        {vSwot.threats.length}
                      </td>
                      <td className="px-5 py-2 num text-foreground">
                        {itemCount(vSwot)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
