import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQueue } from "../hirono/apply-queue.ts";

const SAMPLE_QUEUE = `---
type: meta
---

# Curation Queue — 2026-05-13

## Proposals (3 actionable, 1 skipped)

### 1. Merge \`bfloat16\` → \`BF16\`  [confidence: high]

- [x] approved

**Rationale**: Same IEEE format; alias already exists.

\`\`\`
hirono merge-entities bfloat16 --into BF16 --reason "case+spelling variant"
\`\`\`

### 2. Rename \`Tile IR\` → \`CUDA Tile IR\`  [confidence: medium]

- [ ] approved

**Rationale**: Canonical spelling per CUDA 13.1 announcement.

\`\`\`
hirono rename-entity "Tile IR" "CUDA Tile IR" --reason "canonical spelling"
\`\`\`

### 3. Refine Entity \`MLA\` Synthesis  [confidence: high]

- [x] approved

**Rationale**: Stale post-V4 retirement.

\`\`\`
hirono refine-entity MLA    # → prompt; operator spawns Sonnet → apply
\`\`\`
`;

test("parseQueue: extracts items with checkbox state + confidence", () => {
  const items = parseQueue(SAMPLE_QUEUE);
  assert.equal(items.length, 3);
  assert.equal(items[0].heading, "Merge `bfloat16` → `BF16`");
  assert.equal(items[0].confidence, "high");
  assert.equal(items[0].approved, true);
  assert.ok(items[0].command.includes("merge-entities bfloat16"));

  assert.equal(items[1].confidence, "medium");
  assert.equal(items[1].approved, false);
  assert.ok(items[1].command.includes("rename-entity"));

  assert.equal(items[2].confidence, "high");
  assert.equal(items[2].approved, true);
  assert.ok(items[2].command.startsWith("hirono refine-entity"));
});

test("parseQueue: skips items with no fenced command", () => {
  const md = `### 1. Skipped item  [confidence: low]

- [x] approved

**Rationale**: no command.
`;
  const items = parseQueue(md);
  assert.equal(items.length, 1);
  assert.equal(items[0].command, "");
});

test("parseQueue: handles command with comment lines", () => {
  const md = `### 1. Refine Entity \`X\`  [confidence: high]

- [x] approved

**Rationale**: drift.

\`\`\`
hirono refine-entity X    # → prompt; operator spawns Sonnet → apply
\`\`\`
`;
  const items = parseQueue(md);
  assert.equal(items.length, 1);
  // Comments stripped, leaving the bare command
  assert.equal(items[0].command, "hirono refine-entity X    # → prompt; operator spawns Sonnet → apply");
});

test("parseQueue: empty queue returns empty array", () => {
  assert.deepEqual(parseQueue("# Empty\n\nNo proposals.\n"), []);
});
