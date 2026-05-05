#!/usr/bin/env node
/**
 * lint: health-check the wiki's internal graph & structure.
 *
 * Mechanical checks only (no LLM calls). Contradiction detection, stale-claim
 * detection, and "concepts mentioned in prose but not wikilinked" are LLM-
 * driven passes and are out of scope for this tool.
 *
 * Check classes:
 *   orphans           Entity / Topic pages with 0 incoming content-page refs.
 *                     (Sources are expected to have 0 inbound — they're leaves.)
 *   dead-wikilinks    [[X]] where slug X doesn't exist as a file.
 *                     Excludes Meta/ by default (schema.md has docstring
 *                     examples like [[Slug]] that would false-positive).
 *                     Content inside fenced ``` blocks is never scanned.
 *   tier-mismatch     Entity in _seen/ with refs >= 3 (should be promoted),
 *                     or Entity in active tier with refs < 3 (curious; may
 *                     be a manual carve-out).
 *   frontmatter       Missing / malformed required frontmatter fields per
 *                     the page's bucket (per Meta/schema.md conventions).
 *
 *   tsx lint.ts                         # run all checks
 *   tsx lint.ts --check orphans,dead    # subset
 *   tsx lint.ts --include-meta          # also check Meta/ (off by default)
 *   tsx lint.ts --json                  # NDJSON output
 *   tsx lint.ts --quiet                 # exit code only, suppress prose
 *
 * Exit 0 if clean, 1 if any issues found.
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import {
  type Bucket,
  BUCKETS,
  bucketOf,
  slugOf,
  walkWikiDocs,
} from "../link-map.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const TIER_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type CheckKind = "orphans" | "dead-wikilinks" | "tier-mismatch" | "frontmatter" | "raw-orphan" | "sources-index";

export interface Issue {
  kind: CheckKind;
  severity: "error" | "warn";
  path: string;                  // repo-relative
  detail: string;
  hint?: string;
}

interface DocMeta {
  repo_path: string;
  slug: string;
  bucket: Bucket;
  frontmatter: Record<string, unknown>;
  body: string;
  wikilinks: Set<string>;        // unique outgoing wikilink targets, fence-stripped
}

// ---------------------------------------------------------------------------
// parse + wikilink extraction (same rules as reindex.ts)
// ---------------------------------------------------------------------------

function parseDoc(repoRoot: string, repoPath: string): DocMeta {
  const raw = readFileSync(join(repoRoot, repoPath), "utf8");
  const { data, content } = matter(raw);
  return {
    repo_path: repoPath,
    slug: slugOf(repoPath),
    bucket: bucketOf(repoPath)!,
    frontmatter: data as Record<string, unknown>,
    body: content,
    wikilinks: extractWikilinks(content),
  };
}

function extractWikilinks(body: string): Set<string> {
  const out = new Set<string>();
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      out.add(m[1].trim());
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// checks (each is a pure function of docs → issues)
// ---------------------------------------------------------------------------

export function checkOrphans(docs: DocMeta[]): Issue[] {
  // Count incoming refs excluding Meta/ (navigation) + self-refs.
  const refs = new Map<string, number>();
  for (const doc of docs) {
    if (doc.bucket === "Meta") continue;
    for (const target of doc.wikilinks) {
      if (target === doc.slug) continue;
      refs.set(target, (refs.get(target) ?? 0) + 1);
    }
  }
  const issues: Issue[] = [];
  for (const doc of docs) {
    if (doc.bucket !== "Entities" && doc.bucket !== "Topics") continue;
    const count = refs.get(doc.slug) ?? 0;
    if (count === 0) {
      issues.push({
        kind: "orphans",
        severity: "warn",
        path: doc.repo_path,
        detail: `orphan: 0 incoming refs from content pages`,
        hint: "consider linking from a related source/entity, or deleting",
      });
    }
  }
  return issues;
}

export function checkDeadWikilinks(
  docs: DocMeta[],
  opts: { includeMeta: boolean },
): Issue[] {
  const knownSlugs = new Set(docs.map((d) => d.slug));
  const issues: Issue[] = [];
  for (const doc of docs) {
    if (!opts.includeMeta && doc.bucket === "Meta") continue;
    for (const target of doc.wikilinks) {
      if (!knownSlugs.has(target)) {
        const hint =
          target.includes("/")
            ? "path-style wikilink detected; use bare slug (e.g. [[schema]] not [[Meta/schema]])"
            : "slug doesn't exist; create it as a stub or remove the reference";
        issues.push({
          kind: "dead-wikilinks",
          severity: "error",
          path: doc.repo_path,
          detail: `[[${target}]] resolves to no file`,
          hint,
        });
      }
    }
  }
  return issues;
}

export function checkTierMismatch(docs: DocMeta[]): Issue[] {
  const refs = new Map<string, number>();
  for (const doc of docs) {
    if (doc.bucket === "Meta") continue;
    for (const target of doc.wikilinks) {
      if (target === doc.slug) continue;
      refs.set(target, (refs.get(target) ?? 0) + 1);
    }
  }
  const issues: Issue[] = [];
  for (const doc of docs) {
    if (doc.bucket !== "Entities") continue;
    const count = refs.get(doc.slug) ?? 0;
    const inSeen = doc.repo_path.includes("/_seen/");
    if (inSeen && count >= TIER_THRESHOLD) {
      issues.push({
        kind: "tier-mismatch",
        severity: "error",
        path: doc.repo_path,
        detail: `entity in _seen/ has ${count} refs (>= ${TIER_THRESHOLD}) — should be promoted`,
        hint: "run `npx tsx reindex.ts`",
      });
    }
    if (!inSeen && count < TIER_THRESHOLD) {
      issues.push({
        kind: "tier-mismatch",
        severity: "warn",
        path: doc.repo_path,
        detail: `entity in active tier has only ${count} refs (< ${TIER_THRESHOLD})`,
        hint: "demotion is manual and discouraged; acceptable as a hand-promoted exception, otherwise investigate",
      });
    }
  }
  return issues;
}

/**
 * raw-orphan: every Sources/YYYY/<slug>.md should have a paired
 * raw/YYYY/<slug>/content.md; every raw/YYYY/<slug>/ should be referenced by
 * some Sources/<slug>.md. Missing either side is an error.
 *
 * This exists so scaling v1 doesn't silently accumulate Source summaries whose
 * raw backing disappeared (lost archive), or orphan raw dirs whose summary was
 * deleted (stale archive).
 */
