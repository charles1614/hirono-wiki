#!/usr/bin/env node
/**
 * reindex: scan the wiki, count wikilink references per slug, promote entities
 * that cross the tier threshold, and regenerate the three sharded indexes +
 * 00_Meta/index.md counts. Also updates `refs` / `tier` / `source_count` in
 * entity and topic frontmatter.
 *
 * Runs over filesystem state (no Lark calls). Idempotent: running twice in a
 * row is a no-op after the first run converges.
 *
 *   npx tsx tools/bin/reindex.ts            # full pass, write changes
 *   npx tsx tools/bin/reindex.ts --dry-run  # print what would change, no writes
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
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

const PROMOTION_THRESHOLD = 3;
const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..");

// ---------------------------------------------------------------------------
// parse + wikilink extraction
// ---------------------------------------------------------------------------

interface DocMeta {
  repo_path: string;
  slug: string;
  bucket: Bucket;
  frontmatter: Record<string, unknown>;
  body: string;
  wikilinks: Set<string>;  // unique outgoing wikilink targets
}

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

export function extractWikilinks(body: string): Set<string> {
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
// ref counting
// ---------------------------------------------------------------------------

/**
 * refs[slug] = number of *content* pages that contain a wikilink to slug.
 * Content pages = Sources + Entities + Topics. Meta/ pages are navigational
 * (index catalogs etc.) and are excluded from citing-side counts so that
 * the auto-generated indexes can't inflate tier promotions.
 */
export function countRefs(docs: DocMeta[]): Map<string, number> {
  const refs = new Map<string, number>();
  for (const doc of docs) {
    if (doc.bucket === "00_Meta") continue;
    for (const target of doc.wikilinks) {
      if (target === doc.slug) continue;
      refs.set(target, (refs.get(target) ?? 0) + 1);
    }
  }
  return refs;
}

/**
 * source_count[topic_slug] = number of distinct Sources/ pages that this
 * topic page is connected to via wikilinks — counted **either direction**:
 *   - 03_Sources/X cites [[Topic]] in its body
 *   - Topic cites [[03_Sources/X]] in its body (e.g., "Sources drawn on" section)
 *
 * Either direction signals "this topic synthesizes from / is anchored by
 * source X." Counting only one direction misses query-loop topics (they cite
 * sources outbound but no source has been re-edited to cite them back).
 */
export function countSourceCites(docs: DocMeta[]): Map<string, number> {
  // First, build a slug → bucket lookup so we can identify Sources/ slugs.
  const bucketOfSlug = new Map<string, Bucket>();
  for (const d of docs) bucketOfSlug.set(d.slug, d.bucket);

  // For each (topicSlug, sourceSlug) pair connected in either direction, record once.
  const connections = new Map<string, Set<string>>();  // topicSlug → set of sourceSlugs
  const note = (topicSlug: string, sourceSlug: string) => {
    if (!connections.has(topicSlug)) connections.set(topicSlug, new Set());
    connections.get(topicSlug)!.add(sourceSlug);
  };

  for (const doc of docs) {
    for (const target of doc.wikilinks) {
      if (target === doc.slug) continue;
      const targetBucket = bucketOfSlug.get(target);
      // direction 1: a Source links to a Topic
      if (doc.bucket === "03_Sources" && targetBucket === "01_Topics") {
        note(target, doc.slug);
      }
      // direction 2: a Topic links to a Source
      if (doc.bucket === "01_Topics" && targetBucket === "03_Sources") {
        note(doc.slug, target);
      }
    }
  }

  const count = new Map<string, number>();
  for (const [topic, srcs] of connections) count.set(topic, srcs.size);
  return count;
}

/**
 * For each Entity slug, return the set of Source slugs that wikilink it.
 *
 * Used to surface Entities whose Observations block is empty/placeholder
 * despite refs > 0 — a structural gap the schema's "every observation cites
 * its source" rule wants closed. Reindex doesn't auto-write observation text
 * (we can't synthesize the source's claim about the entity from outside the
 * source), but we DO surface the gap so the operator / ingest agent knows
 * what's missing.
 */
export function reverseSourceCitations(docs: DocMeta[]): Map<string, Set<string>> {
  const bucketOfSlug = new Map<string, Bucket>();
  for (const d of docs) bucketOfSlug.set(d.slug, d.bucket);
  const out = new Map<string, Set<string>>();  // entitySlug → set of sourceSlugs that cite it
  for (const doc of docs) {
    if (doc.bucket !== "03_Sources") continue;
    for (const target of doc.wikilinks) {
      if (target === doc.slug) continue;
      const targetBucket = bucketOfSlug.get(target);
      if (targetBucket !== "02_Entities") continue;
      if (!out.has(target)) out.set(target, new Set());
      out.get(target)!.add(doc.slug);
    }
  }
  return out;
}

