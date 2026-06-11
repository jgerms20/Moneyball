"use client";

import type { Overview } from "@/lib/queries";

interface TwoTradersProps {
  overview: Overview;
}

function fmtCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  if (abs >= 100_000) {
    const s = `$${(abs / 100_000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
    return negative ? `-${s}` : s;
  }
  const s = `$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return negative ? `-${s}` : s;
}

function ImportHint({ book }: { book: "equity" | "options" }) {
  return (
    <div className="space-y-3">
      <div className="h-8 w-24 rounded bg-surface-2 opacity-40" />
      <div className="h-4 w-36 rounded bg-surface-2 opacity-30" />
      <div className="h-4 w-28 rounded bg-surface-2 opacity-20" />
      {book === "equity" ? (
        <div className="mt-4 text-xs text-muted">
          <p className="font-medium text-faint mb-1">No equity history yet.</p>
          <p>Go to <span className="text-brass">Fidelity.com</span> → Accounts → History → Export to CSV,
            then drop the file on the <a href="/data" className="text-brass underline">/data</a> page.</p>
        </div>
      ) : (
        <div className="mt-4 text-xs text-muted">
          <p className="font-medium text-faint mb-1">No options history yet.</p>
          <p className="mb-1">Two ways to import:</p>
          <ul className="space-y-1 list-none">
            <li><span className="text-brass">Schwab.com</span> → Accounts → History → Export</li>
            <li><span className="text-brass">thinkorswim</span> → Monitor → Account Statement → export</li>
          </ul>
          <p className="mt-1">Drop either file on the <a href="/data" className="text-brass underline">/data</a> page.</p>
        </div>
      )}
    </div>
  );
}

export function TwoTraders({ overview }: TwoTradersProps) {
  const equityAccounts = overview.accounts.filter((a) => a.book === "equity");
  const optionsAccounts = overview.accounts.filter((a) => a.book === "options");

  const hasEquity = equityAccounts.some((a) => a.txCount > 0);
  const hasOptions = optionsAccounts.some((a) => a.txCount > 0);
  const vitals = overview.optionsVitals;

  // equity stats: sum deposits/withdrawals across years
  const totalDeposits = overview.years.reduce((a, y) => a + y.depositsCents, 0);
  const totalWithdrawals = overview.years.reduce((a, y) => a + y.withdrawalsCents, 0);
  const cumulativeRealized = overview.years.reduce(
    (a, y) => a + (y.taxGainCents ?? y.engineGainCents ?? 0),
    0,
  );

  // trades per month for options
  let tradesPerMonth: string = "—";
  if (vitals && vitals.totalPositions > 0 && optionsAccounts.length > 0) {
    const firstDate = optionsAccounts
      .map((a) => a.firstDate)
      .filter((d): d is string => d != null)
      .sort()[0];
    const lastDate = optionsAccounts
      .map((a) => a.lastDate)
      .filter((d): d is string => d != null)
      .sort()
      .at(-1);
    if (firstDate && lastDate) {
      const months =
        Math.max(
          1,
          Math.round(
            (Date.parse(lastDate) - Date.parse(firstDate)) / (30 * 86_400_000),
          ),
        );
      tradesPerMonth = (vitals.totalPositions / months).toFixed(1);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Fidelity / Equity card */}
      <div className={`card px-6 py-5 ${!hasEquity ? "opacity-60" : ""}`}>
        <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-brass">Fidelity You</div>
        <div className="mb-4 font-display text-lg text-foreground">
          The patient accumulator
        </div>
        {!hasEquity ? (
          <ImportHint book="equity" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Accounts</span>
              <span className="num text-sm text-foreground">{equityAccounts.length}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Holdings</span>
              <span className="num text-sm text-foreground">
                {overview.holdings.filter((h) =>
                  equityAccounts.some((a) => a.id === h.accountId)
                ).length}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Cumulative realized</span>
              <span className={`num text-sm ${cumulativeRealized >= 0 ? "text-gain" : "text-loss"}`}>
                {fmtCents(cumulativeRealized)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Total deposited</span>
              <span className="num text-sm text-foreground">{fmtCents(totalDeposits)}</span>
            </div>
            {totalWithdrawals > 0 && (
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <span className="text-xs text-muted">Total withdrawn</span>
                <span className="num text-sm text-muted">{fmtCents(totalWithdrawals)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">Active years</span>
              <span className="num text-sm text-foreground">{overview.years.length}</span>
            </div>
            <p className="mt-2 text-xs text-faint italic">
              Buys in fractional shares, DCA cadence. The long game.
            </p>
          </div>
        )}
      </div>

      {/* Options / Schwab card */}
      <div className={`card px-6 py-5 ${!hasOptions ? "opacity-60" : ""}`}>
        <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-brass">Options You</div>
        <div className="mb-4 font-display text-lg text-foreground">
          The probability trader
        </div>
        {!hasOptions ? (
          <ImportHint book="options" />
        ) : vitals ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Total positions</span>
              <span className="num text-sm text-foreground">{vitals.totalPositions}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Open</span>
              <span className="num text-sm text-foreground">{vitals.open}</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Win rate</span>
              <span className={`num text-sm ${(vitals.winRatePct ?? 0) >= 50 ? "text-gain" : "text-loss"}`}>
                {vitals.winRatePct != null ? `${vitals.winRatePct}%` : "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Median DTE at open</span>
              <span className="num text-sm text-foreground">
                {vitals.medianDteAtOpen != null ? `${vitals.medianDteAtOpen}d` : "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-b border-line pb-2">
              <span className="text-xs text-muted">Realized P&L</span>
              <span className={`num text-sm ${vitals.realizedCents >= 0 ? "text-gain" : "text-loss"}`}>
                {fmtCents(vitals.realizedCents)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">Trades / month</span>
              <span className="num text-sm text-foreground">{tradesPerMonth}</span>
            </div>
            <p className="mt-2 text-xs text-faint italic">
              Selling premium, managing by DTE. A different clock than the equity book.
            </p>
          </div>
        ) : (
          <div className="text-sm text-muted">Accounts exist but no positions recorded.</div>
        )}
      </div>

      {/* Same brain note */}
      {hasEquity && hasOptions && (
        <div className="sm:col-span-2 card px-5 py-4 text-sm text-muted border-l-2 border-l-brass">
          Same brain, two different tempos. The equity book counts in months and years. The options book
          counts in days and DTE. The interesting question is whether they stress each other out.
        </div>
      )}
    </div>
  );
}
