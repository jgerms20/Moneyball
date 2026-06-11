"use client";

import { useRef, useTransition } from "react";
import { RegimeBadge, Badge } from "@/components/ui";
import { addAnnotation } from "@/app/timeline/actions";
import { formatCents, formatQty } from "@/lib/model/money";

/* -------------------------------------------------------------------------- */
/*  Types (plain/serializable so page can pass them)                           */
/* -------------------------------------------------------------------------- */

export interface DayEvent {
  id: number;
  type: string;
  symbol: string | null;
  description: string | null;
  qtyMicro: number | null;
  amountCents: number | null;
  accountId: string;
  occKey: string | null;
}

export interface DayContext {
  date: string;
  asOf: string | null;
  spyCloseMicro: number | null;
  drawdownPct: number | null;
  rangePosition: number | null;
  fiveDayReturnPct: number | null;
  vixClose: number | null;
  regime: string;
}

export interface DayAnnotation {
  id: number;
  date: string;
  label: string;
  body: string | null;
  kind: string;
  createdAt: string;
}

export interface DayData {
  date: string;
  buysCents: number;
  sellsCents: number;
  events: DayEvent[];
  context: DayContext;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const COMPACT_TYPES = new Set(["dividend", "reinvest"]);
const TRADE_TYPES = new Set(["buy", "sell"]);

function formatDate(date: string): string {
  // date is YYYY-MM-DD
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function typeTone(type: string): "gain" | "loss" | "neutral" | "brass" {
  if (type === "buy" || type === "reinvest") return "gain";
  if (type === "sell") return "loss";
  if (type === "dividend") return "brass";
  return "neutral";
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    buy: "BUY",
    sell: "SELL",
    dividend: "DIV",
    reinvest: "REINV",
    transfer_in: "DEP",
    transfer_out: "WITH",
    fee: "FEE",
    interest: "INT",
    journal: "JNL",
    option_open: "OPT OPEN",
    option_close: "OPT CLOSE",
    option_expire: "EXPIRE",
    option_assign: "ASSIGN",
    option_exercise: "EXERCISE",
  };
  return labels[type] ?? type.toUpperCase();
}

/** One-line brass note when the user bought during a deep drawdown */
function verdictLine(day: DayData): string | null {
  const { context, buysCents } = day;
  if (buysCents <= 0 || context.drawdownPct == null) return null;
  const dd = context.drawdownPct;
  // Only surface meaningful drawdowns (> 4%)
  if (dd > -4) return null;

  const ddStr = dd.toFixed(1);
  const bought = formatCents(buysCents);

  if (dd <= -20) {
    return `You deployed ${bought} while SPY was ${ddStr}% off its high — deep into bear territory. That's the edge most people can't hold.`;
  }
  if (dd <= -10) {
    return `You bought ${bought} worth during a ${ddStr}% correction in SPY. Buying the fear is the strategy — you did it.`;
  }
  // -4 to -10 pullback
  return `You added ${bought} while SPY was ${ddStr}% off its high. Buying pullbacks compounds into conviction.`;
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                               */
/* -------------------------------------------------------------------------- */

function EventRow({ ev }: { ev: DayEvent }) {
  const tone = typeTone(ev.type);
  const amtColor =
    ev.amountCents == null
      ? "text-muted"
      : ev.type === "buy" || ev.type === "reinvest"
      ? "text-gain"
      : ev.type === "sell"
      ? "text-loss"
      : "text-foreground";

  return (
    <div className="flex items-center gap-3 py-1 text-sm border-t border-line/50">
      <Badge tone={tone}>{typeLabel(ev.type)}</Badge>
      {ev.symbol && (
        <span className="font-medium text-foreground w-16 shrink-0">{ev.symbol}</span>
      )}
      {ev.qtyMicro != null && (
        <span className="num text-muted text-xs">{formatQty(ev.qtyMicro)} sh</span>
      )}
      {ev.occKey && !ev.symbol && (
        <span className="num text-muted text-xs truncate max-w-[180px]">{ev.occKey}</span>
      )}
      {!ev.symbol && !ev.occKey && ev.description && (
        <span className="text-muted text-xs truncate max-w-[200px]">{ev.description}</span>
      )}
      <span className={`num ml-auto ${amtColor}`}>
        {formatCents(ev.amountCents)}
      </span>
    </div>
  );
}

interface CompactGroup {
  type: "dividend" | "reinvest";
  count: number;
  totalCents: number;
}

function CompactGroupRow({ group }: { group: CompactGroup }) {
  const label = group.type === "dividend" ? "dividend" : "reinvest";
  return (
    <div className="flex items-center gap-3 py-1 text-xs text-muted border-t border-line/50">
      <span className="text-brass">
        {group.count} {label}{group.count !== 1 ? "s" : ""}
      </span>
      <span className="num ml-auto text-brass">{formatCents(group.totalCents)}</span>
    </div>
  );
}

function AnnotationForm({ date }: { date: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = formRef.current;
    startTransition(async () => {
      await addAnnotation(fd);
      form?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="date" value={date} />
      <div className="flex gap-2">
        <input
          name="label"
          required
          placeholder="Label (e.g. Job loss, Fed day…)"
          className="flex-1 rounded-md border border-line bg-surface2 px-3 py-1.5 text-sm text-foreground placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-brass/50"
        />
        <select
          name="kind"
          className="rounded-md border border-line bg-surface2 px-2 py-1.5 text-sm text-muted focus:outline-none focus:ring-1 focus:ring-brass/50"
        >
          <option value="life">life</option>
          <option value="market">market</option>
          <option value="account">account</option>
        </select>
      </div>
      <textarea
        name="body"
        rows={2}
        placeholder="Notes (optional)"
        className="rounded-md border border-line bg-surface2 px-3 py-1.5 text-sm text-foreground placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-brass/50 resize-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-surface2 border border-line px-4 py-1.5 text-xs text-brass hover:border-brass/50 hover:text-brass-bright transition-colors disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add annotation"}
      </button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main DayCard                                                                */
/* -------------------------------------------------------------------------- */

export function DayCard({
  day,
  annotations,
}: {
  day: DayData;
  annotations: DayAnnotation[];
}) {
  const { context } = day;

  // Split events into trades vs compact
  const tradeEvents = day.events.filter((e) => !COMPACT_TYPES.has(e.type));
  const dividendEvents = day.events.filter((e) => e.type === "dividend");
  const reinvestEvents = day.events.filter((e) => e.type === "reinvest");

  const compactGroups: CompactGroup[] = [];
  if (dividendEvents.length > 0) {
    compactGroups.push({
      type: "dividend",
      count: dividendEvents.length,
      totalCents: dividendEvents.reduce((s, e) => s + (e.amountCents ?? 0), 0),
    });
  }
  if (reinvestEvents.length > 0) {
    compactGroups.push({
      type: "reinvest",
      count: reinvestEvents.length,
      totalCents: reinvestEvents.reduce((s, e) => s + (e.amountCents ?? 0), 0),
    });
  }

  const verdict = verdictLine(day);

  const ddLabel =
    context.drawdownPct != null
      ? `${context.drawdownPct.toFixed(1)}%`
      : "—";

  const vixLabel =
    context.vixClose != null
      ? context.vixClose.toFixed(1)
      : "—";

  const rangeLabel =
    context.rangePosition != null
      ? `${(context.rangePosition * 100).toFixed(0)}%ile`
      : null;

  return (
    <div className="card px-5 py-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h3 className="font-display text-lg text-foreground">{formatDate(day.date)}</h3>
        <RegimeBadge regime={context.regime} />
        <div className="flex items-center gap-3 ml-auto text-xs text-muted">
          <span>
            SPY drawdown{" "}
            <span className={`num ${context.drawdownPct != null && context.drawdownPct <= -10 ? "text-loss" : context.drawdownPct != null && context.drawdownPct <= -4 ? "text-panic" : "text-muted"}`}>
              {ddLabel}
            </span>
          </span>
          <span>
            VIX <span className={`num ${context.vixClose != null && context.vixClose >= 30 ? "text-panic" : context.vixClose != null && context.vixClose >= 20 ? "text-loss" : "text-muted"}`}>{vixLabel}</span>
          </span>
          {rangeLabel && (
            <span>
              52w range <span className="num">{rangeLabel}</span>
            </span>
          )}
        </div>
      </div>

      {/* Trade events */}
      {tradeEvents.map((ev) => (
        <EventRow key={ev.id} ev={ev} />
      ))}

      {/* Compact groups */}
      {compactGroups.map((g) => (
        <CompactGroupRow key={g.type} group={g} />
      ))}

      {/* Verdict line */}
      {verdict && (
        <p className="mt-3 text-sm text-brass italic border-l-2 border-brass/50 pl-3">
          {verdict}
        </p>
      )}

      {/* Existing annotations */}
      {annotations.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {annotations.map((a) => (
            <div key={a.id} className="rounded-md bg-surface2 px-3 py-2 text-xs border border-line">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-brass-bright font-medium">{a.label}</span>
                <span className="text-faint uppercase tracking-wider">{a.kind}</span>
              </div>
              {a.body && <p className="text-muted leading-relaxed">{a.body}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Annotation form (collapsible) */}
      <details className="mt-3 group">
        <summary className="cursor-pointer list-none text-xs text-faint hover:text-muted transition-colors select-none">
          <span className="group-open:hidden">+ Add annotation</span>
          <span className="hidden group-open:inline">- Cancel</span>
        </summary>
        <AnnotationForm date={day.date} />
      </details>
    </div>
  );
}
