/**
 * zhihu site module — covers two URL shapes via one module:
 *
 *   - zhuanlan.zhihu.com/p/<id>            — long-form articles
 *     (body: `.Post-RichTextContainer`).
 *   - www.zhihu.com/question/<qid>/answer/<aid> — single-answer pages
 *     (body: the targeted answer card's `.RichText`).
 *
 * Per the universal pattern (CLAUDE.md §5a): no opencli MD output, no
 * web-read. We use opencli's browser session to extract the raw HTML
 * (different selectors per URL shape) then convert ourselves with
 * jsdom + turndown + per-site rules in `converter.ts`. Both shapes
 * share `convertZhihuArticleHtml` because the body markup is the
 * same RichText structure; they differ only in the metadata callout.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { extractZhihuArticleContent, extractZhihuAnswerContent } from "./fetcher.ts";
import { convertZhihuArticleHtml } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { makeStub } from "../_shared/stub.ts";
import { hostOf } from "../../shared/url-helpers.ts";

function pathOf(url: string): string {
  try { return new URL(url).pathname; }
  catch { return ""; }
}

const ANSWER_PATH_RE = /^\/question\/\d+\/answer\/\d+\/?$/;

function isZhihuAnswerUrl(url: string): boolean {
  return hostOf(url) === "zhihu.com" && ANSWER_PATH_RE.test(pathOf(url));
}

export const site: Site = {
  name: "zhihu-article",
  match: (url) => hostOf(url) === "zhuanlan.zhihu.com" || isZhihuAnswerUrl(url),
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const isAnswer = isZhihuAnswerUrl(url);
    const z = isAnswer ? extractZhihuAnswerContent(url) : extractZhihuArticleContent(url);
    const bodyMin = isAnswer ? 100 : 200;
    const bodyName = isAnswer ? "answer .RichText" : ".Post-RichTextContainer";

    if (z.error) {
      return stubResult(url, `zhihu browser extraction failed: ${z.error.slice(0, 120)}`);
    }
    if (!z.contentHtml || z.contentHtml.length < bodyMin) {
      return stubResult(url, `zhihu ${bodyName} empty or too small (${z.contentHtml.length} chars)`);
    }

    const conv = convertZhihuArticleHtml(
      z.contentHtml,
      { title: z.title, author: z.author, date: z.date },
      url,
    );

    // Download images via curl into slugDir.
    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = imgFailed > 0 ? ["zhihu-image-download-partial"] : [];
    const notes: string[] = [
      `zhihu-article: ${conv.stats.codeFences} code fence(s), ${conv.stats.zhidaLinksUnwrapped} zhida.zhihu.com link(s) unwrapped, ${images.length}/${conv.imagesToDownload.length} image(s) downloaded`,
    ];
    if (imgFailed > 0) notes.push(`zhihu: ${imgFailed} image download(s) failed`);

    return {
      markdown: conv.markdown,
      title: conv.metadata.title || undefined,
      images,
      metadata: {
        source: "zhihu-raw-html",
        title: conv.metadata.title,
        author: conv.metadata.author,
        published_at: conv.metadata.publishedAt,
        stats: conv.stats,
      },
      flags,
      notes,
    };
  },
};

function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "zhihu", kind: "fetch-failed",
    title: "Zhihu Article (fetch failed)",
    summary: reason,
    errorDetail,
  });
}
