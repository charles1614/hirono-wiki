/**
 * `hirono ingest-preview` — what would `refine-all-stale` cost right now?
 *
 * Run after `fetch-all` + per-Source `auto-detect-entities --apply`. Prints
 * a headline cost preview so the operator can decide whether to refine
 * immediately, batch with `--limit N`, or wait for staleness to accumulate.
 *
 * Two layers of information:
 *
 *   1. **Lint-flagged staleness** (the ground truth):
 *      counts of stale-synthesis, stale-topic-synthesis,
 *      stale-top-synthesis as `lint --json` reports them right now.
 *
 *   2. **Recent ingest signal** (--since <git-ref>, default HEAD~1):
 *      counts new Sources written since the ref, plus the union of
 *      entities/topics each lists under `## Entities touched` /
 *      `## Topics touched`. Diagnostic only — actual storm size is
 *      determined by layer 1.
 *
 * Cost estimate: builds a preview prompt for each stale entity (via
 * `refineEntity({ preview: true })`) plus stable per-Topic / Synthesis
 * heuristics. Char/4 → input tokens, +30% for output.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { refineEntity } from "./refine-entity.ts";
import {
  estimateCostUSD,
  OUTPUT_TO_INPUT_RATIO,
  SONNET_INPUT_PRICE_PER_M,
  SONNET_OUTPUT_PRICE_PER_M,
  type MeasureSummary,
} from "./_shared/prompt-measure.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT_DEFAULT = resolve(dirname(THIS_FILE), "..", "..");

// Average prompt sizes for refine-topic + refine-top-synthesis. Derived
// from existing measure sidecars at the time the feature shipped; refresh
// periodically by sampling actual measure sidecars under .refine-prompts/.
// These are heuristics — only used when no actual measure exists for a
// given topic/top-synthesis. Conservative (round up) to avoid under-quote.
const AVG_REFINE_TOPIC_CHARS = 60_000;
const AVG_REFINE_TOP_SYNTHESIS_CHARS = 120_000;

interface ParsedArgs {
  since: string;
  json: boolean;
}

function usage(): never {
  console.error(`usage: hirono ingest-preview [--since <git-ref>] [--json]

After bulk ingest (fetch-all + auto-detect-entities), print the headline
cost preview: how many refines would spawn, ~tokens, ~cost.

  --since <ref>   Compare against this git ref to count new Sources.
                  Default: HEAD~1. Use HEAD^^ for two commits back, a
                  tag, a branch, etc.
  --json          Emit JSON (for piping into other tooling).
`);
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  let since = "HEAD~1";
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--since") {
      const v = argv[++i];
      if (!v) { console.error(`--since requires a git ref`); usage(); }
      since = v;
    } else if (a === "--json") json = true;
    else if (a === "--help" || a === "-h") usage();
    else { console.error(`unknown arg: ${a}`); usage(); }
  }
  return { since, json };
}

interface LintIssue {
  kind: string;
  severity: string;
  path: string;
  detail: string;
}

function runLintChecks(repoRoot: string): LintIssue[] {
  const result = spawnSync(
    "npx",
    [
      "tsx", "tools/bin/lint.ts",
      "--check", "stale-synthesis,stale-topic-synthesis,stale-top-synthesis",
      "--json",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status === null) {
    throw new Error(`lint failed to run: ${result.error?.message ?? "unknown"}`);
  }
  const issues: LintIssue[] = [];
  const out = result.stdout.trim();
  if (!out) return [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    try { issues.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return issues;
}

function entityNameFromPath(p: string): string | null {
  const m = p.match(/^Entities\/(?:_seen\/)?([^\/]+?)\.md$/);
  return m ? m[1] : null;
}

interface IngestSignal {
  newSources: string[];
  touchedEntities: Set<string>;
  touchedTopics: Set<string>;
  invalidRef: boolean;
}

export function extractWikilinks(section: string): string[] {
  const out: string[] = [];
  // Captures: target only. Optional `#anchor` and `|alias` suffixes are
  // consumed but discarded — wikilink TARGET is the entity/topic name.
  const re = /\[\[([^\]|#]+?)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

export function readSection(body: string, heading: string): string | null {
  // Split into lines, find the matching `## <heading>` line, slice up to
  // the next `## ` line (or EOF). Regex with `\Z` doesn't exist in JS
  // and `$` is unreliable across line endings, so go imperative.
  const lines = body.split("\n");
  const target = `## ${heading}`;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === target) { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join("\n");
}

function gatherIngestSignal(repoRoot: string, since: string): IngestSignal {
  // List NEW Sources added between <since> and HEAD via git diff --name-only.
  // `-c core.quotepath=false` so non-ASCII filenames (CJK, etc.) aren't
  // returned wrapped in quotes with octal-escaped bytes.
  const result = spawnSync(
    "git",
    ["-c", "core.quotepath=false", "diff", "--name-only", "--diff-filter=A", since, "HEAD", "--", "03_Sources/"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    // Likely an invalid ref — return empty signal so the caller can show
    // the lint counts without crashing.
    return { newSources: [], touchedEntities: new Set(), touchedTopics: new Set(), invalidRef: true };
  }
  const files = result.stdout.split("\n").map(s => s.trim()).filter(s => s.endsWith(".md"));
  const touchedEntities = new Set<string>();
  const touchedTopics = new Set<string>();
  // Classify each wikilink target by filesystem presence (Entities/ vs
  // Topics/). The dedicated `## Entities touched` / `## Topics touched`
  // sections are convention but not universally followed (~half of
  // current Sources use them), so we scan ALL body wikilinks to avoid
  // undercounting the fan-out.
  for (const f of files) {
    let raw: string;
    try { raw = readFileSync(join(repoRoot, f), "utf8"); }
    catch { continue; }
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
    for (const link of extractWikilinks(body)) {
      if (existsSync(join(repoRoot, "01_Topics", `${link}.md`))) {
        touchedTopics.add(link);
      } else if (
        existsSync(join(repoRoot, "02_Entities", `${link}.md`)) ||
        existsSync(join(repoRoot, "02_Entities", "_seen", `${link}.md`))
      ) {
        touchedEntities.add(link);
      }
      // Wikilinks to Sources or unresolved targets are ignored — they
      // don't drive entity/topic staleness fan-out.
    }
  }
  return { newSources: files, touchedEntities, touchedTopics, invalidRef: false };
}

interface Preview {
  ingest: {
    since: string;
    newSources: number;
    touchedEntities: number;
    touchedTopics: number;
    invalidRef: boolean;
  };
  stale: {
    entities: { count: number; names: string[] };
    topics: { count: number; names: string[] };
    topSynthesis: boolean;
  };
  refine: {
    spawns: number;
    totalChars: number;
    estInputTokens: number;
    estCostUSD: number;
    breakdown: Record<string, { count: number; chars: number }>;
  };
}

export function computePreview(repoRoot: string, since: string): Preview {
  const issues = runLintChecks(repoRoot);
  const staleEntities: string[] = [];
  const staleTopics: string[] = [];
  let topStale = false;
  for (const i of issues) {
    if (i.kind === "stale-synthesis") {
      const name = entityNameFromPath(i.path);
      if (name) staleEntities.push(name);
    } else if (i.kind === "stale-topic-synthesis") {
      const m = i.path.match(/^Topics\/(.+?)\.md$/);
      if (m) staleTopics.push(m[1]);
    } else if (i.kind === "stale-top-synthesis") {
      topStale = true;
    }
  }

  // Cost: actually preview entity refines (accurate). For topics and
  // top-synthesis, use heuristic averages (one-call, low N — refining
  // those individually for an exact size would slow the preview down
  // without changing the order of magnitude).
  const breakdown: Record<string, { count: number; chars: number }> = {};
  let totalChars = 0;
  for (const name of staleEntities) {
    try {
      const r = refineEntity(repoRoot, name, { preview: true });
      const chars = r.promptChars ?? 0;
      totalChars += chars;
      if (!breakdown["refine-entity"]) breakdown["refine-entity"] = { count: 0, chars: 0 };
      breakdown["refine-entity"].count += 1;
      breakdown["refine-entity"].chars += chars;
    } catch { /* skip — entity might be unresolvable */ }
  }
  if (staleTopics.length > 0) {
    const chars = staleTopics.length * AVG_REFINE_TOPIC_CHARS;
    totalChars += chars;
    breakdown["refine-topic"] = { count: staleTopics.length, chars };
  }
  if (topStale) {
    totalChars += AVG_REFINE_TOP_SYNTHESIS_CHARS;
    breakdown["refine-top-synthesis"] = { count: 1, chars: AVG_REFINE_TOP_SYNTHESIS_CHARS };
  }

  const estInputTokens = Math.round(totalChars / 4);
  const spawns = staleEntities.length + staleTopics.length + (topStale ? 1 : 0);
  const summary: MeasureSummary = {
    count: spawns,
    total_chars: totalChars,
    total_lines: 0,
    est_input_tokens: estInputTokens,
    by_kind: breakdown,
    largest: [],
  };
  const cost = estimateCostUSD(summary);

  const signal = gatherIngestSignal(repoRoot, since);

  return {
    ingest: {
      since,
      newSources: signal.newSources.length,
      touchedEntities: signal.touchedEntities.size,
      touchedTopics: signal.touchedTopics.size,
      invalidRef: signal.invalidRef,
    },
    stale: {
      entities: { count: staleEntities.length, names: staleEntities },
      topics: { count: staleTopics.length, names: staleTopics },
      topSynthesis: topStale,
    },
    refine: {
      spawns,
      totalChars,
      estInputTokens,
      estCostUSD: cost,
      breakdown,
    },
  };
}