export interface ObservationGap {
  slug: string;
  refs: number;
  citingSources: string[];   // every Source that wikilinks this entity
  missingSources: string[];  // citingSources whose slug doesn't appear in the entity's Observations block
}

/**
 * For each Entity doc, parse its `## Observations` section and find which
 * citing-Source slugs are already cited there. Anything missing is a gap.
 *
 * Heuristic for "Observations is empty / placeholder": the section body
 * contains either (a) only the placeholder line "(auto-populated as Sources
 * cite this entity)" or (b) no `[[<source-slug>]]` references where the
 * source slug looks like `YYYY-MM-DD-...`.
 */
export function computeObservationGaps(
  docs: DocMeta[],
  refs: Map<string, number>,
): ObservationGap[] {
  const citations = reverseSourceCitations(docs);
  const gaps: ObservationGap[] = [];
  for (const doc of docs) {
    if (doc.bucket !== "02_Entities") continue;
    const citing = citations.get(doc.slug);
    if (!citing || citing.size === 0) continue;

    // Extract the Observations section body.
    const obsMatch = doc.body.match(/## Observations\b[\s\S]*?(?=\n## |\n#[^\n]|$)/);
    const obsBody = obsMatch ? obsMatch[0] : "";

    // Find Source slugs (YYYY-MM-DD-prefixed) cited inside Observations.
    const citedInObs = new Set<string>();
    for (const m of obsBody.matchAll(/\[\[(\d{4}-\d{2}-\d{2}-[^\]|]+)/g)) {
      citedInObs.add(m[1].trim());
    }

    const missing = [...citing].filter((s) => !citedInObs.has(s));
    if (missing.length === 0) continue;
    gaps.push({
      slug: doc.slug,
      refs: refs.get(doc.slug) ?? 0,
      citingSources: [...citing].sort(),
      missingSources: missing.sort(),
    });
  }
  // Highest-refs entities first — biggest debt.
  gaps.sort((a, b) => b.refs - a.refs);
  return gaps;
}

// ---------------------------------------------------------------------------
// frontmatter mutations (entity + topic)
// ---------------------------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Normalize frontmatter for re-serialization. Two YAML/gray-matter quirks
 * mutate the on-disk date format even when the value isn't changing:
 *
 *   1. YAML parses unquoted `2026-05-12` as a JavaScript `Date`; `matter
 *      .stringify` then renders it as `2026-05-12T00:00:00.000Z`.
 *   2. If we pre-stringify the date to `"2026-05-12"`, gray-matter's
 *      js-yaml dump wraps it as `'2026-05-12'` (quoted) because the
 *      string looks like a date and YAML 1.1 spec round-trip rules
 *      mandate quoting to disambiguate.
 *
 * Fix in two parts: (a) `normalizeDateFields` coerces Date / ISO-string
 * values back to YYYY-MM-DD strings before stringify; (b) `unquoteDateLines`
 * post-processes the serialized output to strip the surrounding quotes
 * on `created:` / `updated:` lines, restoring the unquoted on-disk shape.
 *
 * Per `00_Meta/schema.md` decision D7 (date format normalization).
 */
function normalizeDateFields(fm: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fm };
  for (const key of ["created", "updated"]) {
    const v = out[key];
    if (v instanceof Date) {
      out[key] = v.toISOString().slice(0, 10);
    } else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      // Already-stringified ISO timestamp from a prior pass — strip back.
      out[key] = v.slice(0, 10);
    }
  }
  return out;
}

/**
 * Strip the YAML-mandated single quotes from `created:` / `updated:` date
 * lines. Applied after `matter.stringify` because gray-matter / js-yaml
 * always quotes string-typed dates per YAML 1.1 round-trip rules. Leaves
 * non-date string values alone (the regex anchors on YYYY-MM-DD shape).
 */
function unquoteDateLines(text: string): string {
  return text.replace(
    /^(created|updated):\s*'(\d{4}-\d{2}-\d{2})'\s*$/gm,
    "$1: $2",
  );
}

interface Pending {
  oldPath: string;
  newPath: string;        // may equal oldPath
  newContent: string;
  reason: string;
}

