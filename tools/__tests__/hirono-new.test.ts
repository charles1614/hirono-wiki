/**
 * Tests for `hirono new-entity` and `hirono new-topic` — the CLI
 * scaffolders that create schema-conformant Entity / Topic stubs.
 *
 * Tests call the exported `createEntityStub` / `createTopicStub`
 * directly with an explicit repoRoot. The CLI wrapper is thin —
 * it just parses args + auto-detects REPO_ROOT — and the contract
 * the LLM relies on is "creates a file at the right path with the
 * right contents," which these tests cover.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEntityStub } from "../hirono/new-entity.ts";
import { createTopicStub } from "../hirono/new-topic.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "hirono-new-"));
}

// ---------------------------------------------------------------------------
// new-entity
// ---------------------------------------------------------------------------

test("createEntityStub: creates a seen-tier stub with correct frontmatter + scaffolding", () => {
  const root = tmp();
  try {
    const path = createEntityStub(root, "FooBar", "A test entity");
    assert.ok(existsSync(path), `expected file at ${path}`);
    assert.equal(path, join(root, "02_Entities", "_seen", "FooBar.md"));
    const content = readFileSync(path, "utf8");
    // Required frontmatter fields:
    assert.match(content, /^type: entity$/m);
    assert.match(content, /^refs: 0$/m);
    assert.match(content, /^tier: seen$/m);
    assert.match(content, /^created: \d{4}-\d{2}-\d{2}$/m, "dates must be YYYY-MM-DD");
    assert.match(content, /^updated: \d{4}-\d{2}-\d{2}$/m);
    // Required body shape:
    assert.match(content, /^# FooBar$/m);
    assert.match(content, /A test entity/);
    assert.match(content, /^## Synthesis$/m);
    assert.match(content, /^## Observations$/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("createEntityStub: refuses to overwrite existing file at seen tier", () => {
  const root = tmp();
  try {
    createEntityStub(root, "FooBar", "first");
    assert.throws(
      () => createEntityStub(root, "FooBar", "duplicate"),
      /already exists/,
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("createEntityStub: refuses to overwrite existing file at active tier", () => {
  const root = tmp();
  try {
    mkdirSync(join(root, "02_Entities"), { recursive: true });
    writeFileSync(join(root, "02_Entities", "FooBaz.md"), "stub");
    assert.throws(
      () => createEntityStub(root, "FooBaz", "test"),
      /already exists/,
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("createEntityStub: rejects invalid names", () => {
  const root = tmp();
  try {
    for (const bad of ["", "_hidden", ".dotfile", "has/slash", "has\\backslash", "has*star", "has<bracket"]) {
      assert.throws(() => createEntityStub(root, bad, "test"), `should reject ${JSON.stringify(bad)}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("createEntityStub: empty kind argument produces a placeholder one-liner", () => {
  const root = tmp();
  try {
    const path = createEntityStub(root, "NoKind", "");
    const content = readFileSync(path, "utf8");
    // Should have an italicized placeholder when kind is empty.
    assert.match(content, /_\(one-line kind:/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// new-topic
// ---------------------------------------------------------------------------

test("createTopicStub: creates a Topic with the four required sections in order", () => {
  const root = tmp();
  try {
    const path = createTopicStub(root, "Cross-Cutting Theme", "Some testable definition.");
    assert.ok(existsSync(path), `expected file at ${path}`);
    assert.equal(path, join(root, "01_Topics", "Cross-Cutting Theme.md"));
    const content = readFileSync(path, "utf8");
    // Required frontmatter:
    assert.match(content, /^type: topic$/m);
    assert.match(content, /^source_count: 0$/m);
    assert.match(content, /^created: \d{4}-\d{2}-\d{2}$/m);
    // Required four sections (in order):
    const sectionOrder = ["## What", "## Current understanding", "## Open threads", "## Sources drawn on"];
    let pos = 0;
    for (const heading of sectionOrder) {
      const next = content.indexOf(heading, pos);
      assert.ok(next >= 0, `section ${heading} missing or out of order`);
      pos = next + heading.length;
    }
    // --what content shows up in ## What:
    assert.match(content, /Some testable definition\./);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("createTopicStub: refuses to overwrite existing topic", () => {
  const root = tmp();
  try {
    createTopicStub(root, "Foo Topic", "");
    assert.throws(
      () => createTopicStub(root, "Foo Topic", ""),
      /already exists/,
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("createTopicStub: rejects invalid names", () => {
  const root = tmp();
  try {
    for (const bad of ["", "_hidden", ".dotfile", "has/slash"]) {
      assert.throws(() => createTopicStub(root, bad, ""), `should reject ${JSON.stringify(bad)}`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("createTopicStub: empty --what produces a placeholder pointing at the lint check", () => {
  const root = tmp();
  try {
    const path = createTopicStub(root, "Empty Topic", "");
    const content = readFileSync(path, "utf8");
    // Should reference the topic-content-gaps lint check in the placeholder.
    assert.match(content, /topic-content-gaps/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
