/**
 * Shared UI primitives. Server-component friendly (no client hooks).
 */

import type { ReactNode } from "react";
import { formatCents, formatQty } from "@/lib/model/money";

export function Money({
  cents,
  sign = false,
  colored = false,
  className = "",
}: {
  cents: number | null | undefined;
  sign?: boolean;
  colored?: boolean;
  className?: string;
}) {
  const color =
    colored && cents != null ? (cents > 0 ? "text-gain" : cents < 0 ? "text-loss" : "text-muted") : "";
  return <span className={`num ${color} ${className}`}>{formatCents(cents, { sign })}</span>;
}

export function Qty({ micro }: { micro: number | null | undefined }) {
  return <span className="num">{formatQty(micro)}</span>;
}

export function PageHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker?: string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="rise mb-8">
      {kicker ? (
        <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-brass">{kicker}</div>
      ) : null}
      <h1 className="text-4xl leading-tight text-foreground">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card px-5 py-4">
      <div className="text-[11px] uppercase tracking-widest text-faint">{label}</div>
      <div className={`mt-1 text-2xl ${accent ? "text-brass-bright" : "text-foreground"} num`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function Section({
  title,
  aside,
  children,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl text-foreground">{title}</h2>
        {aside ? <div className="text-xs text-muted">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gain" | "loss" | "brass" | "panic";
}) {
  const tones: Record<string, string> = {
    neutral: "border-line text-muted",
    gain: "border-gain/40 text-gain",
    loss: "border-loss/40 text-loss",
    brass: "border-brass/50 text-brass-bright",
    panic: "border-panic/50 text-panic",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function RegimeBadge({ regime }: { regime: string }) {
  const tone =
    regime === "panic" || regime === "bear"
      ? "panic"
      : regime === "correction" || regime === "pullback"
        ? "loss"
        : regime === "recovery"
          ? "gain"
          : "neutral";
  return <Badge tone={tone as never}>{regime}</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function PullQuote({ children, source }: { children: ReactNode; source?: ReactNode }) {
  return (
    <figure className="card border-l-2 border-l-brass px-6 py-5">
      <blockquote className="pullquote text-lg leading-relaxed">{children}</blockquote>
      {source ? <figcaption className="mt-2 text-xs text-faint">{source}</figcaption> : null}
    </figure>
  );
}
