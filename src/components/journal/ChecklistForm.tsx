"use client";

import { useRef } from "react";
import { createChecklist } from "@/app/journal/actions";

export function ChecklistForm() {
  const ref = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await createChecklist(formData);
    ref.current?.reset();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      ref={ref}
      action={handleSubmit}
      className="card p-5 flex flex-col gap-4"
    >
      <div className="text-[11px] uppercase tracking-widest text-brass mb-1">
        Pre-Trade Checklist
      </div>

      {/* Row 1: date + symbol */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">
            Date
          </label>
          <input
            name="date"
            type="date"
            defaultValue={today}
            required
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground focus:border-brass focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">
            Symbol (optional)
          </label>
          <input
            name="symbol"
            placeholder="AAPL"
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
          />
        </div>
      </div>

      {/* Thesis one-liner */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-widest text-faint">
          Thesis one-liner
        </label>
        <input
          name="thesis"
          required
          placeholder="Why am I making this trade right now?"
          className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
        />
      </div>

      {/* Max loss + exit plan */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">
            Max loss $
          </label>
          <input
            name="maxLoss"
            type="number"
            min="0"
            step="0.01"
            placeholder="500"
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">
            Exit plan
          </label>
          <input
            name="exitPlan"
            placeholder="Price target or trigger"
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
          />
        </div>
      </div>

      {/* Within 48h of a loss? */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-widest text-faint">
          Am I within 48h of a loss?
        </span>
        <div className="flex gap-6">
          {(["no", "yes"] as const).map((val) => (
            <label
              key={val}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <input
                type="radio"
                name="withinLoss"
                value={val}
                defaultChecked={val === "no"}
                className="sr-only peer"
              />
              <span className="h-4 w-4 rounded-full border border-brass/30 peer-checked:border-brass peer-checked:bg-brass transition-all" />
              <span className="capitalize text-muted peer-checked:text-foreground">
                {val}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Size vs normal */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-widest text-faint">
          Size vs normal
        </span>
        <div className="flex gap-6">
          {(["smaller", "normal", "larger"] as const).map((val) => (
            <label
              key={val}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <input
                type="radio"
                name="positionSize"
                value={val}
                defaultChecked={val === "normal"}
                className="sr-only peer"
              />
              <span className="h-4 w-4 rounded-full border border-brass/30 peer-checked:border-brass peer-checked:bg-brass transition-all" />
              <span className="capitalize text-muted peer-checked:text-foreground">
                {val}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md border border-brass/50 bg-surface2 px-5 py-2 text-sm text-brass-bright transition-colors hover:border-brass hover:bg-brass/10"
        >
          Log checklist
        </button>
      </div>
    </form>
  );
}
