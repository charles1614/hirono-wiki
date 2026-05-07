/**
 * `hirono raindrop diff <slug>` — diff two revisions of a slug.
 *
 * Resolves --from / --to to revisions in raw/<year>/<slug>/revisions.jsonl
 * (defaults: --from rev1, --to latest), reads the matching content files,
 * and prints:
 *   1. A structural-change summary (chars, headings, fences, status, kind)
 *   2. A unified text diff (via system `git diff --no-index`)
 *
 * Date form for --from / --to: `YYYY-MM-DD` matches the revision with the
 * latest fetched_at <= that date.
 *
 * Usage:
 *   hirono raindrop diff <slug>
 *   hirono raindrop diff <slug> --from rev1 --to rev3
 *   hirono raindrop diff <slug> --from 2026-04-01 --summary
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { rawDirFor } from "../../fetch-raw.ts";
import { readRevisions, backfillFromSource, type RevisionRow } from "../../shared/revisions.ts";

interface Options {
  slug: string;
  from?: string;     // "rev1" | "rev2" | "2026-04-01"
  to?: string;
  summary: boolean;
  noColor: boolean;
}

function parseArgs(argv: string[]): Options {
  const o: Options = { slug: "", summary: false, noColor: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from") o.from = argv[++i];
    else if (a === "--to") o.to = argv[++i];
    else if (a === "--summary") o.summary = true;
    else if (a === "--no-color") o.noColor = true;
    else if (a === "--help" || a === "-h") {
      console.log(`hirono raindrop diff <slug> [--from <rev|date>] [--to <rev|date>] [--summary] [--no-color]

Diff between two revisions of a slug. --from defaults to rev1 (oldest);
--to defaults to the latest revision. Date form (YYYY-MM-DD) selects the
revision with fetched_at closest to (and ≤) that date.

--summary  Print only the structural-change table; skip the unified diff.
--no-color Disable color in the unified diff (default: respect git config).`);
      process.exit(0);
    }
    else if (a.startsWith("--")) {
      console.error(`[diff] unknown flag: ${a}`);
      process.exit(2);
    }
    else positional.push(a);
  }
  if (positional.length !== 1) {
    console.error(`usage: hirono raindrop diff <slug> [--from <rev|date>] [--to <rev|date>] [--summary] [--no-color]`);
    process.exit(2);
  }
  o.slug = positional[0];
  return o;
}

function resolveRev(rows: RevisionRow[], spec: string | undefined, fallback: "first" | "last"): RevisionRow {
  if (rows.length === 0) throw new Error("no revisions");
  if (!spec) return fallback === "first" ? rows[0] : rows[rows.length - 1];

  const m = spec.match(/^rev(\d+)$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    const r = rows.find(x => x.rev === n);
    if (!r) throw new Error(`rev${n} not found in history (have rev1..rev${rows.length})`);
    return r;
  }

  // Date form: pick revision with latest fetched_at <= spec
  if (/^\d{4}-\d{2}-\d{2}/.test(spec)) {
    const cutoff = Date.parse(spec.length === 10 ? `${spec}T23:59:59Z` : spec);
    if (Number.isNaN(cutoff)) throw new Error(`bad date format: ${spec}`);
    const candidates = rows.filter(r => Date.parse(r.fetched_at) <= cutoff);
    if (candidates.length === 0) throw new Error(`no revision <= ${spec}`);
    return candidates[candidates.length - 1];
  }

  throw new Error(`unrecognized rev spec: ${spec} (use 'rev1' / 'revN' or 'YYYY-MM-DD')`);
}

interface StructuralCounts {
  chars: number;
  headings: number;
  fences: number;
  tables: number;
  images: number;
}

function countStructural(md: string): StructuralCounts {
  return {
    chars: md.length,
    headings: (md.match(/^#{1,6}\s/gm) || []).length,
    fences: (md.match(/^```/gm) || []).length,
    tables: (md.match(/^\|/gm) || []).length,
    images: (md.match(/!\[/g) || []).length,
  };
}

function deltaSign(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return "0";
}

function renderSummary(slug: string, from: RevisionRow, to: RevisionRow, fromMd: string, toMd: string): string {
  const a = countStructural(fromMd);
  const b = countStructural(toMd);
  const lines: string[] = [];
  lines.push(`# ${slug} — diff rev${from.rev} → rev${to.rev}`);
  lines.push("");
  lines.push(`${from.fetched_at.slice(0, 10)} → ${to.fetched_at.slice(0, 10)} ` +
             `(${ageDelta(from.fetched_at, to.fetched_at)})`);
  lines.push("");

  const regression = (from.quality_status === "good" && to.quality_status !== "good");
  if (regression) {
    lines.push(`⚠️  REGRESSION: rev${from.rev} was \`good\`, rev${to.rev} is \`${to.quality_status}\` ` +
               `(failure_kind=${to.failure_kind ?? "?"})`);
    lines.push("");
  }

  lines.push(`| field | rev${from.rev} | rev${to.rev} | Δ |`);
  lines.push(`|---|---:|---:|---:|`);
  lines.push(`| chars | ${a.chars} | ${b.chars} | ${deltaSign(b.chars - a.chars)} |`);
  lines.push(`| headings | ${a.headings} | ${b.headings} | ${deltaSign(b.headings - a.headings)} |`);
  lines.push(`| fences | ${a.fences} | ${b.fences} | ${deltaSign(b.fences - a.fences)} |`);
  lines.push(`| tables | ${a.tables} | ${b.tables} | ${deltaSign(b.tables - a.tables)} |`);
  lines.push(`| images | ${a.images} | ${b.images} | ${deltaSign(b.images - a.images)} |`);
  lines.push(`| quality_status | ${from.quality_status} | ${to.quality_status} | ${from.quality_status === to.quality_status ? "—" : "changed"} |`);
  lines.push(`| failure_kind | ${from.failure_kind ?? "?"} | ${to.failure_kind ?? "?"} | ${from.failure_kind === to.failure_kind ? "—" : "changed"} |`);
  lines.push(`| content_sha | \`${from.content_sha.slice(0, 12)}\` | \`${to.content_sha.slice(0, 12)}\` | ${from.content_sha === to.content_sha ? "—" : "changed"} |`);
  return lines.join("\n");
}

function ageDelta(fromIso: string, toIso: string): string {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "same day";
  if (days < 30) return `${days}d apart`;
  if (days < 365) return `${Math.round(days / 30)}mo apart`;
  return `${(days / 365).toFixed(1)}y apart`;
}

function unifiedDiff(fromPath: string, toPath: string, noColor: boolean): string {
  const args = ["diff", "--no-index", "--minimal"];
  if (noColor) args.push("--no-color");
  else args.push("--color=always");
  args.push(fromPath, toPath);
  const res = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  // git diff exits 1 when files differ, 0 when identical, >1 on error
  if (res.status !== 0 && res.status !== 1) {
    return `[diff] git diff failed: ${(res.stderr || "").slice(0, 200)}`;
  }
  return res.stdout || "(files are identical)";
}

export function main(argv: string[]): void {
  const opts = parseArgs(argv);
  const slugDir = rawDirFor(opts.slug);
  if (!existsSync(slugDir)) {
    console.error(`[diff] slug directory not found: ${slugDir}`);
    process.exit(2);
  }
  backfillFromSource(slugDir);
  const rows = readRevisions(slugDir);
  if (rows.length === 0) {
    console.error(`[diff] ${opts.slug}: no revisions on disk`);
    process.exit(2);
  }
  if (rows.length === 1 && !opts.from && !opts.to) {
    console.error(`[diff] ${opts.slug}: only rev1 exists; nothing to diff`);
    process.exit(2);
  }

  const from = resolveRev(rows, opts.from, "first");
  const to = resolveRev(rows, opts.to, "last");

  if (from.rev === to.rev) {
    console.error(`[diff] from and to resolved to the same revision (rev${from.rev})`);
    process.exit(2);
  }

  const fromPath = join(slugDir, from.content_file);
  const toPath = join(slugDir, to.content_file);
  if (!existsSync(fromPath)) {
    console.error(`[diff] ${fromPath} missing on disk (revisions.jsonl says it should be there)`);
    process.exit(2);
  }
  if (!existsSync(toPath)) {
    console.error(`[diff] ${toPath} missing on disk`);
    process.exit(2);
  }
  const fromMd = readFileSync(fromPath, "utf8");
  const toMd = readFileSync(toPath, "utf8");

  const summary = renderSummary(opts.slug, from, to, fromMd, toMd);
  process.stdout.write(summary + "\n");

  if (!opts.summary) {
    process.stdout.write("\n");
    process.stdout.write(unifiedDiff(fromPath, toPath, opts.noColor));
  }
}
