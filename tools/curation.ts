/**
 * curation.ts — shared library for wiki rearrangement CLIs.
 *
 * Used by `hirono rename-entity`, `merge-entities`, `merge-topics`,
 * `bulk-delete-orphans`, `health-check`. Provides:
 *
 *   - reverseCitationIndex(): slug → [{ source_path, line, raw_link }]
 *   - rewriteWikilinksInBody(): body + mapping → rewritten body
 *   - mergeObservationBlocks(): two Observations sections → merged
 *   - applyAtomically(): two-phase commit via .curation-staging/<op-id>/
 *   - appendLogEntry(): prepend a `refactor | ` entry to 00_Meta/log-2026.md
 *
 * Design tenets (per the curation-infrastructure plan):
 *  - Live-computed, no persisted reverse index (small corpus).
 *  - Two-phase commit so a mid-failure leaves the corpus consistent.
 *  - Log entries auto-emitted by mutators; operator never has to remember.
 *  - reindex.ts stays mechanical; curation is operator-triggered.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { walkWikiDocs } from "./link-map.ts";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface CitationRef {
  source_path: string;   // repo-relative
  line: number;          // 1-indexed
  raw_link: string;      // the full `[[X]]` or `[[X|alias]]` text matched
}

export interface PendingOp {
  kind: "write" | "delete" | "rename";
  /** For write/delete: the final destination path (repo-relative). */
  path: string;
  /** For rename: the final destination path; `from` is the source. */
  from?: string;
  /** For write: the new body to put at `path`. */
  body?: string;
}

// ---------------------------------------------------------------------------
// reverse-citation index
// ---------------------------------------------------------------------------

/**
 * Build a map: slug → [{source_path, line, raw_link}] for every page that
 * wikilinks to it. Live-computed; no persistence. Fence-aware (skips ```).
 *
 * Excludes Meta/ pages as citers — they're navigational/auto-generated and
 * shouldn't drive rename impact-calculations. The mutator CLIs DO rewrite
 * Meta/ pages too (since reindex regenerates them), but the index is for
 * "who actually cites this entity in content".
 */
