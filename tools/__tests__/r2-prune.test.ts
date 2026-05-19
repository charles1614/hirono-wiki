import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  appendDispositionRow,
  readDisposition,
} from "../shared/r2-disposition.ts";

// ---------------------------------------------------------------------------
// disposition store
// ---------------------------------------------------------------------------

test("disposition: delete then revert leaves keep as latest", () => {
  const dir = mkdtempSync(join(tmpdir(), "disp-"));
  try {
    const path = join(dir, ".disp.jsonl");
    appendDispositionRow({
      slug: "s1", host: "h1", file: "a.png",
      action: "delete", reason: "avatar", decided_at: "t1",
    }, path);
    appendDispositionRow({
      slug: "s1", host: "h1", file: "a.png",
      action: "keep", reason: "reverted", decided_at: "t2",
    }, path);
    const map = readDisposition(path);
    assert.equal(map.get("s1\x00a.png")?.action, "keep");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("disposition: independent (slug, file) pairs don't collide", () => {
  const dir = mkdtempSync(join(tmpdir(), "disp-"));
  try {
    const path = join(dir, ".disp.jsonl");
    appendDispositionRow({
      slug: "s1", host: "h1", file: "a.png",
      action: "delete", reason: "r1", decided_at: "t1",
    }, path);
    appendDispositionRow({
      slug: "s2", host: "h2", file: "a.png",
      action: "delete", reason: "r2", decided_at: "t2",
    }, path);
    appendDispositionRow({
      slug: "s1", host: "h1", file: "b.png",
      action: "delete", reason: "r3", decided_at: "t3",
    }, path);
    const map = readDisposition(path);
    assert.equal(map.size, 3);
    assert.equal(map.get("s1\x00a.png")?.reason, "r1");
    assert.equal(map.get("s2\x00a.png")?.reason, "r2");
    assert.equal(map.get("s1\x00b.png")?.reason, "r3");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("disposition: missing file returns empty map", () => {
  const dir = mkdtempSync(join(tmpdir(), "disp-"));
  try {
    const map = readDisposition(join(dir, "absent.jsonl"));
    assert.equal(map.size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// glob-to-regex (inline copy mirrors raw-prune.ts implementation)
// ---------------------------------------------------------------------------

function globToRegex(pat: string): RegExp {
  let s = "^";
  for (const ch of pat) {
    if (ch === "*") s += ".*";
    else if (ch === "?") s += ".";
    else if ("\\^$.+()[]{}|".includes(ch)) s += "\\" + ch;
    else s += ch;
  }
  return new RegExp(s + "$");
}

test("globToRegex: matches *.png", () => {
  const re = globToRegex("*.png");
  assert.ok(re.test("avatar-12.png"));
  assert.ok(re.test("a.png"));
  assert.ok(!re.test("a.jpg"));
});

test("globToRegex: matches avatar-* prefix glob", () => {
  const re = globToRegex("avatar-*");
  assert.ok(re.test("avatar-1.png"));
  assert.ok(re.test("avatar-xyz"));
  assert.ok(!re.test("img-1.png"));
});

test("globToRegex: special chars literally", () => {
  const re = globToRegex("foo.bar");
  assert.ok(re.test("foo.bar"));
  assert.ok(!re.test("fooXbar"));
});
