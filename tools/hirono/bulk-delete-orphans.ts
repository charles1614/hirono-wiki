/**
 * `hirono bulk-delete-orphans` — list (default) or delete `_seen/` entities
 * at refs=0.
 *
 * Default behavior (no flags): print the orphan list to stdout, exit 0.
 * `--confirm <slug1,slug2,...>`: delete exactly those slugs (re-validates
 *   refs=0 at apply time to guard against races).
 * `--all-zero`: delete every `_seen/` orphan with refs=0 (use after review).
 * `--dry-run`: with `--confirm` or `--all-zero`, prints what would happen.
 *
 * Only deletes from `02_Entities/_seen/`. Never active-tier entities, never
 * Topics, never Sources. Emits a refactor log entry summarizing the
 * deletion.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { appendLogEntry, applyAtomically, cleanupStaging, type PendingOp } from "../curation.ts";
import { walkWikiDocs } from "../link-map.ts";
import { extractWikilinks } from "../bin/reindex.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  confirm: string[] | null;
  allZero: boolean;
  dryRun: boolean;
}

function usage(): never {
  console.error(`usage: hirono bulk-delete-orphans [--confirm slug1,slug2,...] [--all-zero] [--dry-run]

Default (no flags): list _seen/ entities at refs=0; exit 0.

Flags:
  --confirm <slugs>   Delete exactly the named slugs (comma-separated).
                      Re-validates refs=0 at apply time.
  --all-zero          Delete every _seen/ entity with refs=0. Use after review.
  --dry-run           With --confirm or --all-zero, print plan; do nothing.

Safety:
  - Only deletes files in Entities/_seen/. Never active-tier entities,
    never Topics, never Sources.
  - Emits a refactor entry to 00_Meta/log-YYYY.md listing the deleted slugs.
  - After successful delete, run \`npx tsx tools/bin/reindex.ts\` to refresh indexes.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let confirm: string[] | null = null;
  let allZero = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--confirm") {
      i++;
      confirm = (argv[i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a === "--all-zero") {
      allZero = true;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      usage();
    } else if (a.startsWith("-")) {
      console.error(`unknown flag: ${a}`); usage();
    } else {
      console.error(`unexpected positional: ${a}`); usage();
    }
  }
  return { confirm, allZero, dryRun };
}

/** Compute orphans: _seen/ entities with refs=0. */
export function computeOrphans(repoRoot: string): { slug: string; path: string }[] {
  const paths = walkWikiDocs(repoRoot);
  // Build refs map (citations FROM non-Meta pages TO any slug)
  const refs = new Map<string, number>();
  for (const repoPath of paths) {
    if (repoPath.startsWith("00_Meta/")) continue;
    let raw: string;
    try { raw = readFileSync(join(repoRoot, repoPath), "utf8"); } catch { continue; }
    const { content } = matter(raw);
    const selfSlug = repoPath.split("/").pop()!.replace(/\.md$/, "");
    for (const target of extractWikilinks(content)) {
      if (target === selfSlug) continue;
      refs.set(target, (refs.get(target) ?? 0) + 1);
    }
  }
  // Walk _seen/ entities, return those with refs=0 (or not in refs map at all)
  const seenDir = join(repoRoot, "02_Entities", "_seen");
  if (!existsSync(seenDir)) return [];
  const out: { slug: string; path: string }[] = [];
  for (const entry of readdirSync(seenDir)) {
    if (!entry.endsWith(".md")) continue;
    const slug = entry.slice(0, -3);
    const count = refs.get(slug) ?? 0;
    if (count === 0) out.push({ slug, path: `02_Entities/_seen/${entry}` });
  }
  return out;
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  const repoRoot = REPO_ROOT_DEFAULT;

  const orphans = computeOrphans(repoRoot);

  // List mode: no --confirm and no --all-zero
  if (!args.confirm && !args.allZero) {
    if (orphans.length === 0) {
      console.log("No _seen/ orphans (refs=0). Nothing to do.");
      return;
    }
    console.log(`Found ${orphans.length} _seen/ entities with refs=0:`);
    for (const o of orphans) {
      console.log(`  ${o.slug}  (${o.path})`);
    }
    console.log("\nTo delete a subset:");
    console.log(`  hirono bulk-delete-orphans --confirm ${orphans.slice(0, 3).map(o => o.slug).join(",")}`);
    console.log("\nTo delete all:");
    console.log(`  hirono bulk-delete-orphans --all-zero`);
    console.log("\nUse --dry-run first to preview.");
    return;
  }

  // Determine deletion set
  let toDelete: { slug: string; path: string }[];
  if (args.allZero) {
    toDelete = orphans;
  } else {
    const requested = new Set(args.confirm!);
    toDelete = orphans.filter((o) => requested.has(o.slug));
    // Warn on requested-but-not-orphan
    const notFound = [...requested].filter((s) => !toDelete.find((o) => o.slug === s));
    if (notFound.length > 0) {
      console.error(`warning: not deleting (not in _seen/ orphan list): ${notFound.join(", ")}`);
    }
  }

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (args.dryRun) {
    console.log(`[dry-run] would delete ${toDelete.length} files:`);
    for (const o of toDelete) console.log(`  ${o.path}`);
    return;
  }

  const opId = `delete-orphans-${Date.now()}`;
  const ops: PendingOp[] = toDelete.map((o) => ({ kind: "delete", path: o.path }));
  applyAtomically(repoRoot, opId, ops);

  appendLogEntry(repoRoot, "refactor", `Delete ${toDelete.length} _seen/ orphan entities`, [
    `Deleted slugs (refs=0): ${toDelete.map(o => `\`${o.slug}\``).join(", ")}.`,
    `Run \`npx tsx tools/bin/reindex.ts\` to refresh 00_Meta/index*.md.`,
  ]);

  cleanupStaging(repoRoot, opId);

  console.log(`✓ deleted ${toDelete.length} _seen/ orphan entities`);
  for (const o of toDelete) console.log(`  ✓ ${o.path}`);
  console.log(`✓ refactor log entry appended to 00_Meta/log-${new Date().getFullYear()}.md`);
  console.log(`\nNext: run \`npx tsx tools/bin/reindex.ts\` to refresh indexes.`);
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