export function checkRawOrphan(docs: DocMeta[], repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  const sources = docs.filter((d) => d.bucket === "Sources");

  // Expected raw/<year>/<slug> dirs per Source page
  const expectedRawSlugs = new Set<string>();
  for (const s of sources) {
    const rawDir = join(repoRoot, "raw", yearForSourcePath(s.repo_path), s.slug);
    expectedRawSlugs.add(s.slug);
    const content = join(rawDir, "content.md");
    if (!existsSync(content)) {
      issues.push({
        kind: "raw-orphan",
        severity: "error",
        path: s.repo_path,
        detail: `Sources/.../${s.slug}.md has no raw archive at raw/.../${s.slug}/content.md`,
        hint: "run tools/fetch-raw.ts to populate raw/, or remove the Source summary",
      });
    }
  }

  // Reverse direction: any raw/YYYY/<slug>/ without a matching Source summary?
  const rawRoot = join(repoRoot, "raw");
  if (existsSync(rawRoot)) {
    for (const year of readdirSync(rawRoot)) {
      const yearDir = join(rawRoot, year);
      if (!statSync(yearDir).isDirectory()) continue;
      for (const slug of readdirSync(yearDir)) {
        const slugDir = join(yearDir, slug);
        if (!statSync(slugDir).isDirectory()) continue;
        if (!expectedRawSlugs.has(slug)) {
          issues.push({
            kind: "raw-orphan",
            severity: "warn",
            path: `raw/${year}/${slug}/`,
            detail: `raw dir exists but no Sources/.../${slug}.md references it`,
            hint: "ingest this source (write a Sources summary) or delete raw/.../" + slug + "/",
          });
        }
      }
    }
  }

  return issues;
}

