/**
 * `hirono refine-topic <name>` — LLM-driven Current-understanding regenerator.
 *
 * Topic-side parallel of refine-entity. Regenerates a Topic's
 * `## Current understanding` paragraph from accumulated context:
 *   - the Topic's `## What` framing
 *   - the cited Source bodies (extracted from wikilinks in
 *     `## Current understanding` + `## Sources drawn on`)
 *
 * Three modes:
 *   1. Prepare prompt (default): writes prompt package to
 *      `.refine-prompts/<name>-topic-prompt.md`.
 *   2. Dry-run (--response <path>): print proposed diff.
 *   3. Apply (--response <path> --apply): replace ## Current understanding,
 *      bump `synthesis_updated_at`, append refactor log entry.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAtomically,
  appendLogEntry,
  cleanupStaging,
  type PendingOp,
} from "../curation.ts";
import { REFINE_TOPIC_PREAMBLE } from "./_shared/prompt-preamble.ts";
import { excerptSource, type ExcerptMode } from "./_shared/source-excerpt.ts";
import { writePromptMeasure } from "./_shared/prompt-measure.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  name: string;
  responsePath: string;
  apply: boolean;
  fullSource: boolean;
}

function usage(): never {
  console.error(`usage: hirono refine-topic <name> [--response <path>] [--apply] [--full-source]

Regenerate a Topic's ## Current understanding (+ ## Comparison if present)
from its cited Sources.

Modes:
  (no flags)              Generate prompt package; operator spawns Sonnet subagent.
  --response <path>       Dry-run diff.
  --response <path> --apply   Atomic replace + log entry.

Flags:
  --full-source           Include full raw Source bodies instead of curated
                          excerpts (TL;DR + Key claims + What this changes).
                          Escape hatch; ~3× more tokens.
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let responsePath = "";
  let apply = false;
  let fullSource = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--response") { i++; responsePath = (argv[i] ?? "").trim(); }
    else if (a === "--apply") apply = true;
    else if (a === "--full-source") fullSource = true;
    else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("-")) { console.error(`unknown flag: ${a}`); usage(); }
    else positional.push(a);
  }
  if (positional.length !== 1) usage();
  if (apply && !responsePath) { console.error("--apply requires --response"); usage(); }
  return { name: positional[0], responsePath, apply, fullSource };
}

function findTopicFile(repoRoot: string, name: string): string | null {
  const p = `Topics/${name}.md`;
  return existsSync(join(repoRoot, p)) ? p : null;
}

function splitFM(raw: string): { fm: string; body: string } {
  const m = raw.match(/^---\n[\s\S]*?\n---\n/);
  return m ? { fm: m[0], body: raw.slice(m[0].length) } : { fm: "", body: raw };
}

function extractSection(body: string, heading: string): string {
  const lines = body.split("\n");
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) { startIdx = i + 1; break; }
  }
  if (startIdx < 0) return "";
  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i])) { endIdx = i; break; }
  }
  return lines.slice(startIdx, endIdx).join("\n").trim();
}

/** Extract Source slugs from wikilinks in topic body (matches YYYY-MM-DD-… prefix). */
function extractSourceCitations(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g)) {
    const target = m[1].trim();
    // Source slugs typically start with YYYY-MM-DD-
    if (/^\d{4}-\d{2}-\d{2}-/.test(target)) out.add(target);
    else if (target.startsWith("Sources/")) {
      const slug = target.replace(/^Sources\/(?:\d{4}\/)?/, "").replace(/\.md$/, "");
      out.add(slug);
    }
  }
  return Array.from(out);
}

