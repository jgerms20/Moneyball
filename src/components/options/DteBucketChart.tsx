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

interface DteBucket {
  label: string;
  count: number;
  realizedCents: number;
  winRatePct: number | null;
}

const BUCKET_ORDER = ["<7 DTE (lottery)", "7-21 DTE", "22-45 DTE", ">45 DTE", "unknown"];

function fmtCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
  return negative ? `-${s}` : s;
}

export function DteBucketChart({
  data,
  totalCount,
}: {
  data: DteBucket[];
  totalCount: number;
}) {
  const sorted = [...data].sort(
    (a, b) => BUCKET_ORDER.indexOf(a.label) - BUCKET_ORDER.indexOf(b.label),
  );

  const lotteryBucket = data.find((d) => d.label === "<7 DTE (lottery)");
  const lotteryShare =
    lotteryBucket && totalCount > 0
      ? Math.round((lotteryBucket.count / totalCount) * 100)
      : null;

  const chartData = sorted.map((d) => ({
    label: d.label === "<7 DTE (lottery)" ? "<7 DTE" : d.label,
    fullLabel: d.label,
    count: d.count,
    realized: d.realizedCents / 100,
    winRate: d.winRatePct,
    sharePct: totalCount > 0 ? Math.round((d.count / totalCount) * 100) : 0,
  }));

  return (
    <div className="space-y-5">
      {lotteryBucket && lotteryShare != null && (
        <div className="card border-loss/30 bg-loss/5 px-5 py-4 text-sm">
          <p className="font-medium text-loss">
            {lotteryShare}% of your trades live below 7 DTE.
          </p>
          <p className="mt-1 text-muted">
            Theta is a tollbooth here. You&apos;re paying it in both directions — buying expensive
            gamma or selling options where there&apos;s almost no time premium left to collect.
            That bucket realized{" "}
            <span
              className={
                lotteryBucket.realizedCents >= 0 ? "text-gain" : "text-loss"
              }
            >
              {fmtCents(lotteryBucket.realizedCents)}
            </span>{" "}
            on {lotteryBucket.count} trade{lotteryBucket.count !== 1 ? "s" : ""}.
            {lotteryBucket.winRatePct != null && (
              <> Win rate: {lotteryBucket.winRatePct}%.</>
            )}
          </p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2c2820" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#6b6354", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b6354", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "trades",
              angle: -90,
              position: "insideLeft",
              fill: "#6b6354",
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#181612",
              border: "1px solid #2c2820",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#ece5d8" }}
            formatter={(value, name) => [
              name === "count" ? `${value} trades` : `$${Number(value).toFixed(0)}`,
              name === "count" ? "Trades" : "Realized P&L",
            ]}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as (typeof chartData)[number];
              return (
                <div
                  style={{
                    background: "#181612",
                    border: "1px solid #2c2820",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: "#ece5d8", fontWeight: 500, marginBottom: 4 }}>
                    {d.fullLabel}
                  </div>
                  <div style={{ color: "#9c937f" }}>{d.count} trades ({d.sharePct}%)</div>
                  <div style={{ color: d.realized >= 0 ? "#6fb5ab" : "#c5705d" }}>
                    {fmtCents(d.realized * 100)} realized
                  </div>
                  {d.winRate != null && (
                    <div style={{ color: "#9c937f" }}>Win rate: {d.winRate}%</div>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.fullLabel === "<7 DTE (lottery)" ? "#c5705d" : "#c9a45c"}
                fillOpacity={entry.fullLabel === "<7 DTE (lottery)" ? 0.7 : 0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