function planEntityUpdate(doc: DocMeta, refs: number): Pending | null {
  const fm = doc.frontmatter;
  const currentRefs = typeof fm.refs === "number" ? fm.refs : undefined;
  const currentTier = fm.tier;
  const shouldBeActive = refs >= PROMOTION_THRESHOLD;
  const inSeenDir = doc.repo_path.includes("/_seen/");

  const willPromote = shouldBeActive && currentTier === "seen";
  const refsChanged = currentRefs !== refs;
  const tierOutOfSync =
    (currentTier === "seen" && shouldBeActive) ||
    (currentTier === "active" && !shouldBeActive && inSeenDir);
  // note: we never demote (remove "active" → "seen"); see schema.md

  if (!refsChanged && !tierOutOfSync) return null;

  const newFm: Record<string, unknown> = { ...fm, refs };
  if (willPromote) newFm.tier = "active";
  newFm.updated = today();
  const newContent = unquoteDateLines(matter.stringify(doc.body, normalizeDateFields(newFm)));

  const reasonParts: string[] = [];
  if (refsChanged) reasonParts.push(`refs ${currentRefs ?? "?"} → ${refs}`);
  if (willPromote) reasonParts.push("promote seen → active");

  return {
    oldPath: doc.repo_path,
    newPath: willPromote && inSeenDir
      ? doc.repo_path.replace("/_seen/", "/")
      : doc.repo_path,
    newContent,
    reason: reasonParts.join("; "),
  };
}

function planTopicUpdate(doc: DocMeta, sourceCount: number): Pending | null {
  const fm = doc.frontmatter;
  const current = typeof fm.source_count === "number" ? fm.source_count : undefined;
  if (current === sourceCount) return null;

  const newFm = { ...fm, source_count: sourceCount, updated: today() };
  return {
    oldPath: doc.repo_path,
    newPath: doc.repo_path,
    newContent: unquoteDateLines(matter.stringify(doc.body, normalizeDateFields(newFm))),
    reason: `source_count ${current ?? "?"} → ${sourceCount}`,
  };
}

// ---------------------------------------------------------------------------
// index regeneration
// ---------------------------------------------------------------------------

function firstH1(body: string): string {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}

/** Strip the "[YYYY-MM-DD] " prefix from a source H1, if present. */
function humanTitle(h1: string): string {
  return h1.replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, "").trim();
}

function rawSourceHost(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return raw.startsWith("lark://") ? "lark" : (raw || "—");
  }
}

