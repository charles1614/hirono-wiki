/**
 * Unit tests for the shared `extractJsonFromEvalStdout` helper.
 *
 * Every site fetcher that calls `opencli browser eval` runs this parser on
 * stdout. It must:
 *   - tolerate banner text before/after the JSON
 *   - ignore `{` / `}` inside string values (HTML attrs full of inline styles)
 *   - return null on missing or unbalanced JSON
 *   - return null on parse failure
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJsonFromEvalStdout } from "../sites/_shared/browser-eval-json.ts";

test("extractJsonFromEvalStdout: simple object", () => {
  const r = extractJsonFromEvalStdout(`{"a": 1, "b": "two"}`);
  assert.deepEqual(r, { a: 1, b: "two" });
});

test("extractJsonFromEvalStdout: opencli banner before + after", () => {
  const stdout = `Some opencli banner...\n\n{"title": "X", "html": "<div>y</div>"}\n  Update available...\n`;
  const r = extractJsonFromEvalStdout(stdout);
  assert.deepEqual(r, { title: "X", html: "<div>y</div>" });
});

test("extractJsonFromEvalStdout: ignores braces inside string values", () => {
  const stdout = `{"style": "color: red; font: 14px {ignored}", "ok": true}`;
  const r = extractJsonFromEvalStdout(stdout) as { style: string; ok: boolean };
  assert.equal(r.style, "color: red; font: 14px {ignored}");
  assert.equal(r.ok, true);
});

test("extractJsonFromEvalStdout: handles escaped quotes in strings", () => {
  const stdout = `{"q": "she said \\"hi\\""}`;
  const r = extractJsonFromEvalStdout(stdout) as { q: string };
  assert.equal(r.q, 'she said "hi"');
});

test("extractJsonFromEvalStdout: nested object", () => {
  const stdout = `garbage {"outer": {"inner": {"a": 1}}, "after": []} more garbage`;
  const r = extractJsonFromEvalStdout(stdout) as { outer: { inner: { a: number } } };
  assert.equal(r.outer.inner.a, 1);
});

test("extractJsonFromEvalStdout: no JSON object → null", () => {
  assert.equal(extractJsonFromEvalStdout("just text, no json here"), null);
  assert.equal(extractJsonFromEvalStdout(""), null);
});

test("extractJsonFromEvalStdout: unterminated JSON → null", () => {
  assert.equal(extractJsonFromEvalStdout(`{"a": 1, "b":`), null);
});

test("extractJsonFromEvalStdout: invalid JSON syntax inside braces → null", () => {
  // Balanced braces but invalid JSON (trailing comma + bare key)
  assert.equal(extractJsonFromEvalStdout(`{ a: 1, }`), null);
});

test("extractJsonFromEvalStdout: realistic opencli stdout shape", () => {
  // Mimic the actual `opencli browser eval` output we saw in the wild.
  const stdout = `{"contentHtml":"<article><h1>T</h1></article>","title":"T - Site","finalUrl":"https://example.com/x"}\n\n  Update available: v1.7.4 → v1.7.8\n  Run: npm install -g @jackwener/opencli\n`;
  const r = extractJsonFromEvalStdout(stdout) as {
    contentHtml: string;
    title: string;
    finalUrl: string;
  };
  assert.equal(r.title, "T - Site");
  assert.equal(r.finalUrl, "https://example.com/x");
  assert.match(r.contentHtml, /<h1>T<\/h1>/);
});
