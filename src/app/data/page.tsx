/**
 * Data — import history, account overview, market data, and export guides.
 * Server component, data fetched at request time.
 */

import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { importFiles, skippedRows } from "@/lib/db/schema";
import { getOverview, db } from "@/lib/queries";
import { marketDataRange } from "@/lib/market/market";
import { Empty, PageHeader, Section } from "@/components/ui";
import { UploadForm } from "@/components/data/UploadForm";
import { refreshMarketAction, rebuildDerivedAction } from "@/app/data/actions";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/* ------------------------------------------------------------------ */
/* action buttons (client wrapper needed for server actions in forms)   */
/* ------------------------------------------------------------------ */

function ActionButton({
  action,
  label,
}: {
  action: () => Promise<{ ok: boolean; message: string }>;
  label: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await action();
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-line bg-surface2 px-3 py-1.5 text-xs text-muted transition-colors hover:border-brass/40 hover:text-brass-bright"
      >
        {label}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                 */
/* ------------------------------------------------------------------ */

export default function DataPage() {
  const database = db(); // uses the cached db() from queries.ts (loads market data on first touch)
  const rawDb = getDb();
  const overview = getOverview();

  /* --- import history (newest first) --- */
  const importHistory = rawDb
    .select()
    .from(importFiles)
    .orderBy(desc(importFiles.importedAt))
    .all();

  /* --- latest 50 skipped rows --- */
  const latestSkipped = rawDb
    .select()
    .from(skippedRows)
    .orderBy(desc(skippedRows.id))
    .limit(50)
    .all();

  /* --- market data ranges --- */
  const spyRange = marketDataRange(database, "SPY");
  const qqqRange = marketDataRange(database, "QQQ");
  const vixRange = marketDataRange(database, "VIX");

  return (
    <div>
      <PageHeader
        kicker="data"
        title="Data"
        subtitle="Everything here stays local. Your brokerage exports never leave this machine."
      />

      {/* 1. Upload area */}
      <Section title="Import files">
        <UploadForm />
      </Section>

      {/* 2. Accounts table */}
      <Section title="Accounts">
        {overview.accounts.length === 0 ? (
          <Empty>
            <p className="text-sm text-muted">No accounts yet. Import a file above to get started.</p>
          </Empty>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-widest text-faint">
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Broker</th>
                  <th className="px-4 py-3 text-left">Book</th>
                  <th className="px-4 py-3 text-right num">Transactions</th>
                  <th className="px-4 py-3 text-right">Date range</th>
                </tr>
              </thead>
              <tbody>
                {overview.accounts.map((a, i) => (
                  <tr
                    key={a.id}
                    className={`border-b border-line last:border-0 ${i % 2 !== 0 ? "bg-surface2/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{a.label}</div>
                      <div className="text-[11px] text-faint num">{a.id}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted">{a.broker}</td>
                    <td className="px-4 py-3 text-muted">{a.book}</td>
                    <td className="px-4 py-3 text-right num text-foreground">
                      {a.txCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted num">
                      {a.firstDate ? fmtDate(a.firstDate) : "—"}
                      {" – "}
                      {a.lastDate ? fmtDate(a.lastDate) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 3. Import history */}
      <Section title="Import history" aside={`${importHistory.length} file${importHistory.length !== 1 ? "s" : ""}`}>
        {importHistory.length === 0 ? (
          <Empty>
            <p className="text-sm text-muted">No imports yet.</p>
          </Empty>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-widest text-faint">
                  <th className="px-4 py-3 text-left">File</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-right num">Imported</th>
                  <th className="px-4 py-3 text-right num">Deduped</th>
                  <th className="px-4 py-3 text-right num">Skipped</th>
                  <th className="px-4 py-3 text-right">Imported at</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((f) => {
                  let warnings: string[] = [];
                  try {
                    warnings = f.warnings ? (JSON.parse(f.warnings) as string[]) : [];
                  } catch {
                    warnings = [];
                  }
                  return (
                    <tr key={f.id} className="border-b border-line/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="text-foreground max-w-xs truncate">{f.fileName}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{f.source}</td>
                      <td className="px-4 py-3 text-right num text-gain">{f.rowsImported}</td>
                      <td className="px-4 py-3 text-right num text-muted">{f.rowsDeduped}</td>
                      <td className={`px-4 py-3 text-right num ${f.rowsSkipped > 0 ? "text-loss" : "text-muted"}`}>
                        {f.rowsSkipped}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-faint num">
                        {fmtDateTime(f.importedAt)}
                      </td>
                      {warnings.length > 0 && (
                        <td className="px-4 py-3 text-xs text-brass" colSpan={6}>
                          {warnings.slice(0, 3).join(" · ")}
                          {warnings.length > 3 && ` (+${warnings.length - 3} more)`}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 4. Skipped rows drawer */}
      {latestSkipped.length > 0 && (
        <Section title="Skipped rows">
          <details className="card">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm text-muted hover:text-foreground">
              <span>
                <span className="text-loss num font-medium">{latestSkipped.length}</span>
                {latestSkipped.length === 50 ? "+" : ""} skipped rows
              </span>
              <span className="text-[11px] uppercase tracking-widest text-faint">
                skipped visibly, never silently
              </span>
            </summary>

            <div className="border-t border-line px-5 py-4">
              <p className="mb-3 text-xs text-muted">
                These rows were recognized but couldn&apos;t be parsed into transactions. Nothing
                is dropped without a reason logged here.
              </p>
              <div className="space-y-2">
                {latestSkipped.map((row) => (
                  <div key={row.id} className="rounded-md border border-line/60 px-3 py-2">
                    <div className="text-xs text-loss">{row.reason}</div>
                    <div className="mt-1 font-mono text-[11px] text-faint break-all">
                      {truncate(row.raw, 200)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </Section>
      )}

      {/* 5. Market data card */}
      <Section title="Market data">
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { symbol: "SPY", range: spyRange },
              { symbol: "QQQ", range: qqqRange },
              { symbol: "VIX", range: vixRange },
            ].map(({ symbol, range }) => (
              <div key={symbol} className="rounded-lg border border-line bg-surface2/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-widest text-faint mb-1">{symbol}</div>
                {range ? (
                  <div className="num text-xs text-muted">
                    {fmtDate(range.min)} – {fmtDate(range.max)}
                  </div>
                ) : (
                  <div className="text-xs text-faint">No data</div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <ActionButton action={refreshMarketAction} label="Refresh market data" />
            <ActionButton action={rebuildDerivedAction} label="Rebuild derived state" />
          </div>

          <p className="text-xs text-faint">
            Market data refreshes from Stooq and GitHub when network is available; bundled
            snapshots serve offline. &ldquo;Rebuild derived state&rdquo; re-computes lots,
            closures, and option positions from raw transactions.
          </p>
        </div>
      </Section>

      {/* 6. Privacy note */}
      <Section title="Privacy">
        <div className="card border-l-2 border-l-brass px-6 py-5">
          <p className="text-sm text-muted leading-relaxed">
            <span className="font-medium text-foreground">Your data never leaves this server.</span>{" "}
            Everything is stored in a local SQLite file at{" "}
            <code className="rounded bg-surface2 px-1 py-0.5 font-mono text-xs text-brass">
              data/trader-mirror.db
            </code>
            . No analytics, no tracking, no third-party requests except optional market data
            refreshes from public sources (Stooq, GitHub). The upload endpoint writes directly to
            disk — nothing is transmitted externally.
          </p>
        </div>
      </Section>

      {/* 7. Export guides */}
      <Section title="How to export from your broker">
        <div className="space-y-3">
          {/* Schwab */}
          <details className="card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-foreground hover:text-brass-bright">
              Schwab — options history (CSV)
            </summary>
            <div className="border-t border-line px-5 py-4 text-sm text-muted space-y-2">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Log in at <span className="text-brass">schwab.com</span></li>
                <li>Go to <span className="text-foreground">Accounts</span> → <span className="text-foreground">History</span></li>
                <li>Select your options / brokerage account</li>
                <li>Set the date range (go back as far as you have history)</li>
                <li>Click <span className="text-foreground">Export</span> and save as CSV</li>
              </ol>
              <p className="text-faint text-xs">
                We look for the Schwab CSV format automatically. The file name doesn&apos;t matter.
              </p>
            </div>
          </details>

          {/* thinkorswim */}
          <details className="card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-foreground hover:text-brass-bright">
              thinkorswim — account statement
            </summary>
            <div className="border-t border-line px-5 py-4 text-sm text-muted space-y-2">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Open the <span className="text-brass">thinkorswim</span> desktop app</li>
                <li>Go to the <span className="text-foreground">Monitor</span> tab</li>
                <li>Click <span className="text-foreground">Account Statement</span></li>
                <li>Set the date range you want to export</li>
                <li>Click <span className="text-foreground">Export to File</span> (top right)</li>
              </ol>
              <p className="text-faint text-xs">
                The exported file is a multi-section CSV. We parse all relevant sections automatically.
              </p>
            </div>
          </details>

          {/* Fidelity history */}
          <details className="card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-foreground hover:text-brass-bright">
              Fidelity — transaction history (CSV)
            </summary>
            <div className="border-t border-line px-5 py-4 text-sm text-muted space-y-2">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Log in at <span className="text-brass">fidelity.com</span></li>
                <li>Go to <span className="text-foreground">Accounts &amp; Trade</span> → <span className="text-foreground">Account History</span></li>
                <li>Select the account and set a date range</li>
                <li>Click <span className="text-foreground">Download</span> → CSV</li>
              </ol>
              <p className="text-faint text-xs">
                The file name should contain the account number (e.g.{" "}
                <code className="font-mono">History_for_Account_Z09XXXXXX.csv</code>) for automatic
                account matching.
              </p>
            </div>
          </details>

          {/* Fidelity 1099 */}
          <details className="card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-foreground hover:text-brass-bright">
              Fidelity — consolidated 1099 (PDF)
            </summary>
            <div className="border-t border-line px-5 py-4 text-sm text-muted space-y-2">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Log in at <span className="text-brass">fidelity.com</span></li>
                <li>Go to <span className="text-foreground">Accounts &amp; Trade</span> → <span className="text-foreground">Tax Forms</span></li>
                <li>Find your Consolidated 1099 for the tax year</li>
                <li>Download as PDF</li>
              </ol>
              <p className="text-faint text-xs">
                We extract realized gain/loss data for the Tax view. The PDF parser handles standard
                Fidelity 1099-B layouts.
              </p>
            </div>
          </details>
        </div>
      </Section>
    </div>
  );
}