function renderSourcesIndex(docs: DocMeta[]): string {
  const sources = docs.filter((d) => d.bucket === "03_Sources");
  const byYear = new Map<string, DocMeta[]>();
  for (const d of sources) {
    const m = d.repo_path.match(/Sources\/(\d{4})\//);
    const year = m ? m[1] : "unknown";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(d);
  }

  const lines: string[] = [];
  lines.push("---");
  lines.push("created: 2026-04-19");
  lines.push(`updated: ${today()}`);
  lines.push("type: meta");
  lines.push("---");
  lines.push("");
  lines.push("# Index — Sources");
  lines.push("");
  lines.push("Every ingested source page, grouped by year. Regenerated by `tools/bin/reindex.ts`.");
  lines.push("");

  if (byYear.size === 0) {
    lines.push("_(none yet)_");
    lines.push("");
    return lines.join("\n") + "\n";
  }

  const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));
  for (const year of years) {
    lines.push(`## ${year}`);
    lines.push("");
    const entries = byYear.get(year)!.sort((a, b) => b.slug.localeCompare(a.slug));
    for (const d of entries) {
      const title = humanTitle(firstH1(d.body) || d.slug);
      const raw = String(d.frontmatter.source_url ?? "");
      const host = rawSourceHost(raw);
      lines.push(`- [[${d.slug}]] — ${title} _(${host})_`);
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function renderEntitiesIndex(
  docs: DocMeta[],
  refs: Map<string, number>,
): string {
  const entities = docs.filter((d) => d.bucket === "02_Entities");
  const active = entities.filter((d) => !d.repo_path.includes("/_seen/"));
  const seen = entities.filter((d) => d.repo_path.includes("/_seen/"));

  const lines: string[] = [];
  lines.push("---");
  lines.push("created: 2026-04-19");
  lines.push(`updated: ${today()}`);
  lines.push("type: meta");
  lines.push("---");
  lines.push("");
  lines.push("# Index — Entities");
  lines.push("");
  lines.push(
    "Every entity page. Tier split: **active** (≥3 refs, `02_Entities/`) vs **seen** (1–2 refs, `02_Entities/_seen/`). Regenerated by `tools/bin/reindex.ts`.",
  );
  lines.push("");

  const renderSection = (title: string, arr: DocMeta[]) => {
    lines.push(`## ${title}`);
    lines.push("");
    if (arr.length === 0) {
      lines.push("_(none yet)_");
      lines.push("");
      return;
    }
    const sorted = [...arr].sort((a, b) => {
      const rd = (refs.get(b.slug) ?? 0) - (refs.get(a.slug) ?? 0);
      return rd !== 0 ? rd : a.slug.localeCompare(b.slug);
    });
    for (const d of sorted) {
      const n = refs.get(d.slug) ?? 0;
      const oneliner = firstNonFrontmatterParagraph(d.body);
      lines.push(`- **[[${d.slug}]]** _(${n} refs)_ — ${oneliner}`);
    }
    lines.push("");
  };
  renderSection("Active (≥3 refs)", active);
  renderSection("Seen (1–2 refs)", seen);

  return lines.join("\n") + "\n";
}

function renderTopicsIndex(
  docs: DocMeta[],
  sourceCounts: Map<string, number>,
): string {
  const topics = docs.filter((d) => d.bucket === "01_Topics")
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const lines: string[] = [];
  lines.push("---");
  lines.push("created: 2026-04-19");
  lines.push(`updated: ${today()}`);
  lines.push("type: meta");
  lines.push("---");
  lines.push("");
  lines.push("# Index — Topics");
  lines.push("");
  lines.push("Every synthesis page. Regenerated by `tools/bin/reindex.ts`.");
  lines.push("");

  if (topics.length === 0) {
    lines.push("_(none yet)_");
    return lines.join("\n") + "\n";
  }

  for (const d of topics) {
    const n = sourceCounts.get(d.slug) ?? 0;
    const oneliner = firstNonFrontmatterParagraph(d.body);
    lines.push(`- **[[${d.slug}]]** _(${n} sources)_ — ${oneliner}`);
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

function renderIndexOverview(
  docs: DocMeta[],
): string {
  const sources = docs.filter((d) => d.bucket === "03_Sources").length;
  const entities = docs.filter((d) => d.bucket === "02_Entities");
  const active = entities.filter((d) => !d.repo_path.includes("/_seen/")).length;
  const seen = entities.length - active;
  const topics = docs.filter((d) => d.bucket === "01_Topics").length;
  const total = docs.length;

  return `---
created: 2026-04-19
updated: ${today()}
type: meta
---

# Index — lay of the land

One-page overview. Detailed catalogs live in the sharded indexes below.

## Thesis

- **[[Synthesis]]** — what this corpus collectively argues. Start here for the through-line; come back to the catalogs below for specific pages.

## Catalogs

- **[[index-sources]]** — all source pages, by year
- **[[index-entities]]** — all entities, split active vs seen
- **[[index-topics]]** — all synthesis pages

## Live log

- **[[log-2026]]** — this year's ingest / query / refactor entries

## Schema

- **[[schema]]** — conventions for how pages are written here

## Current state

_Regenerated by \`tools/bin/reindex.ts\` after each ingest._

- Sources: ${sources}
- Entities (active): ${active}
- Entities (seen):   ${seen}
- Topics: ${topics}
- Total pages: ${total}

## How to navigate

- **Looking for a specific thing?** Search by slug: \`rg '\\[\\[Megatron\\]\\]' .\` or use the Lark graph view for visual traversal.
- **Want to see what's new?** Read the top of [[log-2026]].
- **Want to write a query against the wiki?** Ask Claude; it reads indexes + relevant docs and can file the answer back as a [[01_Topics/]] page.
`;
}

function firstNonFrontmatterParagraph(body: string): string {
  // body is already frontmatter-stripped by gray-matter. Skip the H1 and blanks.
  const lines = body.split("\n");
  let seenH1 = false;
  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      seenH1 = true;
      continue;
    }
    if (!seenH1) continue;
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    // Truncate for index readability.
    return t.length > 140 ? t.slice(0, 137) + "…" : t;
  }
  return "";
}

// ---------------------------------------------------------------------------
// orchestration
// ---------------------------------------------------------------------------

interface ReindexResult {
  pending: Pending[];
  indexFiles: Array<{ path: string; content: string }>;
  refs: Map<string, number>;
}

export function computeReindex(repoRoot: string): ReindexResult {
  const paths = walkWikiDocs(repoRoot);
  const docs = paths.map((p) => parseDoc(repoRoot, p));
  const refs = countRefs(docs);
  const sourceCounts = countSourceCites(docs);

  const pending: Pending[] = [];
  const pathMoves = new Map<string, string>();  // oldPath → newPath for renamed entities
  for (const doc of docs) {
    if (doc.bucket === "02_Entities") {
      const p = planEntityUpdate(doc, refs.get(doc.slug) ?? 0);
      if (p) {
        pending.push(p);
        if (p.oldPath !== p.newPath) pathMoves.set(p.oldPath, p.newPath);
      }
    } else if (doc.bucket === "01_Topics") {
      const p = planTopicUpdate(doc, sourceCounts.get(doc.slug) ?? 0);
      if (p) pending.push(p);
    }
  }

  // Apply promotions in-memory so index regeneration sees post-promotion state.
  const virtualDocs = docs.map((d) => {
    const moved = pathMoves.get(d.repo_path);
    return moved ? { ...d, repo_path: moved } : d;
  });

  const indexFiles = [
    { path: "00_Meta/index.md", content: renderIndexOverview(virtualDocs) },
    { path: "00_Meta/index-sources.md", content: renderSourcesIndex(virtualDocs) },
    { path: "00_Meta/index-entities.md", content: renderEntitiesIndex(virtualDocs, refs) },
    { path: "00_Meta/index-topics.md", content: renderTopicsIndex(virtualDocs, sourceCounts) },
  ];
  return { pending, indexFiles, refs };
}

function apply(repoRoot: string, result: ReindexResult, dryRun: boolean): void {
  // 02_Entities/topics frontmatter updates + renames
  for (const p of result.pending) {
    if (p.oldPath === p.newPath) {
      console.log(`[reindex] ${dryRun ? "would update" : "update"}: ${p.oldPath}  (${p.reason})`);
      if (!dryRun) writeFileSync(join(repoRoot, p.oldPath), p.newContent, "utf8");
    } else {
      console.log(`[reindex] ${dryRun ? "would move" : "move"}: ${p.oldPath} → ${p.newPath}  (${p.reason})`);
      if (!dryRun) {
        writeFileSync(join(repoRoot, p.oldPath), p.newContent, "utf8");
        renameSync(join(repoRoot, p.oldPath), join(repoRoot, p.newPath));
      }
    }
  }

  // Index files — only write if content changed.
  for (const ix of result.indexFiles) {
    const full = join(repoRoot, ix.path);
    let existing = "";
    try { existing = readFileSync(full, "utf8"); } catch {}
    if (existing === ix.content) continue;
    console.log(`[reindex] ${dryRun ? "would rewrite" : "rewrite"}: ${ix.path}`);
    if (!dryRun) writeFileSync(full, ix.content, "utf8");
  }
}

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const result = computeReindex(REPO_ROOT);

  // Summary line for ref counts of the top 10 slugs.
  const top = [...result.refs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("[reindex] top slugs by refs:");
  for (const [slug, n] of top) console.log(`  ${String(n).padStart(3)} ${slug}`);

  apply(REPO_ROOT, result, dryRun);

  // Surface Entities with refs > 0 but missing Observations citations.
  // Reindex doesn't auto-write observation text (we can't synthesize what
  // the source said about the entity); but we DO list the gap so the
  // operator / ingest agent knows what's pending. This is the
  // post-batch-close checklist — each line is one piece of LLM work.
  const paths = walkWikiDocs(REPO_ROOT);
  const docs = paths.map((p) => parseDoc(REPO_ROOT, p));
  const gaps = computeObservationGaps(docs, result.refs);
  if (gaps.length > 0) {
    const TOP_N = 10;
    const shown = gaps.slice(0, TOP_N);
    console.log(`\n[reindex] ${gaps.length} entit${gaps.length === 1 ? "y" : "ies"} with refs > 0 but Observations don't cite all citing Sources:`);
    for (const g of shown) {
      console.log(`  ${g.slug.padEnd(28)} refs=${g.refs}  missing ${g.missingSources.length} observation${g.missingSources.length === 1 ? "" : "s"}`);
      const MAX_SOURCES_SHOWN = 3;
      for (const s of g.missingSources.slice(0, MAX_SOURCES_SHOWN)) {
        console.log(`      ← [[${s}]]`);
      }
      if (g.missingSources.length > MAX_SOURCES_SHOWN) {
        console.log(`      ← ...and ${g.missingSources.length - MAX_SOURCES_SHOWN} more`);
      }
    }
    if (gaps.length > TOP_N) {
      console.log(`  (...${gaps.length - TOP_N} more not shown)`);
    }
    console.log(`[reindex] tip: each gap is one piece of LLM work — open the Entity file, view the listed Source(s), append a cited Observation bullet per schema.md §entity-page.`);
  }

  if (dryRun) console.log("[reindex] dry-run — no writes performed");
  else console.log("[reindex] done");
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
