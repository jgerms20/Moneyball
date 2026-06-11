import { getOverview, getPatterns } from "@/lib/queries";
import {
  Badge,
  Empty,
  Money,
  PageHeader,
  PullQuote,
  Section,
  Stat,
} from "@/components/ui";
import { formatCents, formatQty, QTY_SCALE, PRICE_SCALE } from "@/lib/model/money";
import PnlByYearChart from "@/components/mirror/PnlByYearChart";
import CashFlowChart from "@/components/mirror/CashFlowChart";
import type { PnlYearDatum } from "@/components/mirror/PnlByYearChart";
import type { CashFlowDatum } from "@/components/mirror/CashFlowChart";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function greeting(): string {
  // 2026-06-11 → hour-agnostic; just a warm opener
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPct(n: number, decimals = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + "%";
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* page                                                                 */
/* ------------------------------------------------------------------ */

export default function MirrorPage() {
  const o = getOverview();

  /* ---- empty state ---- */
  if (!o.hasData) {
    return (
      <div>
        <PageHeader
          kicker="the mirror"
          title={greeting()}
          subtitle="No trading history loaded yet."
        />
        <Empty>
          <p className="text-base text-foreground">Nothing to reflect on yet.</p>
          <p className="max-w-sm text-muted">
            Run{" "}
            <code className="rounded bg-surface2 px-1 py-0.5 font-mono text-brass">
              npm run import -- &lt;files&gt;
            </code>{" "}
            to import your brokerage exports, or{" "}
            <code className="rounded bg-surface2 px-1 py-0.5 font-mono text-brass">
              npm run seed:demo
            </code>{" "}
            to explore with sample data.
          </p>
        </Empty>
      </div>
    );
  }

  /* ---- derived values ---- */
  const pnl = o.cumulativeRealizedCents;
  const pnlColor = pnl > 0 ? "text-gain" : pnl < 0 ? "text-loss" : "text-muted";

  // find worst year by authoritative gain
  const yearsWithGain = o.years.filter(
    (y) => y.taxGainCents != null || y.engineGainCents != null
  );
  const worstYear =
    yearsWithGain.length > 0
      ? yearsWithGain.reduce((a, b) => {
          const ag = a.taxGainCents ?? a.engineGainCents ?? 0;
          const bg = b.taxGainCents ?? b.engineGainCents ?? 0;
          return bg < ag ? b : a;
        })
      : null;
  const worstGain = worstYear
    ? (worstYear.taxGainCents ?? worstYear.engineGainCents ?? 0)
    : 0;

  // subtitle that adapts to the data
  function heroSubtitle(): string {
    if (yearsWithGain.length === 0) return "The ledger is open. Let it speak.";
    if (worstYear && worstGain < -500_00 && yearsWithGain.length > 1) {
      const worstPct = Math.round((Math.abs(worstGain) / Math.abs(pnl === 0 ? 1 : pnl)) * 100);
      return `${worstYear.year} carries ${worstPct}% of the damage — one year, the whole story.`;
    }
    if (pnl > 0) {
      return "In the black, on balance. The details are worth a closer look.";
    }
    return "Still in the red on realized — but the story isn't over.";
  }

  /* ---- P&L by year chart data ---- */
  const pnlChartData: PnlYearDatum[] = o.years
    .filter((y) => y.taxGainCents != null || y.engineGainCents != null)
    .map((y) => ({
      year: y.year,
      gainCents: y.taxGainCents ?? y.engineGainCents ?? 0,
      isTax: y.taxGainCents != null,
    }));

  const anyTax = o.years.some((y) => y.taxGainCents != null);

  /* ---- cash flow chart data ---- */
  const cashData: CashFlowDatum[] = o.years
    .filter((y) => y.depositsCents > 0 || y.withdrawalsCents > 0)
    .map((y) => ({
      year: y.year,
      depositsCents: y.depositsCents,
      withdrawalsCents: y.withdrawalsCents,
    }));

  // latest year with cash activity
  const latestCash = cashData.length > 0 ? cashData[cashData.length - 1] : null;
  const worstRatioCash =
    cashData.length > 0
      ? cashData.reduce((a, b) => {
          const ra = a.depositsCents > 0 ? a.withdrawalsCents / a.depositsCents : 0;
          const rb = b.depositsCents > 0 ? b.withdrawalsCents / b.depositsCents : 0;
          return rb > ra ? b : a;
        })
      : null;

  function cashCopyLine(): string {
    if (!latestCash || latestCash.depositsCents === 0) return "";
    const latestRatio = latestCash.withdrawalsCents / latestCash.depositsCents;
    if (!worstRatioCash || worstRatioCash.depositsCents === 0) return "";
    const worstRatio = worstRatioCash.withdrawalsCents / worstRatioCash.depositsCents;
    if (latestCash.year === worstRatioCash.year) {
      return `In ${latestCash.year}, withdrawals were ${formatPct(latestRatio * 100, 0)} of deposits.`;
    }
    if (latestRatio < worstRatio) {
      return `The withdrawal-to-deposit ratio peaked at ${formatPct(worstRatio * 100, 0)} in ${worstRatioCash.year}; ${latestCash.year} is down to ${formatPct(latestRatio * 100, 0)}. The gap is closing.`;
    }
    return `Deposits: ${formatCents(latestCash.depositsCents)} · Withdrawals: ${formatCents(latestCash.withdrawalsCents)} in ${latestCash.year}.`;
  }

  /* ---- dividend strip ---- */
  const dividendYears = o.years.filter((y) => y.dividendsCents > 0);
  const totalDividends = dividendYears.reduce((a, y) => a + y.dividendsCents, 0);

  /* ---- holdings ---- */
  const regularHoldings = o.holdings.filter((h) => !h.isMoneyMarket);
  const mmHoldings = o.holdings.filter((h) => h.isMoneyMarket);

  /* ---- insight of the day ---- */
  const patterns = getPatterns();

  interface Insight {
    quote: string;
    footnote: string;
  }

  function buildInsights(): Insight[] {
    const list: Insight[] = [];

    // 1. crash buyer receipt
    const cb = patterns.crashBuyer;
    if (cb.bestDay) {
      list.push({
        quote: `On ${fmtDate(cb.bestDay.date)}, when the market was down ${Math.abs(cb.bestDay.drawdownPct).toFixed(1)}% from its peak, you deployed capital instead of freezing. That's a rare reflex.`,
        footnote: `Crash-buyer score ${cb.score}/100 · ${formatCents(cb.deployedInDrawdownCents)} deployed into ≥10% drawdowns · ${cb.drawdownBuyDays} buy day${cb.drawdownBuyDays !== 1 ? "s" : ""} in deep corrections`,
      });
    }

    // 2. biggest premature exit
    const topExit = patterns.premature.exits[0];
    if (topExit) {
      list.push({
        quote: `You sold ${topExit.symbol} on ${fmtDate(topExit.exitDate)}, then watched it climb another ${topExit.runUpPct.toFixed(0)}% in the next year. Sometimes the hardest trade is the one you don't make.`,
        footnote: `Left on table: ${formatCents(topExit.leftOnTableCents)} · Peak on ${fmtDate(topExit.peakDate)} · ${patterns.premature.exits.length} premature exit${patterns.premature.exits.length !== 1 ? "s" : ""} total`,
      });
    }

    // 3. cluster day timing grade
    const bestCluster = patterns.clusters.length > 0
      ? patterns.clusters.reduce((a, b) =>
          (a.timingGrade < b.timingGrade ? a : b)
        )
      : null;
    if (bestCluster && bestCluster.timingGrade === "A") {
      list.push({
        quote: `Your best cluster sell day — ${fmtDate(bestCluster.date)}, ${bestCluster.sells} positions — landed in the top fifth of the 52-week range. You picked the moment.`,
        footnote: `Timing grade A · ${formatCents(bestCluster.proceedsCents)} proceeds · ${bestCluster.symbols.slice(0, 4).join(", ")}${bestCluster.symbols.length > 4 ? " …" : ""}`,
      });
    } else if (bestCluster) {
      list.push({
        quote: `On ${fmtDate(bestCluster.date)} you liquidated ${bestCluster.sells} positions at once. Timing grade: ${bestCluster.timingGrade}. ${bestCluster.timingNote}`,
        footnote: `${formatCents(bestCluster.proceedsCents)} proceeds · ${bestCluster.symbols.slice(0, 4).join(", ")}${bestCluster.symbols.length > 4 ? " …" : ""}`,
      });
    }

    // 4. dividend growth
    if (dividendYears.length >= 2) {
      const first = dividendYears[0];
      const last = dividendYears[dividendYears.length - 1];
      if (last.dividendsCents > first.dividendsCents) {
        const growthPct = ((last.dividendsCents - first.dividendsCents) / first.dividendsCents) * 100;
        list.push({
          quote: `Your dividend income grew from ${formatCents(first.dividendsCents)} in ${first.year} to ${formatCents(last.dividendsCents)} in ${last.year} — a ${growthPct.toFixed(0)}% rise. Patience compounds quietly.`,
          footnote: `Total dividends received: ${formatCents(totalDividends)} · ${dividendYears.length} years of income`,
        });
      } else {
        list.push({
          quote: `Dividends collected across ${dividendYears.length} years: ${formatCents(totalDividends)}. Not glamorous — but it showed up every quarter.`,
          footnote: `${formatCents(last.dividendsCents)} in ${last.year} · ${formatCents(first.dividendsCents)} in ${first.year}`,
        });
      }
    }

    // 5. options win rate vs baseline
    if (o.optionsVitals && o.optionsVitals.winRatePct != null) {
      const v = o.optionsVitals;
      const mood = (v.winRatePct ?? 0) >= 60 ? "above the median" : "room to sharpen";
      list.push({
        quote: `Your options book closes winners ${v.winRatePct}% of the time — ${mood}. ${v.open} positions still open, watching.`,
        footnote: `Realized: ${formatCents(v.realizedCents)} · ${v.closed} closed positions · Median DTE at open: ${v.medianDteAtOpen != null ? v.medianDteAtOpen : "—"}`,
      });
    }

    // 6. round trip (realized winners early then losses)
    const topTrip = patterns.roundTrips[0];
    if (topTrip) {
      list.push({
        quote: `${topTrip.symbol}: you booked the gain of ${formatCents(topTrip.earlyGainCents)} early, then came back and handed ${formatCents(Math.abs(topTrip.lateLossCents))} back later. Conviction without a plan is just timing luck.`,
        footnote: `First win: ${fmtDate(topTrip.firstWinDate)} · Last loss: ${fmtDate(topTrip.lastLossDate)}`,
      });
    }

    // 7. cumulative insight fallback
    if (list.length < 5) {
      list.push({
        quote: `Cumulative realized P&L: ${formatCents(Math.abs(pnl))} ${pnl >= 0 ? "in the gain column" : "in tuition paid"}. Every number on this page is a receipt from a decision you made under uncertainty.`,
        footnote: `Across ${o.accounts.length} account${o.accounts.length !== 1 ? "s" : ""} · ${o.holdings.length} open position${o.holdings.length !== 1 ? "s" : ""} today`,
      });
    }

    return list;
  }

  const insights = buildInsights();
  const doy = dayOfYear(new Date());
  const insight = insights[doy % insights.length];

  /* ------------------------------------------------------------------ */
  /* render                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div>
      {/* 1. Hero */}
      <PageHeader
        kicker={o.isDemo ? "demo data · the mirror" : "the mirror"}
        title={greeting()}
      />

      <div className="rise mb-10">
        <div className={`font-display text-6xl leading-none ${pnlColor} num`}>
          {formatCents(pnl, { sign: true })}
        </div>
        <p className="mt-3 text-sm text-muted">{heroSubtitle()}</p>
      </div>

      {/* 2. Realized P&L by year */}
      {pnlChartData.length > 0 && (
        <Section title="Realized P&L by year">
          <div className="card p-4">
            <PnlByYearChart data={pnlChartData} />
          </div>
          {anyTax && (
            <p className="mt-2 text-xs text-faint">
              Tax-form numbers are authoritative where present (shown with same shading); engine
              estimates fill the gaps.
            </p>
          )}
        </Section>
      )}

      {/* 3. Money in vs money out */}
      {cashData.length > 0 && (
        <Section title="Money in vs money out">
          <div className="card p-4">
            <CashFlowChart data={cashData} />
          </div>
          {cashCopyLine() && (
            <p className="mt-2 text-xs text-muted">{cashCopyLine()}</p>
          )}
        </Section>
      )}

      {/* 4. Holdings */}
      {o.holdings.length > 0 && (
        <Section
          title="Holdings"
          aside={
            o.dataHealth.marketAsOf
              ? `Marked to closes as of ${fmtDate(o.dataHealth.marketAsOf)}`
              : "Prices from bundled closes"
          }
        >
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 text-left">Symbol</th>
                  <th className="px-4 py-3 text-right num">Qty</th>
                  <th className="px-4 py-3 text-right num">Cost</th>
                  <th className="px-4 py-3 text-right num">Last close</th>
                  <th className="px-4 py-3 text-right num">Mkt value</th>
                  <th className="px-4 py-3 text-right num">Unrealized</th>
                </tr>
              </thead>
              <tbody>
                {regularHoldings.map((h, i) => {
                  const unrealColor =
                    h.unrealizedCents == null
                      ? "text-muted"
                      : h.unrealizedCents > 0
                        ? "text-gain"
                        : h.unrealizedCents < 0
                          ? "text-loss"
                          : "text-muted";
                  return (
                    <tr
                      key={`${h.accountId}-${h.symbol}`}
                      className={`border-b border-line last:border-0 ${i % 2 === 0 ? "" : "bg-surface2/40"}`}
                    >
                      <td className="px-4 py-3 font-medium text-brass-bright">{h.symbol}</td>
                      <td className="px-4 py-3 text-right num text-muted">
                        {formatQty(h.qtyMicro)}
                      </td>
                      <td className="px-4 py-3 text-right num">
                        {h.costCents != null ? formatCents(h.costCents) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right num text-muted">
                        {h.lastCloseMicro != null
                          ? `$${(h.lastCloseMicro / PRICE_SCALE).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                        {h.lastCloseDate && (
                          <span className="ml-1 text-[10px] text-faint">
                            {h.lastCloseDate}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right num">
                        {h.marketValueCents != null ? formatCents(h.marketValueCents) : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right num ${unrealColor}`}>
                        {h.unrealizedCents != null
                          ? formatCents(h.unrealizedCents, { sign: true })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
                {mmHoldings.map((h) => (
                  <tr
                    key={`${h.accountId}-${h.symbol}`}
                    className="border-b border-line last:border-0 opacity-40"
                  >
                    <td className="px-4 py-3 text-muted italic">{h.symbol}</td>
                    <td className="px-4 py-3 text-right num text-muted">
                      {formatQty(h.qtyMicro)}
                    </td>
                    <td className="px-4 py-3 text-right num text-muted">—</td>
                    <td className="px-4 py-3 text-right num text-muted">$1.00</td>
                    <td className="px-4 py-3 text-right num text-muted">
                      {h.marketValueCents != null ? formatCents(h.marketValueCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right num text-muted">$0.00</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-faint">
            Holdings reconstructed from imported lot history, marked to bundled closes. Money-market
            rows muted — they hold value, not conviction.
          </p>
        </Section>
      )}

      {/* 5. Dividend income strip */}
      {dividendYears.length > 0 && (
        <Section title="Dividend income by year">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {dividendYears.map((y) => (
              <Stat
                key={y.year}
                label={String(y.year)}
                value={formatCents(y.dividendsCents)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            Total: {formatCents(totalDividends)} received across {dividendYears.length} year
            {dividendYears.length !== 1 ? "s" : ""}.
          </p>
        </Section>
      )}

      {/* 6. Options book vital signs */}
      {o.optionsVitals && (
        <Section title="Options book vital signs">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Win rate"
              value={
                o.optionsVitals.winRatePct != null
                  ? `${o.optionsVitals.winRatePct}%`
                  : "—"
              }
              hint={`${o.optionsVitals.closed} closed positions`}
              accent={
                o.optionsVitals.winRatePct != null && o.optionsVitals.winRatePct >= 60
              }
            />
            <Stat
              label="Realized"
              value={<Money cents={o.optionsVitals.realizedCents} colored sign />}
              hint="closed positions only"
            />
            <Stat
              label="Median DTE"
              value={
                o.optionsVitals.medianDteAtOpen != null
                  ? `${o.optionsVitals.medianDteAtOpen}d`
                  : "—"
              }
              hint="at open"
            />
            <Stat
              label="Open"
              value={o.optionsVitals.open}
              hint={`of ${o.optionsVitals.totalPositions} total`}
            />
          </div>
        </Section>
      )}

      {/* 7. Belief Bucket */}
      {o.beliefBucket.length > 0 && (
        <Section title="Belief Bucket">
          <div className="card border border-brass/20 bg-surface2/60 p-1">
            <div className="mb-3 px-4 pt-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-brass">
                Membership, not performance
              </span>
              <p className="mt-1 text-xs text-muted">
                These positions are held on conviction, not near-term thesis. Lifetime P&L
                shown without judgment.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 text-left">Symbol</th>
                  <th className="px-4 py-3 text-left text-muted">Note</th>
                  <th className="px-4 py-3 text-right num">Allocation</th>
                  <th className="px-4 py-3 text-right num">Mkt value</th>
                  <th className="px-4 py-3 text-right num">Lifetime P&L</th>
                </tr>
              </thead>
              <tbody>
                {o.beliefBucket.map((b) => {
                  const pnlColor =
                    b.lifetimePnlCents == null
                      ? "text-muted"
                      : b.lifetimePnlCents > 0
                        ? "text-gain"
                        : b.lifetimePnlCents < 0
                          ? "text-loss"
                          : "text-muted";
                  return (
                    <tr
                      key={b.symbol}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-brass-bright">{b.symbol}</td>
                      <td className="px-4 py-3 text-xs text-muted">{b.note ?? "—"}</td>
                      <td className="px-4 py-3 text-right num text-muted">
                        {b.portfolioSharePct != null
                          ? `${b.portfolioSharePct.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right num">
                        {b.marketValueCents != null ? formatCents(b.marketValueCents) : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right num ${pnlColor}`}>
                        {b.lifetimePnlCents != null
                          ? formatCents(b.lifetimePnlCents, { sign: true })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* 8. Insight of the day */}
      {insight && (
        <Section title="Insight of the day">
          <PullQuote source={insight.footnote}>{insight.quote}</PullQuote>
        </Section>
      )}

      {/* Footer health line */}
      <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-6 text-xs text-faint">
        <span>{o.dataHealth.importFiles} import file{o.dataHealth.importFiles !== 1 ? "s" : ""}</span>
        {o.dataHealth.skippedRows > 0 && (
          <span className="text-loss">{o.dataHealth.skippedRows} skipped rows</span>
        )}
        {o.dataHealth.marketAsOf && <span>Market data through {fmtDate(o.dataHealth.marketAsOf)}</span>}
        {o.orphanProceedsCents > 0 && (
          <span className="text-loss">
            {formatCents(o.orphanProceedsCents)} orphan proceeds (cost basis missing)
          </span>
        )}
        {o.accounts.map((a) => (
          <Badge key={a.id} tone="neutral">
            {a.label} · {a.txCount.toLocaleString()} tx
          </Badge>
        ))}
      </div>
    </div>
  );
}
