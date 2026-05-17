/**
 * `hirono health-check` — read-only audit of LLM-judgment debt in the wiki.
 *
 * Surfaces five categories of curation work that mechanical lint can't catch:
 *  1. **Orphans** — _seen/ entities at refs=0.
 *  2. **Stale Synthesis** — active entities whose `synthesis_updated_at` is
 *     older than the newest cited Source's `updated:`.
 *  3. **Duplicate-pair candidates** — entity slugs that look like duplicates
 *     (Levenshtein similarity or case-insensitive collisions).
 *  4. **Topic-name collisions** — Topic slugs colliding after
 *     lowercase-and-strip-punctuation.
 *  5. **Observation-Synthesis contradiction candidates** — active entities
 *     whose Observations contain retraction phrases (`retired`, `superseded`,
 *     `no longer`, etc.) but whose Synthesis doesn't acknowledge them.
 *
 * Pure read-only. Emits structured markdown report. Operator runs the
 * suggested CLI commands (rename-entity / merge-entities / bulk-delete-orphans)
 * for structural items + asks Claude in-session for the judgment items.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { walkWikiDocs } from "../link-map.ts";
import { extractWikilinks } from "../bin/reindex.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

type Scope = "all" | "orphans" | "stale" | "duplicates" | "topic-collisions" | "contradictions" | "drift" | "sources";

interface ParsedArgs {
  scope: Scope;
  writeReport: string | null;
  json: boolean;
}

function usage(): never {
  console.error(`usage: hirono health-check [--scope <s>] [--write-report <path>] [--json]

Read-only audit of LLM-judgment curation debt. Emits markdown report.

Flags:
  --scope <s>            One of: all (default) | orphans | stale | duplicates |
                         topic-collisions | contradictions | drift | sources
  --write-report <path>  Write the report to <path>. Default: stdout.
  --json                 Emit JSON instead of markdown.

Audits (per scope):
  orphans              _seen/ entities at refs=0. Run \`bulk-delete-orphans\` to fix.
  stale                active entities with stale Synthesis vs newer citing Sources.
                       Operator regenerates Synthesis in-session.
  duplicates           Entity-slug pairs with high name similarity. Run
                       \`merge-entities\` or \`rename-entity\` to fix.
  topic-collisions     Topic slug-collision-after-normalization. Run
                       \`merge-topics\` to fix.
  contradictions       Active-entity Synthesis-vs-Observations contradictions.
                       Operator regenerates Synthesis.
  drift                Raw-archive content-SHA drift, dead URLs not yet
                       pinned, Raindrop-deleted URLs, age-stale upstreams,
                       Sources older than their cited raw archive.
  sources              0-wikilink Sources, tag-outliers, age-stale Sources
                       (no recent revision), Sources cited only by Topics.

Examples:
  hirono health-check
  hirono health-check --scope stale --write-report /tmp/wiki-stale.md
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let scope: Scope = "all";
  let writeReport: string | null = null;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scope") {
      i++;
      const v = (argv[i] ?? "all").trim();
      if (!["all", "orphans", "stale", "duplicates", "topic-collisions", "contradictions", "drift", "sources"].includes(v)) {
        console.error(`unknown scope: ${v}`); usage();
      }
      scope = v as Scope;
    } else if (a === "--write-report") {
      i++;
      writeReport = (argv[i] ?? "").trim() || null;
    } else if (a === "--json") {
      json = true;
    } else if (a === "--help" || a === "-h") {
      usage();
    } else {
      console.error(`unknown flag: ${a}`); usage();
    }
  }
  return { scope, writeReport, json };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Doc {
  path: string;
  slug: string;
  frontmatter: Record<string, unknown>;
  body: string;
  wikilinks: Set<string>;
}

function loadDocs(repoRoot: string): Doc[] {
  const paths = walkWikiDocs(repoRoot);
  const out: Doc[] = [];
  for (const p of paths) {
    let raw: string;
    try { raw = readFileSync(join(repoRoot, p), "utf8"); } catch { continue; }
    const { data, content } = matter(raw);
    out.push({
      path: p,
      slug: p.split("/").pop()!.replace(/\.md$/, ""),
      frontmatter: data as Record<string, unknown>,
      body: content,
      wikilinks: extractWikilinks(content),
    });
  }
  return out;
}

function computeRefs(docs: Doc[]): Map<string, number> {
  const refs = new Map<string, number>();
  for (const doc of docs) {
    if (doc.path.startsWith("00_Meta/")) continue;
    for (const target of doc.wikilinks) {
      if (target === doc.slug) continue;
      refs.set(target, (refs.get(target) ?? 0) + 1);
    }
  }
  return refs;
}

function levenshtein(a: string, b: string): number {
  // Small-string Levenshtein. O(|a|*|b|) — fine at our scale.
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

// ---------------------------------------------------------------------------
// Audit checks
// ---------------------------------------------------------------------------

interface OrphanItem { slug: string; path: string }
interface StaleItem { slug: string; synthesisDate: string | null; newestCitingSource: { slug: string; updated: string } }
interface DuplicateItem { a: string; b: string; aPath: string; bPath: string; similarity: number; combinedRefs: number }
interface CollisionItem { a: string; b: string }
interface ContradictionItem { slug: string; quote: string; sourceSlug: string }

function auditOrphans(docs: Doc[], refs: Map<string, number>): OrphanItem[] {
  const out: OrphanItem[] = [];
  for (const doc of docs) {
    if (!doc.path.startsWith("02_Entities/_seen/")) continue;
    if ((refs.get(doc.slug) ?? 0) === 0) {
      out.push({ slug: doc.slug, path: doc.path });
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

function auditStaleSynthesis(docs: Doc[]): StaleItem[] {
  const out: StaleItem[] = [];
  // Build slug→updated for Sources
  const sourceUpdated = new Map<string, string>();
  for (const d of docs) {
    if (!d.path.startsWith("03_Sources/")) continue;
    const u = String(d.frontmatter.updated ?? "");
    if (u) sourceUpdated.set(d.slug, u);
  }
  for (const d of docs) {
    if (!d.path.startsWith("02_Entities/") || d.path.startsWith("02_Entities/_seen/")) continue;
    // Get the entity's synthesis_updated_at, or fall back to `updated`
    const synthDate = (d.frontmatter.synthesis_updated_at as string | undefined)
      ?? (d.frontmatter.updated as string | undefined)
      ?? null;
    if (!synthDate) continue;
    // Find citing Sources via wikilinks
    let newest: { slug: string; updated: string } | null = null;
    for (const otherDoc of docs) {
      if (!otherDoc.path.startsWith("03_Sources/")) continue;
      if (!otherDoc.wikilinks.has(d.slug)) continue;
      const su = sourceUpdated.get(otherDoc.slug);
      if (!su) continue;
      if (!newest || su > newest.updated) newest = { slug: otherDoc.slug, updated: su };
    }
    if (newest && newest.updated > synthDate) {
      out.push({ slug: d.slug, synthesisDate: synthDate, newestCitingSource: newest });
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

function auditDuplicateEntities(docs: Doc[], refs: Map<string, number>): DuplicateItem[] {
  const entities = docs.filter((d) => d.path.startsWith("02_Entities/"));
  const out: DuplicateItem[] = [];
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i], b = entities[j];
      const lowA = a.slug.toLowerCase();
      const lowB = b.slug.toLowerCase();
      const dist = levenshtein(lowA, lowB);
      const maxLen = Math.max(lowA.length, lowB.length);
      const similarity = 1 - dist / maxLen;
      // Threshold: case-insensitive exact match (similarity = 1) OR similarity > 0.8 with maxLen >= 4
      if (similarity >= 0.8 && maxLen >= 4) {
        // Skip plausibly-distinct hardware-SKU pairs (H100 vs H200, B200 vs B300)
        // — these are SKU distinctions, not duplicates. Heuristic: both end in digits.
        if (/\d$/.test(lowA) && /\d$/.test(lowB) && lowA.slice(0, -1) === lowB.slice(0, -1)) continue;
        const combinedRefs = (refs.get(a.slug) ?? 0) + (refs.get(b.slug) ?? 0);
        out.push({ a: a.slug, b: b.slug, aPath: a.path, bPath: b.path, similarity, combinedRefs });
      }
    }
  }
  return out.sort((a, b) => b.combinedRefs - a.combinedRefs);
}

function auditTopicCollisions(docs: Doc[]): CollisionItem[] {
  const topics = docs.filter((d) => d.path.startsWith("01_Topics/"));
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const buckets = new Map<string, string[]>();
  for (const t of topics) {
    const key = normalize(t.slug);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t.slug);
  }
  const out: CollisionItem[] = [];
  for (const [, slugs] of buckets) {
    if (slugs.length < 2) continue;
    for (let i = 0; i < slugs.length - 1; i++) {
      out.push({ a: slugs[i], b: slugs[i + 1] });
    }
  }
  return out;
}

const RETRACTION_RE = /\b(retired|superseded|walks? away from|returns? to|no longer|removed in|replaced (by|with)|deprecated|abandoned)\b/i;

function auditContradictions(docs: Doc[]): ContradictionItem[] {
  const out: ContradictionItem[] = [];
  for (const d of docs) {
    if (!d.path.startsWith("02_Entities/") || d.path.startsWith("02_Entities/_seen/")) continue;
    // Extract Synthesis + Observations sections
    const synthMatch = d.body.match(/^## Synthesis\s*$([\s\S]*?)(?=^## |\Z)/m);
    const obsMatch = d.body.match(/^## Observations\s*$([\s\S]*?)(?=^## |\Z)/m);
    if (!synthMatch || !obsMatch) continue;
    const synth = synthMatch[1];
    const obs = obsMatch[1];
    // Find bullets containing retraction phrases
    const bullets = obs.split(/\n(?=- )/).filter((b) => RETRACTION_RE.test(b));
    if (bullets.length === 0) continue;
    // Check whether the synthesis acknowledges them
    // Heuristic: if any retraction-phrase keyword from the obs bullet ALSO appears in synth, skip
    for (const bullet of bullets) {
      const keyword = bullet.match(RETRACTION_RE)?.[0].toLowerCase();
      if (keyword && synth.toLowerCase().includes(keyword)) continue;
      // Extract a Source citation from the bullet if present
      const sourceMatch = bullet.match(/\[\[(\d{4}-\d{2}-\d{2}-[^\]|]+)/);
      const sourceSlug = sourceMatch ? sourceMatch[1] : "(uncited)";
      const quote = bullet.replace(/\n+/g, " ").trim().slice(0, 160);
      out.push({ slug: d.slug, quote, sourceSlug });
      break;  // one per entity is enough to surface; operator finds the rest
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

// ---------------------------------------------------------------------------
// Drift + sources audits (Phase B.3)
// ---------------------------------------------------------------------------

interface ShaDriftItem { slug: string; rawDir: string; oldSha: string; newSha: string; sourceUpdated: string; latestRevAt: string }
interface DeadUrlItem { slug: string; rawDir: string; reason: string }
interface RaindropDeletedItem { slug: string; rawDir: string; url: string }
interface HeadStaleItem { slug: string; rawDir: string; lastCheckedAt: string; ageDays: number }
interface SourceOlderThanRawItem { slug: string; sourcePath: string; sourceUpdated: string; rawDir: string; rawUpdated: string }
interface ZeroWikilinkSourceItem { slug: string; sourcePath: string }
interface TagOutlierSourceItem { slug: string; sourcePath: string; tags: string[] }
interface AgeStaleSourceItem { slug: string; sourcePath: string; created: string; ageDays: number }
interface TopicOnlyCitedItem { slug: string; sourcePath: string; topicCiters: string[] }

interface DriftAudit {
  shaDrift: ShaDriftItem[];
  deadUrls: DeadUrlItem[];
  raindropDeleted: RaindropDeletedItem[];
  headStale: HeadStaleItem[];
  sourceOlderThanRaw: SourceOlderThanRawItem[];
}

interface SourcesAudit {
  zeroWikilink: ZeroWikilinkSourceItem[];
  tagOutliers: TagOutlierSourceItem[];
  ageStale: AgeStaleSourceItem[];
  topicOnlyCited: TopicOnlyCitedItem[];
}

/** Parse a revisions.jsonl into rows. */
function readRevisions(rawDir: string): Array<{ rev: number; content_sha: string; fetched_at: string; body_pruned?: boolean }> {
  const path = join(rawDir, "revisions.jsonl");
  if (!existsSync(path)) return [];
  const out: Array<{ rev: number; content_sha: string; fetched_at: string; body_pruned?: boolean }> = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return out.sort((a, b) => a.rev - b.rev);
}

