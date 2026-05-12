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

export type CheckKind = "orphans" | "dead-wikilinks" | "tier-mismatch" | "frontmatter" | "raw-orphan" | "sources-index" | "source-image-refs" | "source-image-count" | "observation-gaps" | "tag-vocabulary" | "topic-content-gaps" | "stale-synthesis" | "stale-source-review";

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
 * Host-agnostic 5-signal trigger for "does this slug's raw archive contain
 * load-bearing images that the Source body should reference?"
 *
 * Used by `checkSourceImageCount` below. May graduate to a shared helper if a
 * second consumer (e.g. an image-extraction CLI) lands. Pure filesystem read;
 * no host-specific logic; new hosts inherit the rule by default.
 */
/**
 * Collect image files in `slugDir`, recursing one level into `*-figures/`
 * (Marker's PDF figure output dir) and `*-images/`. Two-level scan is enough
 * for the conventions we use; deeper nesting is out of scope.
 */
function collectImageFiles(slugDir: string): { rel: string; abs: string; size: number }[] {
  const out: { rel: string; abs: string; size: number }[] = [];
  const IMG_RE = /\.(png|jpe?g|webp|gif|bmp|tiff?|svg)$/i;
  if (!existsSync(slugDir)) return out;
  let entries: string[];
  try { entries = readdirSync(slugDir); } catch { return out; }
  for (const name of entries) {
    const abs = join(slugDir, name);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isFile() && IMG_RE.test(name)) {
      out.push({ rel: name, abs, size: st.size });
    } else if (st.isDirectory() && /(^|-)(figures|images|slides)\/?$/.test(name)) {
      let subEntries: string[] = [];
      try { subEntries = readdirSync(abs); } catch { continue; }
      for (const sub of subEntries) {
        const subAbs = join(abs, sub);
        try {
          const subSt = statSync(subAbs);
          if (subSt.isFile() && IMG_RE.test(sub)) {
            out.push({ rel: join(name, sub), abs: subAbs, size: subSt.size });
          }
        } catch { /* skip */ }
      }
    }
  }
  return out;
}

export function shouldExtractImages(slugDir: string, bodyChars: number): { trigger: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const imgFiles = collectImageFiles(slugDir);
  if (imgFiles.length === 0 && !existsSync(slugDir)) return { trigger: false, reasons };
  const svgPresent = imgFiles.some((f) => /\.svg$/i.test(f.rel));
  const imgCount = imgFiles.length;
  let maxSize = 0;
  for (const f of imgFiles) maxSize = Math.max(maxSize, f.size);
  if (svgPresent) reasons.push("SVG present");
  if (maxSize >= 100 * 1024) reasons.push(`image ≥ 100 KB (max ${Math.round(maxSize / 1024)} KB)`);
  if (imgCount >= 3) reasons.push(`${imgCount} images (≥ 3)`);
  if (bodyChars > 0 && bodyChars < 500 && imgCount >= 1) reasons.push(`thin body (${bodyChars} chars) with ${imgCount} image(s)`);
  if (imgCount > 0 && bodyChars > 0 && bodyChars / imgCount < 200) reasons.push(`image-dense (${Math.round(bodyChars / imgCount)} chars/image)`);
  return { trigger: reasons.length > 0, reasons };
}

/**
 * Canonical "no load-bearing images" rationale phrases — each Source either
 * uses one of these verbatim OR includes 2-5 image refs. Tightened from a
 * permissive regex to prevent drift via ad-hoc reasons that bypass review.
 *
 * Synced with the schema's `## Visual observations` rule. Adding a new
 * canonical phrase: update BOTH the schema rule AND this list.
 */
const CANONICAL_RATIONALE_PHRASES: readonly string[] = [
  "all panels redundant with body text",
  "all panels decorative (logos, badges, photos)",
  "all images text-only (typed content extracted into body)",
  "figures inline-captioned in raw, no standalone images",
  "source has no images",
  "other images decorative",
];
function hasCanonicalRationale(body: string): boolean {
  for (const phrase of CANONICAL_RATIONALE_PHRASES) {
    // Match the canonical phrase verbatim in the body. Tolerant of optional
    // surrounding italics * and trailing period; not tolerant of paraphrase.
    if (body.includes(phrase)) return true;
  }
  return false;
}

