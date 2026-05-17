/**
 * `hirono refine-batch` — N-entities-in-one-Sonnet-call batch refiner.
 *
 * Per-entity refine-entity is 3 tool calls each (prepare, spawn Sonnet,
 * apply). For 10 stale entities that's 30 tool calls + 10 fresh Sonnet
 * contexts each paying full price for the ~1.5KB cache-friendly preamble.
 *
 * refine-batch collapses this to 3 tool calls TOTAL:
 *   1. `hirono refine-batch <names...> | --from-stale [--limit N]`
 *      Builds ONE merged prompt: preamble FIRST, N entity blocks LAST.
 *      Writes `.refine-prompts/batch.md`.
 *   2. Operator spawns ONE Sonnet subagent (Agent tool, model:"sonnet")
 *      reading the batch prompt; subagent writes marker-delimited response
 *      to `.refine-prompts/batch-response.txt`.
 *   3. `hirono refine-batch --response <path> [--apply]`
 *      Parses by `=== entity: <Name> ===` markers; for each parsed pair
 *      invokes refineEntity's apply path (atomic + log entry).
 *
 * Why batched-single-call beats parallel-N-calls:
 *   - Preamble bills exactly once (within the single conversation; the
 *     5-min cache TTL also covers subsequent calls but a single call is
 *     the lower bound).
 *   - One Agent invocation instead of N — fewer orchestration failure modes.
 *   - Sonnet sees all N entities together — can align framing where the
 *     same Source is cited across multiple entities.
 *
 * Stable-in-code guarantees:
 *   - Merged prompt always starts with REFINE_ENTITY_PREAMBLE (cache key).
 *   - Marker format hard-coded; Sonnet's instructions match the parser.
 *   - Apply path reuses refineEntity's atomic write + log entry logic —
 *     no duplicated invariants.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refineEntity } from "./refine-entity.ts";
import { refineAllStale, type StaleItem } from "./refine-all-stale.ts";
import { REFINE_ENTITY_PREAMBLE } from "./_shared/prompt-preamble.ts";
import { excerptSource, type ExcerptMode } from "./_shared/source-excerpt.ts";
import { writePromptMeasure } from "./_shared/prompt-measure.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

const BATCH_PROMPT_PATH = ".refine-prompts/batch.md";
const BATCH_RESPONSE_PATH = ".refine-prompts/batch-response.txt";
const ENTITY_MARKER_RE = /^=== entity: (.+?) ===\s*$/gm;

interface ParsedArgs {
  names: string[];
  fromStale: boolean;
  limit: number | null;
  responsePath: string;
  apply: boolean;
  fullSource: boolean;
}

function usage(): never {
  console.error(`usage:
  hirono refine-batch <name1> <name2> ...           # build merged prompt
  hirono refine-batch --from-stale [--limit N]      # pick top-N stale entities
  hirono refine-batch --response <path>             # dry-run all diffs
  hirono refine-batch --response <path> --apply     # apply all atomically

One Sonnet call refines N entities; preamble caches once instead of N times.

Flags:
  --from-stale         Take names from stale-synthesis lint (lag-desc).
  --limit N            Cap to top-N stale items when --from-stale.
  --response <path>    Read Sonnet response (marker-delimited per entity).
                       Without --apply: dry-run, prints diffs only.
  --apply              Apply atomically (per-entity refactor-log entries).
  --full-source        Full Source bodies instead of curated excerpts.

Workflow:
  1. \`hirono refine-batch Foo Bar Baz\` → writes ${BATCH_PROMPT_PATH}
  2. Spawn ONE Sonnet (Agent tool, model:"sonnet"). Instruct it to read
     the prompt and write to ${BATCH_RESPONSE_PATH} using marker format.
  3. \`hirono refine-batch --response ${BATCH_RESPONSE_PATH} --apply\`
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let fromStale = false;
  let limit: number | null = null;
  let responsePath = "";
  let apply = false;
  let fullSource = false;
  const names: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-stale") fromStale = true;
    else if (a === "--limit") {
      const v = argv[++i];
      if (!v || !/^\d+$/.test(v)) { console.error(`--limit requires a positive integer`); usage(); }
      limit = parseInt(v, 10);
    }
    else if (a === "--response") { i++; responsePath = (argv[i] ?? "").trim(); }
    else if (a === "--apply") apply = true;
    else if (a === "--full-source") fullSource = true;
    else if (a === "--help" || a === "-h") usage();
    else if (a.startsWith("-")) { console.error(`unknown flag: ${a}`); usage(); }
    else names.push(a);
  }
  if (apply && !responsePath) { console.error("--apply requires --response"); usage(); }
  if (!responsePath && !fromStale && names.length === 0) usage();
  return { names, fromStale, limit, responsePath, apply, fullSource };
}

/** Mirror of refine-entity.ts internals — extract a `## Heading` section body. */
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

