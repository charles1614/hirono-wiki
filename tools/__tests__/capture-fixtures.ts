#!/usr/bin/env tsx
/**
 * Capture a converter-regression fixture from a live URL.
 *
 * Usage:
 *   npx tsx tools/__tests__/capture-fixtures.ts weixin <name> <url>
 *   npx tsx tools/__tests__/capture-fixtures.ts xhs    <name> <url>
 *
 * Writes (under tools/__tests__/fixtures/converters/<host>/):
 *   <name>.input.json     — converter inputs (frozen)
 *   <name>.expected.md    — converter's exact markdown output (frozen)
 *   <name>.expected.json  — converter's non-markdown fields (frozen)
 *
 * Use this script when:
 *   - First-time capturing a fixture for a new URL
 *   - Intentionally accepting a new converter baseline (after a code
 *     change that legitimately improves output). Review the diff before
 *     committing.
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { convertWeixinHtml } from "../sites/weixin/converter.ts";
import { convertXhsHtml } from "../sites/xhs/converter.ts";
import {
  convertGithubPrIssue,
  convertGithubRelease,
  convertGithubRaw,
} from "../sites/github/converter.ts";
import {
  parseGithubUrl,
  fetchPrIssue,
  fetchRelease,
  fetchRaw,
  fetchTreeReadme,
  fetchRepoReadme,
} from "../sites/github/fetcher.ts";
import { convertZhihuArticleHtml } from "../sites/zhihu/converter.ts";
import { extractZhihuArticleContent } from "../sites/zhihu/fetcher.ts";
import { convertDeepwikiHtml } from "../sites/_shared/deepwiki-engine/converter.ts";
import { extractDeepwikiContent } from "../sites/_shared/deepwiki-engine/fetcher.ts";
import { extractXhsFullContent, sleepMs, closeBrowser, browserTimeoutMs } from "../fetch-raw.ts";
import { spawnSync } from "node:child_process";

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "converters");

function captureWeixin(name: string, url: string): void {
  console.log(`[capture weixin] opening ${url}`);
  let browserOpened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    if (openRes.status !== 0) throw new Error(`browser open failed: ${openRes.stderr?.slice(0, 200)}`);
    browserOpened = true;
    sleepMs(3500);

    const evalScript = `(() => {
      const root = document.querySelector("#js_content");
      const html = root ? root.outerHTML : "";
      const titleEl = document.querySelector("#activity-name");
      const authorEl = document.querySelector("#js_name") || document.querySelector("#profileBt #js_name");
      const timeEl = document.querySelector("#publish_time") || document.querySelector("em#publish_time");
      return JSON.stringify({
        html,
        title: titleEl ? (titleEl.textContent || "").trim().replace(/\\s+/g, " ") : "",
        author: authorEl ? (authorEl.textContent || "").trim() : "",
        publishTime: timeEl ? (timeEl.textContent || "").trim() : "",
      });
    })()`;
    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 32 * 1024 * 1024,
    });
    if (evalRes.status !== 0) throw new Error(`browser eval failed: ${evalRes.stderr?.slice(0, 200)}`);
    const stdout = evalRes.stdout || "";
    const jsonStart = stdout.indexOf("{");
    if (jsonStart < 0) throw new Error("no JSON in eval output");
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = jsonStart; i < stdout.length; i++) {
      const c = stdout[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === "\"") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) throw new Error("unterminated JSON");
    const payload = JSON.parse(stdout.slice(jsonStart, end + 1)) as {
      html: string; title: string; author: string; publishTime: string;
    };

    const args: [string, { title: string; author: string; publishTime: string }, string] = [
      payload.html,
      { title: payload.title, author: payload.author, publishTime: payload.publishTime },
      url,
    ];
    const result = convertWeixinHtml(args[0], args[1], args[2]);

    const dir = join(FIXTURES_ROOT, "weixin");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.input.json`), JSON.stringify({
      fn: "convertWeixinHtml",
      args,
    }, null, 2) + "\n");
    writeFileSync(join(dir, `${name}.expected.md`), result.markdown);
    const { markdown: _md, ...rest } = result;
    writeFileSync(join(dir, `${name}.expected.json`), JSON.stringify(rest, null, 2) + "\n");
    console.log(`[capture weixin] wrote 3 files to ${dir}/${name}.{input.json,expected.md,expected.json}`);
    console.log(`[capture weixin] markdown ${result.markdown.length} chars, ${result.imagesToDownload.length} image(s), ${result.svgFiles.length} svg(s)`);
  } finally {
    if (browserOpened) closeBrowser();
  }
}

function captureXhs(name: string, url: string): void {
  console.log(`[capture xhs] opening ${url}`);
  const xhsFull = extractXhsFullContent(url);
  if (xhsFull.error) throw new Error(`xhs extraction failed: ${xhsFull.error}`);
  if (!xhsFull.descText.trim()) throw new Error(`xhs descText empty (image-only post or auth failure)`);

  // Note: this fixture captures the xhs converter input AS-IF images were
  // already downloaded. We pass synthetic image filenames matching what
  // the runtime would produce — the converter only cares about the count
  // and basenames, not the actual files.
  const noteIdMatch = (xhsFull.finalUrl || url).match(/\/(?:discovery\/item|explore|search_result)\/([a-f0-9]+)/i);
  const noteId = noteIdMatch ? noteIdMatch[1] : "xhs";
  const pad = Math.max(2, String(xhsFull.imageUrls.length).length);
  const imageRefs = xhsFull.imageUrls.map((u, i) => {
    const ext = (u.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] ?? "jpg").toLowerCase();
    return `${noteId}_${String(i + 1).padStart(pad, "0")}.${ext === "jpeg" ? "jpg" : ext}`;
  });

  const args: [string, Record<string, unknown>, string, string[]] = [
    xhsFull.descText,
    {
      title: xhsFull.title,
      author: xhsFull.author,
      likes: xhsFull.likes,
      collects: xhsFull.collects,
      comments: xhsFull.comments,
    },
    url,
    imageRefs,
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = convertXhsHtml(args[0], args[1] as any, args[2], args[3]);

  const dir = join(FIXTURES_ROOT, "xhs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.input.json`), JSON.stringify({
    fn: "convertXhsHtml",
    args,
  }, null, 2) + "\n");
  writeFileSync(join(dir, `${name}.expected.md`), result.markdown);
  const { markdown: _md, ...rest } = result;
  writeFileSync(join(dir, `${name}.expected.json`), JSON.stringify(rest, null, 2) + "\n");
  console.log(`[capture xhs] wrote 3 files to ${dir}/${name}.{input.json,expected.md,expected.json}`);
  console.log(`[capture xhs] markdown ${result.markdown.length} chars, ${imageRefs.length} image refs`);
}

function captureGithub(name: string, url: string): void {
  console.log(`[capture github] ${url}`);
  const parsed = parseGithubUrl(url);
  if (!parsed) throw new Error(`could not parse github URL: ${url}`);
  const dir = join(FIXTURES_ROOT, "github");
  mkdirSync(dir, { recursive: true });

  let fn: string;
  let args: unknown[];
  let markdown: string;

  if (parsed.kind === "pr" || parsed.kind === "issue" || parsed.kind === "discussion") {
    const result = fetchPrIssue(parsed.org, parsed.repo, parsed.ref!, parsed.kind);
    if (!result) throw new Error(`github ${parsed.kind} REST API fetch failed`);
    const convInput = {
      kind: parsed.kind === "pr" ? "pull" : parsed.kind === "issue" ? "issues" : "discussions",
      org: parsed.org,
      repo: parsed.repo,
      number: parseInt(parsed.ref!, 10),
      originUrl: url,
      main: result.main,
      comments: result.comments,
      reviews: result.reviews,
      reviewComments: result.reviewComments,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markdown = convertGithubPrIssue(convInput as any);
    fn = "convertGithubPrIssue";
    args = [convInput];
  } else if (parsed.kind === "release") {
    const release = fetchRelease(parsed.org, parsed.repo, parsed.ref!);
    if (!release) throw new Error(`github release fetch failed`);
    const convInput = { org: parsed.org, repo: parsed.repo, tag: parsed.ref!, originUrl: url, release };
    markdown = convertGithubRelease(convInput);
    fn = "convertGithubRelease";
    args = [convInput];
  } else if (parsed.kind === "blob" || parsed.kind === "tree" || parsed.kind === "repo") {
    let raw = null;
    if (parsed.kind === "blob") raw = fetchRaw(parsed.org, parsed.repo, parsed.branch!, parsed.path!);
    else if (parsed.kind === "tree") raw = fetchTreeReadme(parsed.org, parsed.repo, parsed.branch!, parsed.path || "");
    else raw = fetchRepoReadme(parsed.org, parsed.repo);
    if (!raw) throw new Error(`github raw fetch failed`);
    const convInput = {
      org: parsed.org,
      repo: parsed.repo,
      branch: raw.branch,
      path: raw.resolvedPath,
      originUrl: url,
      body: raw.body,
    };
    markdown = convertGithubRaw(convInput);
    fn = "convertGithubRaw";
    args = [convInput];
  } else {
    throw new Error(`unsupported github URL kind: ${parsed.kind}`);
  }

  writeFileSync(join(dir, `${name}.input.json`), JSON.stringify({ fn, args }, null, 2) + "\n");
  writeFileSync(join(dir, `${name}.expected.md`), markdown);
  writeFileSync(join(dir, `${name}.expected.json`), JSON.stringify({}, null, 2) + "\n");
  console.log(`[capture github] wrote 3 files to ${dir}/${name}.{input.json,expected.md,expected.json}`);
  console.log(`[capture github] markdown ${markdown.length} chars (kind=${parsed.kind})`);
}

function captureZhihu(name: string, url: string): void {
  console.log(`[capture zhihu] ${url}`);
  const z = extractZhihuArticleContent(url);
  if (z.error) throw new Error(`zhihu extraction failed: ${z.error}`);
  if (!z.contentHtml || z.contentHtml.length < 200) {
    throw new Error(`zhihu .Post-RichTextContainer empty (${z.contentHtml.length} chars) — login expired?`);
  }
  const args: [string, { title: string; author: string; date: string }, string] = [
    z.contentHtml,
    { title: z.title, author: z.author, date: z.date },
    url,
  ];
  const result = convertZhihuArticleHtml(args[0], args[1], args[2]);

  const dir = join(FIXTURES_ROOT, "zhihu");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.input.json`), JSON.stringify({
    fn: "convertZhihuArticleHtml",
    args,
  }, null, 2) + "\n");
  writeFileSync(join(dir, `${name}.expected.md`), result.markdown);
  const { markdown: _md, ...rest } = result;
  writeFileSync(join(dir, `${name}.expected.json`), JSON.stringify(rest, null, 2) + "\n");
  console.log(`[capture zhihu] wrote 3 files to ${dir}/${name}.{input.json,expected.md,expected.json}`);
  console.log(`[capture zhihu] markdown ${result.markdown.length} chars, ${result.imagesToDownload.length} image(s), ${result.stats.zhidaLinksUnwrapped} zhida-link(s) unwrapped`);
}

function captureDeepwiki(name: string, url: string): void {
  console.log(`[capture deepwiki] ${url}`);
  const x = extractDeepwikiContent(url);
  if (x.error) throw new Error(`deepwiki extraction failed: ${x.error}`);
  if (!x.contentHtml || x.contentHtml.length < 200) {
    throw new Error(`deepwiki .prose container empty (${x.contentHtml.length} chars)`);
  }
  const args: [string, string[], { title: string; url: string }] = [
    x.contentHtml,
    x.mermaidSources,
    { title: x.title, url },
  ];
  const result = convertDeepwikiHtml(args[0], args[1], args[2]);

  const dir = join(FIXTURES_ROOT, "deepwiki");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.input.json`), JSON.stringify({
    fn: "convertDeepwikiHtml",
    args,
  }, null, 2) + "\n");
  writeFileSync(join(dir, `${name}.expected.md`), result.markdown);
  const { markdown: _md, ...rest } = result;
  writeFileSync(join(dir, `${name}.expected.json`), JSON.stringify(rest, null, 2) + "\n");
  console.log(`[capture deepwiki] wrote 3 files to ${dir}/${name}.{input.json,expected.md,expected.json}`);
  console.log(`[capture deepwiki] markdown ${result.markdown.length} chars, ${result.imagesToDownload.length} image(s), ${result.stats.mermaidPlaced}/${result.stats.mermaidExpected} mermaid block(s)`);
}

const [host, name, url] = process.argv.slice(2);
if (!host || !name || !url) {
  console.error("usage: capture-fixtures.ts <host> <name> <url>");
  console.error("  host = weixin | xhs | github | zhihu | deepwiki");
  console.error("  name = identifier for the fixture (e.g. gpu-container)");
  console.error("  url  = the URL to fetch");
  process.exit(2);
}

if (host === "weixin") captureWeixin(name, url);
else if (host === "xhs") captureXhs(name, url);
else if (host === "github") captureGithub(name, url);
else if (host === "zhihu") captureZhihu(name, url);
else if (host === "deepwiki") captureDeepwiki(name, url);
else { console.error(`unknown host: ${host}`); process.exit(2); }