/**
 * source-image-count: when a Source's raw archive shows load-bearing-image
 * signals (via `shouldExtractImages`), the Source body must EITHER include
 * 2–5 in-body `![]()` refs OR explicitly document why zero with a canonical
 * rationale line matching `*No load-bearing images — <reason>.*`.
 *
 * Sibling of `checkSourceImageRefs` (which validates file integrity); this
 * check enforces the schema's quantity + justification rule. Surfaces the
 * "lazy zero-image Source" failure mode that the schema's previous "omit the
 * section if zero" guidance silently enabled.
 *
 * Severity: warn (not error) — to allow incremental retroactive cleanup
 * without blocking commits.
 */
export function checkSourceImageCount(docs: DocMeta[], repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  const sources = docs.filter((d) => d.bucket === "Sources");

  // Build slug → slugDir map (same shape as checkRawOrphan).
  const rawRoot = join(repoRoot, "raw", "raindrop");
  const rawSlugs = new Map<string, string>();
  if (existsSync(rawRoot)) {
    for (const host of readdirSync(rawRoot)) {
      const hostDir = join(rawRoot, host);
      let st;
      try { st = statSync(hostDir); } catch { continue; }
      if (!st.isDirectory()) continue;
      for (const slug of readdirSync(hostDir)) {
        const slugDir = join(hostDir, slug);
        try { if (!statSync(slugDir).isDirectory()) continue; } catch { continue; }
        rawSlugs.set(slug, slugDir);
      }
    }
  }

  for (const doc of sources) {
    const slugDir = rawSlugs.get(doc.slug);
    if (!slugDir) continue; // raw-orphan covers this case
    const contentMd = join(slugDir, "content.md");
    let bodyChars = 0;
    try { bodyChars = statSync(contentMd).size; } catch { /* slug has no content.md; raw-orphan handles */ }
    const { trigger, reasons } = shouldExtractImages(slugDir, bodyChars);
    if (!trigger) continue;
    // Count image files available in raw archive — recurses one level into
    // `*-figures/` / `*-images/` / `*-slides/` subdirs (Marker PDF output, etc.).
    const imgCount = collectImageFiles(slugDir).length;
    const refCount = extractLocalImageRefs(doc.body).length;
    const hasRationale = hasCanonicalRationale(doc.body);
    // Required refs cap: "2-5 images" only applies when raw has ≥ 2 images to pick from.
    // If raw has only 1 image, 1 ref is the max possible; 0 refs still needs a rationale.
    const requiredMinRefs = Math.min(2, imgCount);
    if (refCount < requiredMinRefs && !hasRationale) {
      issues.push({
        kind: "source-image-count",
        severity: "warn",
        path: doc.repo_path,
        detail: `raw archive shows load-bearing-image signals (${reasons.join("; ")}; img_count=${imgCount}) but Source references ${refCount} image(s) and has no rationale line`,
        hint: `Add ${requiredMinRefs === 1 ? "1" : "2-5"} ![](../../raw/...) refs to ## Visual observations, OR add a "*No load-bearing images — <reason>.*" line per Meta/schema.md`,
      });
    } else if (refCount > 5) {
      issues.push({
        kind: "source-image-count",
        severity: "warn",
        path: doc.repo_path,
        detail: `Source references ${refCount} images (cap is 5); demote some to supporting bullets per Meta/schema.md image rule`,
        hint: `Visual observations should keep image refs to 2-5 load-bearing panels`,
      });
    }
  }

  return issues;
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
 * topic-content-gaps: warn when a Topic with source_count ≥ 3 still has
 * placeholder `## What` and `## Current understanding` bodies. Mirrors
 * the entity-side `observation-gaps` check — surfaces editorial debt on
 * the load-bearing Topic pages (where dead-end-stub clicks hurt) while
 * leaving low-traffic Topics (source_count < 3) silent.
 *
 * Detection: a section is "stub" if its body matches one of the
 * placeholder patterns we use when scaffolding Topic pages (`*Stub topic
 * — ...*`, `*Synthesis pending. See Sources drawn on below.*`, `*(stub
 * — ...*`, or empty). Both `## What` AND `## Current understanding` must
 * be stub for the WARN to fire — that distinguishes "scaffolding-only
 * page" from "definition-only page" (the latter is acceptable for a
 * Topic still accumulating Sources).
 */
