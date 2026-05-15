/**
 * Shared `--measure` helper: writes a sidecar `<prompt>-measure.json` with
 * prompt stats next to a generated prompt file. Used by all `refine-*`
 * CLIs to track prompt-size regressions / progress without manual
 * counting.
 *
 * Schema:
 *   {
 *     prompt_path: string,
 *     prompt_chars: number,
 *     prompt_lines: number,
 *     source_count: number,        // # of cited Source excerpts/bodies
 *     stub_count: number,          // # of stub items filtered (synthesis only)
 *     mode: "curated" | "full" | null,
 *     timestamp: string
 *   }
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface PromptMeasure {
  prompt_path: string;
  prompt_chars: number;
  prompt_lines: number;
  source_count: number;
  stub_count?: number;
  mode?: "curated" | "full" | null;
  timestamp: string;
}

export function writePromptMeasure(
  repoRoot: string,
  promptPath: string,
  promptBody: string,
  extras: { source_count: number; stub_count?: number; mode?: "curated" | "full" },
): string {
  const m: PromptMeasure = {
    prompt_path: promptPath,
    prompt_chars: promptBody.length,
    prompt_lines: promptBody.split("\n").length,
    source_count: extras.source_count,
    stub_count: extras.stub_count,
    mode: extras.mode ?? null,
    timestamp: new Date().toISOString(),
  };
  const sidecarPath = promptPath.replace(/\.md$/, "-measure.json");
  const abs = join(repoRoot, sidecarPath);
  writeFileSync(abs, JSON.stringify(m, null, 2) + "\n", "utf8");
  return sidecarPath;
}

export interface MeasureSummary {
  count: number;
  total_chars: number;
  total_lines: number;
  est_input_tokens: number;
  by_kind: Record<string, { count: number; total_chars: number }>;
  largest: Array<{ path: string; chars: number; source_count: number; kind: string }>;
}

/**
 * Infer the refine kind from a measure sidecar's `prompt_path`. Naming
 * scheme established by the refine-* CLIs:
 *   - `synthesis-prompt.md`                  → refine-top-synthesis
 *   - `<name>-topic-prompt.md`               → refine-topic
 *   - `<name>-synthesis-prompt.md`           → refine-entity
 *   - anything else                          → other
 */
export function inferPromptKind(promptPath: string): string {
  const base = promptPath.split("/").pop() ?? promptPath;
  if (base === "synthesis-prompt.md") return "refine-top-synthesis";
  if (base.endsWith("-topic-prompt.md")) return "refine-topic";
  if (base.endsWith("-synthesis-prompt.md")) return "refine-entity";
  return "other";
}

/**
 * Read every `*-measure.json` under `dir` (absolute path) and aggregate
 * the stats. Returns an empty summary if `dir` doesn't exist or has no
 * measure sidecars.
 *
 * Token estimate: `chars / 4` — rough, no tiktoken dependency. Order-of-
 * magnitude accuracy is sufficient for budget previews.
 */
export function summarizeMeasures(dir: string): MeasureSummary {
  const empty: MeasureSummary = {
    count: 0,
    total_chars: 0,
    total_lines: 0,
    est_input_tokens: 0,
    by_kind: {},
    largest: [],
  };
  let files: string[];
  try {
    files = readdirSync(dir).filter(f => f.endsWith("-measure.json"));
  } catch {
    return empty;
  }
  if (files.length === 0) return empty;

  const all: Array<PromptMeasure & { kind: string }> = [];
  for (const f of files) {
    try {
      const m: PromptMeasure = JSON.parse(readFileSync(join(dir, f), "utf8"));
      all.push({ ...m, kind: inferPromptKind(m.prompt_path) });
    } catch {
      // skip malformed sidecars — they don't poison the summary
    }
  }

  const by_kind: Record<string, { count: number; total_chars: number }> = {};
  let total_chars = 0;
  let total_lines = 0;
  for (const m of all) {
    total_chars += m.prompt_chars;
    total_lines += m.prompt_lines;
    if (!by_kind[m.kind]) by_kind[m.kind] = { count: 0, total_chars: 0 };
    by_kind[m.kind].count += 1;
    by_kind[m.kind].total_chars += m.prompt_chars;
  }

  const largest = [...all]
    .sort((a, b) => b.prompt_chars - a.prompt_chars)
    .slice(0, 5)
    .map(m => ({
      path: m.prompt_path,
      chars: m.prompt_chars,
      source_count: m.source_count,
      kind: m.kind,
    }));

  return {
    count: all.length,
    total_chars,
    total_lines,
    est_input_tokens: Math.round(total_chars / 4),
    by_kind,
    largest,
  };
}

/**
 * Pricing constants for the cost estimate. Sonnet 4.6 list price as of
 * 2026-05 — Anthropic publishes $3/M input + $15/M output. Output is
 * harder to predict; we estimate per-refine output as 30% of input on
 * average (refine outputs are a fresh synthesis paragraph, not the full
 * prompt echoed back).
 */
export const SONNET_INPUT_PRICE_PER_M = 3;
export const SONNET_OUTPUT_PRICE_PER_M = 15;
export const OUTPUT_TO_INPUT_RATIO = 0.3;

export function estimateCostUSD(summary: MeasureSummary): number {
  const inputCost = (summary.est_input_tokens / 1_000_000) * SONNET_INPUT_PRICE_PER_M;
  const outputCost = (summary.est_input_tokens * OUTPUT_TO_INPUT_RATIO / 1_000_000) * SONNET_OUTPUT_PRICE_PER_M;
  return inputCost + outputCost;
}

export function formatSummary(summary: MeasureSummary, dir?: string): string {
  if (summary.count === 0) {
    return `No measure sidecars${dir ? ` in ${dir}` : ""}.`;
  }
  const cost = estimateCostUSD(summary);
  const lines: string[] = [];
  lines.push(`Prompts:           ${summary.count}`);
  for (const [kind, s] of Object.entries(summary.by_kind).sort()) {
    lines.push(`  ${kind.padEnd(22)} ${String(s.count).padStart(4)}  (~${(s.total_chars / 1000).toFixed(1)}K chars)`);
  }
  lines.push(`Total chars:       ~${(summary.total_chars / 1000).toFixed(1)}K`);
  lines.push(`Est input tokens:  ~${(summary.est_input_tokens / 1000).toFixed(1)}K`);
  lines.push(`Est dispatch cost: ~$${cost.toFixed(2)} (Sonnet 4.6 @ $${SONNET_INPUT_PRICE_PER_M}/M input + ${(OUTPUT_TO_INPUT_RATIO * 100).toFixed(0)}% output)`);
  return lines.join("\n");
}
