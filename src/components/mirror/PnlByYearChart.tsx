"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PnlYearDatum {
  year: number;
  gainCents: number;
  isTax: boolean;
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
  payload?: { value: number; payload: PnlYearDatum }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const isTax = payload[0].payload.isTax;
  const color = v >= 0 ? "#6fb5ab" : "#c5705d";
  return (
    <div className="card px-3 py-2 text-xs">
      <div className="text-faint">{label}</div>
      <div className="num mt-0.5 font-medium" style={{ color }}>
        {formatK(v)}
      </div>
      {isTax && <div className="mt-0.5 text-faint">tax-form</div>}
    </div>
  );
}

export default function PnlByYearChart({ data }: { data: PnlYearDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
        <ReferenceLine y={0} stroke="#2c2820" strokeWidth={1} />
        <Bar dataKey="gainCents" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {data.map((d) => (
            <Cell
              key={d.year}
              fill={d.gainCents >= 0 ? "#6fb5ab" : "#c5705d"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
