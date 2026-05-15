/**
 * `hirono auto-detect-entities <source-slug>` — LLM-NER entity extractor.
 *
 * The Karpathy-aligned centerpiece of Phase B: the wiki absorbs whatever
 * Sources the operator bookmarks, and auto-detect-entities is how new
 * entities get grown automatically as the corpus expands. The LLM
 * (orchestrator Claude session) does the NER pass via the Agent tool with
 * Sonnet; this CLI handles the structured I/O around that pass.
 *
 * Three modes:
 *
 *   1. Prepare prompt (default, no flags):
 *        Reads Source body + existing entity index + aliases. Writes a
 *        prompt package to `<raw-dir>/<slug>-entities-prompt.md`. Prints
 *        operator instructions: spawn Sonnet subagent, save JSON response
 *        to `<raw-dir>/<slug>-entities-response.json`.
 *
 *   2. Dry-run (--response <path>):
 *        Reads response JSON, normalizes via aliases, cross-references
 *        existing entities. Prints proposed stubs + wikilink suggestions.
 *
 *   3. Apply (--response <path> --apply):
 *        Creates `_seen/<canonical>.md` stubs atomically via
 *        applyAtomically. Wikilink insertion is operator's call (printed
 *        as suggestions; not auto-applied since the right insertion point
 *        is a judgment call).
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAtomically,
  appendLogEntry,
  cleanupStaging,
  loadEntityAliases,
  normalizeEntityName,
  type PendingOp,
} from "../curation.ts";
import { renderEntityStub } from "./new-entity.ts";
import { AUTO_DETECT_ENTITIES_PREAMBLE } from "./_shared/prompt-preamble.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  slug: string;
  responsePath: string;
  apply: boolean;
}

interface ResponseEntity {
  name: string;
  description?: string;
}

function usage(): never {
  console.error(`usage: hirono auto-detect-entities <source-slug> [--response <path>] [--apply]

Three modes:
  (no flags)            Generate prompt package; operator spawns Sonnet subagent.
  --response <path>     Dry-run: read response JSON, show proposed stubs.
  --response <path> --apply
                        Apply: create _seen/ stubs atomically + log entry.

Example workflow:
  hirono auto-detect-entities 2026-04-03-llm-architecture-gallery
  # → writes <raw-dir>/<slug>-entities-prompt.md
  # operator spawns Sonnet subagent in Claude session, saves JSON to:
  #   <raw-dir>/<slug>-entities-response.json
  hirono auto-detect-entities 2026-04-03-llm-architecture-gallery \\
    --response raw/.../slug-entities-response.json
  # → prints proposed stubs (no writes)
  hirono auto-detect-entities 2026-04-03-llm-architecture-gallery \\
    --response raw/.../slug-entities-response.json --apply
  # → creates stubs, appends log entry
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let responsePath = "";
  let apply = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--response") { i++; responsePath = (argv[i] ?? "").trim(); }
    else if (a === "--apply") apply = true;
    else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("-")) { console.error(`unknown flag: ${a}`); usage(); }
    else positional.push(a);
  }
  if (positional.length !== 1) usage();
  if (apply && !responsePath) { console.error("--apply requires --response"); usage(); }
  return { slug: positional[0], responsePath, apply };
}

/** Locate the Source markdown file in Sources/<year>/<slug>.md. */
function findSourceFile(repoRoot: string, slug: string): { repoPath: string; year: string } | null {
  const sourcesDir = join(repoRoot, "Sources");
  if (!existsSync(sourcesDir)) return null;
  const years = readdirSync(sourcesDir).filter(y => /^\d{4}$/.test(y));
  for (const year of years) {
    const p = join("Sources", year, `${slug}.md`);
    if (existsSync(join(repoRoot, p))) return { repoPath: p, year };
  }
  return null;
}

