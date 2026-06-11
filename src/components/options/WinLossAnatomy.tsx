"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface WinLossProps {
  positions: {
    realizedCents: number | null;
    status: string;
    outcome: string | null;
  }[];
}

function fmtCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return negative ? `-${s}` : s;
}

export function WinLossAnatomy({ positions }: WinLossProps) {
  const closed = positions.filter(
    (p) => p.status === "closed" && p.realizedCents != null,
  );

  if (closed.length === 0) {
    return (
      <div className="card px-5 py-8 text-center text-sm text-muted">
        No closed positions yet — check back once trades settle.
      </div>
    );
  }

  const wins = closed.filter((p) => p.realizedCents! > 0);
  const losses = closed.filter((p) => p.realizedCents! < 0);
  const breakevens = closed.filter((p) => p.realizedCents === 0);

  const avgWin = wins.length > 0
    ? Math.round(wins.reduce((a, p) => a + p.realizedCents!, 0) / wins.length)
    : 0;
  const avgLoss = losses.length > 0
    ? Math.round(losses.reduce((a, p) => a + p.realizedCents!, 0) / losses.length)
    : 0;

  const winRate = closed.length > 0 ? wins.length / closed.length : 0;
  const expectancy = Math.round(winRate * avgWin + (1 - winRate) * avgLoss);

  // outcome split
  const outcomeCounts: Record<string, number> = {};
  for (const p of positions) {
    const key = p.outcome ?? "open";
    outcomeCounts[key] = (outcomeCounts[key] ?? 0) + 1;
  }

  const outcomeData = Object.entries(outcomeCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const outcomeColor = (label: string): string => {
    if (label === "expired") return "#6fb5ab";
    if (label === "assigned" || label === "exercised") return "#8e5db5";
    if (label === "closed") return "#c9a45c";
    return "#6b6354";
  };

  const barData = [
    { label: "Avg Win", value: avgWin / 100 },
    { label: "Avg Loss", value: avgLoss / 100 },
    { label: "Expectancy", value: expectancy / 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Key stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-faint">Avg Win</div>
          <div className="num mt-1 text-lg text-gain">{fmtCents(avgWin)}</div>
          <div className="mt-0.5 text-[11px] text-faint">{wins.length} trades</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-faint">Avg Loss</div>
          <div className="num mt-1 text-lg text-loss">{fmtCents(avgLoss)}</div>
          <div className="mt-0.5 text-[11px] text-faint">{losses.length} trades</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-faint">Expectancy</div>
          <div className={`num mt-1 text-lg ${expectancy >= 0 ? "text-gain" : "text-loss"}`}>
            {fmtCents(expectancy)}
          </div>
          <div className="mt-0.5 text-[11px] text-faint">per trade</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-faint">Breakevens</div>
          <div className="num mt-1 text-lg text-muted">{breakevens.length}</div>
          <div className="mt-0.5 text-[11px] text-faint">of {closed.length} closed</div>
        </div>
      </div>

      {/* W/L bar chart */}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2c2820" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#6b6354", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "#6b6354", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{ background: "#181612", border: "1px solid #2c2820", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#ece5d8" }}
            formatter={(value) => [`$${Math.abs(Number(value)).toFixed(0)}`, ""]}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {barData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.value >= 0 ? "#6fb5ab" : "#c5705d"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Outcome split */}
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-widest text-faint">Outcome Split</div>
        <div className="flex flex-wrap gap-2">
          {outcomeData.map(({ label, count }) => (
            <div key={label} className="card flex items-center gap-2 px-3 py-2 text-sm">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: outcomeColor(label) }}
              />
              <span className="text-muted capitalize">{label}</span>
              <span className="num text-foreground">{count}</span>
              {label === "expired" && (
                <span className="text-[10px] text-faint">(worthless — seller&apos;s best outcome)</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
