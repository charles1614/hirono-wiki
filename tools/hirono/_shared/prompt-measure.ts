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

import { writeFileSync } from "node:fs";
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
