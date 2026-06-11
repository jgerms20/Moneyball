"use client";

import type { TiltReport } from "@/lib/queries";

function fmtCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return negative ? `-${s}` : s;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export function TiltDetector({ tilt }: { tilt: TiltReport }) {
  const hasTilt = tilt.tiltTrades > 0;
  const tiltShare =
    tilt.tiltTrades + tilt.baselineTrades > 0
      ? Math.round((tilt.tiltTrades / (tilt.tiltTrades + tilt.baselineTrades)) * 100)
      : 0;

  const winDelta =
    tilt.tiltWinRatePct != null && tilt.baselineWinRatePct != null
      ? tilt.tiltWinRatePct - tilt.baselineWinRatePct
      : null;

  const sizeDelta =
    tilt.tiltAvgSizeCents != null && tilt.baselineAvgSizeCents != null && tilt.baselineAvgSizeCents > 0
      ? Math.round(((tilt.tiltAvgSizeCents - tilt.baselineAvgSizeCents) / tilt.baselineAvgSizeCents) * 100)
      : null;

  return (
    <div className="space-y-5">
      {/* Framing copy */}
      <div className="card border-l-2 border-l-brass px-5 py-4 text-sm">
        <p className="text-muted">
          A fingerprint, not an accusation. This is what revenge trading would look like in your data —
          positions opened within 48 hours of a realized loss. Here&apos;s whether the pattern shows.
        </p>
      </div>

      {!hasTilt ? (
        <div className="card px-5 py-6 text-center text-sm text-muted">
          No tilt trades detected. Either the pattern isn&apos;t there, or you haven&apos;t been tested yet.
        </div>
      ) : (
        <>
          {/* Comparison grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="card px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-faint">Tilt Trades</div>
              <div className={`num mt-1 text-2xl ${tiltShare >= 20 ? "text-loss" : "text-muted"}`}>
                {tilt.tiltTrades}
              </div>
              <div className="mt-0.5 text-[11px] text-faint">{tiltShare}% of all trades</div>
            </div>

            <div className="card px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-faint">Win Rate</div>
              <div className="mt-1 space-y-0.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-faint">Tilt</span>
                  <span className={`num text-base ${(tilt.tiltWinRatePct ?? 0) < (tilt.baselineWinRatePct ?? 0) ? "text-loss" : "text-gain"}`}>
                    {tilt.tiltWinRatePct != null ? `${tilt.tiltWinRatePct}%` : "—"}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-faint">Baseline</span>
                  <span className="num text-base text-muted">
                    {tilt.baselineWinRatePct != null ? `${tilt.baselineWinRatePct}%` : "—"}
                  </span>
                </div>
                {winDelta != null && (
                  <div className="text-[10px] text-right" style={{ color: winDelta < 0 ? "#c5705d" : "#6fb5ab" }}>
                    {winDelta > 0 ? "+" : ""}{winDelta}pp vs baseline
                  </div>
                )}
              </div>
            </div>

            <div className="card px-4 py-3">
              <div className="text-[11px] uppercase tracking-widest text-faint">Avg Position Size</div>
              <div className="mt-1 space-y-0.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-faint">Tilt</span>
                  <span className="num text-base text-foreground">{fmtCents(tilt.tiltAvgSizeCents)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-faint">Baseline</span>
                  <span className="num text-base text-muted">{fmtCents(tilt.baselineAvgSizeCents)}</span>
                </div>
                {sizeDelta != null && (
                  <div className="text-[10px] text-right" style={{ color: sizeDelta > 20 ? "#c5705d" : "#6b6354" }}>
                    {sizeDelta > 0 ? "+" : ""}{sizeDelta}% vs baseline
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Diagnosis */}
          {winDelta != null && sizeDelta != null && (
            <div className={`card px-5 py-4 text-sm ${winDelta < -5 || sizeDelta > 25 ? "border-loss/30 bg-loss/5" : "border-line"}`}>
              {winDelta < -5 && sizeDelta > 25 ? (
                <p className="text-muted">
                  <span className="text-loss font-medium">Pattern confirmed.</span> After losses, you&apos;re
                  opening bigger positions with a lower success rate. The data is telling you something.
                </p>
              ) : winDelta < -5 ? (
                <p className="text-muted">
                  <span className="text-loss font-medium">Win rate dips after losses</span> — size stays
                  controlled, which is good, but you&apos;re picking worse spots under pressure.
                </p>
              ) : sizeDelta > 25 ? (
                <p className="text-muted">
                  <span className="text-brass font-medium">You go bigger after losses</span> — win rate holds,
                  so maybe it&apos;s confidence, not panic. Worth watching.
                </p>
              ) : (
                <p className="text-muted">
                  <span className="text-gain font-medium">No strong tilt signal.</span> Post-loss trades
                  look similar to your baseline. Steady.
                </p>
              )}
            </div>
          )}

          {/* Examples */}
          {tilt.examples.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] uppercase tracking-widest text-faint">Examples</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-widest text-faint">
                      <th className="pb-2 pr-4">Opened</th>
                      <th className="pb-2 pr-4">Ticker</th>
                      <th className="pb-2 pr-4">After loss at</th>
                      <th className="pb-2 text-right">Realized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tilt.examples.map((ex, i) => (
                      <tr key={i} className="border-b border-line/40">
                        <td className="num py-2 pr-4 text-muted">{fmtDate(ex.openedAt)}</td>
                        <td className="py-2 pr-4 font-medium text-foreground">{ex.underlying}</td>
                        <td className="num py-2 pr-4 text-faint">{fmtDate(ex.afterLossAt)}</td>
                        <td className={`num py-2 text-right ${(ex.realizedCents ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
                          {fmtCents(ex.realizedCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
