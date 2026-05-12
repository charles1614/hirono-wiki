/**
 * `hirono rename-entity <OldName> <NewName>` — atomic entity rename.
 *
 * Moves Entities/[_seen/]<Old>.md → Entities/[_seen/]<New>.md (preserves tier),
 * rewrites the body's H1 heading, and rewrites every `[[OldName]]` (and
 * `[[OldName|alias]]`) reference across the corpus to `[[NewName]]`.
 *
 * Operations are applied atomically via two-phase commit (`tools/curation.ts`).
 * On any failure mid-apply, the staging dir holds the rollback snapshots.
 *
 * After applying, a refactor entry is prepended to Meta/log-YYYY.md.
 * Operator should run `npx tsx tools/bin/reindex.ts` afterward to refresh
 * Meta/index*.md and entity `updated:` dates.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAtomically,
  appendLogEntry,
  cleanupStaging,
  type PendingOp,
  reverseCitationIndex,
  rewriteWikilinksInBody,
} from "../curation.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  oldName: string;
  newName: string;
  reason: string;
  dryRun: boolean;
}

function usage(): never {
  console.error(`usage: hirono rename-entity <OldName> <NewName> [--reason "<text>"] [--dry-run]

Atomically rename an entity:
  - Moves Entities/[_seen/]<OldName>.md → Entities/[_seen/]<NewName>.md
  - Rewrites the body's H1 heading
  - Rewrites all [[OldName]] (and [[OldName|alias]]) references corpus-wide
  - Appends a refactor entry to Meta/log-YYYY.md

Examples:
  hirono rename-entity "Tile IR" "CUDA Tile IR" --reason "Consolidate three-name fragment"
  hirono rename-entity FlashAttention-3 FlashAttention3 --dry-run

Notes:
  - Names with spaces must be quoted.
  - Target name must not already exist.
  - After successful rename, run \`npx tsx tools/bin/reindex.ts\` to refresh indexes.
  - Staging dir at .curation-staging/<op-id>/ (gitignored) holds rollback snapshots.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  let reason = "";
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--reason" || a === "-r") {
      i++;
      reason = (argv[i] ?? "").trim();
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      usage();
    } else if (a.startsWith("-")) {
      console.error(`unknown flag: ${a}`);
      usage();
    } else {
      positional.push(a);
    }
  }
  if (positional.length !== 2) usage();
  return { oldName: positional[0], newName: positional[1], reason, dryRun };
}

function findEntityFile(repoRoot: string, name: string): { path: string; tier: "active" | "seen" } | null {
  const active = join(repoRoot, "Entities", `${name}.md`);
  if (existsSync(active)) return { path: `Entities/${name}.md`, tier: "active" };
  const seen = join(repoRoot, "Entities", "_seen", `${name}.md`);
  if (existsSync(seen)) return { path: `Entities/_seen/${name}.md`, tier: "seen" };
  return null;
}

function validateName(name: string): void {
  if (!name) throw new Error("name cannot be empty");
  if (name.startsWith(".") || name.startsWith("_")) throw new Error(`name cannot start with . or _: ${name}`);
  if (name.includes("/") || name.includes("\\")) throw new Error(`name cannot contain path separators: ${name}`);
  if (/[\x00-\x1f\x7f]/.test(name)) throw new Error(`name cannot contain control characters: ${name}`);
}

export interface RenameResult {
  oldPath: string;
  newPath: string;
  citingPagesTouched: number;
  totalLinkRewrites: number;
  opId: string;
  stagingDir: string;
  logEntryAppended: boolean;
}

/**
 * Programmatic entry. Pure-ish: writes files via applyAtomically;
 * returns a structured result describing what changed.
 */