function formatPreview(p: Preview): string {
  const lines: string[] = [];
  lines.push(`Ingest signal (since ${p.ingest.since}):`);
  if (p.ingest.invalidRef) {
    lines.push(`  (could not resolve git ref — skipping ingest counts)`);
  } else {
    lines.push(`  New Sources:        ${p.ingest.newSources}`);
    lines.push(`  Touched Entities:   ${p.ingest.touchedEntities}`);
    lines.push(`  Touched Topics:     ${p.ingest.touchedTopics}`);
  }
  lines.push(``);
  lines.push(`Currently flagged stale (lint --json):`);
  lines.push(`  Entities:           ${p.stale.entities.count}`);
  lines.push(`  Topics:             ${p.stale.topics.count}`);
  lines.push(`  Top-Synthesis:      ${p.stale.topSynthesis ? "yes" : "no"}`);
  lines.push(``);
  lines.push(`refine-all-stale would spawn:`);
  lines.push(`  Sonnet calls:       ${p.refine.spawns}`);
  for (const [k, v] of Object.entries(p.refine.breakdown).sort()) {
    lines.push(`    ${k.padEnd(22)} ${String(v.count).padStart(4)}  (~${(v.chars / 1000).toFixed(1)}K chars)`);
  }
  lines.push(`  Est input tokens:   ~${(p.refine.estInputTokens / 1000).toFixed(1)}K`);
  lines.push(`  Est dispatch cost:  ~$${p.refine.estCostUSD.toFixed(2)}  (Sonnet 4.6 @ $${SONNET_INPUT_PRICE_PER_M}/M input + ${(OUTPUT_TO_INPUT_RATIO * 100).toFixed(0)}% output @ $${SONNET_OUTPUT_PRICE_PER_M}/M)`);
  lines.push(``);
  if (p.refine.spawns === 0) {
    lines.push(`Nothing to refine. Discipline: ingest frequently, refine rarely.`);
  } else {
    lines.push(`Recommended next steps:`);
    lines.push(`  hirono refine-all-stale --preview              # entity-level breakdown`);
    if (p.refine.spawns > 10) {
      const cap = Math.min(10, Math.ceil(p.refine.spawns / 3));
      lines.push(`  hirono refine-all-stale --limit ${cap}                 # cap to top ${cap} most-stale`);
    }
    lines.push(`  (or wait — staleness will batch further drift; 7d lag threshold)`);
  }
  return lines.join("\n");
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  try {
    const p = computePreview(REPO_ROOT_DEFAULT, args.since);
    if (args.json) {
      console.log(JSON.stringify(p, null, 2));
    } else {
      console.log(formatPreview(p));
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}

const isEntryPoint = process.argv[1] && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main(process.argv.slice(2));
