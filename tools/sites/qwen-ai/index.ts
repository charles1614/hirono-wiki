/**
 * qwen.ai — Alibaba's Qwen marketing / product surface. Pure JS SPA
 * shell on plain HTTP fetch (`<title>Qwen</title>` + 88KB of script
 * tags), but `qwen.ai/blog?id=<slug>` and `qwen.ai/research` hydrate
 * into a real article body that mirrors the qwenlm.github.io Hugo
 * theme: `<article class="post-single"> .post-content`, full headers,
 * code blocks, tables, images.
 *
 * Strategy: opencli browser open → 3s hydration delay → eval pulls
 * the post HTML + metadata; we own the conversion. If extraction
 * fails (network, SPA didn't hydrate, page genuinely has no body)
 * we emit the stub redirecting to qwenlm.github.io.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { JSDOM } from "jsdom";

import { convertGenericHtml } from "../_shared/generic-converter.ts";
import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../_shared/browser-helpers.ts";
import { downloadImage } from "../../fetch-raw.ts";

interface QwenExtraction {
  title: string;
  description: string;
  publishedAt: string;
  articleHtml: string;
  error?: string;
}

interface QwenConvertArgs {
  articleHtml: string;
  title: string;
  description: string;
  publishedAt: string;
  url: string;
}

interface QwenConvertResult {
  markdown: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  metadata: { title: string; description: string; publishedAt: string };
  stats: { bodyChars: number; images: number };
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function extractQwenAi(url: string): QwenExtraction {
  let opened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], {
      encoding: "utf8",
      timeout: browserTimeoutMs("open"),
    });
    if (openRes.status !== 0) {
      return {
        title: "", description: "", publishedAt: "", articleHtml: "",
        error: `browser open failed: ${(openRes.stderr || "").slice(0, 200)}`,
      };
    }
    opened = true;
    sleepMs(3500);

    const evalScript = `(() => {
      const get = (sel, attr) => {
        const el = document.querySelector(sel);
        if (!el) return "";
        if (attr) return (el.getAttribute(attr) || "").trim();
        return (el.textContent || "").trim();
      };
      const article = document.querySelector("article.post-single, article.post-content, article")
                   || document.querySelector(".post-content")
                   || document.querySelector("main");
      const titleH1 = get(".post-title") || get("h1");
      const ogTitle = get('meta[property="og:title"]', "content");
      // Prefer the in-page H1: og:title is the SPA's site name ("Qwen Studio").
      const title = titleH1 || ogTitle || document.title || "";
      return JSON.stringify({
        title: title.replace(/\\s*\\|\\s*Qwen.*$/, "").trim(),
        description: get('meta[property="og:description"]', "content"),
        publishedAt: get('meta[property="article:published_time"]', "content"),
        articleHtml: article ? article.outerHTML : "",
      });
    })()`;
    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 32 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      return {
        title: "", description: "", publishedAt: "", articleHtml: "",
        error: `browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}`,
      };
    }

    const stdout = evalRes.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) {
      return { title: "", description: "", publishedAt: "", articleHtml: "", error: "no JSON in eval output" };
    }
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < stdout.length; i++) {
      const c = stdout[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) {
      return { title: "", description: "", publishedAt: "", articleHtml: "", error: "unterminated JSON" };
    }
    try {
      const p = JSON.parse(stdout.slice(start, end + 1));
      return {
        title: p.title || "",
        description: p.description || "",
        publishedAt: p.publishedAt || "",
        articleHtml: p.articleHtml || "",
      };
    } catch (e) {
      return {
        title: "", description: "", publishedAt: "", articleHtml: "",
        error: `JSON parse failed: ${e instanceof Error ? e.message : e}`,
      };
    }
  } catch (e) {
    return {
      title: "", description: "", publishedAt: "", articleHtml: "",
      error: `extractQwenAi threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (opened) closeBrowser();
  }
}

export function convertQwenAi(opts: QwenConvertArgs): QwenConvertResult {
  // Strip the social-link bar (QWEN CHAT / GitHub / Hugging Face / ModelScope /
  // DISCORD), which appears as an unclassed <p> at the top of .post-content
  // and bleeds into og:description as well. Drop any <p> whose flattened text
  // matches the link-row signature.
  const dom = new JSDOM(opts.articleHtml);
  const doc = dom.window.document;
  const SOCIAL_RE = /QWEN CHAT[\s\S]*GitHub[\s\S]*Hugging Face[\s\S]*ModelScope[\s\S]*DISCORD/;
  for (const p of Array.from(doc.querySelectorAll("p, div"))) {
    const txt = (p.textContent || "").replace(/\s+/g, " ").trim();
    if (txt.length < 200 && SOCIAL_RE.test(txt)) p.remove();
  }
  const cleanedHtml = (doc.querySelector("article, .post-content, main, body") || doc.body).outerHTML;

  const generic = convertGenericHtml({
    html: cleanedHtml,
    url: opts.url,
    imagePrefix: "qwen-ai",
  });
  let body = applyCommonMarkdownCleanups(generic.body);
  // Drop the in-body H1 — we render it from the §2 frontmatter title.
  body = body.replace(/^#\s+[^\n]+\n+/, "");

  // Strip the social-bar prefix that bleeds into og:description.
  const description = opts.description.replace(
    /^\s*QWEN CHAT[\s\S]*?DISCORD\s*/, "",
  ).trim();

  const fm: string[] = [`# ${opts.title}`, "", `> 原文链接: ${opts.url}`];
  if (opts.publishedAt) fm.push(`> 发表于: ${opts.publishedAt.slice(0, 10)}`);
  if (description) fm.push(`> ${description}`);
  fm.push("", "---", "", "");

  let markdown = fm.join("\n") + body;
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  return {
    markdown,
    imagesToDownload: generic.imagesToDownload,
    metadata: { title: opts.title, description: opts.description, publishedAt: opts.publishedAt },
    stats: { bodyChars: body.length, images: generic.imagesToDownload.length },
  };
}

