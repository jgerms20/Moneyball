/**
 * Education index — editorial reading-room.
 * Grid of module cards: kicker, serif title, minutes, one-line hook.
 */

import Link from "next/link";
import { modules } from "@/lib/education/modules";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function EducationPage() {
  return (
    <div>
      <PageHeader
        kicker="education"
        title="The Reading Room"
        subtitle="Nine modules built from your own trade history. Tax mechanics, risk frameworks, professional habits — each one rooted in your data, not generic advice."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod, i) => (
          <Link
            key={mod.slug}
            href={`/education/${mod.slug}`}
            className="card group flex flex-col gap-3 px-5 py-5 transition-colors hover:border-brass/40 hover:bg-surface2/60"
          >
            {/* index badge + kicker */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-faint tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-brass">
                {mod.kicker}
              </span>
            </div>

            {/* serif title */}
            <h2 className="font-display text-xl leading-snug text-foreground group-hover:text-brass-bright transition-colors">
              {mod.title}
            </h2>

            {/* hook */}
            <p className="flex-1 text-xs leading-relaxed text-muted">{mod.hook}</p>

            {/* footer: reading time + arrow */}
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="text-[11px] text-faint">
                {mod.minutes} min read
              </span>
              <span className="text-[11px] text-brass opacity-0 transition-opacity group-hover:opacity-100">
                Read →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-faint max-w-2xl">
        This section is educational only and does not constitute financial or tax advice. All
        strategies are presented with their maximum-loss scenarios. Consult a qualified professional
        before making financial decisions.
      </p>
    </div>
  );
}