export function reverseCitationIndex(repoRoot: string): Map<string, CitationRef[]> {
  const out = new Map<string, CitationRef[]>();
  const paths = walkWikiDocs(repoRoot);
  for (const repoPath of paths) {
    // Skip Meta/ — auto-regenerated
    if (repoPath.startsWith("00_Meta/")) continue;
    let raw: string;
    try { raw = readFileSync(join(repoRoot, repoPath), "utf8"); } catch { continue; }
    // Strip frontmatter — the wikilinks live in the body
    const bodyStart = raw.indexOf("---\n", raw.startsWith("---\n") ? 4 : 0);
    const body = bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw;
    const offset = raw.length - body.length;  // for line-number math
    let inFence = false;
    const lines = body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      // Compute line number in the ORIGINAL file (1-indexed)
      const linesBefore = raw.slice(0, offset).split("\n").length;
      const lineNo = linesBefore + i;
      for (const m of line.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
        const target = m[1].trim();
        if (!out.has(target)) out.set(target, []);
        out.get(target)!.push({ source_path: repoPath, line: lineNo, raw_link: m[0] });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// wikilink rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrite `[[OldSlug]]` → `[[NewSlug]]` (and `[[OldSlug|alias]]` →
 * `[[NewSlug|alias]]`) in `body`, returning { newBody, count }.
 *
 * Fence-aware (skips ```). Idempotent — re-running yields zero changes if
 * the body has already been rewritten.
 */
export function rewriteWikilinksInBody(
  body: string,
  mapping: Map<string, string>,
): { body: string; count: number } {
  let count = 0;
  let inFence = false;
  const outLines: string[] = [];
  for (const line of body.split("\n")) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      outLines.push(line);
      continue;
    }
    if (inFence) {
      outLines.push(line);
      continue;
    }
    // Match `[[X]]` or `[[X|alias]]`, replace X if mapped
    const newLine = line.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (_full, target, alias) => {
      const trimmed = target.trim();
      const replaceWith = mapping.get(trimmed);
      if (replaceWith === undefined) return _full;
      count++;
      return `[[${replaceWith}${alias ?? ""}]]`;
    });
    outLines.push(newLine);
  }
  return { body: outLines.join("\n"), count };
}

// ---------------------------------------------------------------------------
// Observation block merging
// ---------------------------------------------------------------------------

/**
 * Concatenate `## Observations` blocks from `targetBody` and `sourceBody`,
 * preserving target ordering and prepending an HTML merge-origin comment
 * before the appended source bullets.
 *
 * Returns the FULL merged body of the target file (frontmatter NOT
 * included — caller handles that). If either body lacks a `## Observations`
 * section, the other's section is used as-is. If both lack it, the function
 * returns the targetBody unchanged.
 */
export function mergeObservationBlocks(
  targetBody: string,
  sourceBody: string,
  sourceSlug: string,
  dateISO: string,
): string {
  const OBS_RE = /^## Observations\s*$/m;
  const targetMatch = targetBody.match(OBS_RE);
  const sourceMatch = sourceBody.match(OBS_RE);

  // Extract source's Observations bullets (from `## Observations` to next `## ` or EOF)
  const extractObsBullets = (body: string, matchIdx: number): string => {
    const after = body.slice(matchIdx);
    const nextSection = after.slice(1).search(/^## /m);  // skip the leading `## Observations\n` itself
    const obsBlock = nextSection >= 0 ? after.slice(0, nextSection + 1) : after;
    // Drop the `## Observations` heading line itself; keep the rest
    return obsBlock.split("\n").slice(1).join("\n").trim();
  };

  if (!sourceMatch) return targetBody;  // nothing to merge
  const sourceObs = extractObsBullets(sourceBody, sourceMatch.index!);
  if (!sourceObs) return targetBody;

  const mergeComment = `<!-- merged from \`${sourceSlug}\` on ${dateISO} -->`;
  const appendedBlock = `\n\n${mergeComment}\n\n${sourceObs}\n`;

  if (!targetMatch) {
    // Target has no Observations section — append one
    return targetBody.replace(/\s*$/, `\n\n## Observations\n${appendedBlock}`);
  }

  // Insert appendedBlock at the end of target's Observations section,
  // before the next `## ` (if any) or EOF.
  const headIdx = targetMatch.index!;
  const afterHead = targetBody.slice(headIdx);
  const nextSection = afterHead.slice(1).search(/^## /m);
  if (nextSection < 0) {
    // Observations is the last section — append at end of body
    return targetBody.replace(/\s*$/, `${appendedBlock}\n`);
  }
  // Insert before the next section header
  const splitAt = headIdx + nextSection + 1;
  return targetBody.slice(0, splitAt).replace(/\n+$/, "") + appendedBlock + "\n" + targetBody.slice(splitAt);
}

// ---------------------------------------------------------------------------
// atomic apply (two-phase commit)
// ---------------------------------------------------------------------------

/**
 * Apply a batch of file operations atomically via a staging directory.
 *
 * Phase 1: validate + write all new file bodies to `.curation-staging/<op-id>/`
 * Phase 2: for each op, perform the actual filesystem mutation (renameSync /
 *          unlinkSync / write-via-rename). If any step fails, roll back the
 *          successful ones using the staging copies.
 *
 * Staging dir is gitignored. Mid-failure state is inspectable for forensics.
 *
 * Returns the staging-dir path used (for log/audit).
 */
export function applyAtomically(repoRoot: string, opId: string, ops: PendingOp[]): string {
  const stagingRoot = join(repoRoot, ".curation-staging", opId);
  mkdirSync(stagingRoot, { recursive: true });

  // Phase 1: write all `write` payloads + snapshot any files that will be
  // deleted/overwritten, into staging.
  const phase1Errors: string[] = [];
  const stagedWrites = new Map<string, string>();  // path → staging body file
  const stagedBackups = new Map<string, string>();  // existing path → staging backup

  for (const op of ops) {
    if (op.kind === "write") {
      if (op.body === undefined) {
        phase1Errors.push(`write op missing body: ${op.path}`);
        continue;
      }
      const stagedPath = join(stagingRoot, "writes", op.path);
      mkdirSync(dirname(stagedPath), { recursive: true });
      writeFileSync(stagedPath, op.body, "utf8");
      stagedWrites.set(op.path, stagedPath);
      // Snapshot existing file if any
      const abs = join(repoRoot, op.path);
      if (existsSync(abs)) {
        const backupPath = join(stagingRoot, "backups", op.path);
        mkdirSync(dirname(backupPath), { recursive: true });
        writeFileSync(backupPath, readFileSync(abs, "utf8"), "utf8");
        stagedBackups.set(op.path, backupPath);
      }
    } else if (op.kind === "delete") {
      const abs = join(repoRoot, op.path);
      if (!existsSync(abs)) {
        phase1Errors.push(`delete op target missing: ${op.path}`);
        continue;
      }
      const backupPath = join(stagingRoot, "backups", op.path);
      mkdirSync(dirname(backupPath), { recursive: true });
      writeFileSync(backupPath, readFileSync(abs, "utf8"), "utf8");
      stagedBackups.set(op.path, backupPath);
    } else if (op.kind === "rename") {
      if (!op.from) {
        phase1Errors.push(`rename op missing from: ${op.path}`);
        continue;
      }
      const absFrom = join(repoRoot, op.from);
      if (!existsSync(absFrom)) {
        phase1Errors.push(`rename op source missing: ${op.from}`);
        continue;
      }
      const backupPath = join(stagingRoot, "backups", op.from);
      mkdirSync(dirname(backupPath), { recursive: true });
      writeFileSync(backupPath, readFileSync(absFrom, "utf8"), "utf8");
      stagedBackups.set(op.from, backupPath);
    }
  }

  if (phase1Errors.length > 0) {
    throw new Error(`Phase 1 validation failed:\n  - ${phase1Errors.join("\n  - ")}`);
  }

  // Phase 2: perform mutations. Track what we've done so we can roll back.
  const completed: { kind: "wrote" | "deleted" | "renamed"; data: { path?: string; from?: string; to?: string; restoreFrom?: string } }[] = [];

  try {
    for (const op of ops) {
      if (op.kind === "write") {
        const abs = join(repoRoot, op.path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, op.body!, "utf8");
        completed.push({ kind: "wrote", data: { path: op.path, restoreFrom: stagedBackups.get(op.path) } });
      } else if (op.kind === "delete") {
        const abs = join(repoRoot, op.path);
        unlinkSync(abs);
        completed.push({ kind: "deleted", data: { path: op.path, restoreFrom: stagedBackups.get(op.path) } });
      } else if (op.kind === "rename") {
        const absFrom = join(repoRoot, op.from!);
        const absTo = join(repoRoot, op.path);
        mkdirSync(dirname(absTo), { recursive: true });
        renameSync(absFrom, absTo);
        completed.push({ kind: "renamed", data: { from: op.from, to: op.path, restoreFrom: stagedBackups.get(op.from!) } });
      }
    }
  } catch (e) {
    // Roll back
    for (const op of completed.reverse()) {
      try {
        if (op.kind === "wrote" && op.data.restoreFrom) {
          writeFileSync(join(repoRoot, op.data.path!), readFileSync(op.data.restoreFrom, "utf8"), "utf8");
        } else if (op.kind === "wrote") {
          // No previous file — remove the one we just wrote
          unlinkSync(join(repoRoot, op.data.path!));
        } else if (op.kind === "deleted" && op.data.restoreFrom) {
          writeFileSync(join(repoRoot, op.data.path!), readFileSync(op.data.restoreFrom, "utf8"), "utf8");
        } else if (op.kind === "renamed") {
          renameSync(join(repoRoot, op.data.to!), join(repoRoot, op.data.from!));
        }
      } catch { /* best-effort rollback */ }
    }
    throw new Error(`Phase 2 failed (rolled back ${completed.length} ops): ${(e as Error).message}`);
  }

  return stagingRoot;
}

/**
 * Remove the staging directory for an op-id. Call after a successful
 * applyAtomically + log + reindex pipeline, when forensic inspection is
 * no longer needed.
 */
export function cleanupStaging(repoRoot: string, opId: string): void {
  const stagingRoot = join(repoRoot, ".curation-staging", opId);
  try { rmSync(stagingRoot, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// ingest skip-list
// ---------------------------------------------------------------------------

export interface SkipEntry {
  /** The URL or slug pattern that should be skipped. */
  key: string;
  /** Skip reason code: spam | duplicate | deprecated | bookmarked-by-mistake | other. */
  reason: string;
  /** Free-text rationale appended after the reason. */
  rationale: string;
}

/**
 * Parse `00_Meta/sources-ingest-skips.md` into a list of skip entries.
 *
 * Format (one entry per line, under any `## ` heading):
 *   - <URL or slug> — skip-reason=<spam|duplicate|deprecated|bookmarked-by-mistake|other> · <free text>
 *
 * The arrow is an em-dash (`—`, U+2014); ASCII `--` is also accepted.
 *
 * Returns an empty list if the file doesn't exist. Operators populate
 * via `hirono raindrop forget <url>` or by hand-editing.
 *
 * **This is the last-resort skip mechanism, NOT the default for off-topic
 * content.** Karpathy's wiki ingests every URL in raw/; the curation gate
 * is at the Raindrop-bookmark layer. Skip-list is reserved for known-spam,
 * permanently-deprecated, or duplicate-URL situations.
 */
export function loadIngestSkips(repoRoot: string): SkipEntry[] {
  const path = join(repoRoot, "00_Meta", "sources-ingest-skips.md");
  let content: string;
  try { content = readFileSync(path, "utf8"); } catch { return []; }
  const out: SkipEntry[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^-\s+(.+?)\s+(?:—|--)\s+skip-reason=([a-z-]+)(?:\s+·\s+(.*))?$/);
    if (!m) continue;
    out.push({ key: m[1].trim(), reason: m[2].trim(), rationale: (m[3] ?? "").trim() });
  }
  return out;
}

/** Return true if the URL or slug matches any skip-list entry. */
export function isInSkipList(urlOrSlug: string, entries: SkipEntry[]): SkipEntry | null {
  const normalized = urlOrSlug.toLowerCase().trim();
  for (const e of entries) {
    const k = e.key.toLowerCase().trim();
    if (k === normalized) return e;
    // Trailing-slash insensitive
    if (k.replace(/\/$/, "") === normalized.replace(/\/$/, "")) return e;
  }
  return null;
}

// ---------------------------------------------------------------------------
// entity aliases
// ---------------------------------------------------------------------------

/**
 * Parse `00_Meta/entity-aliases.md` into a Map<variant, canonical>.
 *
 * Each line under `## Aliases` matching `- <variant> → <canonical>` becomes
 * one entry. The arrow can be `→` (U+2192) or `->`. Match against incoming
 * candidate names case-sensitively — operator-curated variants typically
 * encode case differences too.
 *
 * Returns an empty map if the file doesn't exist. Not a scope gate; auto-
 * detect-entities calls this to merge spelling variants before stub-creation.
 */
export function loadEntityAliases(repoRoot: string): Map<string, string> {
  const path = join(repoRoot, "00_Meta", "entity-aliases.md");
  let content: string;
  try { content = readFileSync(path, "utf8"); } catch { return new Map(); }

  const out = new Map<string, string>();
  const lines = content.split("\n");
  let inAliases = false;
  for (const line of lines) {
    if (/^## Aliases\s*$/.test(line)) { inAliases = true; continue; }
    if (/^##\s/.test(line)) { inAliases = false; continue; }
    if (!inAliases) continue;
    const m = line.match(/^-\s+(.+?)\s+(?:→|->)\s+(.+?)\s*$/);
    if (!m) continue;
    const variant = m[1].trim();
    const canonical = m[2].trim();
    if (variant && canonical && variant !== canonical) out.set(variant, canonical);
  }
  return out;
}

/**
 * Apply alias normalization: if `name` matches a variant key, return its
 * canonical form; otherwise return `name` unchanged.
 */
export function normalizeEntityName(name: string, aliases: Map<string, string>): string {
  return aliases.get(name) ?? name;
}

// ---------------------------------------------------------------------------
// log-entry appending
// ---------------------------------------------------------------------------

/**
 * Prepend a refactor log entry to `00_Meta/log-YYYY.md` (current year).
 *
 * Entries land at the top of the entries section, marked by the
 * `<!-- LOG-ENTRIES-START -->` comment if present, otherwise after the
 * first `# Log` heading.
 *
 * Pattern follows the existing log convention:
 *   ## [YYYY-MM-DD] refactor | <Title>
 *   <body lines, one per paragraph>
 */
export function appendLogEntry(
  repoRoot: string,
  kind: "refactor" | "ingest" | "query",
  title: string,
  bodyLines: string[],
): void {
  const year = new Date().toISOString().slice(0, 4);
  const date = new Date().toISOString().slice(0, 10);
  const logPath = join(repoRoot, "00_Meta", `log-${year}.md`);
  let content: string;
  try { content = readFileSync(logPath, "utf8"); }
  catch {
    // Bootstrap a new log file with frontmatter
    content = `---\ncreated: ${date}\nupdated: ${date}\ntype: meta\n---\n\n# Log — ${year}\n\nAppend-only log of wiki changes. **Newest entries at top.**\n\n<!-- LOG-ENTRIES-START -->\n`;
  }

  const entry = `## [${date}] ${kind} | ${title}\n\n${bodyLines.join("\n\n")}\n\n---\n\n`;

  // Find insertion point: just after `<!-- LOG-ENTRIES-START -->` if present
  const marker = "<!-- LOG-ENTRIES-START -->";
  const markerIdx = content.indexOf(marker);
  let inserted: string;
  if (markerIdx >= 0) {
    const afterMarker = markerIdx + marker.length;
    inserted = content.slice(0, afterMarker) + "\n\n" + entry + content.slice(afterMarker).replace(/^\n+/, "");
  } else {
    // Insert after first `# Log` heading + blank-line intro paragraph
    const headingIdx = content.search(/^# Log/m);
    if (headingIdx >= 0) {
      // Find end of the intro paragraph (next blank line after the heading)
      const afterHeading = content.indexOf("\n\n", headingIdx);
      const insertAt = afterHeading >= 0 ? afterHeading + 2 : content.length;
      inserted = content.slice(0, insertAt) + entry + content.slice(insertAt);
    } else {
      inserted = content + "\n" + entry;
    }
  }

  // Bump `updated:` in frontmatter
  inserted = inserted.replace(/^updated:\s*\d{4}-\d{2}-\d{2}\s*$/m, `updated: ${date}`);

  writeFileSync(logPath, inserted, "utf8");
}
