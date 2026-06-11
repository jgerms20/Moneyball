/**
 * Server-only PDF -> text step for the 1099 importer (pdf-parse v2).
 * Kept separate so the text parser stays pure and fixture-testable.
 */

import { PDFParse } from "pdf-parse";
import { parseFidelity1099Text } from "./fidelity-1099";
import type { Parsed1099 } from "../model/types";

export async function extractPdfText(data: Buffer | Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: data instanceof Uint8Array ? data : new Uint8Array(data) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function parseFidelity1099Pdf(data: Buffer | Uint8Array): Promise<Parsed1099> {
  const text = await extractPdfText(data);
  return parseFidelity1099Text(text);
}