function yearForSourcePath(repoPath: string): string {
  // "Sources/2026/2026-04-19-foo.md" → "2026"
  const m = repoPath.match(/^Sources\/(\d{4})\//);
  return m ? m[1] : new Date().getFullYear().toString();
}

/**
 * sources-index: assert that .wiki-sources-index.json is (a) parseable and
 * (b) every entry's repo_path still points at a real Sources/*.md file.
 *
 * Parse failures are hard errors — the index is what the dedup layer uses
 * to avoid double-ingesting URLs, so corruption silently metastasizes.
 * Stale repo_path (index points at a since-renamed / deleted file) is a
 * warning — reindex will fix it on the next run, but it's worth surfacing.
 */
export function checkSourcesIndex(repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  const indexPath = join(repoRoot, ".wiki-sources-index.json");
  if (!existsSync(indexPath)) return issues;  // not an error — may not have been built yet

  let raw: string;
  try {
    raw = readFileSync(indexPath, "utf8");
  } catch (err) {
    issues.push({
      kind: "sources-index",
      severity: "error",
      path: ".wiki-sources-index.json",
      detail: `could not read: ${err instanceof Error ? err.message : err}`,
      hint: "check file permissions, or delete and rebuild via `tsx build-sources-index.ts`",
    });
    return issues;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    issues.push({
      kind: "sources-index",
      severity: "error",
      path: ".wiki-sources-index.json",
      detail: `JSON parse failed (${raw.length} bytes): ${err instanceof Error ? err.message : err}`,
      hint: "inspect the file; restore from .wiki-sources-index.json.bak if present, or rebuild via `tsx build-sources-index.ts`",
    });
    return issues;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    issues.push({
      kind: "sources-index",
      severity: "error",
      path: ".wiki-sources-index.json",
      detail: `top-level value is not a JSON object (got ${Array.isArray(parsed) ? "array" : typeof parsed})`,
      hint: "rebuild via `tsx build-sources-index.ts`",
    });
    return issues;
  }

  // Consistency check: every entry's repo_path must point at a real file.
  for (const [url, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push({
        kind: "sources-index",
        severity: "error",
        path: ".wiki-sources-index.json",
        detail: `entry for ${url.slice(0, 80)} is not an object`,
        hint: "rebuild via `tsx build-sources-index.ts`",
      });
      continue;
    }
    const repoPath = (entry as Record<string, unknown>).repo_path;
    if (typeof repoPath !== "string") {
      issues.push({
        kind: "sources-index",
        severity: "error",
        path: ".wiki-sources-index.json",
        detail: `entry for ${url.slice(0, 80)} is missing repo_path`,
        hint: "rebuild via `tsx build-sources-index.ts`",
      });
      continue;
    }
    if (!existsSync(join(repoRoot, repoPath))) {
      issues.push({
        kind: "sources-index",
        severity: "warn",
        path: ".wiki-sources-index.json",
        detail: `entry for ${url.slice(0, 80)} points at missing file ${repoPath}`,
        hint: "rebuild via `tsx build-sources-index.ts` to drop stale entries",
      });
    }
  }

  return issues;
}

export function checkFrontmatter(docs: DocMeta[]): Issue[] {
  const issues: Issue[] = [];
  const required: Record<Bucket, string[]> = {
    Meta:     ["type", "created", "updated"],
    Sources:  ["type", "created", "updated", "raw_source"],
    Entities: ["type", "created", "updated", "refs", "tier"],
    Topics:   ["type", "created", "updated", "source_count"],
  };
  const expectedType: Record<Bucket, string> = {
    Meta: "meta",
    Sources: "source",
    Entities: "entity",
    Topics: "topic",
  };
  for (const doc of docs) {
    const fm = doc.frontmatter;
    const req = required[doc.bucket];
    for (const key of req) {
      if (!(key in fm) || fm[key] === null || fm[key] === "") {
        issues.push({
          kind: "frontmatter",
          severity: "error",
          path: doc.repo_path,
          detail: `missing required frontmatter field: ${key}`,
        });
      }
    }
    if (fm.type && fm.type !== expectedType[doc.bucket]) {
      issues.push({
        kind: "frontmatter",
        severity: "error",
        path: doc.repo_path,
        detail: `frontmatter type="${fm.type}" doesn't match bucket (expected "${expectedType[doc.bucket]}")`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// orchestration
// ---------------------------------------------------------------------------

const ALL_CHECKS: CheckKind[] = ["orphans", "dead-wikilinks", "tier-mismatch", "frontmatter", "raw-orphan", "sources-index"];

export interface LintOptions {
  checks?: CheckKind[];
  includeMeta?: boolean;
}

export function runLint(repoRoot: string, opts: LintOptions = {}): Issue[] {
  const checks = opts.checks ?? ALL_CHECKS;
  const includeMeta = opts.includeMeta ?? false;
  const paths = walkWikiDocs(repoRoot);
  const docs = paths.map((p) => parseDoc(repoRoot, p));
  const issues: Issue[] = [];
  if (checks.includes("orphans"))        issues.push(...checkOrphans(docs));
  if (checks.includes("dead-wikilinks")) issues.push(...checkDeadWikilinks(docs, { includeMeta }));
  if (checks.includes("tier-mismatch"))  issues.push(...checkTierMismatch(docs));
  if (checks.includes("frontmatter"))    issues.push(...checkFrontmatter(docs));
  if (checks.includes("raw-orphan"))     issues.push(...checkRawOrphan(docs, repoRoot));
  if (checks.includes("sources-index"))  issues.push(...checkSourcesIndex(repoRoot));
  return issues;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const quiet = args.includes("--quiet");
  const includeMeta = args.includes("--include-meta");
  const checkIdx = args.indexOf("--check");
  let checks = ALL_CHECKS;
  if (checkIdx >= 0 && args[checkIdx + 1]) {
    const requested = args[checkIdx + 1].split(",").map((s) => s.trim());
    for (const r of requested) {
      if (!ALL_CHECKS.includes(r as CheckKind)) {
        console.error(`unknown check: ${r}. Known: ${ALL_CHECKS.join(",")}`);
        process.exit(2);
      }
    }
    checks = requested as CheckKind[];
  }

  const issues = runLint(REPO_ROOT, { checks, includeMeta });

  if (json) {
    for (const i of issues) process.stdout.write(JSON.stringify(i) + "\n");
  } else if (!quiet) {
    if (issues.length === 0) {
      console.log(`[lint] ✓ ${checks.join(", ")} — no issues`);
    } else {
      // group by kind for readability
      const byKind = new Map<CheckKind, Issue[]>();
      for (const i of issues) {
        if (!byKind.has(i.kind)) byKind.set(i.kind, []);
        byKind.get(i.kind)!.push(i);
      }
      for (const kind of checks) {
        const arr = byKind.get(kind);
        if (!arr || arr.length === 0) continue;
        console.log(`\n[lint] ${kind} (${arr.length} issue${arr.length === 1 ? "" : "s"}):`);
        for (const i of arr) {
          const sev = i.severity.toUpperCase().padEnd(5);
          console.log(`  ${sev}  ${i.path}: ${i.detail}`);
          if (i.hint) console.log(`         → ${i.hint}`);
        }
      }
      const errs = issues.filter((i) => i.severity === "error").length;
      const warns = issues.filter((i) => i.severity === "warn").length;
      console.log(`\n[lint] ${errs} error(s), ${warns} warning(s)`);
    }
  }

  process.exit(issues.some((i) => i.severity === "error") ? 1 : 0);
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
