/**
 * Options Psyche — a read of who you are when you trade options.
 * Server component, data fetched at request time.
 */

import { getOptionsReport, getOverview } from "@/lib/queries";
import { getMonthlyOptionCounts } from "@/app/options/queries";
import { Empty, Money, PageHeader, Section, Stat } from "@/components/ui";
import { StrategyBars } from "@/components/options/StrategyBars";
import { DteBucketChart } from "@/components/options/DteBucketChart";
import { TiltDetector } from "@/components/options/TiltDetector";
import { TwoTraders } from "@/components/options/TwoTraders";
import { WinLossAnatomy } from "@/components/options/WinLossAnatomy";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmtDollar(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
  return negative ? `-${s}` : s;
}

export default function OptionsPage() {
  const report = getOptionsReport();
  const overview = getOverview();
  const monthlyCounts = getMonthlyOptionCounts();

  /* ---- empty state ---- */
  if (report.vitals === null) {
    return (
      <div>
        <PageHeader
          kicker="options psyche"
          title="Your options book is empty."
          subtitle="Import your options trading history to see how you perform as a probability trader."
        />
        <Empty>
          <p className="text-base text-foreground">No option positions found.</p>
          <p className="max-w-lg text-muted">
            Two ways to import your history:
          </p>
          <ul className="mt-2 space-y-1 text-left text-sm text-muted">
            <li>
              <span className="text-brass-bright">Schwab.com</span> → Accounts → History → Export
              (select your options account, choose a date range, export as CSV)
            </li>
            <li>
              <span className="text-brass-bright">thinkorswim</span> → Monitor tab → Account
              Statement → set date range → Export to file
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted">
            Then drop either file on the{" "}
            <Link href="/data" className="text-brass underline">
              Data page
            </Link>
            . We&apos;ll detect the format automatically.
          </p>
        </Empty>
      </div>
    );
  }

  const v = report.vitals;
  const netPremium = v.premiumSoldCents + v.premiumBoughtCents; // premiumBought is negative

  /* stress-correlation: monthly trade count alongside realized */
  const hasMonthly = monthlyCounts.length > 0;
  const busiest = hasMonthly
    ? monthlyCounts.reduce((a, b) => (b.tradeCount > a.tradeCount ? b : a))
    : null;
  const busiestRealized = busiest
    ? monthlyCounts.filter((m) => m.month === busiest.month)[0]?.realizedCents ?? 0
    : 0;

  return (
    <div>
      <PageHeader
        kicker="options psyche"
        title="Options Psyche"
        subtitle="A candid read of who you are when you step into the probability game."
      />

      {/* 1. Vital signs strip */}
      <Section title="Vital signs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Total positions"
            value={v.totalPositions}
            hint={`${v.open} open · ${v.closed} closed`}
          />
          <Stat
            label="Win rate"
            value={v.winRatePct != null ? `${v.winRatePct}%` : "—"}
            hint={`${v.closed} closed positions`}
            accent={v.winRatePct != null && v.winRatePct >= 60}
          />
          <Stat
            label="Realized P&L"
            value={<Money cents={v.realizedCents} colored sign />}
            hint="closed positions only"
          />
          <Stat
            label="Median DTE at open"
            value={v.medianDteAtOpen != null ? `${v.medianDteAtOpen}d` : "—"}
            hint="days to expiration"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Premium sold"
            value={<Money cents={v.premiumSoldCents} />}
            hint="cash received at opens"
          />
          <Stat
            label="Premium bought"
            value={<Money cents={Math.abs(v.premiumBoughtCents)} />}
            hint="cash paid at opens"
          />
          <Stat
            label="Net premium"
            value={<Money cents={netPremium} colored sign />}
            hint="sold minus bought"
          />
        </div>
      </Section>

      {/* 2. Win / Loss Anatomy */}
      <Section
        title="Win / Loss Anatomy"
        aside="closed positions only"
      >
        <div className="card p-5">
          <WinLossAnatomy positions={report.positions} />
        </div>
      </Section>

      {/* 3. Strategy breakdown */}
      <Section title="By strategy">
        <div className="card p-5">
          <StrategyBars data={report.byStrategy} />
        </div>
      </Section>

      {/* 4. DTE Buckets */}
      <Section
        title="By days to expiration"
        aside="trade count · realized P&L"
      >
        <div className="card p-5">
          <DteBucketChart
            data={report.dteBuckets}
            totalCount={v.totalPositions}
          />
        </div>
      </Section>

      {/* 5. Two Traders */}
      <Section
        title="Two traders, one brain"
        aside="equity vs options personality"
      >
        <TwoTraders overview={overview} />
      </Section>

      {/* 6. Stress / Correlation — monthly activity vs realized */}
      {hasMonthly && (
        <Section
          title="Activity vs results"
          aside="monthly trade count · stress correlation"
        >
          <div className="card p-5">
            <p className="mb-4 text-sm text-muted">
              Your busiest month was{" "}
              <span className="text-foreground font-medium">{busiest?.month}</span> with{" "}
              <span className="text-brass-bright num">{busiest?.tradeCount}</span> trades, which
              realized{" "}
              <span
                className={`num font-medium ${busiestRealized >= 0 ? "text-gain" : "text-loss"}`}
              >
                {fmtDollar(busiestRealized)}
              </span>
              . High frequency doesn&apos;t guarantee high quality.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-widest text-faint">
                    <th className="pb-2 pr-4">Month</th>
                    <th className="pb-2 pr-4 text-right">Trades</th>
                    <th className="pb-2 text-right">Realized</th>
                  </tr>
                </thead>
                <tbody>
                  {[...monthlyCounts]
                    .sort((a, b) => b.month.localeCompare(a.month))
                    .slice(0, 24)
                    .map((m) => (
                      <tr key={m.month} className="border-b border-line/40">
                        <td className="num py-2 pr-4 text-muted">{m.month}</td>
                        <td className="num py-2 pr-4 text-right text-foreground">
                          {m.tradeCount}
                        </td>
                        <td
                          className={`num py-2 text-right ${
                            m.realizedCents > 0
                              ? "text-gain"
                              : m.realizedCents < 0
                                ? "text-loss"
                                : "text-muted"
                          }`}
                        >
                          {fmtDollar(m.realizedCents)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {monthlyCounts.length > 24 && (
                <p className="mt-2 text-xs text-faint">
                  Showing most recent 24 of {monthlyCounts.length} months.
                </p>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* 7. Tilt Detector */}
      <Section
        title="Tilt detector"
        aside="trades opened within 48h of a realized loss"
      >
        <TiltDetector tilt={report.tilt} />
      </Section>
    </div>
  );
}