export function renameEntity(
  repoRoot: string,
  oldName: string,
  newName: string,
  opts: { reason?: string; dryRun?: boolean } = {},
): RenameResult {
  validateName(oldName);
  validateName(newName);
  if (oldName === newName) throw new Error("OldName and NewName are identical; nothing to do");

  // Resolve source entity
  const src = findEntityFile(repoRoot, oldName);
  if (!src) throw new Error(`entity not found: Entities/${oldName}.md or Entities/_seen/${oldName}.md`);

  // Refuse if target name collides
  const tgt = findEntityFile(repoRoot, newName);
  if (tgt) throw new Error(`target name already exists: ${tgt.path}`);

  // Resolve target path (preserve tier)
  const newPath = src.tier === "active"
    ? `Entities/${newName}.md`
    : `Entities/_seen/${newName}.md`;

  // Read source body; rewrite H1 inside it (best-effort — only rewrites
  // the first `# OldName` line on a typical schema-conformant page).
  const oldFileAbs = join(repoRoot, src.path);
  const oldFileRaw = readFileSync(oldFileAbs, "utf8");
  // Match `# <OldName>` as a standalone heading line (preserves trailing context if any)
  const newFileRaw = oldFileRaw.replace(
    new RegExp(`^# ${oldName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "m"),
    `# ${newName}`,
  );

  // Build the reverse-citation index → who cites [[oldName]]?
  const citations = reverseCitationIndex(repoRoot);
  const refs = citations.get(oldName) ?? [];
  // Group by citing-page path
  const citingPaths = new Set<string>();
  for (const r of refs) citingPaths.add(r.source_path);
  // Exclude the source file itself from rewrites (we handle it via rename + H1 rewrite)
  citingPaths.delete(src.path);

  // Build the wikilink-rewrite mapping
  const mapping = new Map([[oldName, newName]]);

  // Compute rewritten bodies for each citing page
  const writes: PendingOp[] = [];
  let totalLinkRewrites = 0;
  for (const citingPath of citingPaths) {
    const abs = join(repoRoot, citingPath);
    const raw = readFileSync(abs, "utf8");
    // Split frontmatter from body to rewrite only the body
    const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
    const fmText = fmMatch ? fmMatch[0] : "";
    const bodyText = fmMatch ? raw.slice(fmMatch[0].length) : raw;
    const { body: newBody, count } = rewriteWikilinksInBody(bodyText, mapping);
    if (count > 0) {
      writes.push({ kind: "write", path: citingPath, body: fmText + newBody });
      totalLinkRewrites += count;
    }
  }

  // Build the rename + H1-rewrite op for the entity file itself.
  // Using the staging machinery: write the new file (at newPath, with H1 rewritten),
  // then delete the old file. Two ops, applied atomically.
  const ops: PendingOp[] = [
    ...writes,
    { kind: "write", path: newPath, body: newFileRaw },
    { kind: "delete", path: src.path },
  ];

  const opId = `rename-${oldName.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;

  if (opts.dryRun) {
    return {
      oldPath: src.path,
      newPath,
      citingPagesTouched: writes.length,
      totalLinkRewrites,
      opId,
      stagingDir: "(dry-run; no staging written)",
      logEntryAppended: false,
    };
  }

  const stagingDir = applyAtomically(repoRoot, opId, ops);

  // Append refactor log entry
  const reason = opts.reason ?? "";
  appendLogEntry(repoRoot, "refactor", `Rename [[${oldName}]] → [[${newName}]]`, [
    `Tier preserved: ${src.tier}.`,
    `Pages with wikilink rewrites: ${writes.length}. Total link replacements: ${totalLinkRewrites}.`,
    reason ? `Reason: ${reason}` : `Reason: not specified.`,
    `Run \`npx tsx tools/bin/reindex.ts\` to refresh Meta/index*.md.`,
  ]);

  // Clean up staging on success (forensic snapshots are no longer needed)
  cleanupStaging(repoRoot, opId);

  return {
    oldPath: src.path,
    newPath,
    citingPagesTouched: writes.length,
    totalLinkRewrites,
    opId,
    stagingDir,
    logEntryAppended: true,
  };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const result = renameEntity(REPO_ROOT_DEFAULT, args.oldName, args.newName, {
      reason: args.reason,
      dryRun: args.dryRun,
    });
    if (args.dryRun) {
      console.log(`[dry-run] would rename: ${result.oldPath} → ${result.newPath}`);
      console.log(`[dry-run] citing pages to be touched: ${result.citingPagesTouched}`);
      console.log(`[dry-run] total wikilink replacements: ${result.totalLinkRewrites}`);
    } else {
      console.log(`✓ renamed: ${result.oldPath} → ${result.newPath}`);
      console.log(`✓ citing pages touched: ${result.citingPagesTouched}`);
      console.log(`✓ total wikilink replacements: ${result.totalLinkRewrites}`);
      console.log(`✓ refactor log entry appended to Meta/log-${new Date().getFullYear()}.md`);
      console.log(`\nNext: run \`npx tsx tools/bin/reindex.ts\` to refresh indexes.`);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

// Direct-invocation guard so the file can also be imported by tests
const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
