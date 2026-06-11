"use client";

import { useRef } from "react";
import { addDesignation, removeDesignation } from "@/app/walls/actions";

export function AddBeliefForm() {
  const ref = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await addDesignation(formData);
    ref.current?.reset();
  }

  return (
    <form
      ref={ref}
      action={handleSubmit}
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="bucket" value="belief" />
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-widest text-faint">
          Ticker
        </label>
        <input
          name="symbol"
          required
          placeholder="AMC"
          className="w-28 rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <label className="text-[11px] uppercase tracking-widest text-faint">
          Note (optional)
        </label>
        <input
          name="note"
          placeholder="Why it belongs here"
          className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="rounded-md border border-brass/50 bg-surface2 px-4 py-2 text-sm text-brass-bright transition-colors hover:border-brass hover:bg-brass/10"
      >
        Add to Bucket
      </button>
    </form>
  );
}

export function RemoveBeliefButton({ symbol }: { symbol: string }) {
  return (
    <form action={removeDesignation}>
      <input type="hidden" name="symbol" value={symbol} />
      <button
        type="submit"
        className="text-[11px] text-faint underline underline-offset-2 hover:text-loss transition-colors"
      >
        remove
      </button>
    </form>
  );
}
