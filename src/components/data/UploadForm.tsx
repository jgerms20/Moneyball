"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FileSummary } from "@/app/data/upload/route";

type UploadResult = FileSummary[];

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;

    setError(null);
    setResults(null);

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/data/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        setError(`Upload failed (${res.status}): ${text}`);
        return;
      }

      const data: UploadResult = await res.json();
      setResults(data);

      // Clear the file input
      if (inputRef.current) inputRef.current.value = "";

      // Refresh server data without full navigation
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div>
        <p className="text-sm text-foreground font-medium mb-1">
          Drop your brokerage exports here
        </p>
        <p className="text-xs text-muted">
          Accepts CSV files (Schwab history, Fidelity history, thinkorswim statement) and PDF
          files (Fidelity 1099-B consolidated). Multiple files at once is fine — we&apos;ll
          detect each format automatically and deduplicate.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label
          className="flex flex-col items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed border-line px-6 py-8 text-center transition-colors hover:border-brass/50 hover:bg-surface2/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (inputRef.current && e.dataTransfer.files.length > 0) {
              // DataTransfer files can't be directly set; trigger selection feedback
              const dt = new DataTransfer();
              for (const f of e.dataTransfer.files) dt.items.add(f);
              inputRef.current.files = dt.files;
              // Show file names
              inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }}
        >
          <div className="text-3xl text-faint select-none">&#8593;</div>
          <div className="text-sm text-muted">
            Click to choose files, or drag &amp; drop
          </div>
          <div className="text-[11px] text-faint uppercase tracking-widest">
            .csv &middot; .pdf
          </div>
          <input
            ref={inputRef}
            type="file"
            name="files"
            multiple
            accept=".csv,.pdf"
            className="sr-only"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg border border-brass/40 bg-brass/10 px-4 py-2.5 text-sm font-medium text-brass-bright transition-colors hover:bg-brass/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Refreshing…" : "Import files"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-loss/30 bg-loss/5 px-4 py-3 text-sm text-loss">
          {error}
        </div>
      )}

      {/* Per-file results */}
      {results && results.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-faint">Import results</div>
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg border px-4 py-3 text-sm ${
                r.error
                  ? "border-loss/30 bg-loss/5"
                  : "border-gain/30 bg-gain/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-foreground truncate">{r.fileName}</span>
                {r.format && (
                  <span className="shrink-0 text-[11px] uppercase tracking-wider text-faint num">
                    {r.format}
                  </span>
                )}
              </div>

              {r.error ? (
                <p className="mt-1 text-loss">{r.error}</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted num">
                  <span>
                    <span className="text-gain">{r.imported}</span> imported
                  </span>
                  {r.deduped > 0 && (
                    <span>
                      <span className="text-muted">{r.deduped}</span> deduped
                    </span>
                  )}
                  {r.skipped > 0 && (
                    <span>
                      <span className="text-loss">{r.skipped}</span> skipped
                    </span>
                  )}
                </div>
              )}

              {r.warnings.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-brass">
                  {r.warnings.map((w, wi) => (
                    <li key={wi}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
