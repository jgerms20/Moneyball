"use client";

import { useRef } from "react";
import { createThesis } from "@/app/journal/actions";

export function ThesisForm() {
  const ref = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await createThesis(formData);
    ref.current?.reset();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form ref={ref} action={handleSubmit} className="card p-5 flex flex-col gap-4">
      <div className="text-[11px] uppercase tracking-widest text-brass mb-1">
        New Thesis
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={today}
            required
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground focus:border-brass focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">Symbol</label>
          <input
            name="symbol"
            required
            placeholder="NVDA"
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-widest text-faint">
          Why I bought (the thesis)
        </label>
        <textarea
          name="body"
          required
          rows={3}
          placeholder="What's the story here? What do you see that others might not?"
          className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none resize-none"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">Exit plan</label>
          <textarea
            name="exitPlan"
            rows={2}
            placeholder="Price target, time horizon, or trigger"
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none resize-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">
            Invalidation — what would prove me wrong?
          </label>
          <textarea
            name="invalidation"
            rows={2}
            placeholder="If this happens, the thesis is dead"
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none resize-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[11px] uppercase tracking-widest text-faint">
          Conviction (1 = whisper, 5 = core belief)
        </label>
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map((v) => (
            <label key={v} className="flex flex-col items-center gap-1 cursor-pointer group">
              <input
                type="radio"
                name="conviction"
                value={v}
                defaultChecked={v === 3}
                className="sr-only peer"
              />
              <span className="h-5 w-5 rounded-full border border-brass/30 peer-checked:border-brass peer-checked:bg-brass transition-all group-hover:border-brass/60" />
              <span className="text-[11px] text-faint peer-checked:text-brass-bright">{v}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md border border-brass/50 bg-surface2 px-5 py-2 text-sm text-brass-bright transition-colors hover:border-brass hover:bg-brass/10"
        >
          File thesis
        </button>
      </div>
    </form>
  );
}
