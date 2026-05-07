/**
 * `hirono raindrop history <slug>` — list all revisions of a slug from
 * `raw/<year>/<slug>/revisions.jsonl`.
 *
 * Backfill: when revisions.jsonl is missing but source.json exists,
 * synthesize rev 1 lazily so legacy slugs (pre-this-feature) just work.
 *
 * Usage:
 *   hirono raindrop history <slug> [--json]
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findRawDir } from "../../fetch-raw.ts";
import { readRevisions, backfillFromSource, type RevisionRow } from "../../shared/revisions.ts";

interface Options {
  slug: string;
  format: "md" | "json";
}

function parseArgs(argv: string[]): Options {
  const o: Options = { slug: "", format: "md" };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.format = "json";
    else if (a === "--md") o.format = "md";
    else if (a === "--help" || a === "-h") {
      console.log(`hirono raindrop history <slug> [--json]

List all revisions for a slug from raw/<year>/<slug>/revisions.jsonl.
Auto-backfills rev 1 from source.json for legacy slugs (pre-feature 3).`);
      process.exit(0);
    }
    else if (a.startsWith("--")) {
      console.error(`[history] unknown flag: ${a}`);
      process.exit(2);
    }
    else positional.push(a);
  }
  if (positional.length !== 1) {
    console.error(`usage: hirono raindrop history <slug> [--json]`);
    process.exit(2);
  }
  o.slug = positional[0];
  return o;
}

export function loadHistory(slug: string): RevisionRow[] {
  const slugDir = findRawDir(slug);
  if (!slugDir) {
    throw new Error(`slug directory not found under raw/raindrop/: ${slug}`);
  }
  // Lazy backfill — if revisions.jsonl missing but source.json present,
  // synthesize rev 1 from source.json.
  backfillFromSource(slugDir);
  return readRevisions(slugDir);
}

function renderMd(slug: string, rows: RevisionRow[]): string {
  if (rows.length === 0) {
    return `# ${slug}\n\nNo revision history (slug has neither revisions.jsonl nor source.json).\n`;
  }
  const lines: string[] = [];
  lines.push(`# ${slug} — revision history`);
  lines.push("");
  lines.push(`${rows.length} revision${rows.length === 1 ? "" : "s"}.`);
  lines.push("");
  lines.push(`| rev | fetched_at | content_file | content_sha | quality | failure_kind | size | imgs |`);
  lines.push(`|---|---|---|---|---|---|---:|---:|`);
  for (const r of rows) {
    lines.push(
      `| ${r.rev} | ${r.fetched_at.slice(0, 19).replace("T", " ")} | ${r.content_file} | ` +
      `\`${r.content_sha.slice(0, 12)}\` | ${r.quality_status} | ${r.failure_kind ?? "—"} | ` +
      `${r.content_length} | ${r.image_count} |`
    );
  }
  return lines.join("\n");
}

export function main(argv: string[]): void {
  const opts = parseArgs(argv);
  const rows = loadHistory(opts.slug);
  const out = opts.format === "json"
    ? JSON.stringify(rows, null, 2)
    : renderMd(opts.slug, rows);
  process.stdout.write(out + "\n");
}
