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

import { readFileSync, existsSync, statSync, readdirSync, openSync, readSync, closeSync } from "node:fs";
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
import { looksLikeImage, MIN_IMAGE_BYTES } from "../fetch-raw.ts";
import { computeObservationGaps, countRefs } from "./reindex.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
// Wiki root: THIS_FILE is at `tools/bin/lint.ts`, so `dirname/../..`
// resolves to the wiki root. Earlier code only went up one level —
// that resolved to `tools/`, so `walkWikiDocs(REPO_ROOT)` walked
// `tools/Sources/` (doesn't exist), found zero source docs, and the
// reverse-orphan check walked `tools/raw/raindrop/` (doesn't exist
// either). Lint always reported "no issues" regardless of corpus state.
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");
const TIER_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type CheckKind = "orphans" | "dead-wikilinks" | "tier-mismatch" | "frontmatter" | "raw-orphan" | "sources-index" | "source-image-refs" | "observation-gaps" | "tag-vocabulary";

export interface Issue {
  kind: CheckKind;
  severity: "error" | "warn" | "info";
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
 * raw/raindrop/<host>/<slug>/content.md; every raw/raindrop/<host>/<slug>/
 * should be referenced by some Sources/<slug>.md. Missing either side
 * is an error.
 *
 * This exists so scaling v1 doesn't silently accumulate Source summaries
 * whose raw backing disappeared (lost archive), or orphan raw dirs whose
 * summary was deleted (stale archive).
 */
export function checkRawOrphan(docs: DocMeta[], repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  const sources = docs.filter((d) => d.bucket === "Sources");

  // Index existing raw slugs by slug → (host, slugDir).
  const rawRoot = join(repoRoot, "raw", "raindrop");
  const rawSlugs = new Map<string, { host: string; slugDir: string }>();
  if (existsSync(rawRoot)) {
    for (const host of readdirSync(rawRoot)) {
      const hostDir = join(rawRoot, host);
      let st;
      try { st = statSync(hostDir); } catch { continue; }
      if (!st.isDirectory()) continue;  // skip _index.json + other sidecar files
      for (const slug of readdirSync(hostDir)) {
        const slugDir = join(hostDir, slug);
        try { if (!statSync(slugDir).isDirectory()) continue; } catch { continue; }
        rawSlugs.set(slug, { host, slugDir });
      }
    }
  }

  // Load `_index.json` (best-effort) so the reverse-orphan check can
  // filter to ingest-ready slugs only. Flagged slugs (auth-walled,
  // SPA-no-content, paywalled, etc.) are deliberately NOT yet
  // ingested — warning on them turns lint into noise (currently
  // ~363 such slugs corpus-wide). A flagged slug becomes a
  // reverse-orphan candidate only after the operator marks it
  // `quality_status: good`.
  const rawIndexPath = join(rawRoot, "_index.json");
  const rawQualityBySlug = new Map<string, string>();
  if (existsSync(rawIndexPath)) {
    try {
      const idx = JSON.parse(readFileSync(rawIndexPath, "utf8")) as {
        slugs?: Record<string, { quality_status?: string }>;
      };
      for (const [slug, entry] of Object.entries(idx.slugs ?? {})) {
        if (entry?.quality_status) rawQualityBySlug.set(slug, entry.quality_status);
      }
    } catch { /* fall back to no-filter behavior */ }
  }

  // Expected slugs per Source page
  const expectedRawSlugs = new Set<string>();
  for (const s of sources) {
    expectedRawSlugs.add(s.slug);
    const rawEntry = rawSlugs.get(s.slug);
    const content = rawEntry ? join(rawEntry.slugDir, "content.md") : null;
    if (!content || !existsSync(content)) {
      issues.push({
        kind: "raw-orphan",
        severity: "error",
        path: s.repo_path,
        detail: `Sources/.../${s.slug}.md has no raw archive at raw/raindrop/<host>/${s.slug}/content.md`,
        hint: "run `hirono raindrop fetch <slug>` to populate raw/, or remove the Source summary",
      });
    }
  }

  // Reverse direction: any raw/raindrop/<host>/<slug>/ without a matching Source summary?
  // Filter to good-quality slugs only — flagged slugs are expected
  // to be unpaired (they're WIP, not yet eligible for ingest).
  // Severity demoted from `warn` → `info`: a clean-but-not-yet-
  // ingested slug is the intended state of the WIP queue.
  for (const [slug, { host }] of rawSlugs) {
    if (expectedRawSlugs.has(slug)) continue;
    if (rawQualityBySlug.size > 0) {
      const status = rawQualityBySlug.get(slug);
      if (status && status !== "good") continue;
    }
    issues.push({
      kind: "raw-orphan",
      severity: "info",
      path: `raw/raindrop/${host}/${slug}/`,
      detail: `raw dir exists but no Sources/.../${slug}.md references it`,
      hint: "ingest this source (write a Sources summary) or delete raw/raindrop/" + host + "/" + slug + "/",
    });
  }

  return issues;
}

/**
 * source-image-refs: every `![alt](path)` image reference inside a Source
 * page must resolve to a real file on disk that is a valid image of a known
 * format. Closes the gap between fetch-time validation (downloadImage
 * checks bytes on the way in) and ingest-time discipline (operator-/LLM-
 * authored Source pages reference those bytes by relative path).
 *
 * Three error classes:
 *   - dangling: file at the resolved path doesn't exist.
 *   - implausibly-small: file exists but is < MIN_IMAGE_BYTES (truncated
 *     download stub, tracking pixel, error-page-as-image).
 *   - wrong-format: file exists and is large enough but bytes don't match
 *     a known image magic-byte signature (HTML error page saved as .png,
 *     etc.).
 *
 * Validity criteria match `downloadImage` in tools/fetch-raw.ts so the
 * two layers can't drift. Refs inside fenced code blocks are ignored
 * (they're documentation examples). Remote http(s) refs are ignored
 * here — the separate "no remote image refs" rule covers them.
 */
export function checkSourceImageRefs(docs: DocMeta[], repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  for (const doc of docs.filter((d) => d.bucket === "Sources")) {
    for (const ref of extractLocalImageRefs(doc.body)) {
      // Resolve `../../raw/...` relative to the Source's directory.
      const abs = resolve(repoRoot, dirname(doc.repo_path), ref);
      let size: number;
      try {
        size = statSync(abs).size;
      } catch {
        issues.push({
          kind: "source-image-refs",
          severity: "error",
          path: doc.repo_path,
          detail: `image ref "${ref}" resolves to a missing file`,
          hint: `expected at ${relpath(abs, repoRoot)}`,
        });
        continue;
      }
      if (size < MIN_IMAGE_BYTES) {
        issues.push({
          kind: "source-image-refs",
          severity: "error",
          path: doc.repo_path,
          detail: `image ref "${ref}" resolves to a ${size}-byte file (below MIN_IMAGE_BYTES=${MIN_IMAGE_BYTES}; likely truncated)`,
          hint: `hirono raindrop refetch <slug> --force, then re-verify`,
        });
        continue;
      }
      let head: Buffer;
      try {
        const fd = openSync(abs, "r");
        head = Buffer.alloc(Math.min(size, 256));
        readSync(fd, head, 0, head.length, 0);
        closeSync(fd);
      } catch (e) {
        issues.push({
          kind: "source-image-refs",
          severity: "error",
          path: doc.repo_path,
          detail: `image ref "${ref}" could not be read: ${(e as Error).message}`,
        });
        continue;
      }
      if (!looksLikeImage(head)) {
        issues.push({
          kind: "source-image-refs",
          severity: "error",
          path: doc.repo_path,
          detail: `image ref "${ref}" exists (${size} B) but doesn't match any known image format (PNG/JPEG/WebP/SVG/GIF/BMP/TIFF)`,
          hint: `the file may be an HTML error page or text saved with an image extension; refetch the slug`,
        });
      }
    }
  }
  return issues;
}

/**
 * Pull every `![alt](path)` reference out of a markdown body, skipping
 * those inside fenced code blocks and skipping remote `http(s)://` URLs.
 * Returns the path string verbatim — the caller resolves it.
 */
function extractLocalImageRefs(body: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const path = m[1].trim();
      if (/^https?:\/\//i.test(path)) continue;  // remote refs are a separate rule
      if (path.length === 0) continue;
      out.push(path);
    }
  }
  return out;
}