/** Locate the raw archive directory for a given Source slug. */
function findRawDir(repoRoot: string, slug: string): string | null {
  const rawRoot = join(repoRoot, "raw", "raindrop");
  if (!existsSync(rawRoot)) return null;
  for (const host of readdirSync(rawRoot)) {
    const candidate = join("raw", "raindrop", host, slug);
    if (existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}

/** Read all entity slugs from Entities/*.md + Entities/_seen/*.md. */
function listEntitySlugs(repoRoot: string): { active: string[]; seen: string[] } {
  const entitiesDir = join(repoRoot, "Entities");
  const active: string[] = [];
  const seen: string[] = [];
  if (existsSync(entitiesDir)) {
    for (const f of readdirSync(entitiesDir)) {
      if (f.endsWith(".md")) active.push(f.slice(0, -3));
    }
  }
  const seenDir = join(entitiesDir, "_seen");
  if (existsSync(seenDir)) {
    for (const f of readdirSync(seenDir)) {
      if (f.endsWith(".md")) seen.push(f.slice(0, -3));
    }
  }
  return { active, seen };
}

/** Build the prompt-package markdown the operator hands to a Sonnet subagent. */
function buildPrompt(slug: string, sourceBody: string, entities: { active: string[]; seen: string[] }): string {
  const allEntities = [...entities.active, ...entities.seen].sort();
  // Layout: STABLE preamble FIRST (caches across all auto-detect runs).
  // Existing-entity list is variable (grows over time) but mostly stable
  // between adjacent runs, so it sits in the middle. Source body LAST.
  return `${AUTO_DETECT_ENTITIES_PREAMBLE}

---

## Existing entity slugs (use exact spelling — don't create variants)

${allEntities.map(e => `- ${e}`).join("\n")}

---

## Source: ${slug}

${sourceBody}

---

Save your response as JSON to: \`<raw-dir>/${slug}-entities-response.json\`
`;
}

/** Classify each response entity against existing slugs + aliases. */
interface Classification {
  name: string;          // canonical (post-alias-normalization)
  raw: string;           // what the LLM proposed
  description: string;
  status: "exists-active" | "exists-seen" | "new";
  wikilinkedInSource: boolean;
}

function classify(
  responseEntities: ResponseEntity[],
  entities: { active: string[]; seen: string[] },
  aliases: Map<string, string>,
  sourceBody: string,
): Classification[] {
  const activeSet = new Set(entities.active);
  const seenSet = new Set(entities.seen);
  const out: Classification[] = [];
  for (const e of responseEntities) {
    const canonical = normalizeEntityName(e.name, aliases);
    const desc = (e.description ?? "").trim();
    let status: Classification["status"];
    if (activeSet.has(canonical)) status = "exists-active";
    else if (seenSet.has(canonical)) status = "exists-seen";
    else status = "new";
    // Check wikilink presence in the Source body (fence-aware would be nicer
    // but a substring check is good enough — body is small)
    const wikilinkedInSource = sourceBody.includes(`[[${canonical}]]`) ||
      sourceBody.includes(`[[${canonical}|`);
    out.push({ name: canonical, raw: e.name, description: desc, status, wikilinkedInSource });
  }
  return out;
}

function printReport(slug: string, classified: Classification[]): void {
  const newEntities = classified.filter(c => c.status === "new");
  const existingUnlinked = classified.filter(c => c.status !== "new" && !c.wikilinkedInSource);
  const existingLinked = classified.filter(c => c.status !== "new" && c.wikilinkedInSource);

  console.log(`# auto-detect-entities report for ${slug}\n`);
  console.log(`detected: ${classified.length} entity references`);
  console.log(`  new stubs to create:        ${newEntities.length}`);
  console.log(`  existing but missing link:  ${existingUnlinked.length}`);
  console.log(`  existing and already link:  ${existingLinked.length}\n`);

  if (newEntities.length > 0) {
    console.log("## New stubs to create (Entities/_seen/)\n");
    for (const c of newEntities) {
      const aliasNote = c.raw !== c.name ? ` (alias from \"${c.raw}\")` : "";
      console.log(`- ${c.name}${aliasNote} — ${c.description || "(no description)"}`);
    }
    console.log();
  }
  if (existingUnlinked.length > 0) {
    console.log("## Suggest wikilink-insertion (operator's call)\n");
    for (const c of existingUnlinked) {
      console.log(`- [[${c.name}]] — mentioned but not wikilinked (tier: ${c.status === "exists-active" ? "active" : "seen"})`);
    }
    console.log();
  }
}

export function autoDetect(
  repoRoot: string,
  slug: string,
  opts: { responsePath?: string; apply?: boolean } = {},
): { mode: "prepare" | "dryrun" | "apply"; promptPath?: string; classified?: Classification[]; created?: string[]; opId?: string } {
  const src = findSourceFile(repoRoot, slug);
  if (!src) throw new Error(`Source not found: ${slug}`);
  const rawDir = findRawDir(repoRoot, slug);
  if (!rawDir) throw new Error(`raw archive not found for slug: ${slug}`);

  // Mode 1: prepare prompt
  if (!opts.responsePath) {
    const sourceBody = readFileSync(join(repoRoot, src.repoPath), "utf8");
    const entities = listEntitySlugs(repoRoot);
    const prompt = buildPrompt(slug, sourceBody, entities);
    const promptPath = join(rawDir, `${slug}-entities-prompt.md`);
    writeFileSync(join(repoRoot, promptPath), prompt, "utf8");
    return { mode: "prepare", promptPath };
  }

  // Modes 2/3: read response, classify
  const respAbs = resolve(opts.responsePath);
  let parsed: { entities?: ResponseEntity[] };
  try { parsed = JSON.parse(readFileSync(respAbs, "utf8")); }
  catch (e) { throw new Error(`failed to read/parse response JSON at ${respAbs}: ${(e as Error).message}`); }
  const responseEntities = Array.isArray(parsed.entities) ? parsed.entities : [];

  const sourceBody = readFileSync(join(repoRoot, src.repoPath), "utf8");
  const entities = listEntitySlugs(repoRoot);
  const aliases = loadEntityAliases(repoRoot);
  const classified = classify(responseEntities, entities, aliases, sourceBody);

  if (!opts.apply) return { mode: "dryrun", classified };

  // Mode 3: apply atomically
  const newEntities = classified.filter(c => c.status === "new");
  if (newEntities.length === 0) return { mode: "apply", classified, created: [], opId: "" };

  const ops: PendingOp[] = newEntities.map(c => ({
    kind: "write" as const,
    path: `Entities/_seen/${c.name}.md`,
    body: renderEntityStub(c.name, c.description),
  }));
  const opId = `auto-detect-${slug.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;
  applyAtomically(repoRoot, opId, ops);

  const bodyLines = [
    `Auto-detected ${classified.length} entity references in [[${slug}]]; created ${newEntities.length} new \`_seen/\` stubs.`,
    `New stubs:\n${newEntities.map(c => `  - [[${c.name}]] — ${c.description || "(no description)"}`).join("\n")}`,
  ];
  const unlinked = classified.filter(c => c.status !== "new" && !c.wikilinkedInSource);
  if (unlinked.length > 0) {
    bodyLines.push(`Operator: ${unlinked.length} existing entities mentioned but not wikilinked — review and add \`[[X]]\` in the Source body:\n${unlinked.map(c => `  - [[${c.name}]]`).join("\n")}`);
  }
  bodyLines.push(`Run \`npx tsx tools/bin/reindex.ts\` to update entity ref counts.`);
  appendLogEntry(repoRoot, "refactor", `auto-detect-entities on [[${slug}]]`, bodyLines);
  cleanupStaging(repoRoot, opId);

  return { mode: "apply", classified, created: newEntities.map(c => c.name), opId };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = autoDetect(REPO_ROOT_DEFAULT, args.slug, {
      responsePath: args.responsePath,
      apply: args.apply,
    });
    if (r.mode === "prepare") {
      console.log(`✓ wrote prompt package: ${r.promptPath}\n`);
      console.log(`Next steps:`);
      console.log(`  1. Spawn a Sonnet subagent in your Claude session with the prompt above.`);
      console.log(`  2. Save the JSON response to:`);
      console.log(`       ${dirname(r.promptPath!)}/${args.slug}-entities-response.json`);
      console.log(`  3. Re-run with --response <path> to preview proposed stubs.`);
      console.log(`  4. Re-run with --response <path> --apply to commit atomically.`);
    } else if (r.mode === "dryrun") {
      printReport(args.slug, r.classified!);
      console.log(`(dry-run — no files written. Re-run with --apply to commit.)`);
    } else {
      printReport(args.slug, r.classified!);
      const n = r.created?.length ?? 0;
      if (n === 0) console.log(`✓ no new stubs needed (all detected entities already exist).`);
      else console.log(`✓ created ${n} new \`_seen/\` stubs; appended refactor log entry.`);
      console.log(`Next: run \`npx tsx tools/bin/reindex.ts\` to refresh ref counts.`);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
