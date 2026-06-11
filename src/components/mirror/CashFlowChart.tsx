"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface CashFlowDatum {
  year: number;
  depositsCents: number;
  withdrawalsCents: number;
}

function formatK(cents: number): string {
  const d = cents / 100;
  if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (Math.abs(d) >= 1_000) return `$${(d / 1_000).toFixed(0)}k`;
  return `$${d.toFixed(0)}`;
}

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs">
      <div className="mb-1 text-faint">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="num flex gap-2">
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{formatK(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CashFlowChart({ data }: { data: CashFlowDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2c2820" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fill: "#6b6354", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatK}
          tick={{ fill: "#6b6354", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<TooltipContent />} cursor={{ fill: "rgba(201,164,92,0.07)" }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#6b6354" }}
          formatter={(v) => <span style={{ color: "#9c937f" }}>{v}</span>}
        />
        <Bar
          dataKey="depositsCents"
          name="Deposits"
          fill="#c9a45c"
          fillOpacity={0.75}
          radius={[3, 3, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="withdrawalsCents"
          name="Withdrawals"
          fill="#6fb5ab"
          fillOpacity={0.65}
          radius={[3, 3, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
