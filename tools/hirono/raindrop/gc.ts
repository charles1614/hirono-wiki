/**
 * `hirono raindrop gc` — garbage-collect old revisions of raw content.
 *
 * Walks `raw/raindrop/<host>/<slug>/`; for each slug, finds
 * `content-rev<N>.md` files and deletes all but the most recent N
 * (default: 3). The current `content.md` and `revisions.jsonl` are
 * NEVER touched — only the old `content-rev*.md` snapshots.
 *
 * Updates `revisions.jsonl` to mark removed revs as `body_pruned: true`
 * so the audit trail records what was GC'd even after files are gone.
 *
 * Append-only logging stays the default; GC is opt-in.
 */

import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..", "..");

interface ParsedArgs {
  keepLast: number;
  slug: string | null;
  dryRun: boolean;
}

function usage(): never {
  console.error(`usage: hirono raindrop gc [--keep-last N] [--slug <slug>] [--dry-run]

Garbage-collect old content-rev<N>.md files in raw archives.

Flags:
  --keep-last N    Keep the most recent N revisions (default: 3).
  --slug <slug>    Limit GC to one specific slug.
  --dry-run        Print what would be deleted; don't actually delete.

Examples:
  hirono raindrop gc --dry-run
  hirono raindrop gc --keep-last 1
  hirono raindrop gc --slug 2026-02-28-deepwiki-slime-02-distributed-orchestrat

The current content.md and revisions.jsonl are never deleted — only the
old content-rev<N>.md snapshots. revisions.jsonl is updated to mark
removed revs with body_pruned=true so the audit trail records the GC.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let keepLast = 3;
  let slug: string | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep-last") {
      i++;
      const n = parseInt(argv[i] ?? "", 10);
      if (!isFinite(n) || n < 0) { console.error("--keep-last requires a non-negative integer"); usage(); }
      keepLast = n;
    } else if (a === "--slug") { i++; slug = (argv[i] ?? "").trim() || null; }
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  return { keepLast, slug, dryRun };
}

interface GcAction {
  slug: string;
  rawDir: string;
  toDelete: string[];   // file basenames (e.g. "content-rev2.md")
  kept: string[];
}

function listRevFiles(rawDir: string): { rev: number; name: string }[] {
  const out: { rev: number; name: string }[] = [];
  try {
    for (const f of readdirSync(rawDir)) {
      const m = f.match(/^content-rev(\d+)\.md$/);
      if (m) out.push({ rev: parseInt(m[1], 10), name: f });
    }
  } catch { /* dir missing */ }
  return out.sort((a, b) => a.rev - b.rev);
}

export function planGc(repoRoot: string, opts: { keepLast: number; slugFilter?: string | null }): GcAction[] {
  const rawRoot = join(repoRoot, "raw", "raindrop");
  const actions: GcAction[] = [];
  if (!existsSync(rawRoot)) return actions;
  for (const host of readdirSync(rawRoot)) {
    if (host.startsWith(".") || host.startsWith("_")) continue;
    const hostDir = join(rawRoot, host);
    let entries: string[];
    try { entries = readdirSync(hostDir); } catch { continue; }
    for (const slug of entries) {
      if (opts.slugFilter && slug !== opts.slugFilter) continue;
      const rawDir = join(hostDir, slug);
      try { if (!statSync(rawDir).isDirectory()) continue; } catch { continue; }
      const revs = listRevFiles(rawDir);
      if (revs.length <= opts.keepLast) continue;
      const toDelete = revs.slice(0, revs.length - opts.keepLast).map(r => r.name);
      const kept = revs.slice(revs.length - opts.keepLast).map(r => r.name);
      actions.push({ slug, rawDir: rawDir.slice(repoRoot.length + 1), toDelete, kept });
    }
  }
  return actions;
}

function markRevisionsPruned(rawDirAbs: string, deletedRevs: number[]): void {
  const revPath = join(rawDirAbs, "revisions.jsonl");
  if (!existsSync(revPath)) return;
  const lines = readFileSync(revPath, "utf8").split("\n");
  const updated: string[] = [];
  const prunedSet = new Set(deletedRevs);
  for (const line of lines) {
    if (!line.trim()) { updated.push(line); continue; }
    try {
      const obj = JSON.parse(line);
      if (typeof obj.rev === "number" && prunedSet.has(obj.rev)) {
        obj.body_pruned = true;
      }
      updated.push(JSON.stringify(obj));
    } catch {
      updated.push(line);
    }
  }
  writeFileSync(revPath, updated.join("\n"), "utf8");
}

export function applyGc(repoRoot: string, actions: GcAction[]): { deletedCount: number; deletedBytes: number } {
  let deletedCount = 0;
  let deletedBytes = 0;
  for (const a of actions) {
    const rawDirAbs = join(repoRoot, a.rawDir);
    const deletedRevs: number[] = [];
    for (const name of a.toDelete) {
      const filePath = join(rawDirAbs, name);
      try {
        const sz = statSync(filePath).size;
        rmSync(filePath);
        deletedCount++;
        deletedBytes += sz;
        const m = name.match(/^content-rev(\d+)\.md$/);
        if (m) deletedRevs.push(parseInt(m[1], 10));
      } catch (e) {
        console.error(`[gc] warning: failed to delete ${filePath}: ${(e as Error).message}`);
      }
    }
    if (deletedRevs.length > 0) markRevisionsPruned(rawDirAbs, deletedRevs);
  }
  return { deletedCount, deletedBytes };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  const actions = planGc(REPO_ROOT_DEFAULT, { keepLast: args.keepLast, slugFilter: args.slug });
  if (actions.length === 0) {
    console.log(`✓ nothing to GC (no slugs have more than ${args.keepLast} content-rev files).`);
    return;
  }
  const totalDeletes = actions.reduce((n, a) => n + a.toDelete.length, 0);
  console.log(`# GC plan: ${actions.length} slug(s), ${totalDeletes} file(s) to delete (keep-last=${args.keepLast})\n`);
  for (const a of actions.slice(0, 20)) {
    console.log(`- ${a.slug}`);
    console.log(`    keep:   ${a.kept.join(", ")}`);
    console.log(`    delete: ${a.toDelete.join(", ")}`);
  }
  if (actions.length > 20) console.log(`  ...and ${actions.length - 20} more.`);
  if (args.dryRun) { console.log(`\n(dry-run — no files deleted.)`); return; }
  const r = applyGc(REPO_ROOT_DEFAULT, actions);
  const kb = Math.round(r.deletedBytes / 1024);
  console.log(`\n✓ deleted ${r.deletedCount} content-rev file(s), reclaimed ~${kb}KB.`);
  console.log(`✓ revisions.jsonl updated with body_pruned=true markers.`);
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
