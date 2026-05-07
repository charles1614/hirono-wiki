/**
 * Tests for the unified stub-emission helper (`tools/sites/_shared/stub.ts`)
 * + error_detail propagation through site modules.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { makeStub, clampErrorDetail } from "../sites/_shared/stub.ts";

test("makeStub: minimal (no errorDetail) — produces clean §2-shape stub", () => {
  const r = makeStub({
    url: "https://example.com/post",
    module: "test-module",
    kind: "fetch-failed",
    summary: "host returned 404",
  });
  // §2 contract
  assert.match(r.markdown, /^# test-module stub: fetch-failed/);
  assert.match(r.markdown, /> 原文链接: https:\/\/example\.com\/post/);
  assert.match(r.markdown, /> Status: host returned 404/);
  assert.match(r.markdown, /\n---\n/);
  // No error-detail section when not provided
  assert.equal(/## Error detail/.test(r.markdown), false);
  // Flags + metadata
  assert.deepEqual(r.flags, ["intentional-stub", "test-module-fetch-failed"]);
  assert.equal(r.metadata.source, "test-module-stub");
  assert.equal(r.metadata.kind, "fetch-failed");
  // error_detail field on Result
  assert.equal(r.error_detail, "host returned 404");  // summary-only when no detail
});

test("makeStub: with errorDetail — renders Error detail section + composes error_detail field", () => {
  const r = makeStub({
    url: "https://example.com/post",
    module: "test-module",
    kind: "auth-gated",
    summary: "forBidden",
    errorDetail: '[lark-cli --as user]\n{"ok":false,"error":{"message":"Caused by: forBidden"}}',
  });
  // Markdown includes the error block
  assert.match(r.markdown, /## Error detail/);
  assert.match(r.markdown, /Caused by: forBidden/);
  // error_detail composed as: <summary>\n\n<raw>
  assert.match(r.error_detail!, /^forBidden\n\n/);
  assert.match(r.error_detail!, /Caused by: forBidden/);
});

test("makeStub: errorDetail length-capped to 2KB", () => {
  const huge = "X".repeat(5000);
  const r = makeStub({
    url: "https://example.com/post",
    module: "test-module",
    kind: "fetch-failed",
    summary: "huge upstream trace",
    errorDetail: huge,
  });
  assert.ok(r.error_detail!.length <= 2000, `got ${r.error_detail!.length}`);
  assert.match(r.error_detail!, /\.\.\. \[truncated/);
});

test("clampErrorDetail: short string passes through unchanged", () => {
  assert.equal(clampErrorDetail("short"), "short");
});

test("clampErrorDetail: long string is truncated with marker", () => {
  const out = clampErrorDetail("X".repeat(3000));
  assert.ok(out.length <= 2000);
  assert.ok(out.endsWith(" for full trace]") || /truncated/.test(out));
});

test("makeStub: title override is honored", () => {
  const r = makeStub({
    url: "https://example.com/post",
    module: "feishu",
    kind: "auth-gated",
    title: "Feishu wiki page (no read access)",
    summary: "forBidden",
  });
  assert.match(r.markdown, /^# Feishu wiki page \(no read access\)/);
});

test("makeStub: advice override appears as italic prose", () => {
  const r = makeStub({
    url: "https://example.com/post",
    module: "x-twitter",
    kind: "auth-required",
    summary: "browser session not signed in",
    advice: "Sign in via opencli's linked Chrome session.",
  });
  assert.match(r.markdown, /\*Sign in via opencli's linked Chrome session\.\*/);
});

// ────────────────── error_detail composition contract ──────────────────

test("error_detail format: starts with summary on its own line", () => {
  const r = makeStub({
    url: "https://x.com/y",
    module: "x-twitter",
    kind: "empty",
    summary: "no tweet articles in hydrated DOM",
    errorDetail: "signedIn: true\nfinalUrl: https://x.com/y\narticle count: 0",
  });
  const firstLine = r.error_detail!.split("\n", 1)[0];
  assert.equal(firstLine, "no tweet articles in hydrated DOM");
});

test("error_detail format: blank line separates summary from raw trace", () => {
  const r = makeStub({
    url: "https://example.com",
    module: "test",
    kind: "fetch-failed",
    summary: "summary line",
    errorDetail: "raw trace content",
  });
  assert.match(r.error_detail!, /^summary line\n\nraw trace content$/);
});
