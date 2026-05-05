#!/usr/bin/env tsx
/**
 * Capture a converter-regression fixture from a live URL.
 *
 * Usage:
 *   npx tsx tools/__tests__/capture-fixtures.ts <host> <name> <url>
 *
 *   <host>: site-module name (substack, weixin, xhs, github, zhihu, …)
 *           OR `web-fetch:<hostkey>` for the generic web-fetch fallback.
 *
 * Writes (under tools/__tests__/fixtures/converters/<host>/):
 *   <name>.input.json     — converter inputs (frozen)
 *   <name>.expected.md    — converter's exact markdown output (frozen)
 *   <name>.expected.json  — converter's non-markdown fields (frozen)
 *
 * NOTE: this is the LOW-LEVEL primitive. Prefer `approve.ts` for routine
 * fixture refreshes — it adds eye-read prompts, structural-rule checks,
 * and atomic multi-artifact writes (fixture + snapshot + sweep). Use
 * this script directly only when scripting bulk re-captures.
 *
 * Use this script when:
 *   - First-time capturing a fixture for a new URL
 *   - Intentionally accepting a new converter baseline (after a code
 *     change that legitimately improves output). Review the diff before
 *     committing.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { findHooksByName } from "../sites/test-hooks-registry.ts";
import { convertGenericHtml } from "../sites/_shared/generic-converter.ts";
import { extractJsonFromEvalStdout } from "../sites/_shared/browser-eval-json.ts";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../sites/_shared/browser-helpers.ts";

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "converters");

/** Write the standard 3-file fixture layout for a converter capture. */
function writeFixture(
  hostDir: string,
  name: string,
  fn: string,
  args: unknown[],
  markdown: string,
  rest: Record<string, unknown>,
): void {
  const dir = join(FIXTURES_ROOT, hostDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${name}.input.json`),
    JSON.stringify({ fn, args }, null, 2) + "\n",
  );
  writeFileSync(join(dir, `${name}.expected.md`), markdown);
  writeFileSync(
    join(dir, `${name}.expected.json`),
    JSON.stringify(rest, null, 2) + "\n",
  );
  console.log(
    `[capture ${hostDir}] wrote 3 files to ${dir}/${name}.{input.json,expected.md,expected.json}`,
  );
  console.log(`[capture ${hostDir}] markdown ${markdown.length} chars`);
}

/**
 * Generic web-fetch capture: curl + the article-converter selector
 * cascade (see `tools/sites/_shared/article-converter.ts`). Used for
 * legacy fixture dirs whose host has been migrated to a site module
 * (those new fixtures use the per-host module's capture hook directly).
 * The fixture directory is the hostname (e.g., `web-arxiv-org`).
 */
function captureWebFetch(hostKey: string, name: string, url: string): void {
  console.log(`[capture web-fetch:${hostKey}] ${url}`);
  let browserOpened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], {
      encoding: "utf8",
      timeout: browserTimeoutMs("open"),
    });
    if (openRes.status !== 0) {
      throw new Error(`browser open failed: ${(openRes.stderr || "").slice(0, 200)}`);
    }
    browserOpened = true;
    sleepMs(10_000);

    const evalScript = `(() => {
      const SELECTORS = ['article','main','[role="main"]','.post-content','.article-body','.entry-content','.post-body','.content-body','.markdown-body','#content','.content','.post','.entry'];
      let best = null; let bestLen = 0;
      for (const sel of SELECTORS) {
        for (const el of document.querySelectorAll(sel)) {
          const len = (el.textContent || '').length;
          if (len > bestLen) { best = el; bestLen = len; }
        }
      }
      if (!best || bestLen < 500) best = document.body;
      return JSON.stringify({
        contentHtml: best ? best.outerHTML : '',
        title: (document.title || '').replace(/\\s+\\|\\s+[^|]*$/, '').trim(),
        finalUrl: window.location.href
      });
    })()`;
    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 64 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      throw new Error(`browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}`);
    }
    const parsed = extractJsonFromEvalStdout(evalRes.stdout || "") as {
      contentHtml?: string; title?: string; finalUrl?: string;
    } | null;
    if (!parsed || !parsed.contentHtml) throw new Error("eval returned no content HTML");

    const finalUrl = parsed.finalUrl || url;
    const imagePrefix = (new URL(finalUrl).hostname || "webread")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const args: [{ html: string; url: string; imagePrefix: string }] = [
      { html: parsed.contentHtml, url: finalUrl, imagePrefix },
    ];
    const result = convertGenericHtml(args[0]);
    const { body, ...rest } = result;
    writeFixture(`web-${hostKey}`, name, "convertGenericHtml", args, body, rest as Record<string, unknown>);
  } finally {
    if (browserOpened) {
      try { closeBrowser(); } catch { /* best-effort */ }
    }
  }
}

const [host, name, url] = process.argv.slice(2);
if (!host || !name || !url) {
  console.error("usage: capture-fixtures.ts <host> <name> <url>");
  console.error("  host = <site-module-name> | web-fetch:<hostkey>");
  console.error("  site-module-name = e.g. weixin, xhs, github, zhihu, deepwiki-com, deepwiki-litenext, linux-do, epoch-ai, nvidianews, sebastianraschka-gallery, substack");
  console.error("  name = identifier for the fixture (e.g. gpu-container)");
  console.error("  url  = the URL to fetch");
  console.error("");
  console.error("note: prefer `approve.ts` for routine refreshes — it adds eye-read + structural-rule checks");
  process.exit(2);
}

if (host.startsWith("web-fetch:")) {
  captureWebFetch(host.slice("web-fetch:".length), name, url);
} else {
  const hooks = findHooksByName(host);
  if (!hooks) {
    console.error(`unknown host: ${host}`);
    console.error(`registered site modules: ${["weixin", "xhs", "github", "zhihu", "deepwiki-com", "deepwiki-litenext", "linux-do", "epoch-ai", "nvidianews", "sebastianraschka-gallery", "substack"].join(", ")}`);
    process.exit(2);
  }
  console.log(`[capture ${host}] ${url}`);
  const r = hooks.capture(url);
  writeFixture(host, name, r.input.fn, r.input.args, r.markdown, r.rest);
}
