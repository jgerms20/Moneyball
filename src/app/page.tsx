import { getOverview } from "@/lib/queries";
import { Money, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function MirrorPage() {
  const o = getOverview();
  return (
    <div>
      <PageHeader
        kicker="the mirror"
        title="Good evening."
        subtitle={
          o.hasData
            ? "The data layer is live. The full Mirror is being polished."
            : "No data yet — run an import or seed the demo."
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label="Cumulative realized"
          value={<Money cents={o.cumulativeRealizedCents} colored sign />}
        />
        <Stat label="Accounts" value={o.accounts.length} />
        <Stat label="Holdings" value={o.holdings.length} />
        <Stat label="Import files" value={o.dataHealth.importFiles} />
      </div>
    </div>
  );
}
