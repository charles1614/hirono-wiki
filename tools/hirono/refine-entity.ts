/**
 * `hirono refine-entity <name>` — LLM-driven Synthesis regenerator.
 *
 * Regenerates an entity's `## Synthesis` paragraph from accumulated
 * `## Observations` bullets + the cited Source bodies via a Sonnet
 * subagent. Operator-triggered (Karpathy invariant: LLM proposes, operator
 * approves).
 *
 * Three modes:
 *
 *   1. Prepare prompt (default, no flags):
 *        Reads entity body + cited Source bodies. Writes a prompt package
 *        to `.refine-prompts/<name>-synthesis-prompt.md`. Prints
 *        operator instructions: spawn Sonnet subagent, save response to
 *        `<name>-synthesis-response.txt` (plain text, 4-6 sentences).
 *
 *   2. Dry-run (--response <path>):
 *        Reads response text, prints side-by-side diff (old vs new
 *        Synthesis).
 *
 *   3. Apply (--response <path> --apply):
 *        Replaces `## Synthesis\n\n<old>` with `## Synthesis\n\n<new>`,
 *        bumps `synthesis_updated_at: <today>` in frontmatter, appends a
 *        `refactor | Refine [[<name>]] Synthesis` log entry. Atomic via
 *        applyAtomically.
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

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

interface ParsedArgs {
  name: string;
  responsePath: string;
  apply: boolean;
}

function usage(): never {
  console.error(`usage: hirono refine-entity <name> [--response <path>] [--apply]

Regenerate an entity's ## Synthesis from its Observations + cited Source bodies.

Modes:
  (no flags)              Generate prompt package; operator spawns Sonnet subagent.
  --response <path>       Dry-run: print proposed Synthesis side-by-side with current.
  --response <path> --apply
                          Apply: replace Synthesis, bump synthesis_updated_at,
                          append refactor log entry.

Example workflow:
  hirono refine-entity MLA
  # → writes .refine-prompts/MLA-synthesis-prompt.md
  # operator spawns Sonnet subagent, saves response to:
  #   .refine-prompts/MLA-synthesis-response.txt
  hirono refine-entity MLA --response .refine-prompts/MLA-synthesis-response.txt
  # → prints diff
  hirono refine-entity MLA --response <path> --apply
  # → applies atomically + log entry
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
  return { name: positional[0], responsePath, apply };
}

/** Find an entity file at active or seen tier. */
function findEntityFile(repoRoot: string, name: string): string | null {
  const active = `Entities/${name}.md`;
  if (existsSync(join(repoRoot, active))) return active;
  const seen = `Entities/_seen/${name}.md`;
  if (existsSync(join(repoRoot, seen))) return seen;
  return null;
}

function splitFM(raw: string): { fm: string; body: string } {
  const m = raw.match(/^---\n[\s\S]*?\n---\n/);
  return m ? { fm: m[0], body: raw.slice(m[0].length) } : { fm: "", body: raw };
}

/** Extract the body of a section ## Foo, from the heading line to the next ## or # heading or EOF. */
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

/** Extract the current Synthesis paragraph + Observations bullets. */
function parseEntity(body: string): { synthesis: string; observations: string[]; cited: string[] } {
  const synthesis = extractSection(body, "## Synthesis");
  const obsBlock = extractSection(body, "## Observations");
  const observations: string[] = [];
  const cited = new Set<string>();
  for (const line of obsBlock.split("\n")) {
    if (/^-\s+/.test(line)) {
      observations.push(line.replace(/^-\s+/, "").trim());
      // Extract [[Sources/.../slug]] wikilinks
      for (const m of line.matchAll(/\[\[Sources\/(?:\d{4}\/)?([^\]|]+?)(?:\|[^\]]*)?\]\]/g)) {
        cited.add(m[1].trim());
      }
      for (const m of line.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g)) {
        // Also catch shorthand `[[slug]]` referring to a Source by its basename
        const target = m[1].trim();
        if (target.startsWith("Sources/")) continue;  // handled above
        cited.add(target);
      }
    }
  }
  return { synthesis, observations, cited: Array.from(cited) };
}

