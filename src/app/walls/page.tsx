import { getOverview, getPatterns, getTaxData } from "@/lib/queries";
import { PageHeader, Section, Money, Qty, Empty, Badge, PullQuote } from "@/components/ui";
import { formatCents } from "@/lib/model/money";
import { AddBeliefForm, RemoveBeliefButton } from "@/components/walls/BeliefBucketForm";

export const dynamic = "force-dynamic";

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function DrawdownBadge({ pct }: { pct: number }) {
  const abs = Math.abs(pct);
  const tone = abs >= 20 ? "panic" : abs >= 15 ? "loss" : "neutral";
  return <Badge tone={tone}>{pct.toFixed(1)}% SPY drawdown</Badge>;
}

export default async function WallsPage() {
  const overview = getOverview();
  const patterns = getPatterns();
  const taxData = getTaxData();

  /* ---- Wins Wall data ---- */
  const { crashBuyer, clusters, premature, roundTrips } = patterns;

  // Crash buy days grouped by date
  const crashByDay = new Map<string, { date: string; symbols: string[]; totalCents: number; drawdownPct: number }>();
  for (const cb of crashBuyer.crashBuys) {
    const existing = crashByDay.get(cb.date);
    if (existing) {
      if (!existing.symbols.includes(cb.symbol)) existing.symbols.push(cb.symbol);
      existing.totalCents += cb.amountCents;
    } else {
      crashByDay.set(cb.date, {
        date: cb.date,
        symbols: [cb.symbol],
        totalCents: cb.amountCents,
        drawdownPct: cb.context.drawdownPct ?? 0,
      });
    }
  }
  const crashDays = [...crashByDay.values()].sort((a, b) => a.drawdownPct - b.drawdownPct);

  // Cluster days with A or B grade
  const winClusters = clusters.filter((c) => c.timingGrade === "A" || c.timingGrade === "B");

  // Positive realized years
  const positiveYears = overview.years.filter(
    (y) => (y.taxGainCents ?? y.engineGainCents ?? 0) > 0,
  );

  /* ---- Tuition Ledger data ---- */
  const topPremature = premature.exits.slice(0, 8);
  const topRoundTrips = roundTrips.slice(0, 6);

  // 1099-R early distributions (distribution code "1" = early)
  const earlyDist1099R = taxData.forms
    .filter((f) => f.form === "1099-R")
    .flatMap((f) => {
      try {
        const p = JSON.parse(f.payload) as Record<string, unknown>;
        const code = String(p.distributionCode ?? p.distribution_code ?? "");
        if (!code.includes("1")) return [];
        // the 1099-R importer stores the amount as grossCents
        const gross =
          typeof p.grossCents === "number"
            ? p.grossCents
            : typeof p.grossDistributionCents === "number"
              ? p.grossDistributionCents
              : null;
        return gross != null
          ? [{ year: f.year, accountNo: f.accountNo, grossCents: gross as number, payload: p }]
          : [];
      } catch {
        return [];
      }
    });

  // Wash sales
  const washLots = taxData.lots.filter(
    (l) => l.washDisallowedCents != null && (l.washDisallowedCents ?? 0) > 0,
  );
  const totalWashDisallowed = washLots.reduce(
    (a, l) => a + (l.washDisallowedCents ?? 0),
    0,
  );

  // Total tuition estimate
  const tuitionCents =
    premature.totalLeftOnTableCents +
    Math.abs(roundTrips.reduce((a, r) => a + r.lateLossCents, 0)) +
    earlyDist1099R.reduce((a, d) => a + Math.round(d.grossCents * 0.1), 0) +
    totalWashDisallowed;

  /* ---- Belief Bucket data ---- */
  const beliefBucket = overview.beliefBucket;

  return (
    <div>
      <PageHeader
        kicker="wins & tuition"
        title="The Two Walls"
        subtitle="One wall holds your trophies. The other holds what you paid for the lessons. Both are yours."
      />

      {/* =========================================================
          WALL 1 — WINS WALL
      ========================================================= */}
      <Section title="The Wins Wall">
        {crashDays.length === 0 && winClusters.length === 0 && positiveYears.length === 0 ? (
          <Empty>
            <span className="text-brass">No wins found yet.</span>
            <span>Import trading data to see your trophies.</span>
          </Empty>
        ) : (
          <div className="space-y-8">

            {/* Crash-bottom buys */}
            {crashDays.length > 0 && (
              <div>
                <div className="mb-3 text-xs uppercase tracking-widest text-brass">
                  Crash-Bottom Buys — You showed up when everyone else ran
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {crashDays.map((day) => (
                    <div
                      key={day.date}
                      className="relative rounded-xl border-2 border-brass/60 bg-surface p-5 shadow-[0_0_0_1px_rgba(201,164,92,0.12)] hover:border-brass transition-colors"
                    >
                      {/* Brass frame corners */}
                      <div className="absolute left-2.5 top-2.5 h-3 w-3 border-l-2 border-t-2 border-brass/40 rounded-tl" />
                      <div className="absolute right-2.5 top-2.5 h-3 w-3 border-r-2 border-t-2 border-brass/40 rounded-tr" />
                      <div className="absolute left-2.5 bottom-2.5 h-3 w-3 border-l-2 border-b-2 border-brass/40 rounded-bl" />
                      <div className="absolute right-2.5 bottom-2.5 h-3 w-3 border-r-2 border-b-2 border-brass/40 rounded-br" />

                      <div className="mb-1 text-[11px] uppercase tracking-widest text-brass">
                        Trophy
                      </div>
                      <div className="font-display text-2xl text-brass-bright">
                        {fmtDate(day.date)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {day.symbols.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-brass/10 px-2 py-0.5 text-xs text-brass-bright font-mono"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <DrawdownBadge pct={day.drawdownPct} />
                        <span className="num text-sm text-foreground">
                          {formatCents(day.totalCents)} deployed
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted">
                        While the market sold fear, you bought shares.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best crash day callout */}
            {crashBuyer.bestDay && (
              <PullQuote source="Crash Buyer Engine">
                Your boldest day: {fmtDate(crashBuyer.bestDay.date)} — SPY down{" "}
                {Math.abs(crashBuyer.bestDay.drawdownPct).toFixed(1)}% from peak, and you put{" "}
                {formatCents(crashBuyer.bestDay.totalCents)} to work in{" "}
                {crashBuyer.bestDay.symbols.join(", ")}.
              </PullQuote>
            )}

            {/* Cluster sell days with A/B timing */}
            {winClusters.length > 0 && (
              <div>
                <div className="mb-3 text-xs uppercase tracking-widest text-brass">
                  Well-Timed Exits — You picked the moment
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {winClusters.map((c) => (
                    <div
                      key={`${c.accountId}|${c.date}`}
                      className="relative rounded-xl border-2 border-brass/60 bg-surface p-5 hover:border-brass transition-colors"
                    >
                      <div className="absolute left-2.5 top-2.5 h-3 w-3 border-l-2 border-t-2 border-brass/40 rounded-tl" />
                      <div className="absolute right-2.5 top-2.5 h-3 w-3 border-r-2 border-t-2 border-brass/40 rounded-tr" />
                      <div className="absolute left-2.5 bottom-2.5 h-3 w-3 border-l-2 border-b-2 border-brass/40 rounded-bl" />
                      <div className="absolute right-2.5 bottom-2.5 h-3 w-3 border-r-2 border-b-2 border-brass/40 rounded-br" />

                      <div className="mb-1 flex items-center gap-2">
                        <div className="text-[11px] uppercase tracking-widest text-brass">
                          Grade
                        </div>
                        <span className="rounded bg-brass/20 px-2 py-0.5 text-xs font-mono font-semibold text-brass-bright">
                          {c.timingGrade}
                        </span>
                      </div>
                      <div className="font-display text-xl text-brass-bright">
                        {fmtDate(c.date)}
                      </div>
                      <div className="mt-1 text-xs text-muted">{c.timingNote}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.symbols.slice(0, 6).map((s) => (
                          <span
                            key={s}
                            className="rounded bg-surface2 px-1.5 py-0.5 text-[11px] font-mono text-muted"
                          >
                            {s}
                          </span>
                        ))}
                        {c.symbols.length > 6 && (
                          <span className="text-[11px] text-faint">
                            +{c.symbols.length - 6} more
                          </span>
                        )}
                      </div>
                      <div className="mt-2 num text-sm text-foreground">
                        {formatCents(c.proceedsCents)} collected
                      </div>
                      {c.taggedReason && (
                        <div className="mt-1 text-[11px] text-faint">
                          Reason logged: {c.taggedReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Positive realized years */}
            {positiveYears.length > 0 && (
              <div>
                <div className="mb-3 text-xs uppercase tracking-widest text-brass">
                  Profitable Years — You finished in the black
                </div>
                <div className="flex flex-wrap gap-4">
                  {positiveYears.map((y) => {
                    const gain = y.taxGainCents ?? y.engineGainCents ?? 0;
                    return (
                      <div
                        key={y.year}
                        className="relative rounded-xl border-2 border-brass/60 bg-surface px-8 py-6 text-center hover:border-brass transition-colors"
                      >
                        <div className="absolute left-2.5 top-2.5 h-3 w-3 border-l-2 border-t-2 border-brass/40 rounded-tl" />
                        <div className="absolute right-2.5 top-2.5 h-3 w-3 border-r-2 border-t-2 border-brass/40 rounded-tr" />
                        <div className="absolute left-2.5 bottom-2.5 h-3 w-3 border-l-2 border-b-2 border-brass/40 rounded-bl" />
                        <div className="absolute right-2.5 bottom-2.5 h-3 w-3 border-r-2 border-b-2 border-brass/40 rounded-br" />
                        <div className="font-display text-4xl text-brass-bright">{y.year}</div>
                        <div className="mt-1 num text-lg text-gain">+{formatCents(gain)}</div>
                        <div className="mt-0.5 text-xs text-muted">realized</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* =========================================================
          WALL 2 — TUITION LEDGER
      ========================================================= */}
      <Section
        title="The Tuition Ledger"
        aside={
          tuitionCents > 0 ? (
            <span className="text-xs text-muted">
              {formatCents(tuitionCents)} total — tuition, not shame
            </span>
          ) : undefined
        }
      >
        {tuitionCents === 0 &&
        topPremature.length === 0 &&
        topRoundTrips.length === 0 &&
        earlyDist1099R.length === 0 &&
        washLots.length === 0 ? (
          <Empty>
            <span>No tuition entries found. Either you nailed it — or there&apos;s no data yet.</span>
          </Empty>
        ) : (
          <div className="space-y-8">
            {/* Total tuition banner */}
            {tuitionCents > 0 && (
              <div className="rounded-xl border border-loss/30 bg-surface px-6 py-4 flex items-center gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-faint">
                    Total tuition paid
                  </div>
                  <div className="num text-2xl text-foreground">{formatCents(tuitionCents)}</div>
                </div>
                <div className="ml-auto text-sm text-muted italic">
                  Every dollar here bought you a lesson. That&apos;s the deal.
                </div>
              </div>
            )}

            {/* Premature exits */}
            {topPremature.length > 0 && (
              <div>
                <div className="mb-3 text-xs uppercase tracking-widest text-faint">
                  Premature Exits — Left on the table
                </div>
                <div className="flex flex-col gap-3">
                  {topPremature.map((e) => (
                    <div
                      key={`${e.symbol}|${e.exitDate}`}
                      className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-6"
                    >
                      <div className="sm:w-24 shrink-0">
                        <div className="font-mono text-sm text-foreground">{e.symbol}</div>
                        <div className="text-xs text-faint">{fmtDate(e.exitDate)}</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-muted">
                          Sold, then peaked{" "}
                          <span className="text-loss">{e.runUpPct.toFixed(0)}%</span> higher by{" "}
                          {fmtDate(e.peakDate)}
                        </div>
                        <div className="mt-0.5 text-xs text-faint italic">
                          Left on the table: <span className="text-loss num">{formatCents(e.leftOnTableCents)}</span> —
                          lesson: conviction outlived the exit
                        </div>
                      </div>
                    </div>
                  ))}
                  {premature.exits.length > topPremature.length && (
                    <div className="text-xs text-faint text-center">
                      +{premature.exits.length - topPremature.length} more exits not shown
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Round trips */}
            {topRoundTrips.length > 0 && (
              <div>
                <div className="mb-3 text-xs uppercase tracking-widest text-faint">
                  Round-Trip Patterns — Won early, lost late
                </div>
                <div className="flex flex-col gap-3">
                  {topRoundTrips.map((rt) => (
                    <div
                      key={rt.symbol}
                      className="rounded-xl border border-line bg-surface p-4"
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm text-foreground">{rt.symbol}</span>
                        <span className="text-xs text-muted">
                          {fmtDate(rt.firstWinDate)} → {fmtDate(rt.lastLossDate)}
                        </span>
                      </div>
                      <div className="text-sm text-muted">
                        <span className="text-gain num">+{formatCents(rt.earlyGainCents)}</span>
                        {" "}early wins, then{" "}
                        <span className="text-loss num">{formatCents(rt.lateLossCents)}</span>
                        {" "}late losses — went back for more and the thesis had already played out.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 1099-R early distributions */}
            {earlyDist1099R.length > 0 && (
              <div>
                <div className="mb-3 text-xs uppercase tracking-widest text-faint">
                  Early Retirement Distributions — The 10% tax
                </div>
                <div className="flex flex-col gap-3">
                  {earlyDist1099R.map((d, i) => {
                    const penalty = Math.round(d.grossCents * 0.1);
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-line bg-surface p-4"
                      >
                        <div className="flex items-center gap-3 mb-1">
                          {d.year && (
                            <span className="text-xs text-faint">Tax year {d.year}</span>
                          )}
                          {d.accountNo && (
                            <span className="font-mono text-[11px] text-faint">
                              acct …{d.accountNo.slice(-4)}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted">
                          Gross distribution:{" "}
                          <span className="num text-foreground">{formatCents(d.grossCents)}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          10% early-withdrawal penalty:{" "}
                          <span className="num text-loss">{formatCents(penalty)}</span> — factual math,
                          no judgment. The money served a purpose.
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Wash sales */}
            {washLots.length > 0 && (
              <div>
                <div className="mb-3 text-xs uppercase tracking-widest text-faint">
                  Wash Sales — Losses deferred by the IRS
                </div>
                <div className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-faint">
                        Disallowed loss
                      </div>
                      <div className="num text-foreground">{formatCents(totalWashDisallowed)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-faint">Lots</div>
                      <div className="num text-foreground">{washLots.length}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    Loss deferred, not lost. It rides with the new cost basis.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* =========================================================
          ZONE 3 — BELIEF BUCKET
      ========================================================= */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl text-foreground">Belief Bucket</h2>
          <div className="text-xs text-muted">kept out of the scorecard by design</div>
        </div>

        <div className="rounded-xl border-2 border-brass/30 bg-surface p-6 space-y-6">
          <p className="text-sm text-muted max-w-xl">
            The relationship stays a chosen one. These positions live outside the wins wall and the
            tuition ledger — their P&amp;L is a membership fee paid on purpose, not a score to
            optimize.
          </p>

          {beliefBucket.length === 0 ? (
            <Empty>
              <span className="text-brass">No belief-bucket designations yet.</span>
              <span className="text-muted">Add a ticker below to designate it as a chosen relationship.</span>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {beliefBucket.map((b) => (
                <div
                  key={b.symbol}
                  className="rounded-xl border border-brass/20 bg-surface2 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-xl text-brass-bright">{b.symbol}</div>
                      {b.portfolioSharePct != null && (
                        <div className="text-xs text-faint">
                          {b.portfolioSharePct.toFixed(1)}% of portfolio
                        </div>
                      )}
                    </div>
                    <RemoveBeliefButton symbol={b.symbol} />
                  </div>

                  {b.note && (
                    <p className="text-xs text-muted italic leading-relaxed border-l border-brass/30 pl-2">
                      {b.note}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-faint">Shares</div>
                      <div className="num text-foreground">
                        <Qty micro={b.qtyMicro} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-faint">Cost</div>
                      <div className="num text-foreground">
                        <Money cents={b.costCents} />
                      </div>
                    </div>
                    {b.marketValueCents != null && (
                      <div>
                        <div className="text-[11px] uppercase tracking-widest text-faint">
                          Market value
                        </div>
                        <div className="num text-foreground">
                          <Money cents={b.marketValueCents} />
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-faint">
                        Realized
                      </div>
                      <div className="num">
                        <Money cents={b.realizedCents} sign colored />
                      </div>
                    </div>
                    {b.lifetimePnlCents != null && (
                      <div className="col-span-2">
                        <div className="text-[11px] uppercase tracking-widest text-faint">
                          Lifetime P&amp;L
                        </div>
                        <div className="num text-sm">
                          <Money cents={b.lifetimePnlCents} sign colored />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/manage form */}
          <div className="border-t border-brass/20 pt-4">
            <div className="text-xs uppercase tracking-widest text-brass mb-2">
              Manage the bucket
            </div>
            <AddBeliefForm />
          </div>
        </div>
      </section>
    </div>
  );
}
