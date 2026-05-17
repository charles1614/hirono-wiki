/**
 * `hirono merge-entities <Src> --into <Tgt>` — atomic entity merge.
 *
 * Consolidates two entities into one:
 *   1. Concatenate Observations: target's bullets first, then a
 *      `<!-- merged from [[Src]] on YYYY-MM-DD -->` comment, then source's.
 *   2. If either has a non-stub Synthesis, prepend
 *      `<!-- TODO: re-regenerate Synthesis from merged Observations -->`
 *      to the target's body for LLM follow-up.
 *   3. Delete the source file.
 *   4. Rewrite every `[[Src]]` (and `[[Src|alias]]`) → `[[Tgt]]` corpus-wide.
 *   5. Append a refactor log entry.
 *
 * Tier governance: target's tier is preserved. If target is `_seen/` and source
 * is active, the operator probably intended the reverse merge — refuse with
 * a clear error (use --force to override).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAtomically,
  appendLogEntry,
  cleanupStaging,
  mergeObservationBlocks,
  type PendingOp,
  reverseCitationIndex,
  rewriteWikilinksInBody,
} from "../curation.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  source: string;
  target: string;
  reason: string;
  force: boolean;
  dryRun: boolean;
}

function usage(): never {
  console.error(`usage: hirono merge-entities <SourceName> --into <TargetName> [--reason "<text>"] [--force] [--dry-run]

Atomically merge two entities:
  - Concatenate Observations (target first, then source after a merge-marker comment).
  - Mark Synthesis stale with a TODO comment (LLM regenerates later).
  - Rewrite all [[SourceName]] corpus-wide to [[TargetName]].
  - Delete the source file.
  - Append a refactor entry to 00_Meta/log-YYYY.md.

Examples:
  hirono merge-entities bfloat16 --into BF16 --reason "Eliminate alias duplicate"
  hirono merge-entities "Tile IR" --into "CUDA Tile IR" --dry-run

Flags:
  --force      Override tier-mismatch protection (allow active → _seen merge).
  --dry-run    Preview without applying.

Safety:
  - Both entities must exist as Entities/[_seen/]<Name>.md.
  - Default refuses if source is active and target is _seen (probably reversed).
  - Atomic apply via staging dir; rollback on failure.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let source = "";
  let target = "";
  let reason = "";
  let force = false;
  let dryRun = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--into") {
      i++;
      target = (argv[i] ?? "").trim();
    } else if (a === "--reason" || a === "-r") {
      i++;
      reason = (argv[i] ?? "").trim();
    } else if (a === "--force") {
      force = true;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      usage();
    } else if (a.startsWith("-")) {
      console.error(`unknown flag: ${a}`); usage();
    } else {
      positional.push(a);
    }
  }
  if (positional.length !== 1 || !target) usage();
  source = positional[0];
  return { source, target, reason, force, dryRun };
}

function findEntityFile(repoRoot: string, name: string): { path: string; tier: "active" | "seen" } | null {
  if (existsSync(join(repoRoot, "02_Entities", `${name}.md`))) {
    return { path: `02_Entities/${name}.md`, tier: "active" };
  }
  if (existsSync(join(repoRoot, "02_Entities", "_seen", `${name}.md`))) {
    return { path: `02_Entities/_seen/${name}.md`, tier: "seen" };
  }
  return null;
}

const SYNTHESIS_STUB_PATTERNS = [
  /\*Regenerated from Observations below/i,
  /\*Stub /i,
  /\*Synthesis pending/i,
  /\(to be filled in\)/i,
];

function isSynthesisStub(body: string): boolean {
  const m = body.match(/^## Synthesis\s*$([\s\S]*?)(?=^## |\Z)/m);
  if (!m) return true;
  const synthesisBody = m[1].trim();
  if (!synthesisBody) return true;
  return SYNTHESIS_STUB_PATTERNS.some((re) => re.test(synthesisBody));
}

export interface MergeResult {
  sourcePath: string;
  targetPath: string;
  citingPagesTouched: number;
  totalLinkRewrites: number;
  synthesisMarkedStale: boolean;
  opId: string;
  stagingDir: string;
}

export function mergeEntities(
  repoRoot: string,
  sourceName: string,
  targetName: string,
  opts: { reason?: string; force?: boolean; dryRun?: boolean } = {},
): MergeResult {
  if (sourceName === targetName) throw new Error("source and target are identical");

  const src = findEntityFile(repoRoot, sourceName);
  if (!src) throw new Error(`source entity not found: ${sourceName}`);
  const tgt = findEntityFile(repoRoot, targetName);
  if (!tgt) throw new Error(`target entity not found: ${targetName}`);

  if (src.tier === "active" && tgt.tier === "seen" && !opts.force) {
    throw new Error(
      `tier-mismatch: source ${sourceName} is active but target ${targetName} is _seen. ` +
      `Probably reversed — try \`merge-entities ${targetName} --into ${sourceName}\`. ` +
      `Pass --force to override.`,
    );
  }

  // Read both bodies
  const sourceRaw = readFileSync(join(repoRoot, src.path), "utf8");
  const targetRaw = readFileSync(join(repoRoot, tgt.path), "utf8");

  // Split frontmatter from body
  const splitFM = (raw: string): { fm: string; body: string } => {
    const m = raw.match(/^---\n[\s\S]*?\n---\n/);
    return m ? { fm: m[0], body: raw.slice(m[0].length) } : { fm: "", body: raw };
  };
  const { fm: targetFm, body: targetBody } = splitFM(targetRaw);
  const { body: sourceBody } = splitFM(sourceRaw);

  // Merge Observations
  const dateISO = new Date().toISOString().slice(0, 10);
  let mergedBody = mergeObservationBlocks(targetBody, sourceBody, sourceName, dateISO);

  // Mark Synthesis stale if either had non-stub Synthesis
  const synthesisWasReal = !isSynthesisStub(targetBody) || !isSynthesisStub(sourceBody);
  if (synthesisWasReal) {
    const todoMarker = `<!-- TODO: re-regenerate Synthesis from merged Observations (post-merge ${dateISO}) -->`;
    mergedBody = mergedBody.replace(/^## Synthesis\s*$/m, `## Synthesis\n\n${todoMarker}`);
  }

  // Build wikilink-rewrite plan
  const citations = reverseCitationIndex(repoRoot);
  const refs = citations.get(sourceName) ?? [];
  const citingPaths = new Set<string>();
  for (const r of refs) citingPaths.add(r.source_path);
  citingPaths.delete(src.path);
  citingPaths.delete(tgt.path);

  const mapping = new Map([[sourceName, targetName]]);
  const writes: PendingOp[] = [];
  let totalLinkRewrites = 0;
  for (const citingPath of citingPaths) {
    const abs = join(repoRoot, citingPath);
    const raw = readFileSync(abs, "utf8");
    const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
    const fmText = fmMatch ? fmMatch[0] : "";
    const bodyText = fmMatch ? raw.slice(fmMatch[0].length) : raw;
    const { body: newBody, count } = rewriteWikilinksInBody(bodyText, mapping);
    if (count > 0) {
      writes.push({ kind: "write", path: citingPath, body: fmText + newBody });
      totalLinkRewrites += count;
    }
  }

  // Build ops: rewrite citing pages + write merged target + delete source
  const ops: PendingOp[] = [
    ...writes,
    { kind: "write", path: tgt.path, body: targetFm + mergedBody },
    { kind: "delete", path: src.path },
  ];

  const opId = `merge-${sourceName.replace(/[^a-zA-Z0-9-]/g, "_")}-into-${targetName.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;

  if (opts.dryRun) {
    return {
      sourcePath: src.path,
      targetPath: tgt.path,
      citingPagesTouched: writes.length,
      totalLinkRewrites,
      synthesisMarkedStale: synthesisWasReal,
      opId,
      stagingDir: "(dry-run; no staging)",
    };
  }

  const stagingDir = applyAtomically(repoRoot, opId, ops);

  const reason = opts.reason ?? "";
  appendLogEntry(repoRoot, "refactor", `Merge [[${sourceName}]] → [[${targetName}]]`, [
    `Source tier: ${src.tier}. Target tier: ${tgt.tier} (preserved).`,
    `Observations concatenated with HTML merge-origin marker.`,
    `Synthesis: ${synthesisWasReal ? "marked stale with TODO comment for LLM regeneration" : "both were stubs; nothing to mark"}.`,
    `Citing pages rewritten: ${writes.length}. Total link replacements: ${totalLinkRewrites}.`,
    reason ? `Reason: ${reason}` : `Reason: not specified.`,
    `Run \`npx tsx tools/bin/reindex.ts\` to refresh indexes.`,
  ]);

  cleanupStaging(repoRoot, opId);

  return {
    sourcePath: src.path,
    targetPath: tgt.path,
    citingPagesTouched: writes.length,
    totalLinkRewrites,
    synthesisMarkedStale: synthesisWasReal,
    opId,
    stagingDir,
  };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const result = mergeEntities(REPO_ROOT_DEFAULT, args.source, args.target, {
      reason: args.reason,
      force: args.force,
      dryRun: args.dryRun,
    });
    const prefix = args.dryRun ? "[dry-run] would" : "✓";
    console.log(`${prefix} merge: ${result.sourcePath} → ${result.targetPath}`);
    console.log(`${prefix} citing pages: ${result.citingPagesTouched} (${result.totalLinkRewrites} link replacements)`);
    console.log(`${prefix} synthesis: ${result.synthesisMarkedStale ? "marked stale (TODO for LLM)" : "both stubs, no marker added"}`);
    if (!args.dryRun) {
      console.log(`✓ refactor log entry appended to 00_Meta/log-${new Date().getFullYear()}.md`);
      console.log(`\nNext: run \`npx tsx tools/bin/reindex.ts\` and optionally rewrite the Synthesis in-session.`);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