function relpath(abs: string, repoRoot: string): string {
  return abs.startsWith(repoRoot + "/") ? abs.slice(repoRoot.length + 1) : abs;
}

/**
 * observation-gaps: surface the LLM-editorial debt that reindex.ts's
 * verbose output prints but doesn't enforce.
 *
 * For each ACTIVE-tier Entity (in `Entities/`, not `Entities/_seen/`)
 * whose `## Observations` section doesn't cite all of the Sources that
 * wikilink to it, emit a WARN naming the missing citing Source(s).
 * The LLM is expected to append one cited bullet per citing Source on
 * the next ingest pass.
 *
 * Why active-tier only: seen-tier entities (refs ≤ 2) are scaffolding
 * by design; warning on them would flood lint with ~80+ items that
 * compound naturally as more Sources accumulate. Active-tier (refs ≥ 3,
 * the load-bearing nodes of the graph) is where dead-end observation
 * sections hurt — clicking a `[[NVIDIA]]` wikilink and reaching a page
 * with no cited claims is the failure mode this check prevents.
 *
 * Reuses `computeObservationGaps` from reindex.ts so the gap-detection
 * logic stays single-sourced. The check is a thin filter over its
 * output: tier === "active" + missingSources.length > 0 → WARN.
 */
export function checkObservationGaps(docs: DocMeta[]): Issue[] {
  const issues: Issue[] = [];
  const refs = countRefs(docs);
  const gaps = computeObservationGaps(docs, refs);
  for (const gap of gaps) {
    // Find the entity doc to check its tier. Active-tier entities live
    // in `Entities/<Name>.md`; seen-tier in `Entities/_seen/<Name>.md`.
    const entityDoc = docs.find(
      (d) => d.bucket === "Entities" && d.slug === gap.slug,
    );
    if (!entityDoc) continue;
    const inSeen = entityDoc.repo_path.includes("/_seen/");
    if (inSeen) continue;  // scaffolding tier; not an enforced gap
    issues.push({
      kind: "observation-gaps",
      severity: "warn",
      path: entityDoc.repo_path,
      detail:
        `active-tier entity has refs=${gap.refs} but ## Observations is missing ${gap.missingSources.length} cited bullet(s) ` +
        `from: ${gap.missingSources.slice(0, 3).map((s) => `[[${s}]]`).join(", ")}` +
        (gap.missingSources.length > 3 ? `, +${gap.missingSources.length - 3} more` : ""),
      hint:
        `LLM-editorial backfill: read each citing Source and append a cited ` +
        `Observation bullet to ${entityDoc.repo_path}. See README §Mode 2 ` +
        `("What 'touches' means") for the workflow.`,
    });
  }
  return issues;
}