/** Try to resolve a citation token to a Source path. */
function resolveSourcePath(repoRoot: string, token: string): string | null {
  if (token.startsWith("Sources/")) {
    const direct = token.endsWith(".md") ? token : `${token}.md`;
    if (existsSync(join(repoRoot, direct))) return direct;
  }
  const sourcesDir = join(repoRoot, "Sources");
  if (!existsSync(sourcesDir)) return null;
  for (const year of readdirSync(sourcesDir)) {
    if (!/^\d{4}$/.test(year)) continue;
    const candidate = `Sources/${year}/${token}.md`;
    if (existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}

/** Read entity → parse Synthesis/Observations/cited → load curated Source excerpts. */
function gatherEntityContext(
  repoRoot: string,
  name: string,
  sourceMode: ExcerptMode,
): { synthesis: string; observations: string[]; sources: { slug: string; body: string }[] } {
  const active = `Entities/${name}.md`;
  const seen = `Entities/_seen/${name}.md`;
  let entityPath: string | null = null;
  if (existsSync(join(repoRoot, active))) entityPath = active;
  else if (existsSync(join(repoRoot, seen))) entityPath = seen;
  if (!entityPath) throw new Error(`entity not found: ${name}`);

  const raw = readFileSync(join(repoRoot, entityPath), "utf8");
  const fmMatch = raw.match(/^---\n[\s\S]*?\n---\n/);
  const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;

  const synthesis = extractSection(body, "## Synthesis");
  const obsBlock = extractSection(body, "## Observations");
  const observations: string[] = [];
  const cited = new Set<string>();
  for (const line of obsBlock.split("\n")) {
    if (/^-\s+/.test(line)) {
      observations.push(line.replace(/^-\s+/, "").trim());
      for (const m of line.matchAll(/\[\[Sources\/(?:\d{4}\/)?([^\]|]+?)(?:\|[^\]]*)?\]\]/g)) {
        cited.add(m[1].trim());
      }
      for (const m of line.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g)) {
        const target = m[1].trim();
        if (target.startsWith("Sources/")) continue;
        cited.add(target);
      }
    }
  }
  const sources: { slug: string; body: string }[] = [];
  for (const token of cited) {
    const srcPath = resolveSourcePath(repoRoot, token);
    if (!srcPath) continue;
    const excerpt = excerptSource(repoRoot, srcPath, sourceMode);
    if (excerpt === null) continue;
    sources.push({ slug: token, body: excerpt });
  }
  return { synthesis, observations, sources };
}

/** Build the merged batch prompt. */
function buildBatchPrompt(
  items: { name: string; ctx: ReturnType<typeof gatherEntityContext> }[],
): string {
  const blocks = items
    .map((it, idx) => {
      const sourceBlocks = it.ctx.sources.map(s => `### Source: ${s.slug}\n\n${s.body}`).join("\n\n");
      return `## (${idx + 1}/${items.length}) Subject: [[${it.name}]]

### Current Synthesis (for continuity — keep or rewrite)

${it.ctx.synthesis || "_(stub)_"}

### Observations

${it.ctx.observations.map(o => `- ${o}`).join("\n")}

### Cited Source excerpts

${sourceBlocks || "_(none resolved)_"}`;
    })
    .join("\n\n---\n\n");

  return `${REFINE_ENTITY_PREAMBLE}

---

## Batch mode: ${items.length} entities in one pass

Regenerate the \`## Synthesis\` paragraph for ${items.length} Entities below. **Output format — exact, parser-strict**:

\`\`\`
=== entity: <Name1> ===
<4–6 sentence Synthesis paragraph; plain prose; no preamble; no wikilinks inside the Synthesis>

=== entity: <Name2> ===
<4–6 sentence Synthesis paragraph>
\`\`\`

Rules (per entity, independent):
- 4–6 sentences of plain prose.
- No bullet lists, headings, fenced code, or preamble like "Here is...".
- No wikilinks INSIDE the Synthesis paragraph.
- Every claim must trace to that entity's Observations or its cited Source excerpts.
- Don't cross-pollinate claims between entities.
- When evidence conflicts, name the conflict.

The CLI parses by the \`=== entity: <Name> ===\` marker line (exact match including spaces around the colon and triple-equals). Use the entity name VERBATIM as shown in each block heading.

Write your full response to \`${BATCH_RESPONSE_PATH}\` (path is relative to repo root; the CLI reads it from there).

---

${blocks}
`;
}

