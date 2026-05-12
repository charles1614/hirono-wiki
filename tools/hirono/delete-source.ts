/**
 * `hirono delete-source <slug>` — atomic Source deletion (accident cleanup).
 *
 * NOT a default path. Karpathy's wiki ingests every URL in raw/; the
 * operator's curation gate is at the Raindrop-bookmark level. This CLI
 * exists for the rare case when a Source was written by mistake and the
 * operator wants to undo it cleanly.
 *
 * Atomic operations (via applyAtomically):
 *   1. Delete `Sources/<year>/<slug>.md`.
 *   2. Delete `raw/raindrop/<host>/<slug>/` directory (unless --keep-raw).
 *   3. Append a refactor log entry.
 *
 * Refuses if the Source is wikilinked from any Entity/Topic Observation
 * (would create dangling wikilinks). `--force` overrides — operator must
 * be sure the dangling refs are acceptable (rare, but valid when the
 * operator is also removing the citing entity).
 *
 * Note: `.wiki-sources-index.json` is regenerated mechanically by
 * `tools/bin/build-sources-index.ts`; we don't try to surgically edit it.
 * The CLI prints the next-step command in the success message.
 */

import { existsSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAtomically,
  appendLogEntry,
  cleanupStaging,
  reverseCitationIndex,
  type PendingOp,
} from "../curation.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  slug: string;
  keepRaw: boolean;
  force: boolean;
  reason: string;
}

function usage(): never {
  console.error(`usage: hirono delete-source <slug> [--keep-raw] [--force] [--reason "<text>"]

Atomically delete a Source + raw archive (accident cleanup, NOT default).

Flags:
  --keep-raw       Preserve the raw archive directory (delete only the
                   Sources/<year>/<slug>.md summary). Use when you want
                   to re-write the Source from the same raw content.
  --force          Override the dangling-wikilink refusal.
  --reason "..."   Human-readable reason; embedded in the log entry.

Examples:
  hirono delete-source 2026-04-23-hsbc-banking-advice --reason "Bookmarked by mistake"
  hirono delete-source 2026-04-23-foo --keep-raw --reason "Re-summarize from raw"
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let keepRaw = false;
  let force = false;
  let reason = "";
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep-raw") keepRaw = true;
    else if (a === "--force") force = true;
    else if (a === "--reason" || a === "-r") { i++; reason = (argv[i] ?? "").trim(); }
    else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("-")) { console.error(`unknown flag: ${a}`); usage(); }
    else positional.push(a);
  }
  if (positional.length !== 1) usage();
  return { slug: positional[0], keepRaw, force, reason };
}

function findSourcePath(repoRoot: string, slug: string): string | null {
  const sourcesDir = join(repoRoot, "Sources");
  if (!existsSync(sourcesDir)) return null;
  for (const year of readdirSync(sourcesDir)) {
    if (!/^\d{4}$/.test(year)) continue;
    const p = `Sources/${year}/${slug}.md`;
    if (existsSync(join(repoRoot, p))) return p;
  }
  return null;
}

function findRawDir(repoRoot: string, slug: string): string | null {
  const rawRoot = join(repoRoot, "raw", "raindrop");
  if (!existsSync(rawRoot)) return null;
  for (const host of readdirSync(rawRoot)) {
    if (host.startsWith(".") || host.startsWith("_")) continue;
    const p = `raw/raindrop/${host}/${slug}`;
    if (existsSync(join(repoRoot, p))) return p;
  }
  return null;
}

export interface DeleteSourceResult {
  sourcePath: string;
  rawDirPath: string | null;
  rawDeleted: boolean;
  citers: { source_path: string; line: number }[];
  opId: string;
}

export function deleteSource(
  repoRoot: string,
  slug: string,
  opts: { keepRaw?: boolean; force?: boolean; reason?: string } = {},
): DeleteSourceResult {
  const sourcePath = findSourcePath(repoRoot, slug);
  if (!sourcePath) throw new Error(`Source not found: ${slug}`);

  // Refuse if any Entity/Topic wikilinks this Source (dangling-refs guard)
  const citations = reverseCitationIndex(repoRoot);
  const citers = citations.get(slug) ?? [];
  const externalCiters = citers
    .filter(c => c.source_path !== sourcePath)
    .map(c => ({ source_path: c.source_path, line: c.line }));
  if (externalCiters.length > 0 && !opts.force) {
    const lines = externalCiters.slice(0, 5).map(c => `  - ${c.source_path}:${c.line}`).join("\n");
    throw new Error(`Source [[${slug}]] is cited by ${externalCiters.length} page(s):\n${lines}\n${externalCiters.length > 5 ? `  ...and ${externalCiters.length - 5} more.\n` : ""}Refusing to delete; pass --force to override (creates dangling wikilinks).`);
  }

  const rawDir = findRawDir(repoRoot, slug);

  // Atomic phase: delete Source.md only (raw dir is non-atomic — deleted after)
  const ops: PendingOp[] = [{ kind: "delete", path: sourcePath }];
  const opId = `delete-source-${slug.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;
  applyAtomically(repoRoot, opId, ops);

  // Non-atomic: delete raw archive directory
  let rawDeleted = false;
  if (rawDir && !opts.keepRaw) {
    try {
      rmSync(join(repoRoot, rawDir), { recursive: true, force: true });
      rawDeleted = true;
    } catch (e) {
      console.error(`[delete-source] warning: raw archive deletion failed (${(e as Error).message}); Source.md was deleted but raw remains`);
    }
  }

  // Log entry
  const bodyLines = [
    `Deleted Source [[${slug}]] (${sourcePath}).`,
    rawDir ? (rawDeleted ? `Raw archive removed: ${rawDir}` : (opts.keepRaw ? `Raw archive preserved (--keep-raw): ${rawDir}` : `Raw archive deletion FAILED, remains at ${rawDir}`)) : `No raw archive found.`,
    externalCiters.length > 0 ? `⚠ ${externalCiters.length} dangling wikilink(s) created (--force used).` : `No dangling wikilinks.`,
    opts.reason ? `Reason: ${opts.reason}` : `Reason: not specified.`,
    `Next: run \`npx tsx tools/bin/build-sources-index.ts\` to refresh the URL→slug index.`,
  ];
  appendLogEntry(repoRoot, "refactor", `Delete Source [[${slug}]]`, bodyLines);
  cleanupStaging(repoRoot, opId);

  return { sourcePath, rawDirPath: rawDir, rawDeleted, citers: externalCiters, opId };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = deleteSource(REPO_ROOT_DEFAULT, args.slug, {
      keepRaw: args.keepRaw, force: args.force, reason: args.reason,
    });
    console.log(`✓ deleted Source: ${r.sourcePath}`);
    if (r.rawDirPath) {
      if (r.rawDeleted) console.log(`✓ deleted raw archive: ${r.rawDirPath}`);
      else console.log(`◦ preserved raw archive: ${r.rawDirPath}`);
    }
    if (r.citers.length > 0) {
      console.log(`⚠ ${r.citers.length} dangling wikilink(s) created (use --force was passed):`);
      for (const c of r.citers.slice(0, 10)) console.log(`    ${c.source_path}:${c.line}`);
    }
    console.log(`\nNext: \`npx tsx tools/bin/build-sources-index.ts\` to refresh URL→slug index.`);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
