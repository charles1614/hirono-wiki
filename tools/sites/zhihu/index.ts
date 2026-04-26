/**
 * zhuanlan.zhihu.com site module.
 *
 * Per the universal pattern (CLAUDE.md §5a): no opencli MD output, no
 * web-read. We use opencli's browser session to extract the article's
 * raw HTML (`.Post-RichTextContainer`), then convert it ourselves with
 * jsdom + turndown + per-site rules in `converter.ts`.
 *
 * Only handles `zhuanlan.zhihu.com` (long-form articles). Question/
 * answer pages on `zhihu.com` go through a different opencli adapter
 * (zhihu-question) and are not covered here.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { extractZhihuArticleContent } from "./fetcher.ts";
import { convertZhihuArticleHtml } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export const site: Site = {
  name: "zhihu-article",
  match: (url) => hostOf(url) === "zhuanlan.zhihu.com",
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const z = extractZhihuArticleContent(url);
    if (z.error) {
      return stubResult(url, `zhihu browser extraction failed: ${z.error.slice(0, 120)}`);
    }
    if (!z.contentHtml || z.contentHtml.length < 200) {
      return stubResult(url, `zhihu .Post-RichTextContainer empty or too small (${z.contentHtml.length} chars)`);
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

function stubResult(url: string, reason: string) {
  return {
    markdown:
      `# Zhihu Article: ${url}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      `*This entry is a metadata stub. ${reason}*\n`,
    images: [],
    metadata: { source: "zhihu-stub", reason },
    flags: ["intentional-stub", "zhihu-fetch-failed"],
    notes: [`zhihu: stub emitted — ${reason}`],
  };
}
