/**
 * epoch.ai converter — composes a §2-contract markdown body from
 * (1) the page's prose intro (HTML) and (2) the underlying CSV dataset.
 *
 * The page is a JS-driven interactive viz; the actual data lives in
 * a downloadable CSV. We embed the top N rows of the CSV as a markdown
 * table and link to the full file for completeness.
 */

import { JSDOM } from "jsdom";
import TurndownService from "turndown";
// @ts-expect-error  no types
import { gfm } from "@joplin/turndown-plugin-gfm";

export interface EpochAiConvertResult {
  /** Body markdown (caller composes §2 frontmatter). */
  body: string;
  stats: {
    introChars: number;
    csvRows: number;
    csvCols: number;
    embeddedRows: number;
  };
}

export interface EpochAiConvertOpts {
  introHtml: string;
  csvUrl: string;
  csvText: string;
  url: string;
  /** Max rows to embed in the body markdown table. Default 30. */
  maxRows?: number;
}

const PRIMARY_COLUMNS_DEFAULT: ReadonlyArray<string> = [
  "Hardware name",
  "Manufacturer",
  "Type",
  "Release date",
  "Tensor-FP16/BF16 performance (FLOP/s)",
  "FP8 performance (FLOP/s)",
  "Memory (bytes)",
  "Memory bandwidth (byte/s)",
  "TDP (W)",
];

export function convertEpochAiContent(opts: EpochAiConvertOpts): EpochAiConvertResult {
  const maxRows = opts.maxRows ?? 30;

  // 1. Convert the intro HTML via jsdom + turndown.
  let introMd = "";
  if (opts.introHtml) {
    const dom = new JSDOM(`<!doctype html><html><body>${opts.introHtml}</body></html>`);
    const td = makeTurndown();
    introMd = td.turndown(dom.window.document.body.innerHTML).trim();
  }

  // 2. Parse CSV.
  const rows = parseCsv(opts.csvText);
  if (rows.length === 0) {
    return {
      body:
        introMd +
        "\n\n*Source CSV unavailable — see [original page](" + opts.url + ") for the live visualization.*\n",
      stats: { introChars: introMd.length, csvRows: 0, csvCols: 0, embeddedRows: 0 },
    };
  }

  const header = rows[0];
  const dataRows = rows.slice(1);

  // 3. Pick a subset of "primary" columns when the CSV is wide
  // (otherwise the markdown table becomes unreadable). For CSVs with
  // ≤ 8 columns, keep them all.
  const colIndices: number[] = [];
  if (header.length <= 8) {
    for (let i = 0; i < header.length; i++) colIndices.push(i);
  } else {
    for (const want of PRIMARY_COLUMNS_DEFAULT) {
      const i = header.findIndex((h) => h.trim().toLowerCase() === want.trim().toLowerCase());
      if (i >= 0) colIndices.push(i);
    }
    if (colIndices.length === 0) {
      // Fallback: first 8 columns.
      for (let i = 0; i < Math.min(8, header.length); i++) colIndices.push(i);
    }
  }

  const projHeader = colIndices.map((i) => header[i] || "");
  const projRows = dataRows.slice(0, maxRows).map((r) => colIndices.map((i) => formatCell(r[i] || "")));

  // 4. Build markdown table.
  const tableLines: string[] = [];
  tableLines.push("| " + projHeader.map(escCell).join(" | ") + " |");
  tableLines.push("| " + projHeader.map(() => "---").join(" | ") + " |");
  for (const r of projRows) tableLines.push("| " + r.map(escCell).join(" | ") + " |");

  // 5. Compose body.
  const parts: string[] = [];
  if (introMd) parts.push(introMd);
  parts.push("");
  parts.push("## Dataset (top " + projRows.length + " of " + dataRows.length + " rows)");
  parts.push("");
  if (header.length > colIndices.length) {
    parts.push(
      `*Showing ${colIndices.length} of ${header.length} columns. ` +
      `Full CSV (${header.length} columns × ${dataRows.length} rows): [${opts.csvUrl}](${opts.csvUrl}).*`,
    );
  } else {
    parts.push(`*Full CSV: [${opts.csvUrl}](${opts.csvUrl}).*`);
  }
  parts.push("");
  parts.push(...tableLines);
  parts.push("");

  const body = parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  return {
    body,
    stats: {
      introChars: introMd.length,
      csvRows: dataRows.length,
      csvCols: header.length,
      embeddedRows: projRows.length,
    },
  };
}

function makeTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  td.use(gfm);
  return td;
}

/**
 * Minimal CSV parser. Handles quoted fields with embedded commas, double-quote
 * escaping inside quoted fields (`""` → `"`), and CRLF line endings.
 * Sufficient for epoch.ai's CSVs (well-formed Python `csv.writer` output).
 */
export function parseCsv(text: string): string[][] {
  if (!text) return [];
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuoted = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuoted = true; i++; continue; }
    if (c === ",") { cur.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") {
      cur.push(field); field = "";
      if (cur.length > 0 && cur.some((f) => f.length > 0)) rows.push(cur);
      cur = [];
      i++; continue;
    }
    field += c; i++;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    if (cur.some((f) => f.length > 0)) rows.push(cur);
  }
  return rows;
}

function escCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function formatCell(s: string): string {
  // Floats with > 9-digit integer parts (e.g. `600000000000000.0`) render as
  // 6.0e14 to keep cells readable. Plain integers and short floats pass through.
  const trimmed = s.trim();
  if (!trimmed) return "—";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (Math.abs(n) >= 1e9) return n.toExponential(2);
  if (Number.isInteger(n)) return String(n);
  return trimmed;
}