function resolveSourcePath(repoRoot: string, slug: string): string | null {
  const sourcesDir = join(repoRoot, "Sources");
  if (!existsSync(sourcesDir)) return null;
  for (const year of readdirSync(sourcesDir)) {
    if (!/^\d{4}$/.test(year)) continue;
    const candidate = `Sources/${year}/${slug}.md`;
    if (existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}

export type TopicShape = "survey" | "comparison";

/**
 * A Topic carries a comparison iff its body contains a `## Comparison` H2
 * heading. Presence of the heading IS the contract; no frontmatter field,
 * no filename heuristic. Any Topic — Survey or otherwise — may opt in by
 * adding the heading; refine-topic will then regenerate the table
 * alongside Current understanding.
 */
export function detectTopicShape(_name: string, _fmRaw: string, body: string): TopicShape {
  return body.split("\n").some(l => l.trim() === "## Comparison") ? "comparison" : "survey";
}

function buildPrompt(
  name: string,
  shape: TopicShape,
  parsed: { what: string; currentUnderstanding: string; comparison: string },
  sourcesBodies: { slug: string; body: string }[],
): string {
  const sourceBlocks = sourcesBodies.map(s => `### Source: ${s.slug}\n\n${s.body}`).join("\n\n");

  // Layout: STABLE preamble FIRST (caches across all refine-topic runs).
  // Per-Topic VARIABLE content LAST. See _shared/prompt-preamble.ts.
  const shapeMarker = shape === "comparison"
    ? "**Shape**: COMPARISON — this Topic body carries a `## Comparison` heading. Your response MUST include BOTH `## Current understanding` AND `## Comparison` sections per the preamble's strict 2-section format. The table is load-bearing — lint will fail without ≥3 |-rows."
    : "**Shape**: SURVEY — output ONLY the new `## Current understanding` content (no heading — the CLI prepends it).";

  return `${REFINE_TOPIC_PREAMBLE}

---

## Subject: Topic \`${name}\`

${shapeMarker}

### ## What

${parsed.what || "_(no What section)_"}

### Current ## Current understanding (for context)

${parsed.currentUnderstanding || "_(stub)_"}
${shape === "comparison" ? `\n### Current ## Comparison (for context)\n\n${parsed.comparison || "_(no Comparison section yet — generate one)_"}\n` : ""}
### Cited Source excerpts

${sourceBlocks}

---

Save your response as plain text/markdown to:
  \`.refine-prompts/${name}-topic-response.txt\`
`;
}

function buildReplacement(topicRaw: string, newContent: string, dateISO: string, shape: TopicShape = "survey"): string {
  const { fm, body } = splitFM(topicRaw);
  const lines = body.split("\n");

  let newBody: string;
  if (shape === "comparison") {
    // Comparison shape: response carries BOTH ## Current understanding AND
    // ## Comparison (the LLM was prompted with the strict 2-section format).
    // Replace the span from ## Current understanding through end-of-Comparison
    // (or next non-Comparison ## heading) with the response verbatim.
    const startIdx = lines.findIndex(l => l.trim() === "## Current understanding");
    let insertAt: number;
    let endIdx: number;
    if (startIdx >= 0) {
      insertAt = startIdx;
      // End at ## Open threads if present, else next H2/H1 after the last of
      // {## Current understanding, ## Comparison}, else EOF.
      endIdx = lines.length;
      const openIdx = lines.findIndex(l => l.trim() === "## Open threads");
      if (openIdx >= 0 && openIdx > startIdx) endIdx = openIdx;
      else {
        // Walk forward, skipping ## Comparison (it's part of the comparison block we're replacing)
        for (let i = startIdx + 1; i < lines.length; i++) {
          const t = lines[i].trim();
          if (/^#{1,2}\s/.test(t) && t !== "## Comparison" && t !== "## Current understanding") {
            endIdx = i;
            break;
          }
        }
      }
    } else {
      // No Current understanding yet — insert before Open threads or at end
      const openIdx = lines.findIndex(l => l.trim() === "## Open threads");
      insertAt = openIdx >= 0 ? openIdx : lines.length;
      endIdx = insertAt;
    }
    const before = lines.slice(0, insertAt).join("\n");
    const after = lines.slice(endIdx).join("\n");
    newBody = `${before}\n\n${newContent.trim()}\n\n${after}`;
  } else {
    // Survey shape: replace only the ## Current understanding section.
    let headingIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "## Current understanding") { headingIdx = i; break; }
    }
    if (headingIdx >= 0) {
      let endIdx = lines.length;
      for (let i = headingIdx + 1; i < lines.length; i++) {
        if (/^#{1,2}\s/.test(lines[i])) { endIdx = i; break; }
      }
      const before = lines.slice(0, headingIdx + 1).join("\n");  // includes heading line
      const after = lines.slice(endIdx).join("\n");
      newBody = `${before}\n\n${newContent.trim()}\n\n${after}`;
    } else {
      const openThreadsIdx = lines.findIndex(l => l.trim() === "## Open threads");
      if (openThreadsIdx >= 0) {
        const before = lines.slice(0, openThreadsIdx).join("\n");
        const after = lines.slice(openThreadsIdx).join("\n");
        newBody = `${before}\n## Current understanding\n\n${newContent.trim()}\n\n${after}`;
      } else {
        newBody = body.replace(/\s*$/, `\n\n## Current understanding\n\n${newContent.trim()}\n`);
      }
    }
  }

  // De-dup consecutive blank lines that may have been introduced
  newBody = newBody.replace(/\n{3,}/g, "\n\n");

  // Bump (or insert) synthesis_updated_at in frontmatter
  let newFm = fm;
  if (/^synthesis_updated_at:\s*.+$/m.test(newFm)) {
    newFm = newFm.replace(/^synthesis_updated_at:\s*.+$/m, `synthesis_updated_at: ${dateISO}`);
  } else if (/^updated:\s*.+$/m.test(newFm)) {
    newFm = newFm.replace(/(^updated:\s*.+$)/m, `$1\nsynthesis_updated_at: ${dateISO}`);
  } else {
    newFm = newFm.replace(/\n---\n$/, `\nsynthesis_updated_at: ${dateISO}\n---\n`);
  }
  if (/^updated:\s*.+$/m.test(newFm)) {
    newFm = newFm.replace(/^updated:\s*.+$/m, `updated: ${dateISO}`);
  }
  return newFm + newBody;
}

export interface RefineTopicResult {
  mode: "prepare" | "dryrun" | "apply";
  topicPath?: string;
  promptPath?: string;
  oldContent?: string;
  newContent?: string;
  citedSources?: string[];
  unresolvedCitations?: string[];
  opId?: string;
}

export function refineTopic(
  repoRoot: string,
  name: string,
  opts: { responsePath?: string; apply?: boolean; sourceMode?: ExcerptMode } = {},
): RefineTopicResult {
  const topicPath = findTopicFile(repoRoot, name);
  if (!topicPath) throw new Error(`Topic not found: ${name}`);
  const topicRaw = readFileSync(join(repoRoot, topicPath), "utf8");
  const { fm, body } = splitFM(topicRaw);
  const shape = detectTopicShape(name, fm, body);

  const what = extractSection(body, "## What");
  const currentUnderstanding = extractSection(body, "## Current understanding");
  const comparison = extractSection(body, "## Comparison");
  const cited = extractSourceCitations(body);

  const sourceMode: ExcerptMode = opts.sourceMode ?? "curated";
  const sourcesBodies: { slug: string; body: string }[] = [];
  const unresolved: string[] = [];
  for (const slug of cited) {
    const p = resolveSourcePath(repoRoot, slug);
    if (!p) { unresolved.push(slug); continue; }
    const excerpt = excerptSource(repoRoot, p, sourceMode);
    if (excerpt === null) { unresolved.push(slug); continue; }
    sourcesBodies.push({ slug, body: excerpt });
  }

  // Mode 1: prepare prompt
  if (!opts.responsePath) {
    const prompt = buildPrompt(name, shape, { what, currentUnderstanding, comparison }, sourcesBodies);
    const promptDir = join(repoRoot, ".refine-prompts");
    mkdirSync(promptDir, { recursive: true });
    const promptPath = `.refine-prompts/${name}-topic-prompt.md`;
    writeFileSync(join(repoRoot, promptPath), prompt, "utf8");
    writePromptMeasure(repoRoot, promptPath, prompt, {
      source_count: sourcesBodies.length,
      mode: sourceMode,
    });
    return { mode: "prepare", topicPath, promptPath, oldContent: currentUnderstanding, citedSources: cited, unresolvedCitations: unresolved };
  }

  // Modes 2/3: read response
  const respAbs = resolve(opts.responsePath);
  let newContent: string;
  try { newContent = readFileSync(respAbs, "utf8").trim(); }
  catch (e) { throw new Error(`failed to read response at ${respAbs}: ${(e as Error).message}`); }
  if (!newContent) throw new Error(`response is empty: ${respAbs}`);

  if (!opts.apply) {
    return { mode: "dryrun", topicPath, oldContent: currentUnderstanding, newContent, citedSources: cited };
  }

  const dateISO = new Date().toISOString().slice(0, 10);
  const newRaw = buildReplacement(topicRaw, newContent, dateISO, shape);
  const ops: PendingOp[] = [{ kind: "write", path: topicPath, body: newRaw }];
  const opId = `refine-topic-${name.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;
  applyAtomically(repoRoot, opId, ops);
  const sectionLabel = shape === "comparison" ? "Current understanding + Comparison" : "Current understanding";
  appendLogEntry(repoRoot, "refactor", `Refine Topic [[${name}]] ${sectionLabel}`, [
    `Topic shape: ${shape}.`,
    `Regenerated ${sectionLabel} from ${sourcesBodies.length} cited Source body(ies).`,
    unresolved.length > 0 ? `${unresolved.length} citation(s) failed to resolve: ${unresolved.join(", ")}` : `All cited Sources resolved.`,
    `\`synthesis_updated_at\` bumped to ${dateISO}.`,
  ]);
  cleanupStaging(repoRoot, opId);
  return { mode: "apply", topicPath, oldContent: currentUnderstanding, newContent, citedSources: cited, opId };
}

