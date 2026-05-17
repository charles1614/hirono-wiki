/**
 * `hirono merge-topics <Src> --into <Tgt>` — atomic topic merge.
 *
 * Topic merges are simpler than entity merges (no tier system; Topics live
 * flat in `01_Topics/`). Per-section concatenation: ## What, ## Current
 * understanding, ## Open threads, ## Sources drawn on get an HTML merge-
 * marker between target's content and source's content. Then rewrite all
 * `[[Src]]` corpus-wide → `[[Tgt]]`, delete source, append log entry.
 *
 * Synthesis-equivalent for Topics is the `## Current understanding` block;
 * if either has non-stub content, the merged target gets a
 * `<!-- TODO: re-synthesize Current understanding -->` marker.
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
  source: string;
  target: string;
  reason: string;
  dryRun: boolean;
}

function usage(): never {
  console.error(`usage: hirono merge-topics <SourceName> --into <TargetName> [--reason "<text>"] [--dry-run]

Atomically merge two topics:
  - Per-section concatenation (## What, ## Current understanding,
    ## Open threads, ## Sources drawn on) with HTML merge-marker.
  - Rewrites all [[SourceName]] corpus-wide to [[TargetName]].
  - Marks Current understanding stale if either was non-stub.
  - Deletes the source file.
  - Appends a refactor entry to 00_Meta/log-YYYY.md.

Examples:
  hirono merge-topics "Communication Overlap" --into "Communication-Computation Overlap"
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let target = "";
  let reason = "";
  let dryRun = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--into") { i++; target = (argv[i] ?? "").trim(); }
    else if (a === "--reason" || a === "-r") { i++; reason = (argv[i] ?? "").trim(); }
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("-")) { console.error(`unknown flag: ${a}`); usage(); }
    else positional.push(a);
  }
  if (positional.length !== 1 || !target) usage();
  return { source: positional[0], target, reason, dryRun };
}

function findTopicFile(repoRoot: string, name: string): string | null {
  const p = join(repoRoot, "01_Topics", `${name}.md`);
  return existsSync(p) ? `01_Topics/${name}.md` : null;
}

const STUB_RE = /\*?stub /i;

/** Merge two Topic bodies section-by-section, preserving target order. */
function mergeTopicBody(targetBody: string, sourceBody: string, sourceSlug: string, dateISO: string): { body: string; cuMarkedStale: boolean } {
  const SECTIONS = ["## What", "## Current understanding", "## Open threads", "## Sources drawn on"];
  const mergeMarker = `<!-- merged from \`${sourceSlug}\` on ${dateISO} -->`;

  const extractSection = (body: string, heading: string): string | null => {
    const re = new RegExp(`^${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`, "m");
    const m = body.match(re);
    if (!m) return null;
    const after = body.slice(m.index!);
    const next = after.slice(1).search(/^## /m);
    return next >= 0 ? after.slice(0, next + 1) : after;
  };

  let merged = targetBody;
  let cuMarkedStale = false;
  for (const heading of SECTIONS) {
    const tgtSection = extractSection(merged, heading);
    const srcSection = extractSection(sourceBody, heading);
    if (!srcSection) continue;
    // Strip the heading line from source's section to get just bullets
    const srcContent = srcSection.split("\n").slice(1).join("\n").trim();
    if (!srcContent) continue;

    if (!tgtSection) {
      // Target lacks this section — append at end
      merged = merged.replace(/\s*$/, `\n\n${heading}\n\n${mergeMarker}\n\n${srcContent}\n`);
    } else {
      // Append source's content within target's section, before next ## heading
      const tgtIdx = merged.indexOf(tgtSection);
      const sectionEnd = tgtIdx + tgtSection.length;
      const appendBlock = `\n${mergeMarker}\n\n${srcContent}\n`;
      merged = merged.slice(0, sectionEnd).replace(/\n+$/, "") + "\n" + appendBlock + "\n" + merged.slice(sectionEnd);
    }

    // Mark Current understanding stale if either had non-stub content
    if (heading === "## Current understanding") {
      const tgtIsStub = !tgtSection || STUB_RE.test(tgtSection);
      const srcIsStub = STUB_RE.test(srcSection);
      if (!tgtIsStub || !srcIsStub) {
        cuMarkedStale = true;
        const todoMarker = `<!-- TODO: re-synthesize ## Current understanding (post-merge ${dateISO}) -->`;
        merged = merged.replace(/^## Current understanding\s*$/m, `## Current understanding\n\n${todoMarker}`);
      }
    }
  }
  return { body: merged, cuMarkedStale };
}

export function mergeTopics(
  repoRoot: string,
  sourceName: string,
  targetName: string,
  opts: { reason?: string; dryRun?: boolean } = {},
): { sourcePath: string; targetPath: string; citingPagesTouched: number; totalLinkRewrites: number; cuMarkedStale: boolean; opId: string } {
  if (sourceName === targetName) throw new Error("source and target are identical");
  const srcPath = findTopicFile(repoRoot, sourceName);
  if (!srcPath) throw new Error(`source topic not found: ${sourceName}`);
  const tgtPath = findTopicFile(repoRoot, targetName);
  if (!tgtPath) throw new Error(`target topic not found: ${targetName}`);

  const srcRaw = readFileSync(join(repoRoot, srcPath), "utf8");
  const tgtRaw = readFileSync(join(repoRoot, tgtPath), "utf8");

  const splitFM = (raw: string) => {
    const m = raw.match(/^---\n[\s\S]*?\n---\n/);
    return m ? { fm: m[0], body: raw.slice(m[0].length) } : { fm: "", body: raw };
  };
  const { fm: tgtFm, body: tgtBody } = splitFM(tgtRaw);
  const { body: srcBody } = splitFM(srcRaw);

  const dateISO = new Date().toISOString().slice(0, 10);
  const { body: mergedBody, cuMarkedStale } = mergeTopicBody(tgtBody, srcBody, sourceName, dateISO);

  const citations = reverseCitationIndex(repoRoot);
  const refs = citations.get(sourceName) ?? [];
  const citingPaths = new Set<string>();
  for (const r of refs) citingPaths.add(r.source_path);
  citingPaths.delete(srcPath);
  citingPaths.delete(tgtPath);

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

  const ops: PendingOp[] = [
    ...writes,
    { kind: "write", path: tgtPath, body: tgtFm + mergedBody },
    { kind: "delete", path: srcPath },
  ];

  const opId = `merge-topic-${sourceName.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;
  if (opts.dryRun) {
    return { sourcePath: srcPath, targetPath: tgtPath, citingPagesTouched: writes.length, totalLinkRewrites, cuMarkedStale, opId };
  }

  applyAtomically(repoRoot, opId, ops);
  appendLogEntry(repoRoot, "refactor", `Merge topic [[${sourceName}]] → [[${targetName}]]`, [
    `Per-section concatenation with merge-marker comments.`,
    `Citing pages rewritten: ${writes.length}. Total link replacements: ${totalLinkRewrites}.`,
    cuMarkedStale ? `## Current understanding marked stale (TODO for LLM regeneration).` : `Both were stubs; no staleness marker added.`,
    opts.reason ? `Reason: ${opts.reason}` : `Reason: not specified.`,
    `Run \`npx tsx tools/bin/reindex.ts\` to refresh indexes.`,
  ]);
  cleanupStaging(repoRoot, opId);
  return { sourcePath: srcPath, targetPath: tgtPath, citingPagesTouched: writes.length, totalLinkRewrites, cuMarkedStale, opId };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = mergeTopics(REPO_ROOT_DEFAULT, args.source, args.target, { reason: args.reason, dryRun: args.dryRun });
    const prefix = args.dryRun ? "[dry-run] would" : "✓";
    console.log(`${prefix} merge topic: ${r.sourcePath} → ${r.targetPath}`);
    console.log(`${prefix} citing pages: ${r.citingPagesTouched} (${r.totalLinkRewrites} link replacements)`);
    console.log(`${prefix} ## Current understanding: ${r.cuMarkedStale ? "marked stale (TODO for LLM)" : "no staleness marker"}`);
    if (!args.dryRun) console.log(`✓ refactor log entry appended\n\nNext: run \`npx tsx tools/bin/reindex.ts\`.`);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
