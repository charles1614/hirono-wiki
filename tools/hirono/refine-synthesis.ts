/**
 * `hirono refine-synthesis` — LLM-driven regenerator for the top-level
 * Synthesis.md (the corpus-wide thesis page).
 *
 * Corpus-level parallel of refine-entity / refine-topic. Regenerates the
 * thesis body (everything between the H1 title and the "## How this page
 * stays current" footer) from accumulated context:
 *   - the current Synthesis.md (so the LLM can preserve through-line
 *     where the corpus hasn't shifted)
 *   - every active Topic's `## What` + `## Current understanding`
 *     (the synthesis layer below)
 *
 * Three modes:
 *   1. Prepare prompt (default): writes prompt package to
 *      `.refine-prompts/synthesis-prompt.md`.
 *   2. Dry-run (--response <path>): print proposed diff.
 *   3. Apply (--response <path> --apply): replace body, bump
 *      `updated:`, append refactor log entry.
 *
 * Why no name arg: Synthesis is a singleton (one per wiki).
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
import { REFINE_SYNTHESIS_PREAMBLE } from "./_shared/prompt-preamble.ts";
import { writePromptMeasure } from "./_shared/prompt-measure.ts";

const STUB_CU_RE = /_\(stub —/;

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");
const SYNTHESIS_PATH = "Synthesis.md";
const FOOTER_HEADING = "## How this page stays current";

interface ParsedArgs {
  responsePath: string;
  apply: boolean;
}

function usage(): never {
  console.error(`usage: hirono refine-synthesis [--response <path>] [--apply]

Regenerate the top-level Synthesis.md from all active Topic syntheses.

Modes:
  (no flags)              Generate prompt package; operator spawns Opus subagent (top-Synthesis policy).
  --response <path>       Dry-run diff.
  --response <path> --apply   Atomic replace + log entry.

Example:
  hirono refine-synthesis
  hirono refine-synthesis --response .refine-prompts/synthesis-response.txt --apply
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let responsePath = "";
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--response") { i++; responsePath = (argv[i] ?? "").trim(); }
    else if (a === "--apply") apply = true;
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  if (apply && !responsePath) { console.error("--apply requires --response"); usage(); }
  return { responsePath, apply };
}

function splitFM(raw: string): { fm: string; body: string } {
  const m = raw.match(/^---\n[\s\S]*?\n---\n/);
  return m ? { fm: m[0], body: raw.slice(m[0].length) } : { fm: "", body: raw };
}

function extractSection(body: string, heading: string): string {
  const lines = body.split("\n");
  const start = lines.findIndex(l => l.trim() === heading);
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

interface TopicContext { name: string; what: string; currentUnderstanding: string; updated: string }

function loadTopicContexts(repoRoot: string): TopicContext[] {
  const topicsDir = join(repoRoot, "Topics");
  if (!existsSync(topicsDir)) return [];
  const out: TopicContext[] = [];
  for (const f of readdirSync(topicsDir)) {
    if (!f.endsWith(".md")) continue;
    const raw = readFileSync(join(topicsDir, f), "utf8");
    const { fm, body } = splitFM(raw);
    const cu = extractSection(body, "## Current understanding");
    // Skip stub Topics — they have no signal to contribute to corpus-wide
    // synthesis. ~40% prompt-size reduction on a typical corpus.
    if (!cu || STUB_CU_RE.test(cu)) continue;
    const synthUpdatedMatch = fm.match(/^synthesis_updated_at:\s*(.+)$/m);
    const updatedMatch = fm.match(/^updated:\s*(.+)$/m);
    const updated = (synthUpdatedMatch?.[1] ?? updatedMatch?.[1] ?? "").trim();
    out.push({
      name: f.replace(/\.md$/, ""),
      what: extractSection(body, "## What"),
      currentUnderstanding: cu,
      updated,
    });
  }
  // Sort alphabetically for cache-friendly determinism: the topic block
  // order should be stable across runs so re-runs with mostly-unchanged
  // Topic set produce mostly-matching prompt prefixes.
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function buildPrompt(currentSynth: string, topics: TopicContext[]): string {
  const topicBlocks = topics
    .map(t => `### Topic: ${t.name}\n\n**What**: ${t.what || "(none)"}\n\n**Current understanding**:\n\n${t.currentUnderstanding}`)
    .join("\n\n---\n\n");

  // Layout: STABLE preamble FIRST (caches across runs); current Synthesis +
  // Topic blocks LAST (the part that changes per run). The Topic blocks are
  // alphabetically sorted (see loadTopicContexts) so a re-run with one
  // changed Topic still matches the prefix of every Topic block before it.
  return `${REFINE_SYNTHESIS_PREAMBLE}

---

## Current Synthesis.md (preserve through-line where corpus unchanged)

\`\`\`
${currentSynth}
\`\`\`

---

## Active Topics — source material (stubs filtered out, alphabetical)

${topicBlocks}

---

Save your response to \`.refine-prompts/synthesis-response.txt\`.
`;
}

function buildReplacement(synthRaw: string, newBody: string, dateISO: string): string {
  const { fm, body } = splitFM(synthRaw);
  const lines = body.split("\n");

  // Find H1 line (first "# " line)
  const h1Idx = lines.findIndex(l => /^#\s/.test(l));
  if (h1Idx < 0) throw new Error("Synthesis.md has no H1 title");

  // Find footer line
  const footerIdx = lines.findIndex(l => l.trim() === FOOTER_HEADING);

  const before = lines.slice(0, h1Idx + 1).join("\n"); // includes H1
  const after = footerIdx >= 0 ? lines.slice(footerIdx).join("\n") : "";

  const newSynthBody = `${before}\n\n${newBody.trim()}\n\n${after}`.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  // Bump updated: in frontmatter
  let newFm = fm;
  if (/^updated:\s*.+$/m.test(newFm)) {
    newFm = newFm.replace(/^updated:\s*.+$/m, `updated: ${dateISO}`);
  } else {
    newFm = newFm.replace(/\n---\n$/, `updated: ${dateISO}\n---\n`);
  }
  return newFm + newSynthBody;
}

export interface RefineSynthesisResult {
  mode: "prepare" | "dryrun" | "apply";
  promptPath?: string;
  oldBody?: string;
  newBody?: string;
  topicCount?: number;
  opId?: string;
}

function bodyBetweenTitleAndFooter(synthRaw: string): string {
  const { body } = splitFM(synthRaw);
  const lines = body.split("\n");
  const h1Idx = lines.findIndex(l => /^#\s/.test(l));
  const footerIdx = lines.findIndex(l => l.trim() === FOOTER_HEADING);
  if (h1Idx < 0) return body;
  const start = h1Idx + 1;
  const end = footerIdx >= 0 ? footerIdx : lines.length;
  return lines.slice(start, end).join("\n").trim();
}

export function refineSynthesis(
  repoRoot: string,
  opts: { responsePath?: string; apply?: boolean } = {},
): RefineSynthesisResult {
  const synthAbs = join(repoRoot, SYNTHESIS_PATH);
  if (!existsSync(synthAbs)) {
    throw new Error(`Synthesis.md not found at ${SYNTHESIS_PATH}`);
  }
  const synthRaw = readFileSync(synthAbs, "utf8");
  const oldBody = bodyBetweenTitleAndFooter(synthRaw);

  // Mode 1: prepare prompt
  if (!opts.responsePath) {
    const topics = loadTopicContexts(repoRoot);
    // Count stubs filtered for the measure sidecar
    let stubCount = 0;
    try {
      const topicsDir = join(repoRoot, "Topics");
      if (existsSync(topicsDir)) {
        stubCount = readdirSync(topicsDir).filter(f => f.endsWith(".md")).length - topics.length;
      }
    } catch { /* fall through, leave stubCount=0 */ }
    const prompt = buildPrompt(synthRaw, topics);
    const promptDir = join(repoRoot, ".refine-prompts");
    mkdirSync(promptDir, { recursive: true });
    const promptPath = ".refine-prompts/synthesis-prompt.md";
    writeFileSync(join(repoRoot, promptPath), prompt, "utf8");
    writePromptMeasure(repoRoot, promptPath, prompt, {
      source_count: topics.length,
      stub_count: stubCount,
    });
    return { mode: "prepare", promptPath, oldBody, topicCount: topics.length };
  }

  // Modes 2/3: read response
  const respAbs = resolve(opts.responsePath);
  let newBody: string;
  try { newBody = readFileSync(respAbs, "utf8").trim(); }
  catch (e) { throw new Error(`failed to read response at ${respAbs}: ${(e as Error).message}`); }
  if (!newBody) throw new Error(`response is empty: ${respAbs}`);

  if (!opts.apply) {
    return { mode: "dryrun", oldBody, newBody };
  }

  const dateISO = new Date().toISOString().slice(0, 10);
  const newRaw = buildReplacement(synthRaw, newBody, dateISO);
  const ops: PendingOp[] = [{ kind: "write", path: SYNTHESIS_PATH, body: newRaw }];
  const opId = `refine-synthesis-${Date.now()}`;
  applyAtomically(repoRoot, opId, ops);
  appendLogEntry(repoRoot, "refactor", `Refine top-level [[Synthesis]]`, [
    `Regenerated Synthesis.md body from accumulated Topic syntheses.`,
    `\`updated:\` bumped to ${dateISO}.`,
  ]);
  cleanupStaging(repoRoot, opId);
  return { mode: "apply", oldBody, newBody, opId };
}

function printDiff(oldS: string, newS: string): void {
  console.log(`# Synthesis body diff\n`);
  console.log(`## Old\n\n${oldS || "_(empty)_"}\n`);
  console.log(`## New\n\n${newS}\n`);
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = refineSynthesis(REPO_ROOT_DEFAULT, {
      responsePath: args.responsePath,
      apply: args.apply,
    });
    if (r.mode === "prepare") {
      console.log(`✓ wrote prompt package: ${r.promptPath}`);
      console.log(`  Topics included: ${r.topicCount ?? 0}`);
      console.log(`\nNext: spawn Opus subagent on this prompt (top Synthesis is high-stakes — see CLAUDE.md §11 / memory feedback_model_choice_opus_vs_sonnet.md), save response to .refine-prompts/synthesis-response.txt, then:`);
      console.log(`  hirono refine-synthesis --response .refine-prompts/synthesis-response.txt --apply`);
    } else if (r.mode === "dryrun") {
      printDiff(r.oldBody!, r.newBody!);
      console.log(`(dry-run — no files written.)`);
    } else {
      printDiff(r.oldBody!, r.newBody!);
      console.log(`✓ wrote new body to Synthesis.md; updated: bumped; log entry appended.`);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