function printDiff(name: string, oldS: string, newS: string): void {
  console.log(`# Current understanding diff for Topic [[${name}]]\n`);
  console.log(`## Old\n\n${oldS || "_(stub)_"}\n`);
  console.log(`## New\n\n${newS}\n`);
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = refineTopic(REPO_ROOT_DEFAULT, args.name, {
      responsePath: args.responsePath,
      apply: args.apply,
      sourceMode: args.fullSource ? "full" : "curated",
    });
    if (r.mode === "prepare") {
      console.log(`✓ wrote prompt package: ${r.promptPath}`);
      console.log(`  cited Sources: ${r.citedSources?.length ?? 0}`);
      if (r.unresolvedCitations && r.unresolvedCitations.length > 0) {
        console.log(`  ⚠ ${r.unresolvedCitations.length} citation(s) failed to resolve: ${r.unresolvedCitations.join(", ")}`);
      }
      console.log(`\nNext: spawn Sonnet subagent, save response to .refine-prompts/${args.name}-topic-response.txt, then re-run with --response <path> [--apply].`);
    } else if (r.mode === "dryrun") {
      printDiff(args.name, r.oldContent!, r.newContent!);
      console.log(`(dry-run — no files written.)`);
    } else {
      printDiff(args.name, r.oldContent!, r.newContent!);
      console.log(`✓ wrote new Current understanding to ${r.topicPath}; synthesis_updated_at bumped; log entry appended.`);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
