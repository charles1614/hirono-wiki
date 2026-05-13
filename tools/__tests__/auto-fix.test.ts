import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadEntityAliases } from "../curation.ts";

// auto-fix's alias-merge detection is a pure function over (aliases, entity set).
// We test the building blocks directly here; the merge-entities dispatch itself
// is covered by existing merge-entities tests.

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "auto-fix-"));
  mkdirSync(join(root, "Entities", "_seen"), { recursive: true });
  mkdirSync(join(root, "Meta"), { recursive: true });
  return root;
}

function writeFile(root: string, repoPath: string, content: string): void {
  const abs = join(root, repoPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

function listEntities(root: string): Set<string> {
  const out = new Set<string>();
  for (const dir of [join(root, "Entities"), join(root, "Entities", "_seen")]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".md")) out.add(f.slice(0, -3));
  }
  return out;
}

function findMerges(root: string): Array<{ variant: string; canonical: string }> {
  const aliases = loadEntityAliases(root);
  const entities = listEntities(root);
  const out: Array<{ variant: string; canonical: string }> = [];
  for (const [variant, canonical] of aliases.entries()) {
    if (entities.has(variant) && entities.has(canonical) && variant !== canonical) {
      out.push({ variant, canonical });
    }
  }
  return out;
}

test("auto-fix: detects alias merges where both files exist", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Meta/entity-aliases.md", "## Aliases\n\n- bfloat16 → BF16\n- LLaMA → Llama\n");
    writeFile(root, "Entities/_seen/bfloat16.md", "---\ntype: entity\n---\n\n# bfloat16\n");
    writeFile(root, "Entities/_seen/BF16.md", "---\ntype: entity\n---\n\n# BF16\n");
    // Llama target exists but the variant doesn't — not a candidate
    writeFile(root, "Entities/Llama.md", "---\ntype: entity\n---\n\n# Llama\n");

    const merges = findMerges(root);
    assert.equal(merges.length, 1);
    assert.equal(merges[0].variant, "bfloat16");
    assert.equal(merges[0].canonical, "BF16");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("auto-fix: skips alias when only one side exists", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Meta/entity-aliases.md", "## Aliases\n\n- LLaMA → Llama\n");
    writeFile(root, "Entities/Llama.md", "---\ntype: entity\n---\n\n# Llama\n");
    // LLaMA stub doesn't exist
    const merges = findMerges(root);
    assert.equal(merges.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("auto-fix: skips identity mappings (variant == canonical)", () => {
  const root = makeRepo();
  try {
    // loadEntityAliases already filters these per its own tests, but verify
    // the combined logic for safety
    writeFile(root, "Meta/entity-aliases.md", "## Aliases\n\n- Llama → Llama\n- BFloat16 → BF16\n");
    writeFile(root, "Entities/Llama.md", "---\ntype: entity\n---\n\n# Llama\n");
    writeFile(root, "Entities/_seen/BFloat16.md", "---\ntype: entity\n---\n\n# BFloat16\n");
    writeFile(root, "Entities/_seen/BF16.md", "---\ntype: entity\n---\n\n# BF16\n");
    const merges = findMerges(root);
    assert.equal(merges.length, 1);
    assert.equal(merges[0].variant, "BFloat16");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("auto-fix: empty aliases file → no merges", () => {
  const root = makeRepo();
  try {
    writeFile(root, "Entities/Llama.md", "---\ntype: entity\n---\n\n# Llama\n");
    assert.equal(findMerges(root).length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