/** Read source.json for a raw archive. */
function readSourceJson(rawDir: string): Record<string, unknown> | null {
  const path = join(rawDir, "source.json");
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

/** Iterate all raw archive directories: yields { rawDir (abs), slug, host }. */
function* walkRawArchives(repoRoot: string): Generator<{ rawDir: string; slug: string; host: string }> {
  const rawRoot = join(repoRoot, "raw", "raindrop");
  if (!existsSync(rawRoot)) return;
  for (const host of readdirSync(rawRoot)) {
    if (host.startsWith(".") || host.startsWith("_")) continue;
    const hostDir = join(rawRoot, host);
    let entries: string[];
    try { entries = readdirSync(hostDir); } catch { continue; }
    for (const slug of entries) {
      const rawDir = join(hostDir, slug);
      try { if (!statSync(rawDir).isDirectory()) continue; } catch { continue; }
      yield { rawDir, slug, host };
    }
  }
}

/** Load Raindrop URL cache: returns the set of currently-bookmarked URLs (lowercased). */
function loadRaindropUrlCache(repoRoot: string): Set<string> {
  const path = join(repoRoot, ".wiki-raindrop-cache.json");
  if (!existsSync(path)) return new Set();
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as { items?: Array<{ link?: string }> };
    const out = new Set<string>();
    for (const it of data.items ?? []) {
      if (it.link) out.add(it.link.toLowerCase().trim());
    }
    return out;
  } catch { return new Set(); }
}

