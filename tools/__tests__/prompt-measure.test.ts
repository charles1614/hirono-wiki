/**
 * Unit tests for `tools/hirono/_shared/prompt-measure.ts`:
 *   - inferPromptKind: filename → kind mapping
 *   - summarizeMeasures: aggregate sidecars from a directory
 *   - estimateCostUSD: chars → cost math
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  inferPromptKind,
  summarizeMeasures,
  estimateCostUSD,
  type PromptMeasure,
} from "../hirono/_shared/prompt-measure.ts";

function writeMeasure(dir: string, name: string, m: PromptMeasure): void {
  writeFileSync(join(dir, name), JSON.stringify(m) + "\n", "utf8");
}

test("inferPromptKind: refine-entity vs refine-topic vs refine-top-synthesis", () => {
  assert.equal(inferPromptKind(".refine-prompts/MLA-synthesis-prompt.md"), "refine-entity");
  assert.equal(inferPromptKind(".refine-prompts/LLM Inference Systems-topic-prompt.md"), "refine-topic");
  assert.equal(inferPromptKind(".refine-prompts/synthesis-prompt.md"), "refine-top-synthesis");
  assert.equal(inferPromptKind(".refine-prompts/whatever.md"), "other");
});

test("summarizeMeasures: empty dir returns zero summary", () => {
  const dir = mkdtempSync(join(tmpdir(), "measure-empty-"));
  try {
    const s = summarizeMeasures(dir);
    assert.equal(s.count, 0);
    assert.equal(s.total_chars, 0);
    assert.equal(s.est_input_tokens, 0);
    assert.deepEqual(s.by_kind, {});
    assert.deepEqual(s.largest, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("summarizeMeasures: nonexistent dir returns zero summary (no throw)", () => {
  const s = summarizeMeasures("/definitely/not/a/real/path/12345");
  assert.equal(s.count, 0);
});

test("summarizeMeasures: aggregates three mixed-kind sidecars", () => {
  const dir = mkdtempSync(join(tmpdir(), "measure-mixed-"));
  try {
    writeMeasure(dir, "MLA-synthesis-prompt-measure.json", {
      prompt_path: ".refine-prompts/MLA-synthesis-prompt.md",
      prompt_chars: 10_000,
      prompt_lines: 200,
      source_count: 3,
      mode: "curated",
      timestamp: "2026-05-15T00:00:00.000Z",
    });
    writeMeasure(dir, "Foo-synthesis-prompt-measure.json", {
      prompt_path: ".refine-prompts/Foo-synthesis-prompt.md",
      prompt_chars: 20_000,
      prompt_lines: 400,
      source_count: 5,
      mode: "curated",
      timestamp: "2026-05-15T00:00:00.000Z",
    });
    writeMeasure(dir, "LLM Inference Systems-topic-prompt-measure.json", {
      prompt_path: ".refine-prompts/LLM Inference Systems-topic-prompt.md",
      prompt_chars: 50_000,
      prompt_lines: 800,
      source_count: 10,
      mode: "curated",
      timestamp: "2026-05-15T00:00:00.000Z",
    });
    const s = summarizeMeasures(dir);
    assert.equal(s.count, 3);
    assert.equal(s.total_chars, 80_000);
    assert.equal(s.total_lines, 1400);
    assert.equal(s.est_input_tokens, 20_000); // 80k / 4
    assert.equal(s.by_kind["refine-entity"].count, 2);
    assert.equal(s.by_kind["refine-entity"].total_chars, 30_000);
    assert.equal(s.by_kind["refine-topic"].count, 1);
    assert.equal(s.by_kind["refine-topic"].total_chars, 50_000);
    // largest: sorted by chars desc, top 5
    assert.equal(s.largest.length, 3);
    assert.equal(s.largest[0].chars, 50_000);
    assert.equal(s.largest[1].chars, 20_000);
    assert.equal(s.largest[2].chars, 10_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("summarizeMeasures: ignores non-measure files and malformed JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "measure-noise-"));
  try {
    writeFileSync(join(dir, "valid-measure.json"), JSON.stringify({
      prompt_path: ".refine-prompts/valid-synthesis-prompt.md",
      prompt_chars: 5_000,
      prompt_lines: 100,
      source_count: 2,
      timestamp: "2026-05-15T00:00:00.000Z",
    }), "utf8");
    writeFileSync(join(dir, "malformed-measure.json"), "{not valid json", "utf8");
    writeFileSync(join(dir, "not-a-measure.txt"), "ignored", "utf8");
    writeFileSync(join(dir, "synthesis-prompt.md"), "# the prompt itself, not a sidecar", "utf8");
    const s = summarizeMeasures(dir);
    assert.equal(s.count, 1, "only the one well-formed sidecar counted");
    assert.equal(s.total_chars, 5_000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("estimateCostUSD: 1M chars → ~$1.875 (Sonnet 4.6, 1M / 4 = 250K tokens × $3/M + 30% × $15/M)", () => {
  const summary = {
    count: 1,
    total_chars: 1_000_000,
    total_lines: 0,
    est_input_tokens: 250_000,
    by_kind: {},
    largest: [],
  };
  // input: 250k tokens × $3/M = $0.75
  // output: 250k × 0.3 = 75k tokens × $15/M = $1.125
  // total: $1.875
  const cost = estimateCostUSD(summary);
  assert.ok(Math.abs(cost - 1.875) < 0.001, `expected ~$1.875, got $${cost}`);
});
