/**
 * reddit.com / www.reddit.com — Reddit threads. Modern reddit is a JS
 * web-components SPA (`<shreddit-post>` / `<shreddit-comment>` custom
 * elements); plain curl gets a shell. We open the page via opencli's
 * browser, give it 4s to hydrate, then extract:
 *
 *   - Post: title, author, subreddit, score, created, body HTML
 *     (`shreddit-post div[id$=-post-rtjson-content]`).
 *   - Comments: flat list with `depth` attribute (web component
 *     `shreddit-comment` exposes `author`, `depth`, `score`, and a
 *     `[slot=comment]` body); we render top-level comments with `##`
 *     and replies as nested blockquotes by depth.
 *
 * Stub fallback when the post is `[deleted by user]` or the page can't
 * be opened. Browser ID-style URLs (`/r/X/s/<id>`) redirect at the
 * server to canonical `/r/X/comments/<id>/...` — opencli follows the
 * redirect, we read window.location.href back.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { JSDOM } from "jsdom";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertGenericHtml } from "../_shared/generic-converter.ts";
import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../_shared/browser-helpers.ts";
import { downloadImage } from "../../fetch-raw.ts";

interface RedditCommentRaw {
  author: string;
  depth: number;
  score: string;
  bodyHtml: string;
}

interface RedditExtraction {
  finalUrl: string;
  title: string;
  author: string;
  subreddit: string;
  score: string;
  created: string;
  bodyHtml: string;
  comments: RedditCommentRaw[];
  deleted: boolean;
  error?: string;
}

interface RedditConvertArgs {
  url: string;
  finalUrl: string;
  title: string;
  author: string;
  subreddit: string;
  score: string;
  created: string;
  bodyHtml: string;
  comments: RedditCommentRaw[];
}

interface RedditConvertResult {
  markdown: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  metadata: { title: string; author: string; subreddit: string; created: string; score: string };
  stats: { bodyChars: number; comments: number; images: number };
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function extractReddit(url: string): RedditExtraction {
  const empty = (over: Partial<RedditExtraction> = {}): RedditExtraction => ({
    finalUrl: url, title: "", author: "", subreddit: "", score: "",
    created: "", bodyHtml: "", comments: [], deleted: false, ...over,
  });

  let opened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], {
      encoding: "utf8",
      timeout: browserTimeoutMs("open"),
    });
    if (openRes.status !== 0) {
      return empty({ error: `browser open failed: ${(openRes.stderr || "").slice(0, 200)}` });
    }
    opened = true;
    sleepMs(4000);

    const evalScript = `(() => {
      const post = document.querySelector("shreddit-post");
      const titleEl = document.querySelector("h1");
      const bodyEl = document.querySelector("shreddit-post div[id$=-post-rtjson-content]")
                  || document.querySelector("[slot=text-body]")
                  || document.querySelector("[data-post-click-location=text-body] div");
      const comments = Array.from(document.querySelectorAll("shreddit-comment")).map(c => {
        const slot = c.querySelector("[slot=comment]");
        return {
          author: c.getAttribute("author") || "",
          depth: parseInt(c.getAttribute("depth") || "0", 10),
          score: c.getAttribute("score") || "",
          bodyHtml: slot ? slot.innerHTML : "",
        };
      });
      return JSON.stringify({
        finalUrl: window.location.href,
        title: titleEl ? (titleEl.textContent || "").trim() : "",
        author: post ? (post.getAttribute("author") || "") : "",
        subreddit: post ? (post.getAttribute("subreddit-prefixed-name") || "") : "",
        score: post ? (post.getAttribute("score") || "") : "",
        created: post ? (post.getAttribute("created-timestamp") || "") : "",
        bodyHtml: bodyEl ? bodyEl.outerHTML : "",
        comments,
      });
    })()`;
    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 64 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      return empty({ error: `browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}` });
    }

    const stdout = evalRes.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) return empty({ error: "no JSON in eval output" });
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
    if (end < 0) return empty({ error: "unterminated JSON" });

    const p = JSON.parse(stdout.slice(start, end + 1));
    const deleted = /^\[deleted by user\]$/i.test(p.title || "")
                 || /^\[removed\]$/i.test(p.title || "")
                 || /^\[deleted\]$/i.test(p.title || "");
    return {
      finalUrl: p.finalUrl || url,
      title: p.title || "",
      author: p.author || "",
      subreddit: p.subreddit || "",
      score: p.score || "",
      created: p.created || "",
      bodyHtml: p.bodyHtml || "",
      comments: Array.isArray(p.comments) ? p.comments : [],
      deleted,
    };
  } catch (e) {
    return empty({ error: `extractReddit threw: ${e instanceof Error ? e.message : e}` });
  } finally {
    if (opened) closeBrowser();
  }
}

function htmlFragmentToMarkdown(html: string, url: string, imagePrefix: string): {
  body: string;
  images: { remoteUrl: string; localFilename: string }[];
} {
  if (!html.trim()) return { body: "", images: [] };
  const generic = convertGenericHtml({ html, url, imagePrefix });
  return {
    body: applyCommonMarkdownCleanups(generic.body).trim(),
    images: generic.imagesToDownload,
  };
}

function indentBlockquote(md: string, levels: number): string {
  if (levels <= 0) return md;
  const prefix = "> ".repeat(levels);
  return md.split("\n").map((ln) => (ln.length > 0 ? `${prefix}${ln}` : prefix.trimEnd())).join("\n");
}

export function convertReddit(opts: RedditConvertArgs): RedditConvertResult {
  const allImages: { remoteUrl: string; localFilename: string }[] = [];
  let imgCounter = 0;
  const allocImages = (
    list: { remoteUrl: string; localFilename: string }[],
    body: string,
  ): { body: string; renamed: { remoteUrl: string; localFilename: string }[] } => {
    const renamed: { remoteUrl: string; localFilename: string }[] = [];
    let out = body;
    for (const img of list) {
      imgCounter++;
      const ext = (img.localFilename.match(/\.[a-z0-9]+$/i)?.[0] || ".png").toLowerCase();
      const final = `reddit-img-${String(imgCounter).padStart(3, "0")}${ext}`;
      const escaped = img.localFilename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`\\(${escaped}\\)`, "g"), `(${final})`);
      renamed.push({ remoteUrl: img.remoteUrl, localFilename: final });
    }
    return { body: out, renamed };
  };

  // Post body
  const post = htmlFragmentToMarkdown(opts.bodyHtml, opts.finalUrl || opts.url, "reddit");
  const postRenamed = allocImages(post.images, post.body);
  allImages.push(...postRenamed.renamed);
  const postBody = postRenamed.body;

  // Comments
  const commentBlocks: string[] = [];
  for (const c of opts.comments) {
    const conv = htmlFragmentToMarkdown(c.bodyHtml, opts.finalUrl || opts.url, "reddit");
    const renamedC = allocImages(conv.images, conv.body);
    allImages.push(...renamedC.renamed);
    const body = renamedC.body;
    const head = `**u/${c.author || "[deleted]"}** · score ${c.score || "?"}`;
    const block = c.depth === 0
      ? `## u/${c.author || "[deleted]"}\n\n> score ${c.score || "?"}\n\n${body}`
      : indentBlockquote(`${head}\n\n${body}`, c.depth);
    commentBlocks.push(block);
  }

  // Frontmatter callout
  const fmMeta: string[] = [];
  const datePart = opts.created ? opts.created.slice(0, 10) : "";
  const metaLine = [
    opts.author ? `u/${opts.author}` : null,
    opts.subreddit || null,
    datePart || null,
    opts.score ? `score ${opts.score}` : null,
  ].filter(Boolean).join(" · ");
  if (metaLine) fmMeta.push(`> ${metaLine}`);

  const lines: string[] = [
    `# ${opts.title || "Reddit post"}`,
    "",
    `> 原文链接: ${opts.finalUrl || opts.url}`,
    ...fmMeta,
    "",
    "---",
    "",
  ];
  if (postBody) lines.push(postBody, "");
  if (commentBlocks.length > 0) {
    lines.push("## Comments", "");
    lines.push(commentBlocks.join("\n\n"), "");
  }

  let markdown = lines.join("\n");
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  return {
    markdown,
    imagesToDownload: allImages,
    metadata: {
      title: opts.title,
      author: opts.author,
      subreddit: opts.subreddit,
      created: opts.created,
      score: opts.score,
    },
    stats: {
      bodyChars: postBody.length,
      comments: opts.comments.length,
      images: allImages.length,
    },
  };
}

function stub(url: string, kind: "deleted" | "blocked" | "extraction-failed", reason: string): Result {
  const title = kind === "deleted"
    ? "Reddit post (deleted or removed)"
    : kind === "blocked"
    ? "Reddit post (unreachable)"
    : "Reddit post (extraction failed)";
  const status = kind === "deleted"
    ? "page-removed — the post was deleted by its author or removed by moderators."
    : `${kind} — ${reason}`;
  const advice = kind === "deleted"
    ? "The original content is no longer available."
    : "Open the URL in a browser to read the thread.";
  return {
    markdown: [
      `# ${title}`, ``,
      `> 原文链接: ${url}`,
      `> Status: ${status}`,
      ``, `---`, ``,
      `*This entry is a metadata stub. ${advice}*`, ``,
    ].join("\n"),
    images: [],
    metadata: { source: "reddit-stub", reason },
    flags: ["intentional-stub", `reddit-${kind}`],
    notes: [`reddit: stub emitted — ${reason}`],
  };
}

export const site: Site = {
  name: "reddit",
  match: (url: string) => {
    const h = hostOf(url);
    return h === "reddit.com" || h === "www.reddit.com" || h === "old.reddit.com";
  },
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });
    const x = extractReddit(url);
    if (x.error) return stub(url, "extraction-failed", x.error.slice(0, 120));
    if (x.deleted) return stub(url, "deleted", `title=${x.title}`);
    if (!x.bodyHtml && x.comments.length === 0) {
      return stub(url, "blocked", "no body and no comments extracted");
    }

    const conv = convertReddit({
      url,
      finalUrl: x.finalUrl,
      title: x.title,
      author: x.author,
      subreddit: x.subreddit,
      score: x.score,
      created: x.created,
      bodyHtml: x.bodyHtml,
      comments: x.comments,
    });

    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest, undefined, x.finalUrl || url);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = imgFailed > 0 ? ["reddit-image-download-partial"] : [];
    return {
      markdown: conv.markdown,
      title: conv.metadata.title || undefined,
      images,
      metadata: {
        source: "reddit",
        title: conv.metadata.title,
        author: conv.metadata.author,
        subreddit: conv.metadata.subreddit,
        created: conv.metadata.created,
        score: conv.metadata.score,
        stats: conv.stats,
      },
      flags,
      notes: [
        `reddit: ${conv.stats.bodyChars} body chars, ${conv.stats.comments} comment(s), ` +
        `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "reddit",
  converterName: "convertReddit",
  snapshotHosts: ["reddit.com", "www.reddit.com", "old.reddit.com"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertReddit") {
      throw new Error(`reddit test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [RedditConvertArgs];
    const r = convertReddit(opts);
    const { markdown, ...rest } = r;
    return { markdown, rest: rest as Record<string, unknown> };
  },
  capture(url: string): CaptureResult {
    const x = extractReddit(url);
    if (x.error) throw new Error(`reddit capture: ${x.error}`);
    if (x.deleted) throw new Error(`reddit capture: post is deleted (cannot capture meaningful fixture)`);
    if (!x.bodyHtml && x.comments.length === 0) {
      throw new Error(`reddit capture: no body and no comments extracted`);
    }
    const args: [RedditConvertArgs] = [{
      url,
      finalUrl: x.finalUrl,
      title: x.title,
      author: x.author,
      subreddit: x.subreddit,
      score: x.score,
      created: x.created,
      bodyHtml: x.bodyHtml,
      comments: x.comments,
    }];
    const r = convertReddit(args[0]);
    const { markdown, ...rest } = r;
    return {
      input: { fn: "convertReddit", args },
      markdown,
      rest: rest as Record<string, unknown>,
    };
  },
};
