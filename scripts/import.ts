/**
 * CLI importer: npm run import -- <files...>
 * Autodetects format, ingests, rebuilds derived state, prints a summary.
 */

import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db/client";
import { detectFormat } from "../src/lib/importers/detect";
import { parseFidelityHistoryCsv } from "../src/lib/importers/fidelity-history";
import { parseSchwabCsv } from "../src/lib/importers/schwab";
import { parseThinkorswimStatement } from "../src/lib/importers/thinkorswim";
import { parseFidelity1099Text } from "../src/lib/importers/fidelity-1099";
import { extractPdfText } from "../src/lib/importers/pdf";
import { ingest1099, ingestParseResult } from "../src/lib/ingest/ingest";
import { rebuildDerived } from "../src/lib/engine/rebuild";
import { loadBundledMarketData } from "../src/lib/market/market";

/**
 * Account aliasing: Fidelity History exports are named for slightly different
 * account ids across export sessions even for the same account. Map both of
 * the user's known export ids onto the 1099's account number.
 */
const ACCOUNT_ALIASES: Record<string, string> = {
  Z093969382: "fidelity:Z09-396938",
  Z093969383: "fidelity:Z09-396938",
};

function accountIdFor(fileName: string, accountHint: string | null | undefined, source: string): {
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
    return { id: `thinkorswim:${rawId}`, label: `thinkorswim ${rawId}`, broker: "thinkorswim", book: "options" };
  }
  return { id: `unknown:${rawId}`, label: rawId, broker: "unknown", book: "equity" };
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: npm run import -- <file.csv|file.pdf> [...more]");
    process.exit(1);
  }
  const db = getDb();
  loadBundledMarketData(db);

  for (const file of files) {
    const name = path.basename(file);
    const buf = fs.readFileSync(file);
    const isPdf = buf.subarray(0, 4).toString() === "%PDF";
    const content = isPdf ? "" : buf.toString("utf8");
    const format = isPdf ? "fidelity_1099_pdf" : detectFormat(content, name);
    console.log(`\n=== ${name} -> ${format ?? "UNKNOWN FORMAT"}`);
    if (!format) {
      console.log("  ! Could not detect format; skipping. (First 120 chars:)");
      console.log("  " + content.slice(0, 120).replace(/\n/g, "\\n"));
      continue;
    }

    if (format === "fidelity_1099_pdf") {
      const text = isPdf ? await extractPdfText(buf) : content;
      const parsed = parseFidelity1099Text(text);
      const summary = ingest1099({ db, fileName: name, fileContent: buf }, parsed);
      console.log(
        `  year=${parsed.year} account=${parsed.accountNo} lots=${summary.lots} (+${summary.lotsDeduped} deduped) dividends=${summary.dividends} (+${summary.dividendsDeduped} deduped) forms=${summary.forms}`,
      );
      for (const w of summary.warnings) console.log(`  ⚠ ${w}`);
      continue;
    }

    const result =
      format === "fidelity_history_csv"
        ? parseFidelityHistoryCsv(content)
        : format === "schwab_csv"
          ? parseSchwabCsv(content)
          : parseThinkorswimStatement(content);

    const acct = accountIdFor(name, result.accountHint, format);
    const summary = ingestParseResult(
      {
        db, fileName: name, fileContent: buf, accountId: acct.id,
        accountLabel: acct.label, broker: acct.broker, book: acct.book,
      },
      result,
    );
    console.log(
      `  account=${acct.id} imported=${summary.imported} deduped=${summary.deduped} skipped=${summary.skipped}${summary.alreadyImportedFile ? " (file already imported)" : ""}`,
    );
    for (const w of summary.warnings) console.log(`  ⚠ ${w}`);
  }

  const rebuilt = rebuildDerived(db);
  console.log(
    `\nDerived state: ${rebuilt.openLots} open lots, ${rebuilt.closures} closures, ${rebuilt.optionPositions} option positions across ${rebuilt.accounts} accounts.`,
  );
  const show = rebuilt.warnings.slice(0, 12);
  for (const w of show) console.log(`  ⚠ ${w}`);
  if (rebuilt.warnings.length > show.length) {
    console.log(`  ... and ${rebuilt.warnings.length - show.length} more warnings`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
