"use client";

import { useRef } from "react";
import { upsertClusterTag } from "@/app/patterns/actions";

interface Props {
  accountId: string;
  date: string;
  currentReason: string | null;
  currentNote: string | null;
}

export function ClusterTagForm({ accountId, date, currentReason, currentNote }: Props) {
  const ref = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await upsertClusterTag(formData);
  }

  return (
    <form ref={ref} action={handleSubmit} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="date" value={date} />
      <p className="text-[11px] uppercase tracking-widest text-faint">
        Your reason — the timing is graded separately by the engine
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          name="reason"
          defaultValue={currentReason ?? ""}
          className="rounded-md border border-line bg-surface2 px-3 py-1.5 text-sm text-foreground focus:border-brass focus:outline-none"
        >
          <option value="" disabled>
            Why did you sell?
          </option>
          <option value="liquidity">Liquidity — needed cash</option>
          <option value="consolidation">Consolidation — trimming size</option>
          <option value="capitulation">Capitulation — hit my limit</option>
          <option value="other">Other</option>
        </select>
        <input
          name="note"
          defaultValue={currentNote ?? ""}
          placeholder="Optional note"
          className="flex-1 min-w-[12rem] rounded-md border border-line bg-surface2 px-3 py-1.5 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-brass/50 bg-surface2 px-4 py-1.5 text-sm text-brass-bright transition-colors hover:border-brass hover:bg-brass/10"
        >
          Save
        </button>
      </div>
    </form>
  );
}
