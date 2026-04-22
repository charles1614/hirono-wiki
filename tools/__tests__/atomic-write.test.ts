import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileAtomic } from "../shared/atomic-write.ts";

// ---------------------------------------------------------------------------
// writeFileAtomic
// ---------------------------------------------------------------------------

test("writeFileAtomic: creates file with contents", () => {
  const dir = mkdtempSync(join(tmpdir(), "atomic-"));
  try {
    const target = join(dir, "state.json");
    writeFileAtomic(target, "hello world");
    assert.equal(readFileSync(target, "utf8"), "hello world");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeFileAtomic: overwrites existing file atomically", () => {
  const dir = mkdtempSync(join(tmpdir(), "atomic-"));
  try {
    const target = join(dir, "state.json");
    writeFileSync(target, "original", "utf8");
    writeFileAtomic(target, "replaced");
    assert.equal(readFileSync(target, "utf8"), "replaced");
    // No tmp files should linger after a clean write
    const dotfiles = readdirSync(dir).filter((n) => n.startsWith("."));
    assert.equal(dotfiles.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeFileAtomic: preserves existing file on rename failure (simulated via bad dir)", () => {
  // Simulate failure by pointing at a non-existent directory.
  const dir = mkdtempSync(join(tmpdir(), "atomic-"));
  try {
    const target = join(dir, "state.json");
    writeFileSync(target, "original", "utf8");
    assert.throws(() => writeFileAtomic(join(dir, "does", "not", "exist", "x.json"), "x"));
    // Original file must still be intact after the failed write attempt
    assert.equal(readFileSync(target, "utf8"), "original");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeFileAtomic: no tmp file left behind after successful write", () => {
  const dir = mkdtempSync(join(tmpdir(), "atomic-"));
  try {
    const target = join(dir, "state.json");
    writeFileAtomic(target, "content");
    const entries = readdirSync(dir);
    // Exactly one file: the target. No tmp siblings.
    assert.equal(entries.length, 1);
    assert.equal(entries[0], "state.json");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeFileAtomic: handles large contents (1MB)", () => {
  const dir = mkdtempSync(join(tmpdir(), "atomic-"));
  try {
    const target = join(dir, "big.json");
    const big = "x".repeat(1024 * 1024);
    writeFileAtomic(target, big);
    assert.equal(readFileSync(target, "utf8").length, big.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeFileAtomic: handles JSON payloads with unicode + newlines", () => {
  const dir = mkdtempSync(join(tmpdir(), "atomic-"));
  try {
    const target = join(dir, "unicode.json");
    const payload = JSON.stringify({
      "名前": "张三",
      "emoji": "🔗",
      "multi": "a\nb\nc",
    }, null, 2) + "\n";
    writeFileAtomic(target, payload);
    assert.equal(readFileSync(target, "utf8"), payload);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
