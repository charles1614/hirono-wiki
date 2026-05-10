/**
 * mp.weixin.qq.com site module.
 *
 * Per the universal pattern (CLAUDE.md §5a): no opencli MD output. We
 * use opencli's browser session to extract `#js_content` outerHTML +
 * page metadata, then convert ourselves with jsdom + turndown + per-site
 * rules in `converter.ts`.
 *
 * First Layer-4 reference implementation (Track B, 2026-04). Was
 * previously located under `tools/hirono/weixin/` — moved here for
 * consistency with the other site modules.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { extractWeixinFullContent } from "./fetcher.ts";
import { convertWeixinHtml } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { hostOf } from "../../shared/url-helpers.ts";

export const site: Site = {
  name: "weixin",
  match: (url) => hostOf(url) === "mp.weixin.qq.com",
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const w = extractWeixinFullContent(url);

    const result = convertWeixinHtml(
      w.contentHtml,
      { title: w.title, author: w.author, publishTime: w.publishTime },
      url,
    );

    // Download images. Failures are tolerated individually — one bad CDN
    // URL shouldn't abort the whole fetch.
    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of result.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    // Write SVG diagram files (mermaid flowcharts etc.) directly.
    for (const svg of result.svgFiles) {
      const dest = join(opts.slugDir, svg.localFilename);
      writeFileSync(dest, svg.svg);
      images.push(svg.localFilename);
    }

    const flags: string[] = imgFailed > 0 ? ["weixin-image-download-partial"] : [];
    const notes: string[] = [
      `weixin: raw-HTML pipeline (turndown + custom rules)`,
      `weixin: ${result.stats.codeFences} code block(s), ${result.stats.tables} table row(s), ${result.stats.svgFiles} SVG diagram(s) preserved (${result.stats.svgDropped} decorative dropped), ${result.stats.listMarkersCleaned} list-marker prefix(es) stripped`,
      `weixin: downloaded ${images.length - result.svgFiles.length}/${result.imagesToDownload.length} image(s)${imgFailed > 0 ? ` (${imgFailed} failed)` : ""}`,
    ];

    return {
      markdown: result.markdown,
      title: result.metadata.title,
      images,
      metadata: {
        source: "weixin-raw-html",
        title: result.metadata.title,
        author: result.metadata.author,
        publish_time: result.metadata.publishTime,
        stats: result.stats,
      },
      flags,
      notes,
    };
  },
};
