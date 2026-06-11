import { getTimeline, getSpySeries } from "@/lib/queries";
import { getDb } from "@/lib/db/client";
import { annotations } from "@/lib/db/schema";
import { and, gte, lte } from "drizzle-orm";
import { PageHeader, Empty } from "@/components/ui";
import { YearTabs } from "@/components/timeline/YearTabs";
import { MarketStrip } from "@/components/timeline/MarketStrip";
import { DayCard } from "@/components/timeline/DayCard";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearStr } = await searchParams;

  const allDays = getTimeline();

  if (allDays.length === 0) {
    return (
      <div>
        <PageHeader
          kicker="timeline"
          title="Trade Replay"
          subtitle="A chronological mirror of every decision you made in the market."
        />
        <Empty>
          <span className="text-brass">No trading data yet.</span>
          <span>Import a brokerage file to see your timeline.</span>
        </Empty>
      </div>
    );
  }

  // Derive available years from all data
  const yearsSet = new Set<number>();
  for (const day of allDays) {
    yearsSet.add(parseInt(day.date.slice(0, 4), 10));
  }
  const years = [...yearsSet].sort((a, b) => b - a);
  const latestYear = years[0]!;
  const selectedYear = yearStr ? parseInt(yearStr, 10) : latestYear;
  const safeYear = yearsSet.has(selectedYear) ? selectedYear : latestYear;

  // Filter to selected year only
  const yearDays = allDays.filter((d) => d.date.startsWith(String(safeYear)));

  // SPY series for the strip chart
  const spySeries = getSpySeries(`${safeYear}-01-01`, `${safeYear}-12-31`);

  // Fetch annotations for this year
  const db = getDb();
  const yearStart = `${safeYear}-01-01`;
  const yearEnd = `${safeYear}-12-31`;
  const allAnnos = db
    .select()
    .from(annotations)
    .where(and(gte(annotations.date, yearStart), lte(annotations.date, yearEnd)))
    .all();

  // Group annotations by date
  const annoByDate = new Map<string, typeof allAnnos>();
  for (const a of allAnnos) {
    const list = annoByDate.get(a.date) ?? [];
    list.push(a);
    annoByDate.set(a.date, list);
  }

  // Reverse chronological order for display
  const reversedDays = [...yearDays].reverse();

  // Trade days for market strip (serializable)
  const tradeDays = yearDays.map((d) => ({
    date: d.date,
    buysCents: d.buysCents,
    sellsCents: d.sellsCents,
    regime: d.context.regime,
  }));

  return (
    <div>
      <PageHeader
        kicker="timeline"
        title="Trade Replay"
        subtitle="Every day you acted — seen through the market's eyes."
      />

      <YearTabs years={years} selected={safeYear} />

      <div className="mt-6 mb-8">
        <MarketStrip spy={spySeries} tradeDays={tradeDays} year={safeYear} />
      </div>

      <div className="flex flex-col gap-4">
        {reversedDays.map((day) => (
          <DayCard
            key={day.date}
            day={{
              date: day.date,
              buysCents: day.buysCents,
              sellsCents: day.sellsCents,
              events: day.events,
              context: {
                date: day.context.date,
                asOf: day.context.asOf,
                spyCloseMicro: day.context.spyCloseMicro,
                drawdownPct: day.context.drawdownPct,
                rangePosition: day.context.rangePosition,
                fiveDayReturnPct: day.context.fiveDayReturnPct,
                vixClose: day.context.vixClose,
                regime: day.context.regime,
              },
            }}
            annotations={annoByDate.get(day.date) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
