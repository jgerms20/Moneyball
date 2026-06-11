"use client";

import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import type { MarketSeriesPoint } from "@/lib/market/market";

export interface TradeDay {
  date: string;
  buysCents: number;
  sellsCents: number;
  regime: string;
}

interface Props {
  spy: MarketSeriesPoint[];
  tradeDays: TradeDay[];
  year: number;
}

interface RegimeSpan {
  start: string;
  end: string;
  regime: string;
}

function buildRegimeSpans(tradeDays: TradeDay[], spyDates: string[]): RegimeSpan[] {
  // Map trade days by date for fast lookup
  const tradeMap = new Map<string, string>();
  for (const td of tradeDays) {
    tradeMap.set(td.date, td.regime);
  }

  // For dates in spy series with no trade, we don't have regime data.
  // Build spans only from trade days that are panic/bear/correction/pullback.
  const coloredRegimes = new Set(["panic", "bear", "correction", "pullback"]);
  const spans: RegimeSpan[] = [];

  // Sort trade days by date
  const sorted = [...tradeDays]
    .filter((d) => coloredRegimes.has(d.regime))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) return spans;

  let currentSpan: RegimeSpan | null = null;

  for (const td of sorted) {
    if (!currentSpan) {
      currentSpan = { start: td.date, end: td.date, regime: td.regime };
    } else {
      // Extend span if same regime and within a few days
      const dayDiff =
        (new Date(td.date).getTime() - new Date(currentSpan.end).getTime()) / 86_400_000;
      if (td.regime === currentSpan.regime && dayDiff <= 7) {
        currentSpan.end = td.date;
      } else {
        spans.push(currentSpan);
        currentSpan = { start: td.date, end: td.date, regime: td.regime };
      }
    }
  }
  if (currentSpan) spans.push(currentSpan);

  return spans;
}

function regimeColor(regime: string): string {
  if (regime === "panic" || regime === "bear") return "rgba(142, 93, 181, 0.15)";
  if (regime === "correction" || regime === "pullback") return "rgba(197, 112, 93, 0.12)";
  return "transparent";
}

interface ChartPoint {
  date: string;
  close: number | null;
  buyDot?: number | null;
  sellDot?: number | null;
  buySize?: number;
  sellSize?: number;
}

const PRICE_SCALE = 1_000_000;

export function MarketStrip({ spy, tradeDays, year }: Props) {
  if (spy.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center text-sm text-muted">
        No SPY data available for {year}.
      </div>
    );
  }

  // Build a date→close map
  const closeMap = new Map<string, number>();
  for (const pt of spy) {
    closeMap.set(pt.date, pt.closeMicro / PRICE_SCALE);
  }

  // Build trade day lookup
  const tradeMap = new Map<string, TradeDay>();
  for (const td of tradeDays) {
    tradeMap.set(td.date, td);
  }

  // Build chart data from SPY series
  const data: ChartPoint[] = spy.map((pt) => {
    const closePrice = pt.closeMicro / PRICE_SCALE;
    const td = tradeMap.get(pt.date);
    return {
      date: pt.date,
      close: closePrice,
      buyDot: td && td.buysCents > 0 ? closePrice : null,
      sellDot: td && td.sellsCents > 0 ? closePrice : null,
      buySize: td ? Math.max(4, Math.min(16, Math.sqrt(td.buysCents / 10000) * 3)) : undefined,
      sellSize: td ? Math.max(4, Math.min(16, Math.sqrt(td.sellsCents / 10000) * 3)) : undefined,
    };
  });

  // Build regime spans for shading
  const spyDates = spy.map((p) => p.date);
  const regimeSpans = buildRegimeSpans(tradeDays, spyDates);

  // Y domain with small padding
  const closes = data.map((d) => d.close).filter((v): v is number => v != null);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const pad = (maxClose - minClose) * 0.05;
  const yDomain = [minClose - pad, maxClose + pad];

  // Format date for display
  const formatTick = (date: string) => {
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short" });
  };

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { payload: ChartPoint }[];
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const pt = payload[0].payload;
    const td = tradeMap.get(pt.date);
    return (
      <div className="card px-3 py-2 text-xs">
        <div className="text-muted">{pt.date}</div>
        {pt.close != null && (
          <div className="num text-foreground">SPY ${pt.close.toFixed(2)}</div>
        )}
        {td && td.buysCents > 0 && (
          <div className="text-gain">
            Bought ${(td.buysCents / 100).toFixed(2)}
          </div>
        )}
        {td && td.sellsCents > 0 && (
          <div className="text-loss">
            Sold ${(td.sellsCents / 100).toFixed(2)}
          </div>
        )}
      </div>
    );
  };

  // Sample ticks — one per month
  const tickDates: string[] = [];
  let lastMonth = "";
  for (const pt of spy) {
    const month = pt.date.slice(0, 7);
    if (month !== lastMonth) {
      tickDates.push(pt.date);
      lastMonth = month;
    }
  }

  // Separate buy and sell scatter points
  const buyPoints = data.filter((d) => d.buyDot != null);
  const sellPoints = data.filter((d) => d.sellDot != null);

  return (
    <div className="card overflow-hidden p-4">
      <div className="mb-2 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#6fb5ab]" />
          Buys
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#c5705d]" />
          Sells
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[rgba(142,93,181,0.3)]" />
          Bear/Panic
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[rgba(197,112,93,0.25)]" />
          Correction
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          {/* Regime shading */}
          {regimeSpans.map((span, i) => (
            <ReferenceArea
              key={i}
              x1={span.start}
              x2={span.end}
              fill={regimeColor(span.regime)}
              strokeOpacity={0}
            />
          ))}

          <XAxis
            dataKey="date"
            ticks={tickDates}
            tickFormatter={formatTick}
            tick={{ fill: "#6b6354", fontSize: 10 }}
            axisLine={{ stroke: "#2c2820" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: "#6b6354", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* SPY price line */}
          <Line
            type="monotone"
            dataKey="close"
            stroke="#9c937f"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#c9a45c" }}
          />

          {/* Buy dots */}
          <Scatter
            data={buyPoints}
            dataKey="buyDot"
            fill="#6fb5ab"
            r={5}
            opacity={0.85}
            name="buy"
          />

          {/* Sell dots */}
          <Scatter
            data={sellPoints}
            dataKey="sellDot"
            fill="#c5705d"
            r={5}
            opacity={0.85}
            name="sell"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