/** Load sources-health-overrides.md and return pinned URLs by pin-kind. */
function loadHealthOverrides(repoRoot: string): Map<string, string[]> {
  const path = join(repoRoot, "00_Meta", "sources-health-overrides.md");
  if (!existsSync(path)) return new Map();
  const out = new Map<string, string[]>();
  let content: string;
  try { content = readFileSync(path, "utf8"); } catch { return new Map(); }
  for (const line of content.split("\n")) {
    const m = line.match(/^-\s+`([^`]+)`.*?pin-kind=([a-z-]+)/i);
    if (!m) continue;
    const slug = m[1].trim();
    const kind = m[2].trim();
    if (!out.has(kind)) out.set(kind, []);
    out.get(kind)!.push(slug);
  }
  return out;
}

function ageDaysFrom(isoDate: string): number {
  const t = Date.parse(isoDate);
  if (isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - t) / (24 * 3600 * 1000));
}

function auditDrift(repoRoot: string, docs: Doc[], opts: { maxAgeDays?: number } = {}): DriftAudit {
  const maxAgeDays = opts.maxAgeDays ?? 90;
  const shaDrift: ShaDriftItem[] = [];
  const deadUrls: DeadUrlItem[] = [];
  const raindropDeleted: RaindropDeletedItem[] = [];
  const headStale: HeadStaleItem[] = [];
  const sourceOlderThanRaw: SourceOlderThanRawItem[] = [];

  const raindropCache = loadRaindropUrlCache(repoRoot);
  const overrides = loadHealthOverrides(repoRoot);
  const deadLinkPinned = new Set(overrides.get("dead-link-accepted") ?? []);

  // Index Sources by slug (the slug of a Source matches the raw-archive slug)
  const sourceBySlug = new Map<string, Doc>();
  for (const d of docs) {
    if (!d.path.startsWith("03_Sources/")) continue;
    sourceBySlug.set(d.slug, d);
  }

  for (const { rawDir, slug, host } of walkRawArchives(repoRoot)) {
    const sourceJson = readSourceJson(rawDir);
    const revs = readRevisions(rawDir);
    const sourceDoc = sourceBySlug.get(slug);
    const sourceUpdated = sourceDoc ? String(sourceDoc.frontmatter.updated ?? "") : "";
    const sourceCreated = sourceDoc ? String(sourceDoc.frontmatter.created ?? "") : "";

    // 1. SHA drift: content_sha changed across consecutive revs, but Source updated < newest rev fetched_at
    if (revs.length >= 2 && sourceUpdated) {
      for (let i = 1; i < revs.length; i++) {
        const prev = revs[i - 1];
        const curr = revs[i];
        if (prev.body_pruned || curr.body_pruned) continue;
        if (!prev.content_sha || !curr.content_sha) continue;
        if (prev.content_sha === curr.content_sha) continue;
        // drift detected; flag if Source updated < curr fetched_at
        if (sourceUpdated < curr.fetched_at.slice(0, 10)) {
          shaDrift.push({
            slug, rawDir: rawDir.slice(repoRoot.length + 1),
            oldSha: prev.content_sha.slice(0, 12), newSha: curr.content_sha.slice(0, 12),
            sourceUpdated, latestRevAt: curr.fetched_at,
          });
          break;  // one entry per slug is enough
        }
      }
    }

    // 2. Dead URLs not yet pinned
    const quality = sourceJson?.quality_flags as string[] | undefined;
    if (quality && quality.includes("dead-link") && !deadLinkPinned.has(slug)) {
      deadUrls.push({ slug, rawDir: rawDir.slice(repoRoot.length + 1), reason: "dead-link flag, no pin" });
    }

    // 3. Raindrop-deleted URLs
    const url = String(sourceJson?.url ?? "").toLowerCase().trim();
    if (url && raindropCache.size > 0 && !raindropCache.has(url)) {
      raindropDeleted.push({ slug, rawDir: rawDir.slice(repoRoot.length + 1), url });
    }

    // 4. HEAD-check stale: upstream.last_checked_at much older than max
    const lastChecked = String(((sourceJson?.upstream as Record<string, unknown> | undefined)?.last_checked_at) ?? "");
    if (lastChecked && sourceCreated) {
      const sourceAge = ageDaysFrom(sourceCreated);
      const checkAge = ageDaysFrom(lastChecked);
      if (sourceAge > maxAgeDays && checkAge > maxAgeDays) {
        headStale.push({ slug, rawDir: rawDir.slice(repoRoot.length + 1), lastCheckedAt: lastChecked, ageDays: checkAge });
      }
    }

    // 5. Source older than its cited raw archive (latest revision)
    if (revs.length > 0 && sourceUpdated) {
      const latestRev = revs[revs.length - 1];
      if (latestRev.fetched_at && sourceUpdated < latestRev.fetched_at.slice(0, 10) && !sourceOlderThanRaw.some(s => s.slug === slug)) {
        // Only flag if SHA actually changed since the Source was updated (the SHA drift check above)
        // — otherwise this fires for every fetch even when content is identical, which is noise.
        const lastBeforeUpdate = revs.findLast(r => r.fetched_at.slice(0, 10) <= sourceUpdated);
        if (lastBeforeUpdate && lastBeforeUpdate.content_sha !== latestRev.content_sha) {
          sourceOlderThanRaw.push({
            slug, sourcePath: sourceDoc!.path, sourceUpdated,
            rawDir: rawDir.slice(repoRoot.length + 1), rawUpdated: latestRev.fetched_at,
          });
        }
      }
    }
  }

  return { shaDrift, deadUrls, raindropDeleted, headStale, sourceOlderThanRaw };
}

function auditSources(docs: Doc[]): SourcesAudit {
  const zeroWikilink: ZeroWikilinkSourceItem[] = [];
  const tagOutliers: TagOutlierSourceItem[] = [];
  const ageStale: AgeStaleSourceItem[] = [];
  const topicOnlyCited: TopicOnlyCitedItem[] = [];

  // Gather Source docs + their tag sets
  const sources = docs.filter(d => d.path.startsWith("03_Sources/"));
  const sourceBySlug = new Map<string, Doc>();
  for (const s of sources) sourceBySlug.set(s.slug, s);

  // Build tag → count
  const tagCount = new Map<string, number>();
  for (const s of sources) {
    const tags = Array.isArray(s.frontmatter.tags) ? (s.frontmatter.tags as string[]) : [];
    for (const t of tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  }

  for (const s of sources) {
    // 0-wikilink
    if (s.wikilinks.size === 0) {
      zeroWikilink.push({ slug: s.slug, sourcePath: s.path });
    }
    // Tag outliers: every tag appears only once (in this Source)
    const tags = Array.isArray(s.frontmatter.tags) ? (s.frontmatter.tags as string[]) : [];
    if (tags.length > 0 && tags.every(t => (tagCount.get(t) ?? 0) === 1)) {
      tagOutliers.push({ slug: s.slug, sourcePath: s.path, tags });
    }
    // Age-stale: created > 180 days ago
    const created = String(s.frontmatter.created ?? "");
    if (created) {
      const age = ageDaysFrom(created);
      if (age > 180) ageStale.push({ slug: s.slug, sourcePath: s.path, created, ageDays: age });
    }
  }

  // Topic-only-cited: Source is wikilinked by a Topic but not by any Entity Observation
  const entitiesCitingSource = new Map<string, Set<string>>();   // source slug → entity slugs
  const topicsCitingSource = new Map<string, Set<string>>();
  for (const d of docs) {
    const isEntity = d.path.startsWith("02_Entities/");
    const isTopic = d.path.startsWith("01_Topics/");
    if (!isEntity && !isTopic) continue;
    for (const link of d.wikilinks) {
      if (!sourceBySlug.has(link)) continue;
      const map = isEntity ? entitiesCitingSource : topicsCitingSource;
      if (!map.has(link)) map.set(link, new Set());
      map.get(link)!.add(d.slug);
    }
  }
  for (const s of sources) {
    const topics = topicsCitingSource.get(s.slug);
    const entities = entitiesCitingSource.get(s.slug);
    if (topics && topics.size > 0 && (!entities || entities.size === 0)) {
      topicOnlyCited.push({ slug: s.slug, sourcePath: s.path, topicCiters: Array.from(topics).sort() });
    }
  }

  return { zeroWikilink, tagOutliers, ageStale, topicOnlyCited };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function renderMarkdown(scope: Scope, audit: {
  orphans: OrphanItem[];
  stale: StaleItem[];
  duplicates: DuplicateItem[];
  collisions: CollisionItem[];
  contradictions: ContradictionItem[];
  drift?: DriftAudit;
  sourcesAudit?: SourcesAudit;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`# Wiki health-check report — ${date}`, ""];

  const want = (s: Scope) => scope === "all" || scope === s;

  if (want("orphans")) {
    lines.push(`## Orphans (\`_seen/\` entities at refs=0): ${audit.orphans.length}`, "");
    if (audit.orphans.length === 0) {
      lines.push("Clean.", "");
    } else {
      for (const o of audit.orphans) {
        lines.push(`- \`${o.slug}\` (${o.path})`);
      }
      lines.push("");
      lines.push("Run `hirono bulk-delete-orphans --confirm <slugs>` for ones you've decided to drop.", "");
    }
  }

  if (want("stale")) {
    lines.push(`## Stale Synthesis (active entity older than its newest citing Source): ${audit.stale.length}`, "");
    if (audit.stale.length === 0) {
      lines.push("Clean.", "");
    } else {
      for (const s of audit.stale) {
        lines.push(`- \`${s.slug}\` — synthesis_updated_at=${s.synthesisDate}, newest cite \`${s.newestCitingSource.slug}\` (${s.newestCitingSource.updated})`);
      }
      lines.push("");
      lines.push("Operator regenerates each entity's `## Synthesis` in-session, then bumps `synthesis_updated_at:`.", "");
    }
  }

  if (want("duplicates")) {
    lines.push(`## Duplicate-pair candidates (entity slug similarity ≥ 0.8): ${audit.duplicates.length}`, "");
    if (audit.duplicates.length === 0) {
      lines.push("Clean.", "");
    } else {
      for (const d of audit.duplicates) {
        const sim = (d.similarity * 100).toFixed(0);
        lines.push(`- \`${d.a}\` ↔ \`${d.b}\`  (sim=${sim}%, combined refs=${d.combinedRefs})`);
        lines.push(`  - paths: ${d.aPath}, ${d.bPath}`);
        lines.push(`  - merge: \`hirono merge-entities ${d.a.includes(" ") ? `"${d.a}"` : d.a} --into ${d.b.includes(" ") ? `"${d.b}"` : d.b}\``);
      }
      lines.push("");
    }
  }

  if (want("topic-collisions")) {
    lines.push(`## Topic-name collisions (case+punctuation normalized): ${audit.collisions.length}`, "");
    if (audit.collisions.length === 0) {
      lines.push("Clean.", "");
    } else {
      for (const c of audit.collisions) {
        lines.push(`- \`${c.a}\` ↔ \`${c.b}\``);
        lines.push(`  - merge: \`hirono merge-topics "${c.a}" --into "${c.b}"\``);
      }
      lines.push("");
    }
  }

  if (want("contradictions")) {
    lines.push(`## Observation-Synthesis contradiction candidates: ${audit.contradictions.length}`, "");
    if (audit.contradictions.length === 0) {
      lines.push("Clean.", "");
    } else {
      for (const c of audit.contradictions) {
        lines.push(`- \`${c.slug}\` — Observation cites retraction:`);
        lines.push(`  - "${c.quote}…"`);
        lines.push(`  - source: \`${c.sourceSlug}\``);
        lines.push(`  - action: rewrite \`02_Entities/${c.slug}.md\` \`## Synthesis\` to acknowledge; bump \`synthesis_updated_at:\`.`);
      }
      lines.push("");
    }
  }

  if (scope === "drift" && audit.drift) {
    const d = audit.drift;
    lines.push(`## Raw-archive content-SHA drift (Source needs re-summarization): ${d.shaDrift.length}`, "");
    if (d.shaDrift.length === 0) lines.push("Clean.", "");
    else {
      for (const i of d.shaDrift) {
        lines.push(`- \`${i.slug}\` — old SHA \`${i.oldSha}\` → new \`${i.newSha}\` (latest fetch ${i.latestRevAt}, Source updated ${i.sourceUpdated})`);
        lines.push(`  - action: re-read raw, update \`03_Sources/.../${i.slug}.md\` body + bump \`updated:\`.`);
      }
      lines.push("");
    }

    lines.push(`## Dead URLs not yet pinned: ${d.deadUrls.length}`, "");
    if (d.deadUrls.length === 0) lines.push("Clean.", "");
    else {
      for (const i of d.deadUrls) lines.push(`- \`${i.slug}\` (${i.rawDir}) — ${i.reason}`);
      lines.push("");
      lines.push("If you want to keep the Source despite a dead upstream, pin in `00_Meta/sources-health-overrides.md` with `pin-kind=dead-link-accepted`.", "");
    }

    lines.push(`## Raindrop-deleted URLs (still in raw/, no longer in raindrop): ${d.raindropDeleted.length}`, "");
    if (d.raindropDeleted.length === 0) lines.push("Clean.", "");
    else {
      for (const i of d.raindropDeleted) lines.push(`- \`${i.slug}\` — ${i.url}`);
      lines.push("");
      lines.push("Action: keep (if still valuable) or `hirono raindrop forget <slug>` to remove + skip-list.", "");
    }

    lines.push(`## HEAD-check stale (last upstream check older than 90d): ${d.headStale.length}`, "");
    if (d.headStale.length === 0) lines.push("Clean.", "");
    else {
      for (const i of d.headStale) lines.push(`- \`${i.slug}\` — last checked ${i.lastCheckedAt} (${i.ageDays}d ago)`);
      lines.push("");
      lines.push("Action: `hirono raindrop sync --check-stale` to re-HEAD this batch.", "");
    }

    lines.push(`## Source older than its cited raw archive (content changed since Source was written): ${d.sourceOlderThanRaw.length}`, "");
    if (d.sourceOlderThanRaw.length === 0) lines.push("Clean.", "");
    else {
      for (const i of d.sourceOlderThanRaw) {
        lines.push(`- \`${i.slug}\` — Source updated ${i.sourceUpdated}, raw latest fetch ${i.rawUpdated}`);
        lines.push(`  - action: re-read raw, update Source body.`);
      }
      lines.push("");
    }
  }

  if (scope === "sources" && audit.sourcesAudit) {
    const a = audit.sourcesAudit;
    lines.push(`## Sources with 0 outgoing wikilinks: ${a.zeroWikilink.length}`, "");
    if (a.zeroWikilink.length === 0) lines.push("Clean.", "");
    else {
      for (const i of a.zeroWikilink) lines.push(`- \`${i.slug}\` (${i.sourcePath}) — add Entity/Topic wikilinks during re-read.`);
      lines.push("");
    }

    lines.push(`## Tag outliers (every tag unique to this Source): ${a.tagOutliers.length}`, "");
    if (a.tagOutliers.length === 0) lines.push("Clean.", "");
    else {
      for (const i of a.tagOutliers) lines.push(`- \`${i.slug}\` — tags: ${i.tags.map(t => `\`${t}\``).join(", ")}`);
      lines.push("");
      lines.push("Action: review tags; either align to canonical vocabulary or accept as new vocabulary entry.", "");
    }

    lines.push(`## Age-stale Sources (created > 180d ago, candidate for re-read): ${a.ageStale.length}`, "");
    if (a.ageStale.length === 0) lines.push("Clean.", "");
    else {
      for (const i of a.ageStale.slice(0, 20)) lines.push(`- \`${i.slug}\` — created ${i.created} (${i.ageDays}d ago)`);
      if (a.ageStale.length > 20) lines.push(`  - …and ${a.ageStale.length - 20} more.`);
      lines.push("");
    }

    lines.push(`## Sources cited only by Topics (no Entity Observations): ${a.topicOnlyCited.length}`, "");
    if (a.topicOnlyCited.length === 0) lines.push("Clean.", "");
    else {
      for (const i of a.topicOnlyCited.slice(0, 20)) {
        lines.push(`- \`${i.slug}\` — cited by Topics: ${i.topicCiters.map(t => `[[${t}]]`).join(", ")}`);
      }
      if (a.topicOnlyCited.length > 20) lines.push(`  - …and ${a.topicOnlyCited.length - 20} more.`);
      lines.push("");
      lines.push("Action: run `hirono auto-detect-entities <slug>` to pull entity references into the graph.", "");
    }
  }

  lines.push("---", "", `Generated by \`hirono health-check\`. Pure read-only — no files were modified.`);
  return lines.join("\n") + "\n";
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  const repoRoot = REPO_ROOT_DEFAULT;
  const docs = loadDocs(repoRoot);
  const refs = computeRefs(docs);

  // Default scopes (no drift/sources unless explicitly requested — those are expensive raw-archive scans)
  const includeDrift = args.scope === "drift";
  const includeSources = args.scope === "sources";

  const audit = {
    orphans: includeDrift || includeSources ? [] : auditOrphans(docs, refs),
    stale: includeDrift || includeSources ? [] : auditStaleSynthesis(docs),
    duplicates: includeDrift || includeSources ? [] : auditDuplicateEntities(docs, refs),
    collisions: includeDrift || includeSources ? [] : auditTopicCollisions(docs),
    contradictions: includeDrift || includeSources ? [] : auditContradictions(docs),
    drift: includeDrift ? auditDrift(repoRoot, docs) : undefined,
    sourcesAudit: includeSources ? auditSources(docs) : undefined,
  };

  let output: string;
  if (args.json) {
    output = JSON.stringify(audit, null, 2);
  } else {
    output = renderMarkdown(args.scope, audit);
  }

  if (args.writeReport) {
    writeFileSync(args.writeReport, output, "utf8");
    console.log(`✓ wrote report to ${args.writeReport}`);
  } else {
    process.stdout.write(output);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
