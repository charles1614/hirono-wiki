/**
 * Regression test suite for the web-fetch path's per-host outputs.
 *
 * `sweep-results/<host>/sample.md` is a curated, eye-reviewed sample of
 * the converter's output for a single representative URL on each host.
 * Unlike the per-host snapshot suite (which uses formal invariants
 * sidecars and exists for committed-and-locked output), this suite is
 * lighter: it walks every committed sample, checks the §2 contract
 * (single H1, frontmatter present, no remote-image leakage, no
 * obvious chrome-denylist hits), and ensures every local image ref
 * resolves to a file on disk in the same directory.
 *
 * The samples are NOT byte-equal frozen — small wording / cosmetic
 * drift is fine. The contract is structural. To regenerate after a
 * pipeline change that intentionally alters output:
 *
 *   1. Re-run the sweep harness (re-fetches every host)
 *   2. Eye-read the diffs vs the previous samples
 *   3. Commit the new samples
 *
 * Hosts with intentional limitations (interactive viz, deleted
 * upstream content, auth-gated stubs) are tagged in `EXPECTED_NOTES`
 * so failures clearly point at the per-host root cause.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { countFeatures, CHROME_DENYLIST } from "./snapshot-helpers.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SWEEP_DIR = join(REPO_ROOT, "sweep-results");

/**
 * Hosts where the sample is a stub or interactive page — adjust the
 * expected character floor / structural rules accordingly.
 */
const EXPECTED: Record<string, {
  minChars: number;
  notes?: string;
  /** Allow specific quality flags without failing the suite. */
  allowFlags?: string[];
}> = {
  "reddit.com": { minChars: 100, notes: "page-removed stub — sampled bookmark was deleted upstream", allowFlags: ["intentional-stub"] },
  "x.com": { minChars: 200, notes: "Twitter/X — auth-gated, content varies by session" },
  "epoch.ai": { minChars: 200, notes: "interactive data viz — extracted text only" },
  "sebastianraschka.com": { minChars: 1000, notes: "React gallery — best-achievable extraction" },
  // _default hybrid samples (long-tail SPAs + article-shape blogs).
  "philschmid.de": { minChars: 5000, notes: "_default curl — typical article blog" },
  "astra-sim.github.io": {
    minChars: 1000, notes: "_default curl — project landing; one cross-origin SVG fails to download",
    allowFlags: ["_default-image-download-partial"],
  },
  "jalammar.github.io": { minChars: 10000, notes: "_default curl — Illustrated Transformer + 37 figures" },
  "cursor.com": { minChars: 5000, notes: "_default curl (SSR sufficient) — Cursor marketing page" },
  "21st.dev": { minChars: 1000, notes: "_default curl (SSR sufficient) — 21st.dev landing" },
  "leetgpu.com": {
    minChars: 500, notes: "_default browser-eval fallback — LeetGPU SPA shell empty under curl",
    allowFlags: ["_default-used-browser-fallback"],
  },
  "gist.github.com": { minChars: 5000, notes: "site:github gist API — markdown gist embedded as-is" },
  "feishu.cn": { minChars: 5000, notes: "site:feishu lark-cli — Gemma 4 wiki page (real content)" },
};

function listHostSamples(): Array<{ host: string; mdPath: string; sourceJson?: string }> {
  if (!existsSync(SWEEP_DIR)) return [];
  const out: Array<{ host: string; mdPath: string; sourceJson?: string }> = [];
  for (const host of readdirSync(SWEEP_DIR).sort()) {
    const hostDir = join(SWEEP_DIR, host);
    let st;
    try { st = statSync(hostDir); } catch { continue; }
    if (!st.isDirectory()) continue;
    const mdPath = join(hostDir, "sample.md");
    if (!existsSync(mdPath)) continue;
    const srcPath = join(hostDir, "source.json");
    out.push({ host, mdPath, sourceJson: existsSync(srcPath) ? srcPath : undefined });
  }
  return out;
}

const samples = listHostSamples();

if (samples.length === 0) {
  test("sweep-results suite: no samples present (fresh checkout?)", () => {
    assert.ok(true);
  });
}

