/**
 * SWOT of Me — pure generator.
 * Derives every claim from real data with evidence receipts.
 * Belief-bucket tickers are excluded by design (caller passes patterns
 * already filtered by beliefSymbols).
 */

import { formatCents } from "@/lib/model/money";
import type { PatternsReport, Overview, YearRow } from "@/lib/queries";

export interface SwotItem {
  claim: string;
  evidence: string[];
}

export interface Swot {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
}

/* ------------------------------------------------------------------ helpers */

function fmtPct(n: number, decimals = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

function fmtDate(d: string): string {
  return d; // already ISO YYYY-MM-DD
}

/* ------------------------------------------------------------------ main */

export function generateSwot(
  patterns: PatternsReport,
  overview: Overview,
): Swot {
  const strengths: SwotItem[] = [];
  const weaknesses: SwotItem[] = [];
  const opportunities: SwotItem[] = [];
  const threats: SwotItem[] = [];

  const { crashBuyer, clusters, premature, roundTrips, holding } = patterns;
  const years = overview.years;

  /* ========================= STRENGTHS ========================= */

  // 1. Crash-buyer score ≥ 50
  if (crashBuyer.score >= 50) {
    const evidence: string[] = [
      `Crash-buyer score ${crashBuyer.score}/100 — top decile for deploying capital into drawdowns.`,
      `Deployed ${formatCents(crashBuyer.deployedInDrawdownCents)} across ${crashBuyer.drawdownBuyDays} day(s) when SPY was ≥10% off highs (${formatCents(crashBuyer.deployedTotalCents)} total).`,
    ];
    if (crashBuyer.bestDay) {
      const bd = crashBuyer.bestDay;
      evidence.push(
        `Best day: ${fmtDate(bd.date)} — SPY ${fmtPct(bd.drawdownPct)} drawdown, ${formatCents(bd.totalCents)} deployed into [${bd.symbols.join(", ")}].`,
      );
    }
    strengths.push({
      claim: "You buy when others are selling — a genuine behavioral edge.",
      evidence,
    });
  }

  // 2. Cluster sell days with A or B timing grade
  const abClusters = clusters.filter(
    (c) => c.timingGrade === "A" || c.timingGrade === "B",
  );
  if (abClusters.length > 0) {
    const evidence: string[] = [
      `${abClusters.length} of ${clusters.length} cluster sell day(s) graded A or B — sold in the upper half of the 52-week range.`,
    ];
    for (const c of abClusters.slice(0, 3)) {
      evidence.push(
        `${fmtDate(c.date)}: grade ${c.timingGrade}, ${c.sells} sells (${c.symbols.slice(0, 4).join(", ")}), proceeds ${formatCents(c.proceedsCents)}.`,
      );
    }
    strengths.push({
      claim: "When you do trim en masse, your timing has been above-average.",
      evidence,
    });
  }

  // 3. Options win rate if realized is positive
  if (
    overview.optionsVitals != null &&
    overview.optionsVitals.winRatePct != null &&
    overview.optionsVitals.winRatePct >= 55 &&
    overview.optionsVitals.realizedCents > 0
  ) {
    const ov = overview.optionsVitals;
    strengths.push({
      claim: `Options book is net profitable with a ${ov.winRatePct}% win rate on ${ov.closed} closed position(s).`,
      evidence: [
        `Realized P&L: ${formatCents(ov.realizedCents)} across ${ov.closed} closed / ${ov.totalPositions} total positions.`,
        `Premium collected: ${formatCents(ov.premiumSoldCents)}; premium paid: ${formatCents(ov.premiumBoughtCents)}.`,
        ov.medianDteAtOpen != null
          ? `Median DTE at open: ${ov.medianDteAtOpen} days.`
          : "DTE at open not yet tracked.",
      ],
    });
  }

  /* ========================= WEAKNESSES ========================= */

  // 1. Premature exits
  if (premature.totalLeftOnTableCents > 0 && premature.exits.length > 0) {
    const top2 = premature.exits.slice(0, 2);
    const evidence: string[] = [
      `${formatCents(premature.totalLeftOnTableCents)} left on the table across ${premature.exits.length} exit(s) that ran ≥50% within 12 months of your sale.`,
    ];
    for (const e of top2) {
      evidence.push(
        `${e.symbol}: exited ${fmtDate(e.exitDate)}, stock ran ${fmtPct(e.runUpPct)} to peak ${fmtDate(e.peakDate)} — ${formatCents(e.leftOnTableCents)} uncaptured.`,
      );
    }
    weaknesses.push({
      claim:
        "You exit too early — forfeiting significant unrealized gains in your strongest ideas.",
      evidence,
    });
  }

  // 2. Round trips
  if (roundTrips.length > 0) {
    const evidence: string[] = [
      `${roundTrips.length} symbol(s) with the round-trip pattern: took early profits, then re-entered and realized losses on the same name.`,
    ];
    for (const rt of roundTrips.slice(0, 3)) {
      const net = rt.earlyGainCents + rt.lateLossCents;
      evidence.push(
        `${rt.symbol}: early gain ${formatCents(rt.earlyGainCents)} (first win ${fmtDate(rt.firstWinDate)}), late loss ${formatCents(rt.lateLossCents)} (last loss ${fmtDate(rt.lastLossDate)}), net ${formatCents(net)}.`,
      );
    }
    weaknesses.push({
      claim:
        "You re-enter winning names too late — giving back profits you already captured.",
      evidence,
    });
  }

  // 3. Short conviction half-life (median hold < 180 days)
  if (
    holding.medianHoldingDays != null &&
    holding.medianHoldingDays < 180
  ) {
    const evidence: string[] = [
      `Median holding period: ${holding.medianHoldingDays} days — well under six months.`,
    ];
    for (const b of holding.byBucket.slice(0, 3)) {
      if (b.medianDays != null) {
        evidence.push(
          `Bucket "${b.bucket}": median ${b.medianDays}d across ${b.count} closed position(s).`,
        );
      }
    }
    weaknesses.push({
      claim:
        "Short conviction half-life — you don't hold ideas long enough to let the thesis mature.",
      evidence,
    });
  }

  // 4. Options win rate if realized is negative or win rate < 50%
  if (
    overview.optionsVitals != null &&
    overview.optionsVitals.closed > 0 &&
    (overview.optionsVitals.realizedCents < 0 ||
      (overview.optionsVitals.winRatePct != null &&
        overview.optionsVitals.winRatePct < 50))
  ) {
    const ov = overview.optionsVitals;
    weaknesses.push({
      claim: `Options book is underwater — ${ov.winRatePct ?? "?"}% win rate on ${ov.closed} closed position(s) is not covering premium costs.`,
      evidence: [
        `Realized P&L: ${formatCents(ov.realizedCents)} across ${ov.closed} closed positions.`,
        `Premium collected: ${formatCents(ov.premiumSoldCents)}; premium paid: ${formatCents(ov.premiumBoughtCents)}.`,
      ],
    });
  }

  /* ========================= OPPORTUNITIES ========================= */

  // 1. Years where withdrawals > deposits (portfolio doubling as emergency fund)
  //    — the gap narrowing is also an opportunity
  const stressYears = years.filter(
    (y) => y.withdrawalsCents > y.depositsCents,
  );
  if (stressYears.length > 0) {
    // Is the gap narrowing over time?
    const sortedStress = [...stressYears].sort((a, b) => a.year - b.year);
    const first = sortedStress[0];
    const last = sortedStress[sortedStress.length - 1];
    const firstRatio = first.depositsCents > 0
      ? first.withdrawalsCents / first.depositsCents
      : null;
    const lastRatio = last.depositsCents > 0
      ? last.withdrawalsCents / last.depositsCents
      : null;
    const gapNarrowing =
      sortedStress.length >= 2 &&
      firstRatio != null &&
      lastRatio != null &&
      lastRatio < firstRatio;

    if (gapNarrowing) {
      const evidence: string[] = [
        `Withdrawals exceeded deposits in ${stressYears.length} year(s), but the withdrawal/deposit ratio is shrinking.`,
      ];
      for (const y of sortedStress) {
        const ratio =
          y.depositsCents > 0
            ? (y.withdrawalsCents / y.depositsCents).toFixed(2)
            : "∞";
        evidence.push(
          `${y.year}: withdrawals ${formatCents(y.withdrawalsCents)}, deposits ${formatCents(y.depositsCents)} (ratio ${ratio}×).`,
        );
      }
      evidence.push(
        "Ratio narrowing over time suggests the portfolio dependency is easing — a structural improvement.",
      );
      opportunities.push({
        claim:
          "The portfolio's role as an emergency fund is shrinking — freeing capital to compound rather than bridge income gaps.",
        evidence,
      });
    }
  }

  // 2. Dividend growth year-over-year
  const yearsWithDivs = years.filter((y) => y.dividendsCents > 0);
  if (yearsWithDivs.length >= 2) {
    const sorted = [...yearsWithDivs].sort((a, b) => a.year - b.year);
    let growthCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].dividendsCents > sorted[i - 1].dividendsCents) {
        growthCount++;
      }
    }
    if (growthCount > 0) {
      const latest = sorted[sorted.length - 1];
      const prior = sorted[sorted.length - 2];
      const yoyPct =
        prior.dividendsCents > 0
          ? ((latest.dividendsCents - prior.dividendsCents) /
              prior.dividendsCents) *
            100
          : null;
      const evidence: string[] = [
        `Dividends grew in ${growthCount} of ${sorted.length - 1} year-over-year period(s).`,
        `Latest: ${formatCents(latest.dividendsCents)} in ${latest.year}${yoyPct != null ? ` (${fmtPct(yoyPct)} vs ${prior.year})` : ""}.`,
      ];
      for (const y of sorted.slice(-4)) {
        evidence.push(`${y.year}: ${formatCents(y.dividendsCents)}`);
      }
      opportunities.push({
        claim:
          "Growing dividend income stream — a compounding floor that doesn't require selling.",
        evidence,
      });
    }
  }

  // 3. If crash-buyer score < 50 but there's some drawdown activity, there's room to improve
  if (
    crashBuyer.score > 0 &&
    crashBuyer.score < 50 &&
    crashBuyer.drawdownBuyDays > 0
  ) {
    opportunities.push({
      claim:
        "Crash-buying behavior exists but is inconsistent — systematizing it could convert a sporadic reaction into a repeatable edge.",
      evidence: [
        `Crash-buyer score: ${crashBuyer.score}/100 — bought on ${crashBuyer.drawdownBuyDays} drawdown day(s) but with ${formatCents(crashBuyer.deployedInDrawdownCents)} vs ${formatCents(crashBuyer.deployedTotalCents)} total deployed.`,
        "A pre-set buy ladder keyed to SPY drawdown tiers would capture this systematically.",
      ],
    });
  }

  /* ========================= THREATS ========================= */

  // 1. Years where withdrawals > deposits — the portfolio as the emergency fund
  if (stressYears.length > 0) {
    const sortedStress = [...stressYears].sort((a, b) => a.year - b.year);
    const evidence: string[] = [
      `In ${stressYears.length} year(s), withdrawals exceeded deposits — the portfolio absorbed living expenses.`,
    ];
    for (const y of sortedStress) {
      const ratio =
        y.depositsCents > 0
          ? (y.withdrawalsCents / y.depositsCents).toFixed(2)
          : "∞";
      evidence.push(
        `${y.year}: withdrawals ${formatCents(y.withdrawalsCents)}, deposits ${formatCents(y.depositsCents)} (ratio ${ratio}×).`,
      );
    }
    threats.push({
      claim:
        "The portfolio has doubled as the emergency fund — forced selling during drawdowns destroys compounding.",
      evidence,
    });
  }

  // 2. Cluster sell days graded D (forced near lows)
  const dClusters = clusters.filter((c) => c.timingGrade === "D");
  if (dClusters.length > 0) {
    const evidence: string[] = [
      `${dClusters.length} cluster sell day(s) graded D — sold near 52-week lows, suggesting external pressure or panic.`,
    ];
    for (const c of dClusters.slice(0, 3)) {
      evidence.push(
        `${fmtDate(c.date)}: ${c.sells} sells (${c.symbols.slice(0, 4).join(", ")}), proceeds ${formatCents(c.proceedsCents)}, regime: ${c.context.regime}.`,
      );
    }
    threats.push({
      claim:
        "Selling near lows under apparent duress — the portfolio may be financing life rather than compounding.",
      evidence,
    });
  }

  // 3. Options win rate weakness already covered in weaknesses; if net loss is large, add as threat too
  if (
    overview.optionsVitals != null &&
    overview.optionsVitals.realizedCents < -500_00 // > $500 net loss
  ) {
    const ov = overview.optionsVitals;
    threats.push({
      claim: `Options losses exceed ${formatCents(Math.abs(ov.realizedCents))} — a structural drag if the strategy doesn't evolve.`,
      evidence: [
        `Net realized from ${ov.closed} closed position(s): ${formatCents(ov.realizedCents)}.`,
        `Win rate: ${ov.winRatePct ?? "?"}% on ${ov.closed} closed trades.`,
      ],
    });
  }

  // 4. Round trips as a systemic threat (re-buying losers)
  if (roundTrips.length >= 3) {
    const totalLoss = roundTrips.reduce((a, rt) => a + rt.lateLossCents, 0);
    threats.push({
      claim:
        "Systematic round-trip pattern — you consistently re-enter names where you've already taken profits and lose on the re-entry.",
      evidence: [
        `${roundTrips.length} symbols show this pattern; aggregate late losses: ${formatCents(totalLoss)}.`,
        "This is a behavioral loop, not bad luck.",
      ],
    });
  }

  /* ── ensure at least one item in each quadrant so the grid renders ── */
  if (strengths.length === 0) {
    strengths.push({
      claim: "Insufficient data to identify confirmed strengths yet.",
      evidence: [
        "Add more trade history or let the patterns engine run against a fuller dataset.",
      ],
    });
  }
  if (weaknesses.length === 0) {
    weaknesses.push({
      claim: "No statistically significant weaknesses detected.",
      evidence: ["Continue importing data to build a more complete picture."],
    });
  }
  if (opportunities.length === 0) {
    opportunities.push({
      claim: "No clear opportunities identified from current data.",
      evidence: ["More history will surface dividend trends and cash-flow patterns."],
    });
  }
  if (threats.length === 0) {
    threats.push({
      claim: "No active threats identified from current data.",
      evidence: ["No years with withdrawals > deposits and no D-grade forced selling."],
    });
  }

  return { strengths, weaknesses, opportunities, threats };
}
