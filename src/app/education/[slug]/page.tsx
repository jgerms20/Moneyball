/**
 * Individual education module page.
 * Assembles the full DataBag from queries, finds the module by slug,
 * and renders with back + prev/next nav.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { modules, type DataBag } from "@/lib/education/modules";
import { getOverview, getTaxData, getOptionsReport } from "@/lib/queries";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EducationModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const idx = modules.findIndex((m) => m.slug === slug);
  if (idx === -1) {
    notFound();
  }

  const mod = modules[idx];
  const prev = idx > 0 ? modules[idx - 1] : null;
  const next = idx < modules.length - 1 ? modules[idx + 1] : null;

  /* ------------------------------------------------------------------ */
  /* Assemble the data bag                                                */
  /* ------------------------------------------------------------------ */
  const overview = getOverview();
  const tax = getTaxData();
  const opts = getOptionsReport();

  const bag: DataBag = {
    overview,
    taxLots: tax.lots as DataBag["taxLots"],
    taxForms: tax.forms as DataBag["taxForms"],
    optionPositions: opts.positions as DataBag["optionPositions"],
    byStrategy: opts.byStrategy,
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/education"
          className="text-[11px] uppercase tracking-[0.15em] text-faint hover:text-brass transition-colors"
        >
          ← Reading Room
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        kicker={mod.kicker}
        title={mod.title}
        subtitle={mod.hook}
      />

      {/* Reading time */}
      <div className="mb-8 text-[11px] text-faint">
        {mod.minutes} min read
        <span className="mx-2 text-line">·</span>
        Module {idx + 1} of {modules.length}
      </div>

      {/* Module body */}
      <div className="min-h-[16rem]">
        {mod.render(bag)}
      </div>

      {/* Disclaimer */}
      <div className="mt-10 border-t border-line pt-6 text-xs text-faint max-w-2xl">
        This module is educational only and does not constitute financial, tax, or investment advice.
        Strategies are presented with their maximum-loss scenarios. Consult a qualified professional
        before making financial decisions.
      </div>

      {/* Prev / Next nav */}
      {(prev || next) && (
        <nav className="mt-8 grid grid-cols-2 gap-4">
          <div>
            {prev && (
              <Link
                href={`/education/${prev.slug}`}
                className="card group flex flex-col gap-1 px-4 py-4 hover:border-brass/40 hover:bg-surface2/60 transition-colors"
              >
                <span className="text-[10px] uppercase tracking-wider text-faint">← Previous</span>
                <span className="text-[10px] text-brass group-hover:text-brass-bright transition-colors">
                  {prev.kicker}
                </span>
                <span className="text-sm font-display text-foreground leading-snug group-hover:text-brass-bright transition-colors">
                  {prev.title}
                </span>
              </Link>
            )}
          </div>
          <div>
            {next && (
              <Link
                href={`/education/${next.slug}`}
                className="card group flex flex-col gap-1 px-4 py-4 text-right hover:border-brass/40 hover:bg-surface2/60 transition-colors"
              >
                <span className="text-[10px] uppercase tracking-wider text-faint">Next →</span>
                <span className="text-[10px] text-brass group-hover:text-brass-bright transition-colors">
                  {next.kicker}
                </span>
                <span className="text-sm font-display text-foreground leading-snug group-hover:text-brass-bright transition-colors">
                  {next.title}
                </span>
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