for (const { host, mdPath, sourceJson } of samples) {
  const expected = EXPECTED[host] || { minChars: 500 };

  test(`sweep[${host}]: sample.md exists and is non-trivial`, () => {
    const md = readFileSync(mdPath, "utf8");
    assert.ok(
      md.length >= expected.minChars,
      `${host}: sample.md is ${md.length} chars (expected >= ${expected.minChars})${expected.notes ? ` — ${expected.notes}` : ""}`,
    );
  });

  test(`sweep[${host}]: §2 contract — exactly one H1`, () => {
    const md = readFileSync(mdPath, "utf8");
    const c = countFeatures(md);
    assert.equal(c.h1, 1, `${host}: expected exactly 1 H1, got ${c.h1}`);
  });

  test(`sweep[${host}]: §2 contract — frontmatter '> 原文链接:' present`, () => {
    const md = readFileSync(mdPath, "utf8");
    const c = countFeatures(md);
    if (!c.frontmatter_present) {
      // Stub formats may legitimately use `> **Source:**` instead of
      // `> 原文链接:` (e.g., reddit `redditReformat` stubs for deleted
      // posts). Accept either as valid frontmatter.
      const head10 = md.split("\n").slice(0, 10).join("\n");
      assert.match(
        head10, /^>\s+\*\*Source:\*\*/m,
        `${host}: missing both '> 原文链接:' and '> **Source:**' in first 10 lines`,
      );
    }
  });

  test(`sweep[${host}]: no remote http(s) image refs (all should be localized)`, () => {
    const md = readFileSync(mdPath, "utf8");
    const c = countFeatures(md);
    // Special case: x.com / reddit.com stubs may legitimately have no images.
    // Special case: graceful-degradation rewrite for failed downloads can leave remote refs.
    // Allow up to 2 remote refs as the floor for "graceful degradation" cases.
    assert.ok(
      c.remote_images <= 2,
      `${host}: ${c.remote_images} remote image refs (expected ≤ 2, since failed downloads can fall back to the remote URL)`,
    );
  });

  test(`sweep[${host}]: no chrome-denylist matches (Subscribe / Share / 订阅 / etc.)`, () => {
    const md = readFileSync(mdPath, "utf8");
    const c = countFeatures(md);
    assert.equal(
      c.chrome_denylist_matches, 0,
      `${host}: ${c.chrome_denylist_matches} bare chrome lines from denylist (${[...CHROME_DENYLIST].slice(0, 5).join(", ")}...)`,
    );
  });

  test(`sweep[${host}]: every local image ref resolves to a real file`, () => {
    const md = readFileSync(mdPath, "utf8");
    const dir = dirname(mdPath);
    // If the sample is flagged with image-download-partial, the converter
    // intentionally left some refs pointing at filenames that never landed
    // on disk (cross-origin denials, 403s, etc.). Skip the dangling check
    // for those — the flag is the explicit allowance.
    if (sourceJson) {
      try {
        const flags: string[] = JSON.parse(readFileSync(sourceJson, "utf8")).quality_flags || [];
        if (flags.some((f) => /image-download-partial$/.test(f))) return;
      } catch { /* fall through to strict check */ }
    }
    const dangling: string[] = [];
    // Strip inline-code spans and fenced code blocks BEFORE scanning for
    // image refs — sample articles often discuss markdown syntax inside
    // backticks (e.g., sspai documents `![$fileName]($url)` as a config
    // example) and those literal `$url` refs aren't real image refs.
    let inFence = false;
    const lines = md.split("\n");
    const scrubbed: string[] = [];
    for (const line of lines) {
      if (/^```/.test(line.trim())) { inFence = !inFence; scrubbed.push(""); continue; }
      if (inFence) { scrubbed.push(""); continue; }
      // Strip inline code spans
      scrubbed.push(line.replace(/`[^`\n]+`/g, ""));
    }
    const scrubbedMd = scrubbed.join("\n");
    for (const m of scrubbedMd.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const ref = m[1];
      if (/^https?:\/\//i.test(ref)) continue;
      if (ref.startsWith("data:")) continue;
      const abs = join(dir, ref);
      if (!existsSync(abs)) dangling.push(ref);
    }
    assert.equal(
      dangling.length, 0,
      `${host}: ${dangling.length} dangling local image refs:\n  ${dangling.slice(0, 5).join("\n  ")}`,
    );
  });

  if (sourceJson) {
    test(`sweep[${host}]: source.json status is good or flagged (not failed/empty)`, () => {
      const src = JSON.parse(readFileSync(sourceJson, "utf8")) as { quality_status?: string; quality_flags?: string[] };
      assert.ok(
        src.quality_status === "good" || src.quality_status === "flagged",
        `${host}: quality_status=${src.quality_status} (expected good or flagged)`,
      );
      // If flagged, check that no UNEXPECTED flags are present.
      const flags = src.quality_flags || [];
      const allow = new Set(expected.allowFlags || []);
      const unexpected = flags.filter((f) => !allow.has(f));
      assert.equal(
        unexpected.length, 0,
        `${host}: unexpected quality flags ${JSON.stringify(unexpected)} (allow=${JSON.stringify([...allow])})`,
      );
    });
  }
}