/** Try to resolve a citation token (slug or `Sources/yyyy/slug`) to a Source path. */
function resolveSourcePath(repoRoot: string, token: string): string | null {
  // Direct path under Sources/
  if (token.startsWith("Sources/")) {
    const direct = token.endsWith(".md") ? token : `${token}.md`;
    if (existsSync(join(repoRoot, direct))) return direct;
  }
  // Sources/<year>/<slug>.md
  const sourcesDir = join(repoRoot, "Sources");
  if (!existsSync(sourcesDir)) return null;
  for (const year of readdirSync(sourcesDir)) {
    if (!/^\d{4}$/.test(year)) continue;
    const candidate = `Sources/${year}/${token}.md`;
    if (existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}

function buildPrompt(name: string, entityBody: string, parsed: { synthesis: string; observations: string[] }, sourcesBodies: { slug: string; body: string }[]): string {
  const sourceBlocks = sourcesBodies.map(s => `### Source: ${s.slug}\n\n\`\`\`\n${s.body}\n\`\`\``).join("\n\n");
  return `# Synthesis regeneration prompt for [[${name}]]

## Instructions to Sonnet subagent

Regenerate the \`## Synthesis\` paragraph for the entity \`${name}\` from:
  - the Observations bullets below (atomic claims, each with a Source citation), and
  - the cited Source bodies (provided in full).

Rules:
  - Preserve **attributability**: every substantive claim should trace to an Observation. Don't add claims that aren't grounded in the Observations or Source bodies.
  - Cap at **4-6 sentences**.
  - Plain prose. No bullet list. No headings. No wikilinks INSIDE the Synthesis (those live in Observations).
  - Output ONLY the new Synthesis paragraph text — no preamble like "Here is the new Synthesis:". The CLI will paste your response verbatim under \`## Synthesis\`.

## Current Synthesis (for context — feel free to keep or rewrite)

${parsed.synthesis || "_(stub)_"}

## Observations

${parsed.observations.map(o => `- ${o}`).join("\n")}

## Cited Source bodies

${sourceBlocks}

---

Save your response as plain text (4-6 sentences, no preamble) to:
  \`.refine-prompts/${name}-synthesis-response.txt\`
`;
}

function buildReplacement(entityRaw: string, newSynthesis: string, dateISO: string): string {
  const { fm, body } = splitFM(entityRaw);

  // 1. Replace the ## Synthesis section content
  let newBody: string;
  if (/^## Synthesis\s*$/m.test(body)) {
    newBody = body.replace(
      /^(## Synthesis\s*\n)([\s\S]*?)(?=\n## |\n# |$)/m,
      `$1\n${newSynthesis.trim()}\n`,
    );
  } else {
    // No Synthesis section — insert before Observations (or at end)
    if (/^## Observations\s*$/m.test(body)) {
      newBody = body.replace(
        /^(## Observations\s*$)/m,
        `## Synthesis\n\n${newSynthesis.trim()}\n\n$1`,
      );
    } else {
      newBody = body.replace(/\s*$/, `\n\n## Synthesis\n\n${newSynthesis.trim()}\n`);
    }
  }

  // 2. Bump (or insert) `synthesis_updated_at:` in frontmatter
  let newFm = fm;
  if (/^synthesis_updated_at:\s*.+$/m.test(newFm)) {
    newFm = newFm.replace(/^synthesis_updated_at:\s*.+$/m, `synthesis_updated_at: ${dateISO}`);
  } else {
    // Insert after `updated:` line (or before closing `---`)
    if (/^updated:\s*.+$/m.test(newFm)) {
      newFm = newFm.replace(/(^updated:\s*.+$)/m, `$1\nsynthesis_updated_at: ${dateISO}`);
    } else {
      newFm = newFm.replace(/\n---\n$/, `\nsynthesis_updated_at: ${dateISO}\n---\n`);
    }
  }
  // Bump updated: too
  if (/^updated:\s*.+$/m.test(newFm)) {
    newFm = newFm.replace(/^updated:\s*.+$/m, `updated: ${dateISO}`);
  }
  return newFm + newBody;
}

export interface RefineResult {
  mode: "prepare" | "dryrun" | "apply";
  entityPath?: string;
  promptPath?: string;
  oldSynthesis?: string;
  newSynthesis?: string;
  citedSources?: string[];
  unresolvedCitations?: string[];
  opId?: string;
}

export function refineEntity(
  repoRoot: string,
  name: string,
  opts: { responsePath?: string; apply?: boolean } = {},
): RefineResult {
  const entityPath = findEntityFile(repoRoot, name);
  if (!entityPath) throw new Error(`entity not found: ${name}`);

  const entityRaw = readFileSync(join(repoRoot, entityPath), "utf8");
  const { body } = splitFM(entityRaw);
  const parsed = parseEntity(body);

  // Resolve citations to Source paths
  const sourcesBodies: { slug: string; body: string }[] = [];
  const unresolved: string[] = [];
  for (const token of parsed.cited) {
    const srcPath = resolveSourcePath(repoRoot, token);
    if (!srcPath) { unresolved.push(token); continue; }
    try {
      const raw = readFileSync(join(repoRoot, srcPath), "utf8");
      sourcesBodies.push({ slug: token, body: raw });
    } catch { unresolved.push(token); }
  }

  // Mode 1: prepare prompt
  if (!opts.responsePath) {
    const prompt = buildPrompt(name, entityRaw, parsed, sourcesBodies);
    // Prompts live under `.refine-prompts/` (gitignored) so lint's
    // walkWikiDocs doesn't pick them up as malformed entity files.
    const promptDir = join(repoRoot, ".refine-prompts");
    mkdirSync(promptDir, { recursive: true });
    const promptPath = `.refine-prompts/${name}-synthesis-prompt.md`;
    writeFileSync(join(repoRoot, promptPath), prompt, "utf8");
    return { mode: "prepare", entityPath, promptPath, oldSynthesis: parsed.synthesis, citedSources: parsed.cited, unresolvedCitations: unresolved };
  }

  // Modes 2/3: read response
  const respAbs = resolve(opts.responsePath);
  let newSynthesis: string;
  try { newSynthesis = readFileSync(respAbs, "utf8").trim(); }
  catch (e) { throw new Error(`failed to read response at ${respAbs}: ${(e as Error).message}`); }
  if (!newSynthesis) throw new Error(`response is empty: ${respAbs}`);

  if (!opts.apply) {
    return { mode: "dryrun", entityPath, oldSynthesis: parsed.synthesis, newSynthesis, citedSources: parsed.cited };
  }

  // Mode 3: apply atomically
  const dateISO = new Date().toISOString().slice(0, 10);
  const newRaw = buildReplacement(entityRaw, newSynthesis, dateISO);
  const ops: PendingOp[] = [{ kind: "write", path: entityPath, body: newRaw }];
  const opId = `refine-entity-${name.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;
  applyAtomically(repoRoot, opId, ops);
  appendLogEntry(repoRoot, "refactor", `Refine [[${name}]] Synthesis`, [
    `Regenerated ## Synthesis from ${parsed.observations.length} Observation(s) + ${sourcesBodies.length} Source body(ies).`,
    unresolved.length > 0 ? `${unresolved.length} citation(s) failed to resolve: ${unresolved.join(", ")}` : `All Observation citations resolved.`,
    `\`synthesis_updated_at\` bumped to ${dateISO}.`,
  ]);
  cleanupStaging(repoRoot, opId);
  return { mode: "apply", entityPath, oldSynthesis: parsed.synthesis, newSynthesis, citedSources: parsed.cited, opId };
}

function printDiff(name: string, oldS: string, newS: string): void {
  console.log(`# Synthesis diff for [[${name}]]\n`);
  console.log(`## Old\n\n${oldS || "_(stub)_"}\n`);
  console.log(`## New\n\n${newS}\n`);
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = refineEntity(REPO_ROOT_DEFAULT, args.name, {
      responsePath: args.responsePath,
      apply: args.apply,
    });
    if (r.mode === "prepare") {
      console.log(`✓ wrote prompt package: ${r.promptPath}`);
      console.log(`  cited Sources: ${r.citedSources?.length ?? 0}`);
      if (r.unresolvedCitations && r.unresolvedCitations.length > 0) {
        console.log(`  ⚠ ${r.unresolvedCitations.length} citation(s) failed to resolve (Source not found): ${r.unresolvedCitations.join(", ")}`);
      }
      console.log(`\nNext steps:`);
      console.log(`  1. Spawn a Sonnet subagent in your Claude session with the prompt.`);
      console.log(`  2. Save the response (plain text, 4-6 sentences) to:`);
      console.log(`       .refine-prompts/${args.name}-synthesis-response.txt`);
      console.log(`  3. Re-run with --response <path> to preview the diff.`);
      console.log(`  4. Re-run with --response <path> --apply to commit.`);
    } else if (r.mode === "dryrun") {
      printDiff(args.name, r.oldSynthesis!, r.newSynthesis!);
      console.log(`(dry-run — no files written. Re-run with --apply to commit.)`);
    } else {
      printDiff(args.name, r.oldSynthesis!, r.newSynthesis!);
      console.log(`✓ wrote new Synthesis to ${r.entityPath}; synthesis_updated_at bumped; log entry appended.`);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
