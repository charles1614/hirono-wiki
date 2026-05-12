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

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { walkWikiDocs } from "../link-map.ts";
import { extractWikilinks } from "../bin/reindex.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

type Scope = "all" | "orphans" | "stale" | "duplicates" | "topic-collisions" | "contradictions";

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
                         topic-collisions | contradictions
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
      if (!["all", "orphans", "stale", "duplicates", "topic-collisions", "contradictions"].includes(v)) {
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
    if (doc.path.startsWith("Meta/")) continue;
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
    if (!doc.path.startsWith("Entities/_seen/")) continue;
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
    if (!d.path.startsWith("Sources/")) continue;
    const u = String(d.frontmatter.updated ?? "");
    if (u) sourceUpdated.set(d.slug, u);
  }
  for (const d of docs) {
    if (!d.path.startsWith("Entities/") || d.path.startsWith("Entities/_seen/")) continue;
    // Get the entity's synthesis_updated_at, or fall back to `updated`
    const synthDate = (d.frontmatter.synthesis_updated_at as string | undefined)
      ?? (d.frontmatter.updated as string | undefined)
      ?? null;
    if (!synthDate) continue;
    // Find citing Sources via wikilinks
    let newest: { slug: string; updated: string } | null = null;
    for (const otherDoc of docs) {
      if (!otherDoc.path.startsWith("Sources/")) continue;
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
  const entities = docs.filter((d) => d.path.startsWith("Entities/"));
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
  const topics = docs.filter((d) => d.path.startsWith("Topics/"));
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
    if (!d.path.startsWith("Entities/") || d.path.startsWith("Entities/_seen/")) continue;
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
// Report rendering
// ---------------------------------------------------------------------------

function renderMarkdown(scope: Scope, audit: {
  orphans: OrphanItem[];
  stale: StaleItem[];
  duplicates: DuplicateItem[];
  collisions: CollisionItem[];
  contradictions: ContradictionItem[];
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
        lines.push(`  - action: rewrite \`Entities/${c.slug}.md\` \`## Synthesis\` to acknowledge; bump \`synthesis_updated_at:\`.`);
      }
      lines.push("");
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

  const audit = {
    orphans: auditOrphans(docs, refs),
    stale: auditStaleSynthesis(docs),
    duplicates: auditDuplicateEntities(docs, refs),
    collisions: auditTopicCollisions(docs),
    contradictions: auditContradictions(docs),
  };

  let output: string;
  if (args.json) {
    output = JSON.stringify(audit, null, 2);
  } else {
    output = renderMarkdown(args.scope, audit);
  }

  if (args.writeReport) {
    require("node:fs").writeFileSync(args.writeReport, output, "utf8");
    console.log(`✓ wrote report to ${args.writeReport}`);
  } else {
    process.stdout.write(output);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
