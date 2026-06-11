import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { detectFormat } from "@/lib/importers/detect";
import { parseFidelityHistoryCsv } from "@/lib/importers/fidelity-history";
import { parseSchwabCsv } from "@/lib/importers/schwab";
import { parseThinkorswimStatement } from "@/lib/importers/thinkorswim";
import { parseFidelity1099Text } from "@/lib/importers/fidelity-1099";
import { extractPdfText } from "@/lib/importers/pdf";
import { ingest1099, ingestParseResult } from "@/lib/ingest/ingest";
import { rebuildDerived } from "@/lib/engine/rebuild";

/* ---- Account aliasing: mirrors scripts/import.ts exactly ---- */

const ACCOUNT_ALIASES: Record<string, string> = {
  Z093969382: "fidelity:Z09-396938",
  Z093969383: "fidelity:Z09-396938",
};

function accountIdFor(
  fileName: string,
  accountHint: string | null | undefined,
  source: string,
): {
  id: string;
  label: string;
  broker: string;
  book: "equity" | "options";
} {
  const fromName = fileName.match(/History_for_Account_([A-Z0-9]+)/i)?.[1];
  const rawId = (fromName ?? accountHint ?? "unknown").trim();
  if (source === "fidelity_history_csv") {
    const id = ACCOUNT_ALIASES[rawId] ?? `fidelity:${rawId}`;
    return { id, label: `Fidelity ${id.split(":")[1]}`, broker: "fidelity", book: "equity" };
  }
  if (source === "schwab_csv") {
    return { id: `schwab:${rawId}`, label: `Schwab ${rawId}`, broker: "schwab", book: "options" };
  }
  if (source === "thinkorswim_statement") {
    return {
      id: `thinkorswim:${rawId}`,
      label: `thinkorswim ${rawId}`,
      broker: "thinkorswim",
      book: "options",
    };
  }
  return { id: `unknown:${rawId}`, label: rawId, broker: "unknown", book: "equity" };
}

export interface FileSummary {
  fileName: string;
  format: string | null;
  imported: number;
  deduped: number;
  skipped: number;
  warnings: string[];
  error?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Could not parse multipart form data." }, { status: 400 });
  }

  const files = formData.getAll("files");
  if (files.length === 0) {
    return Response.json({ error: "No files uploaded." }, { status: 400 });
  }

  const db = getDb();
  const summaries: FileSummary[] = [];

  for (const entry of files) {
    if (!(entry instanceof File)) continue;
    const fileName = entry.name;

    try {
      const arrayBuf = await entry.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const isPdf = buf.subarray(0, 4).toString("ascii") === "%PDF";

      if (isPdf) {
        const text = await extractPdfText(buf);
        const parsed = parseFidelity1099Text(text);
        const summary = ingest1099({ db, fileName, fileContent: buf }, parsed);
        summaries.push({
          fileName,
          format: "fidelity_1099_pdf",
          imported: summary.lots + summary.dividends + summary.forms,
          deduped: summary.lotsDeduped + summary.dividendsDeduped,
          skipped: 0,
          warnings: summary.warnings,
        });
        continue;
      }

      const content = buf.toString("utf8");
      const format = detectFormat(content, fileName);

      if (!format || format === "fidelity_1099_pdf") {
        // fidelity_1099_pdf as text path
        if (format === "fidelity_1099_pdf") {
          const parsed = parseFidelity1099Text(content);
          const summary = ingest1099({ db, fileName, fileContent: buf }, parsed);
          summaries.push({
            fileName,
            format: "fidelity_1099_pdf",
            imported: summary.lots + summary.dividends + summary.forms,
            deduped: summary.lotsDeduped + summary.dividendsDeduped,
            skipped: 0,
            warnings: summary.warnings,
          });
          continue;
        }
        summaries.push({
          fileName,
          format: null,
          imported: 0,
          deduped: 0,
          skipped: 0,
          warnings: [],
          error: `Could not detect file format. First 120 chars: ${content.slice(0, 120).replace(/\n/g, "\\n")}`,
        });
        continue;
      }

      const result =
        format === "fidelity_history_csv"
          ? parseFidelityHistoryCsv(content)
          : format === "schwab_csv"
            ? parseSchwabCsv(content)
            : parseThinkorswimStatement(content);

      const acct = accountIdFor(fileName, result.accountHint, format);
      const summary = ingestParseResult(
        {
          db,
          fileName,
          fileContent: buf,
          accountId: acct.id,
          accountLabel: acct.label,
          broker: acct.broker,
          book: acct.book,
        },
        result,
      );

      summaries.push({
        fileName,
        format,
        imported: summary.imported,
        deduped: summary.deduped,
        skipped: summary.skipped,
        warnings: summary.warnings,
      });
    } catch (e) {
      summaries.push({
        fileName,
        format: null,
        imported: 0,
        deduped: 0,
        skipped: 0,
        warnings: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Rebuild derived state once after all files are processed
  try {
    rebuildDerived(db);
  } catch {
    // Non-fatal; files were ingested; let UI show partial success
  }

  return Response.json(summaries);
}
