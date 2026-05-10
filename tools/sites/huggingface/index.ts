/**
 * huggingface.co/blog — HuggingFace blog posts. Pulls clean markdown
 * directly from the public mirror at github.com/huggingface/blog
 * (raw.githubusercontent.com). Avoids the rendered-HTML path entirely:
 * the source-of-truth is the raw markdown, which is faster, smaller,
 * and free of nav chrome.
 *
 * Path filter: only `/blog/<slug>` URLs go through this module. Other
 * huggingface.co paths (model cards, dataset pages, spaces) fall
 * through to the legacy dispatch.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";
import { makeStub } from "../_shared/stub.ts";
import { hostOf } from "../../shared/url-helpers.ts";

interface HfFixtureArgs {
  rawMd: string;
  url: string;
}

interface HfConvertResult {
  markdown: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  metadata: { title: string; authors: string[] };
  stats: { bodyChars: number; images: number };
}

const HOSTS = ["huggingface.co"];

function pathOf(url: string): string {
  try { return new URL(url).pathname; }
  catch { return ""; }
}

function slugFromUrl(url: string): string | null {
  const m = url.match(/^https?:\/\/huggingface\.co\/blog\/([^?#/]+)/);
  return m ? m[1] : null;
}

function fetchRawMarkdown(slug: string): { rawMd: string; error?: string } {
  try {
    const ghUrl = `https://raw.githubusercontent.com/huggingface/blog/main/${slug}.md`;
    const md = execFileSync(
      "curl",
      ["-sfL", "--max-time", "30", "-A", "Mozilla/5.0", ghUrl],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return { rawMd: md };
  } catch (e) {
    return { rawMd: "", error: e instanceof Error ? e.message : String(e) };
  }
}

function convertHf(opts: HfFixtureArgs): HfConvertResult {
  let body = opts.rawMd;
  let title: string | undefined;
  const authorHandles: string[] = [];

  const fmMatch = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    body = body.slice(fmMatch[0].length);
    const fm = fmMatch[1];
    const titleMatch = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (titleMatch) title = titleMatch[1].trim();
    for (const line of fm.split("\n")) {
      const am = line.match(/^\s*-\s*user:\s*(\S+)/);
      if (am) authorHandles.push(am[1]);
    }
  }

  let bodyMd = body.trim() + "\n";
  bodyMd = bodyMd.replace(/^#\s+[^\n]+\n+/, "");
  bodyMd = applyCommonMarkdownCleanups(bodyMd);

  const finalTitle = title || "HuggingFace Blog Post";
  const fmLines: string[] = [`# ${finalTitle}`, "", `> 原文链接: ${opts.url}`];
  if (authorHandles.length > 0) {
    const label = authorHandles.length === 1 ? "Author" : "Authors";
    const rendered = authorHandles
      .map((h) => `[@${h}](https://huggingface.co/${h})`)
      .join(", ");
    fmLines.push(`> **${label}:** ${rendered}`);
  }
  fmLines.push("", "---", "", "");
  let markdown = fmLines.join("\n") + bodyMd;

  // Resolve site-relative image paths to absolute HF URLs.
  markdown = markdown.replace(
    /(!\[[^\]]*\]\()(\/[^)\s]+)(\))/g,
    (_m, pre, p, post) => `${pre}https://huggingface.co${p}${post}`,
  );
  markdown = markdown.replace(
    /(<img\b[^>]*\bsrc=["'])(\/[^"']+)(["'])/g,
    (_m, pre, p, post) => `${pre}https://huggingface.co${p}${post}`,
  );

  // Extract image URLs from BOTH markdown ![](url) and HTML <img src="url">
  // forms — HF's raw markdown frequently uses <img> for sized images.
  const imagesToDownload: { remoteUrl: string; localFilename: string }[] = [];
  const seen = new Set<string>();
  let counter = 0;
  const collect = (url: string) => {
    if (seen.has(url)) return;
    seen.add(url);
    counter++;
    const ext = (url.match(/\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/)?.[1] || "png").toLowerCase();
    const localFilename = `huggingface-${String(counter).padStart(3, "0")}.${ext}`;
    imagesToDownload.push({ remoteUrl: url, localFilename });
  };
  const mdRegex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  let mm;
  while ((mm = mdRegex.exec(markdown)) !== null) collect(mm[2]);
  const htmlRegex = /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/g;
  while ((mm = htmlRegex.exec(markdown)) !== null) collect(mm[1]);

  // Rewrite both forms to local filenames. <img> with sizing attrs
  // collapses to plain ![alt](local).
  for (const dl of imagesToDownload) {
    const escaped = dl.remoteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    markdown = markdown.replace(
      new RegExp(`!\\[([^\\]]*)\\]\\(${escaped}\\)`, "g"),
      `![$1](${dl.localFilename})`,
    );
    markdown = markdown.replace(
      new RegExp(`<img\\b[^>]*\\bsrc=["']${escaped}["'][^>]*>`, "g"),
      (tag) => {
        const altMatch = tag.match(/\balt=["']([^"']*)["']/);
        const alt = altMatch ? altMatch[1] : "";
        return `![${alt}](${dl.localFilename})`;
      },
    );
  }

  // Unwrap residual HTML around images: <p align="center">…</p>, stray <br>, <br/>.
  markdown = markdown.replace(
    /<p\b[^>]*>\s*([\s\S]*?)\s*<\/p>/g,
    (_m, inner) => `\n${inner.replace(/<br\s*\/?>/gi, "").trim()}\n`,
  );
  markdown = markdown.replace(/<br\s*\/?>/gi, "");
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  return {
    markdown,
    imagesToDownload,
    metadata: { title: finalTitle, authors: authorHandles },
    stats: { bodyChars: bodyMd.length, images: imagesToDownload.length },
  };
}

function stub(url: string, reason: string, kind: "blog-fetch-failed" | "non-blog" | "space" = "blog-fetch-failed", errorDetail?: string): Result {
  const titleHint = kind === "non-blog" ? "HuggingFace page (non-blog)"
    : kind === "space" ? "HuggingFace Space"
    : "HuggingFace blog (fetch failed)";
  const advice = kind === "space"
    ? "HuggingFace Spaces are interactive demos rendered client-side; no static content to extract."
    : kind === "non-blog"
    ? "Model cards, dataset pages, and papers have heavily dynamic HTML. Visit the URL directly."
    : "GitHub mirror at github.com/huggingface/blog may be temporarily unavailable, or the slug may not exist on the mirror.";
  return makeStub({
    url, module: "huggingface", kind,
    title: titleHint,
    summary: reason,
    advice,
    errorDetail,
  });
}

export const site: Site = {
  name: "huggingface",
  // Claim every huggingface.co URL. Behaviour branches on the path:
  //   /blog/<slug>           → fetch raw markdown from the GitHub mirror
  //   /spaces/<owner>/<name> → emit Space stub (interactive demo, no
  //                            useful HTML body)
  //   anything else          → emit non-blog stub (model cards, dataset
  //                            pages, papers, etc. don't fit the article
  //                            shape; their HTML is heavily dynamic)
  match: (url: string) => HOSTS.includes(hostOf(url)),
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });

    const path = pathOf(url);
    if (path.startsWith("/spaces/")) {
      return stub(url,
        "HuggingFace Space — interactive demo with no static body. Visit the URL in a browser to use the Space.",
        "space");
    }
    if (!path.startsWith("/blog/")) {
      return stub(url,
        "HuggingFace non-blog page (model card / dataset / paper / etc.). The page is heavily dynamic; visit the URL for content.",
        "non-blog");
    }

    const slug = slugFromUrl(url);
    if (!slug) return stub(url, "could not extract slug from URL");

    const r = fetchRawMarkdown(slug);
    if (r.error || !r.rawMd) {
      return stub(url, r.error || "raw.githubusercontent fetch returned empty", "blog-fetch-failed",
        `slug: ${slug}\nresolved URL: https://raw.githubusercontent.com/huggingface/blog/main/${slug}.md\n\n[curl] ${r.error || "ok but rawMd empty"}`);
    }

    const conv = convertHf({ rawMd: r.rawMd, url });

    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest, undefined, url);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = imgFailed > 0 ? ["huggingface-image-download-partial"] : [];
    return {
      markdown: conv.markdown,
      title: conv.metadata.title,
      images,
      metadata: {
        source: "huggingface",
        title: conv.metadata.title,
        authors: conv.metadata.authors,
        stats: conv.stats,
      },
      flags,
      notes: [
        `huggingface: ${conv.stats.bodyChars} body chars, ` +
        `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "huggingface",
  converterName: "convertHuggingface",
  snapshotHosts: ["huggingface.co"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertHuggingface") {
      throw new Error(`huggingface test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [HfFixtureArgs];
    const r = convertHf(opts);
    const { markdown, ...rest } = r;
    return { markdown, rest: rest as Record<string, unknown> };
  },
  capture(url: string): CaptureResult {
    const slug = slugFromUrl(url);
    if (!slug) throw new Error(`huggingface capture: could not extract slug from ${url}`);
    const r = fetchRawMarkdown(slug);
    if (r.error) throw new Error(`huggingface fetch failed: ${r.error}`);
    if (!r.rawMd) throw new Error(`huggingface raw markdown empty for slug ${slug}`);
    const args: [HfFixtureArgs] = [{ rawMd: r.rawMd, url }];
    const result = convertHf(args[0]);
    const { markdown, ...rest } = result;
    return {
      input: { fn: "convertHuggingface", args },
      markdown,
      rest: rest as Record<string, unknown>,
    };
  },
};