function yearForSourcePath(repoPath: string): string {
  // "Sources/2026/2026-04-19-foo.md" → "2026"
  const m = repoPath.match(/^Sources\/(\d{4})\//);
  return m ? m[1] : new Date().getFullYear().toString();
}

/**
 * Canonical tag vocabulary for Sources `tags:` frontmatter. Five axes;
 * Sources should pick 2–5 tags from the relevant axes. Documented in
 * `Meta/schema.md` under "Canonical tag vocabulary"; this set is the
 * single source of truth (the doc references this list, not vice versa).
 *
 * Don't tag proper nouns (NVIDIA, vLLM, Mixtral, Llama, etc.) — those go
 * in `## Entities touched` / `## Topics touched`.
 *
 * Extending: novel tag ideas should be added here in the same commit that
 * uses them in a Source, otherwise this check WARNs.
 */
export const CANONICAL_TAGS: ReadonlySet<string> = new Set([
  // Workload (1–2 per Source)
  "pretraining", "training", "post-training", "inference", "evaluation",
  // Subdomain (1–3 per Source)
  "attention-kernels", "comm-overlap", "data-loading", "disaggregation",
  "kv-cache", "moe", "observability", "parallelism", "quantization",
  "scaling-law", "scheduling", "speculative-decoding", "low-precision",
  // Hardware (0–1 per Source)
  "gpu", "tpu", "accelerator-design",
  // Source shape (0–1 per Source)
  "paper", "survey", "microbenchmark", "benchmark", "announcement",
  "tooling", "minimal-impl",
  // Special (0–1 per Source)
  "long-context", "production-deployment",
]);

/**
 * tag-vocabulary: warn on tags not in CANONICAL_TAGS.
 *
 * The lint-required `tags:` check elsewhere already errors on missing /
 * empty tags. This check is the next layer: gates against tag drift at
 * scale (`inference` vs `llm-inference` vs `inference-systems`) by
 * enforcing a controlled vocabulary. Severity is WARN, not ERROR — a
 * novel tag isn't broken, but it's a signal worth surfacing for either
 * (a) renaming to a canonical tag, or (b) extending the vocabulary.
 *
 * Per-Source warnings batch the novel tags into one issue per Source to
 * avoid flooding output.
 */
export function checkTagVocabulary(docs: DocMeta[]): Issue[] {
  const issues: Issue[] = [];
  for (const doc of docs.filter((d) => d.bucket === "Sources")) {
    const tags = doc.frontmatter.tags;
    if (!Array.isArray(tags)) continue;  // other check enforces presence
    const novel = tags.filter((t): t is string =>
      typeof t === "string" && !CANONICAL_TAGS.has(t),
    );
    if (novel.length === 0) continue;
    issues.push({
      kind: "tag-vocabulary",
      severity: "warn",
      path: doc.repo_path,
      detail: `tags not in canonical vocabulary: ${novel.map((t) => `"${t}"`).join(", ")}`,
      hint:
        `Either rewrite to a canonical tag (see Meta/schema.md "Canonical tag vocabulary") ` +
        `or extend tools/bin/lint.ts CANONICAL_TAGS + the schema doc in the same commit. ` +
        `Tip: proper nouns (companies / products / models / SKUs) belong in ## Entities touched, not in tags.`,
    });
  }
  return issues;
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
    Sources:  ["type", "created", "updated", "raw_source", "tags"],
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
        continue;
      }
      // Sources `tags` must be a non-empty list. An empty `[]` literally
      // satisfies the "key present" check above but provides no signal
      // for corpus-level filtering — explicitly reject.
      if (doc.bucket === "Sources" && key === "tags") {
        const tags = fm[key];
        if (!Array.isArray(tags) || tags.length === 0) {
          issues.push({
            kind: "frontmatter",
            severity: "error",
            path: doc.repo_path,
            detail: `Sources frontmatter "tags" must be a non-empty list`,
          });
        }
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

const ALL_CHECKS: CheckKind[] = ["orphans", "dead-wikilinks", "tier-mismatch", "frontmatter", "raw-orphan", "sources-index", "source-image-refs", "observation-gaps", "tag-vocabulary"];

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
  if (checks.includes("source-image-refs")) issues.push(...checkSourceImageRefs(docs, repoRoot));
  if (checks.includes("observation-gaps")) issues.push(...checkObservationGaps(docs));
  if (checks.includes("tag-vocabulary")) issues.push(...checkTagVocabulary(docs));
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
      const infos = issues.filter((i) => i.severity === "info").length;
      console.log(
        `\n[lint] ${errs} error(s), ${warns} warning(s)` +
        (infos > 0 ? `, ${infos} info` : ""),
      );
    }
  }

  process.exit(issues.some((i) => i.severity === "error") ? 1 : 0);
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
