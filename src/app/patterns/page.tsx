import { getPatterns } from "@/lib/queries";
import { formatCents } from "@/lib/model/money";
import { PRICE_SCALE, QTY_SCALE } from "@/lib/model/money";
import {
  Badge,
  Empty,
  Money,
  PageHeader,
  RegimeBadge,
  Section,
  Stat,
} from "@/components/ui";
import { ClusterTagForm } from "@/components/patterns/ClusterTagForm";

export const dynamic = "force-dynamic";

function fmtPriceMicro(micro: number): string {
  return `$${(micro / PRICE_SCALE).toFixed(2)}`;
}

function fmtPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-gain",
  B: "text-brass-bright",
  C: "text-muted",
  D: "text-loss",
};

export default function PatternsPage() {
  const patterns = getPatterns();
  const { crashBuyer, clusters, premature, roundTrips, holding } = patterns;

  return (
    <div>
      <PageHeader
        kicker="patterns"
        title="Who you are as a trader"
        subtitle="Detectors running over your real history. No fiction — just the signal."
      />

      {/* ── 1. Crash Buyer Score ─────────────────────────────────────────── */}
      <Section title="Crash Buyer Score">
        <div className="mb-6 flex flex-wrap gap-4">
          {/* Hero score */}
          <div className="card flex flex-col items-center justify-center px-8 py-6 min-w-[10rem]">
            <div className="text-[11px] uppercase tracking-widest text-faint mb-1">Score</div>
            <div className="font-serif text-7xl text-brass-bright rise">{crashBuyer.score}</div>
            <div className="text-xs text-muted mt-1">out of 100</div>
          </div>

          {/* Supporting stats */}
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 min-w-[16rem]">
            <Stat
              label="Deployed in ≥10% drawdowns"
              value={<Money cents={crashBuyer.deployedInDrawdownCents} />}
            />
            <Stat
              label="Total deployed"
              value={<Money cents={crashBuyer.deployedTotalCents} />}
            />
            <Stat
              label="Drawdown buy days"
              value={`${crashBuyer.drawdownBuyDays} / ${crashBuyer.totalBuyDays}`}
              hint="days with a buy during ≥10% SPY drawdown"
            />
          </div>
        </div>

        {/* Best day callout */}
        {crashBuyer.bestDay ? (
          <div className="card border-l-2 border-l-brass px-5 py-4 mb-6">
            <div className="text-[11px] uppercase tracking-widest text-faint mb-1">Best day</div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-serif text-2xl text-brass-bright">{crashBuyer.bestDay.date}</span>
              <span className="text-loss num">SPY {fmtPct(crashBuyer.bestDay.drawdownPct)} drawdown</span>
              <span className="text-muted">·</span>
              <Money cents={crashBuyer.bestDay.totalCents} className="text-foreground" />
              <span className="text-muted">deployed</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {crashBuyer.bestDay.symbols.map((s) => (
                <Badge key={s} tone="brass">{s}</Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted italic">
              You showed up when there was blood in the streets. That's the edge.
            </p>
          </div>
        ) : null}

        {/* Crash buys table */}
        {crashBuyer.crashBuys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal">Date</th>
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal">Symbol</th>
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Deployed</th>
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Drawdown</th>
                  <th className="pb-2 text-[11px] uppercase tracking-widest text-faint font-normal">Regime</th>
                </tr>
              </thead>
              <tbody>
                {crashBuyer.crashBuys.map((cb, i) => (
                  <tr key={i} className="border-b border-line/50 hover:bg-surface2">
                    <td className="py-2 pr-4 text-muted">{cb.date}</td>
                    <td className="py-2 pr-4 font-medium text-foreground">{cb.symbol}</td>
                    <td className="py-2 pr-4 num">
                      <Money cents={cb.amountCents} />
                    </td>
                    <td className="py-2 pr-4 num text-loss">
                      {cb.context.drawdownPct != null ? fmtPct(cb.context.drawdownPct) : "—"}
                    </td>
                    <td className="py-2">
                      <RegimeBadge regime={cb.context.regime} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No crash buys detected yet — the engine needs buy transactions during ≥10% SPY drawdowns.</Empty>
        )}
      </Section>

      {/* ── 2. Cluster Sell Days ─────────────────────────────────────────── */}
      <Section title="Cluster Sell Days">
        <p className="mb-4 text-sm text-muted">
          Days where you sold 3+ positions. The reason is yours to explain; the timing is graded by the engine independently.
        </p>
        {clusters.length > 0 ? (
          <div className="flex flex-col gap-4">
            {clusters.map((cluster, i) => (
              <div key={i} className="card px-5 py-4">
                <div className="flex flex-wrap items-start gap-4">
                  {/* Timing grade — big serif letter */}
                  <div className="flex flex-col items-center justify-start min-w-[3rem]">
                    <div
                      className={`font-serif text-5xl leading-none ${GRADE_COLORS[cluster.timingGrade] ?? "text-muted"}`}
                    >
                      {cluster.timingGrade}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-faint">timing</div>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-3 mb-1">
                      <span className="font-serif text-xl text-foreground">{cluster.date}</span>
                      <span className="text-muted text-sm">{cluster.sells} sells</span>
                      <Money cents={cluster.proceedsCents} className="text-foreground" />
                      <RegimeBadge regime={cluster.context.regime} />
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {cluster.symbols.map((s) => (
                        <Badge key={s} tone="neutral">{s}</Badge>
                      ))}
                    </div>

                    <p className="text-xs text-muted italic">{cluster.timingNote}</p>

                    {/* Tagged reason display */}
                    {cluster.taggedReason ? (
                      <div className="mt-2 text-xs text-faint">
                        Your reason:{" "}
                        <span className="text-brass-bright">{cluster.taggedReason}</span>
                        {cluster.taggedNote ? ` — ${cluster.taggedNote}` : ""}
                      </div>
                    ) : null}

                    {/* Tagging form */}
                    <ClusterTagForm
                      accountId={cluster.accountId}
                      date={cluster.date}
                      currentReason={cluster.taggedReason}
                      currentNote={cluster.taggedNote}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No cluster sell days detected yet — the engine looks for days with 3+ sells.</Empty>
        )}
      </Section>

      {/* ── 3. Premature Exits ───────────────────────────────────────────── */}
      <Section title="Premature Exits">
        {premature.exits.length > 0 || premature.noDataSymbols.length > 0 ? (
          <>
            {/* Headline */}
            <div className="card px-5 py-4 mb-4 inline-flex flex-col">
              <div className="text-[11px] uppercase tracking-widest text-faint mb-1">
                Left on the table
              </div>
              <div className="font-serif text-4xl text-loss rise">
                <Money cents={premature.totalLeftOnTableCents} />
              </div>
              <div className="text-xs text-muted mt-1">
                across exits that ran ≥50% after you sold
              </div>
            </div>

            {premature.exits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal">Symbol</th>
                      <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal">Exit date</th>
                      <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Exit price</th>
                      <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Peak within 12mo</th>
                      <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal">Peak date</th>
                      <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Run-up</th>
                      <th className="pb-2 text-[11px] uppercase tracking-widest text-faint font-normal num">$ left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {premature.exits.map((e, i) => (
                      <tr key={i} className="border-b border-line/50 hover:bg-surface2">
                        <td className="py-2 pr-4 font-medium text-foreground">{e.symbol}</td>
                        <td className="py-2 pr-4 text-muted">{e.exitDate}</td>
                        <td className="py-2 pr-4 num text-foreground">{fmtPriceMicro(e.exitPriceMicro)}</td>
                        <td className="py-2 pr-4 num text-foreground">{fmtPriceMicro(e.peakPriceMicro)}</td>
                        <td className="py-2 pr-4 text-muted">{e.peakDate}</td>
                        <td className="py-2 pr-4 num text-gain">{fmtPct(e.runUpPct)}</td>
                        <td className="py-2 num">
                          <Money cents={e.leftOnTableCents} colored className="text-loss" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {premature.noDataSymbols.length > 0 ? (
              <p className="mt-3 text-xs text-faint">
                No price data bundled for:{" "}
                {premature.noDataSymbols.join(", ")} — skipped from analysis.
              </p>
            ) : null}
          </>
        ) : (
          <Empty>No premature exits detected — either the thesis played out or there's no price data to compare against.</Empty>
        )}
      </Section>

      {/* ── 4. Round-Trip Winners ────────────────────────────────────────── */}
      <Section title="Round-Trip Winners">
        <p className="mb-4 text-sm text-muted">
          The Enphase pattern: you took gains early, then watched the same ticker erode them on re-entries.
        </p>
        {roundTrips.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal">Symbol</th>
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Early gains</th>
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Late losses</th>
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Net</th>
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal">First win</th>
                  <th className="pb-2 text-[11px] uppercase tracking-widest text-faint font-normal">Last loss</th>
                </tr>
              </thead>
              <tbody>
                {roundTrips.map((rt, i) => {
                  const net = rt.earlyGainCents + rt.lateLossCents;
                  return (
                    <tr key={i} className="border-b border-line/50 hover:bg-surface2">
                      <td className="py-2 pr-4 font-medium text-foreground">{rt.symbol}</td>
                      <td className="py-2 pr-4 num text-gain">
                        <Money cents={rt.earlyGainCents} sign />
                      </td>
                      <td className="py-2 pr-4 num text-loss">
                        <Money cents={rt.lateLossCents} sign />
                      </td>
                      <td className="py-2 pr-4 num">
                        <Money cents={net} colored sign />
                      </td>
                      <td className="py-2 pr-4 text-muted">{rt.firstWinDate}</td>
                      <td className="py-2 text-muted">{rt.lastLossDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No round-trip winners detected — you didn't hand back gains on the same ticker. Clean sheet.</Empty>
        )}
      </Section>

      {/* ── 5. Conviction Half-Life ──────────────────────────────────────── */}
      <Section title="Conviction Half-Life">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <Stat
            label="Median hold"
            value={
              holding.medianHoldingDays != null
                ? `${holding.medianHoldingDays}d`
                : "—"
            }
            hint="across all closed positions"
            accent
          />
        </div>

        {holding.byBucket.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal">Bucket</th>
                  <th className="pb-2 pr-4 text-[11px] uppercase tracking-widest text-faint font-normal num">Median days</th>
                  <th className="pb-2 text-[11px] uppercase tracking-widest text-faint font-normal num">Positions</th>
                </tr>
              </thead>
              <tbody>
                {holding.byBucket
                  .sort((a, b) => (b.medianDays ?? 0) - (a.medianDays ?? 0))
                  .map((row, i) => (
                    <tr key={i} className="border-b border-line/50 hover:bg-surface2">
                      <td className="py-2 pr-4 capitalize text-foreground">{row.bucket}</td>
                      <td className="py-2 pr-4 num text-foreground">
                        {row.medianDays != null ? `${row.medianDays}d` : "—"}
                      </td>
                      <td className="py-2 num text-muted">{row.count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No closed positions yet to measure conviction duration.</Empty>
        )}
      </Section>
    </div>
  );
}