export function checkTopicContentGaps(docs: DocMeta[]): Issue[] {
  const issues: Issue[] = [];
  const STUB_PATTERNS = [
    /\*?stub /i,
    /\*?to be expanded/i,
    /\*?synthesis pending/i,
    /\*?\(stub /i,
    /\*?populate as sources accumulate/i,
  ];
  const isStub = (body: string): boolean => {
    const trimmed = body.trim();
    if (trimmed.length === 0) return true;
    return STUB_PATTERNS.some((re) => re.test(trimmed));
  };
  for (const doc of docs.filter((d) => d.bucket === "Topics")) {
    const sourceCount = doc.frontmatter.source_count;
    if (typeof sourceCount !== "number" || sourceCount < 3) continue;
    const whatMatch = doc.body.match(/^## What\n\n(.*?)(?=\n## |\Z)/ms);
    const cuMatch = doc.body.match(/^## Current understanding\n\n(.*?)(?=\n## |\Z)/ms);
    const whatBody = whatMatch ? whatMatch[1] : "";
    const cuBody = cuMatch ? cuMatch[1] : "";
    if (isStub(whatBody) && isStub(cuBody)) {
      issues.push({
        kind: "topic-content-gaps",
        severity: "warn",
        path: doc.repo_path,
        detail:
          `Topic has source_count=${sourceCount} but ## What and ## Current understanding ` +
          `are both placeholders — load-bearing Topic pages need synthesis.`,
        hint:
          `LLM-editorial backfill: read each citing Source (grep the Topic name across ` +
          `Sources/2026/*.md) and write a synthesis paragraph in ## Current understanding. ` +
          `See Meta/schema.md §Topic-page structure.`,
      });
    }
  }
  return issues;
}

/**
 * stale-synthesis: warn when an active-tier Entity's `synthesis_updated_at`
 * is older than the newest `updated:` of any Source that wikilinks to it.
 *
 * Catches the "Synthesis paragraph asserts X, but a later Source contradicts
 * it" pattern that mechanical checks otherwise miss. The MLA case (Synthesis
 * said 'MLA is its decode kernel' while Observations documented 'Retired in
 * DeepSeek V4') is the canonical motivating example.
 *
 * Requires the entity to have a `synthesis_updated_at:` frontmatter field.
 * Entities without it fall back to `updated:`. Stub-Synthesis entities
 * (caught by other rules) are not flagged here.
 *
 * Severity: warn — operator regenerates Synthesis in-session.
 */
export function checkStaleSynthesis(docs: DocMeta[]): Issue[] {
  const issues: Issue[] = [];
  const SYNTHESIS_STUB_RE = /^\s*(\*Regenerated from Observations|\*Stub|\*Synthesis pending|\(to be filled in\))/im;

  // Source slug → updated date
  const sourceUpdated = new Map<string, string>();
  for (const d of docs) {
    if (d.bucket !== "Sources") continue;
    const u = String(d.frontmatter.updated ?? "");
    if (u) sourceUpdated.set(d.slug, u);
  }

  for (const d of docs) {
    if (d.bucket !== "Entities") continue;
    if (d.repo_path.includes("/_seen/")) continue; // active-tier only
    // Skip if Synthesis is stub-only (other lint rules catch those)
    const synthMatch = d.body.match(/^## Synthesis\s*$([\s\S]*?)(?=^## |\Z)/m);
    if (!synthMatch || SYNTHESIS_STUB_RE.test(synthMatch[1])) continue;

    const synthDate = String(d.frontmatter.synthesis_updated_at ?? d.frontmatter.updated ?? "");
    if (!synthDate) continue;

    // Find Sources that wikilink to this Entity; check newest `updated:` among them
    let newest: { slug: string; updated: string } | null = null;
    for (const other of docs) {
      if (other.bucket !== "Sources") continue;
      if (!other.wikilinks.has(d.slug)) continue;
      const su = sourceUpdated.get(other.slug);
      if (!su) continue;
      if (!newest || su > newest.updated) newest = { slug: other.slug, updated: su };
    }

    if (newest && newest.updated > synthDate) {
      issues.push({
        kind: "stale-synthesis",
        severity: "warn",
        path: d.repo_path,
        detail: `synthesis_updated_at=${synthDate} is older than newest citing Source updated=${newest.updated} ([[${newest.slug}]])`,
        hint: `Re-read citing Sources, rewrite ## Synthesis to reflect current state, bump synthesis_updated_at to today.`,
      });
    }
  }
  return issues;
}

/**
 * stale-source-review: warn when a Source's `last_reviewed_at` frontmatter
 * is much older than the latest raw archive revision date.
 *
 * Operator sets `last_reviewed_at: YYYY-MM-DD` when they re-read the raw
 * archive and confirm the summary is still current. If raw content drifts
 * later (newer revisions.jsonl entry), the lint flags the Source as
 * needing re-review.
 *
 * The check is opt-in by frontmatter: Sources without `last_reviewed_at`
 * are not flagged. Severity: warn. Hint suggests `hirono health-check
 * --scope drift` for the full audit picture.
 *
 * Threshold: 30 days. last_reviewed_at < (latest_revision_date - 30d) → flag.
 */
export function checkStaleSourceReview(docs: DocMeta[], repoRoot: string): Issue[] {
  const issues: Issue[] = [];
  const THRESHOLD_DAYS = 30;
  for (const d of docs) {
    if (d.bucket !== "Sources") continue;
    const lastReviewed = String(d.frontmatter.last_reviewed_at ?? "");
    if (!lastReviewed) continue;  // opt-in
    // Find the raw archive: raw/raindrop/<host>/<slug>/revisions.jsonl
    const rawRoot = `${repoRoot}/raw/raindrop`;
    let latestFetchedAt = "";
    try {
      const fs = require("node:fs") as typeof import("node:fs");
      const path = require("node:path") as typeof import("node:path");
      if (!fs.existsSync(rawRoot)) continue;
      for (const host of fs.readdirSync(rawRoot)) {
        const revPath = path.join(rawRoot, host, d.slug, "revisions.jsonl");
        if (!fs.existsSync(revPath)) continue;
        for (const line of fs.readFileSync(revPath, "utf8").split("\n")) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (typeof obj.fetched_at === "string" && obj.fetched_at > latestFetchedAt) {
              latestFetchedAt = obj.fetched_at;
            }
          } catch { /* skip malformed */ }
        }
        break;  // found raw archive; no other host should match
      }
    } catch { continue; }
    if (!latestFetchedAt) continue;
    const lastFetchDate = latestFetchedAt.slice(0, 10);
    const reviewedTs = Date.parse(lastReviewed);
    const fetchedTs = Date.parse(lastFetchDate);
    if (!isFinite(reviewedTs) || !isFinite(fetchedTs)) continue;
    const diffDays = Math.floor((fetchedTs - reviewedTs) / (24 * 3600 * 1000));
    if (diffDays > THRESHOLD_DAYS) {
      issues.push({
        kind: "stale-source-review",
        severity: "warn",
        path: d.repo_path,
        detail: `last_reviewed_at=${lastReviewed} is ${diffDays}d older than latest raw fetch (${lastFetchDate})`,
        hint: `Re-read the raw archive, verify summary still reflects current content, bump last_reviewed_at to today.`,
      });
    }
  }
  return issues;
}

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
    Sources:  ["type", "created", "updated", "source_url", "tags"],
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

const ALL_CHECKS: CheckKind[] = ["orphans", "dead-wikilinks", "tier-mismatch", "frontmatter", "raw-orphan", "sources-index", "source-image-refs", "source-image-count", "observation-gaps", "tag-vocabulary", "topic-content-gaps", "stale-synthesis", "stale-source-review"];

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
  if (checks.includes("source-image-count")) issues.push(...checkSourceImageCount(docs, repoRoot));
  if (checks.includes("observation-gaps")) issues.push(...checkObservationGaps(docs));
  if (checks.includes("tag-vocabulary")) issues.push(...checkTagVocabulary(docs));
  if (checks.includes("topic-content-gaps")) issues.push(...checkTopicContentGaps(docs));
  if (checks.includes("stale-synthesis")) issues.push(...checkStaleSynthesis(docs));
  if (checks.includes("stale-source-review")) issues.push(...checkStaleSourceReview(docs, repoRoot));
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
