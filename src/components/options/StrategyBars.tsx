"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface StrategyRow {
  label: string;
  count: number;
  realizedCents: number;
  winRatePct: number | null;
}

function fmtCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
  return negative ? `-${s}` : s;
}

export function StrategyBars({ data }: { data: StrategyRow[] }) {
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    label: d.label,
    count: d.count,
    realized: d.realizedCents / 100,
    winRate: d.winRatePct,
  }));

  return (
    <div className="space-y-6">
      {/* Strategy table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-widest text-faint">
              <th className="pb-2 pr-4">Strategy</th>
              <th className="pb-2 pr-4 text-right">Trades</th>
              <th className="pb-2 pr-4 text-right">Realized</th>
              <th className="pb-2 text-right">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.label} className="border-b border-line/40">
                <td className="py-2 pr-4 text-foreground">{row.label}</td>
                <td className="num py-2 pr-4 text-right text-muted">{row.count}</td>
                <td
                  className={`num py-2 pr-4 text-right ${
                    row.realizedCents > 0
                      ? "text-gain"
                      : row.realizedCents < 0
                        ? "text-loss"
                        : "text-muted"
                  }`}
                >
                  {fmtCents(row.realizedCents)}
                </td>
                <td className="num py-2 text-right text-muted">
                  {row.winRatePct != null ? `${row.winRatePct}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bar chart: realized P&L by strategy */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2c2820" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#6b6354", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            tickFormatter={(v: string) => v.split(" ")[0]}
          />
          <YAxis
            tick={{ fill: "#6b6354", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "#181612",
              border: "1px solid #2c2820",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#ece5d8" }}
            itemStyle={{ color: "#9c937f" }}
            formatter={(value) => [`$${Number(value).toFixed(0)}`, "P&L"]}
          />
          <Bar dataKey="realized" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.realized >= 0 ? "#6fb5ab" : "#c5705d"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