function stub(url: string, reason: string): Result {
  return {
    markdown: [
      `# Qwen page`,
      ``,
      `> 原文链接: ${url}`,
      `> Status: ${reason}`,
      `> The Qwen research blog also publishes at https://qwenlm.github.io/blog/`,
      ``,
      `---`,
      ``,
      `*This entry is a metadata stub. ${reason}*`,
      ``,
    ].join("\n"),
    images: [],
    metadata: { source: "qwen-ai-stub", reason },
    flags: ["intentional-stub", "qwen-ai-extraction-failed"],
    notes: [`qwen-ai: stub emitted — ${reason}`],
  };
}

export const site: Site = {
  name: "qwen-ai",
  match: (url: string) => hostOf(url) === "qwen.ai",
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });

    const x = extractQwenAi(url);
    if (x.error) return stub(url, `browser extraction failed: ${x.error.slice(0, 120)}`);
    if (!x.articleHtml || x.articleHtml.length < 500) {
      return stub(url, `qwen.ai article body empty or too small (${x.articleHtml.length} chars)`);
    }
    if (!x.title) return stub(url, "qwen.ai page has no extractable title");

    const conv = convertQwenAi({
      articleHtml: x.articleHtml,
      title: x.title,
      description: x.description,
      publishedAt: x.publishedAt,
      url,
    });

    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest, undefined, url);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = imgFailed > 0 ? ["qwen-ai-image-download-partial"] : [];
    return {
      markdown: conv.markdown,
      title: conv.metadata.title || undefined,
      images,
      metadata: {
        source: "qwen-ai",
        title: conv.metadata.title,
        description: conv.metadata.description,
        published_at: conv.metadata.publishedAt,
        stats: conv.stats,
      },
      flags,
      notes: [
        `qwen-ai: ${conv.stats.bodyChars} body chars, ` +
        `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "qwen-ai",
  converterName: "convertQwenAi",
  snapshotHosts: ["qwen.ai"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertQwenAi") {
      throw new Error(`qwen-ai test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [QwenConvertArgs];
    const r = convertQwenAi(opts);
    const { markdown, ...rest } = r;
    return { markdown, rest: rest as Record<string, unknown> };
  },
  capture(url: string): CaptureResult {
    const x = extractQwenAi(url);
    if (x.error) throw new Error(`qwen-ai capture: ${x.error}`);
    if (!x.articleHtml) throw new Error(`qwen-ai capture: empty article HTML`);
    if (!x.title) throw new Error(`qwen-ai capture: no title`);
    const args: [QwenConvertArgs] = [{
      articleHtml: x.articleHtml,
      title: x.title,
      description: x.description,
      publishedAt: x.publishedAt,
      url,
    }];
    const r = convertQwenAi(args[0]);
    const { markdown, ...rest } = r;
    return {
      input: { fn: "convertQwenAi", args },
      markdown,
      rest: rest as Record<string, unknown>,
    };
  },
};
