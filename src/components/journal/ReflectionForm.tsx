"use client";

import { useRef } from "react";
import { createReflection } from "@/app/journal/actions";

export function ReflectionForm() {
  const ref = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    await createReflection(formData);
    ref.current?.reset();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form ref={ref} action={handleSubmit} className="card p-5 flex flex-col gap-4">
      <div className="text-[11px] uppercase tracking-widest text-brass mb-1">
        New Reflection
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          <label className="text-[11px] uppercase tracking-widest text-faint">
            Symbol (optional)
          </label>
          <input
            name="symbol"
            placeholder="AAPL"
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <label className="text-[11px] uppercase tracking-widest text-faint">Title (optional)</label>
          <input
            name="title"
            placeholder="What happened today"
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] uppercase tracking-widest text-faint">Reflection</label>
        <textarea
          name="body"
          required
          rows={4}
          placeholder="What's on your mind about today's trading?"
          className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground placeholder:text-faint focus:border-brass focus:outline-none resize-none"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md border border-brass/50 bg-surface2 px-5 py-2 text-sm text-brass-bright transition-colors hover:border-brass hover:bg-brass/10"
        >
          Save reflection
        </button>
      </div>
    </form>
  );
}