/** Parse the marker-delimited response into per-entity (name, paragraph) pairs. */
export function parseBatchResponse(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  const text = raw.trim();
  if (!text) return out;
  const parts = text.split(ENTITY_MARKER_RE);
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i]?.trim();
    const body = parts[i + 1]?.trim() ?? "";
    if (!name) continue;
    const cleaned = body.replace(/\n```[\s\S]*$/m, "").trim();
    if (cleaned) out.set(name, cleaned);
  }
  return out;
}

export interface BatchResult {
  mode: "prepare" | "dryrun" | "apply";
  promptPath?: string;
  promptChars?: number;
  itemCount?: number;
  parsed?: Map<string, string>;
  applied?: string[];
  failed?: { name: string; error: string }[];
  unmatchedInResponse?: string[];
  missingFromResponse?: string[];
}

export function refineBatch(
  repoRoot: string,
  opts: {
    names?: string[];
    fromStale?: boolean;
    limit?: number | null;
    responsePath?: string;
    apply?: boolean;
    sourceMode?: ExcerptMode;
  } = {},
): BatchResult {
  // Mode 1: prepare
  if (!opts.responsePath) {
    let names: string[] = opts.names ?? [];
    if (opts.fromStale) {
      const stale = refineAllStale(repoRoot, { list: true });
      const sliced = opts.limit !== null && opts.limit !== undefined
        ? stale.stale.slice(0, opts.limit)
        : stale.stale;
      names = sliced.map((s: StaleItem) => s.name);
      if (names.length === 0) {
        return { mode: "prepare", itemCount: 0 };
      }
    }
    if (names.length === 0) throw new Error(`no entity names given (pass names positionally or --from-stale)`);

    const items = names.map((name) => ({
      name,
      ctx: gatherEntityContext(repoRoot, name, opts.sourceMode ?? "curated"),
    }));

    const prompt = buildBatchPrompt(items);
    const promptDir = join(repoRoot, ".refine-prompts");
    mkdirSync(promptDir, { recursive: true });
    writeFileSync(join(repoRoot, BATCH_PROMPT_PATH), prompt, "utf8");
    writePromptMeasure(repoRoot, BATCH_PROMPT_PATH, prompt, {
      source_count: items.length,
      mode: opts.sourceMode ?? "curated",
    });
    return {
      mode: "prepare",
      promptPath: BATCH_PROMPT_PATH,
      promptChars: prompt.length,
      itemCount: items.length,
    };
  }

  // Modes 2/3: read + parse response
  const respAbs = resolve(repoRoot, opts.responsePath);
  let raw: string;
  try { raw = readFileSync(respAbs, "utf8"); }
  catch (e) { throw new Error(`failed to read response at ${respAbs}: ${(e as Error).message}`); }
  const parsed = parseBatchResponse(raw);
  if (parsed.size === 0) {
    throw new Error(`response contained zero \`=== entity: <Name> ===\` blocks — check marker format`);
  }

  // Cross-check parsed names against the saved batch prompt's entities.
  const promptAbs = join(repoRoot, BATCH_PROMPT_PATH);
  const expected = new Set<string>();
  if (existsSync(promptAbs)) {
    const promptRaw = readFileSync(promptAbs, "utf8");
    for (const m of promptRaw.matchAll(/^## \(\d+\/\d+\) Subject: \[\[(.+?)\]\]\s*$/gm)) {
      expected.add(m[1]);
    }
  }
  const unmatchedInResponse: string[] = [];
  for (const name of parsed.keys()) {
    if (expected.size > 0 && !expected.has(name)) unmatchedInResponse.push(name);
  }
  const missingFromResponse: string[] = [];
  for (const name of expected) {
    if (!parsed.has(name)) missingFromResponse.push(name);
  }

  if (!opts.apply) {
    return {
      mode: "dryrun",
      parsed,
      itemCount: parsed.size,
      unmatchedInResponse,
      missingFromResponse,
    };
  }

  // Mode 3: apply per-entity atomically. Partial success allowed.
  const applied: string[] = [];
  const failed: { name: string; error: string }[] = [];
  const indivDir = join(repoRoot, ".refine-prompts");
  mkdirSync(indivDir, { recursive: true });
  for (const [name, paragraph] of parsed.entries()) {
    try {
      const indivRespPath = `.refine-prompts/${name}-synthesis-response.txt`;
      writeFileSync(join(repoRoot, indivRespPath), paragraph + "\n", "utf8");
      refineEntity(repoRoot, name, {
        responsePath: join(repoRoot, indivRespPath),
        apply: true,
        sourceMode: opts.sourceMode ?? "curated",
      });
      applied.push(name);
    } catch (e) {
      failed.push({ name, error: (e as Error).message });
    }
  }
  return {
    mode: "apply",
    parsed,
    itemCount: parsed.size,
    applied,
    failed,
    unmatchedInResponse,
    missingFromResponse,
  };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const r = refineBatch(REPO_ROOT_DEFAULT, {
      names: args.names,
      fromStale: args.fromStale,
      limit: args.limit,
      responsePath: args.responsePath || undefined,
      apply: args.apply,
      sourceMode: args.fullSource ? "full" : "curated",
    });
    if (r.mode === "prepare") {
      if (r.itemCount === 0) {
        console.log(`✓ no stale entities found; nothing to batch.`);
        return;
      }
      console.log(`✓ wrote batch prompt for ${r.itemCount} entities: ${r.promptPath}`);
      console.log(`  prompt size: ${(r.promptChars! / 1024).toFixed(1)} KB`);
      console.log(`\nNext steps:`);
      console.log(`  1. Spawn ONE Agent subagent (model per CLAUDE.md §11:`);
      console.log(`     Opus for active-tier batches, Sonnet for tail).`);
      console.log(`     Instruct it to read ${r.promptPath} and write its response to`);
      console.log(`     ${BATCH_RESPONSE_PATH} using the marker format.`);
      console.log(`  2. \`hirono refine-batch --response ${BATCH_RESPONSE_PATH}\`              # dry-run all diffs`);
      console.log(`  3. \`hirono refine-batch --response ${BATCH_RESPONSE_PATH} --apply\`      # apply all atomically`);
    } else if (r.mode === "dryrun") {
      console.log(`Parsed ${r.itemCount} entity block(s) from response:`);
      for (const [name, para] of r.parsed!.entries()) {
        console.log(`\n--- [[${name}]] (${para.length} chars) ---`);
        console.log(para);
      }
      if (r.missingFromResponse && r.missingFromResponse.length > 0) {
        console.log(`\n⚠ ${r.missingFromResponse.length} entit(y/ies) in batch prompt but missing from response: ${r.missingFromResponse.join(", ")}`);
      }
      if (r.unmatchedInResponse && r.unmatchedInResponse.length > 0) {
        console.log(`\n⚠ ${r.unmatchedInResponse.length} entit(y/ies) in response but not in batch prompt: ${r.unmatchedInResponse.join(", ")}`);
      }
      console.log(`\n(dry-run — no files written. Re-run with --apply to commit.)`);
    } else {
      // apply
      console.log(`Applied ${r.applied!.length}/${r.itemCount} entity refines:`);
      for (const n of r.applied!) console.log(`  ✓ [[${n}]]`);
      if (r.failed && r.failed.length > 0) {
        console.log(`\nFailed ${r.failed.length}:`);
        for (const f of r.failed) console.log(`  ✗ [[${f.name}]] — ${f.error}`);
      }
      if (r.missingFromResponse && r.missingFromResponse.length > 0) {
        console.log(`\n⚠ ${r.missingFromResponse.length} requested but missing from response: ${r.missingFromResponse.join(", ")}`);
      }
      if (r.unmatchedInResponse && r.unmatchedInResponse.length > 0) {
        console.log(`\n⚠ ${r.unmatchedInResponse.length} in response but not in batch prompt: ${r.unmatchedInResponse.join(", ")}`);
      }
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
