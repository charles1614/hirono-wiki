/**
 * linux.do — a Discourse forum.
 *
 * Per the universal pattern: no opencli web-read. Discourse has a clean
 * JSON API per topic at `<topic-url>.json`; we fetch that, page through
 * the post stream, and convert each post's `cooked` HTML to markdown
 * ourselves (jsdom + turndown + per-site rules in `converter.ts`).
 *
 * Replaces the legacy `linuxDoReformat` post-processor that was patching
 * opencli's lossy markdown of the rendered page.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { fetchLinuxDoTopic } from "./fetcher.ts";
import { convertLinuxDoTopic } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { makeStub } from "../_shared/stub.ts";
import { hostOf } from "../../shared/url-helpers.ts";

export const site: Site = {
  name: "linux-do",
  match: (url) => hostOf(url) === "linux.do",
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const topic = fetchLinuxDoTopic(url);
    if (topic.error) {
      return stubResult(url, `linux.do JSON fetch failed: ${topic.error.slice(0, 160)}`);
    }
    if (topic.posts.length === 0) {
      return stubResult(url, `linux.do topic has no posts`);
    }

    const conv = convertLinuxDoTopic(topic);

    // Localize images.
    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    // Truncation-by-cap is intentional and surfaced via a note (not a
    // quality flag) so the snapshot/quality gates don't false-positive on
    // it. Image-download failures are still real defects.
    const flags: string[] = [];
    if (imgFailed > 0) flags.push("linux-do-image-download-partial");

    const notes: string[] = [
      `linux-do: ${conv.stats.posts} post(s), ${conv.stats.oneboxes} onebox(es), ${conv.stats.quotes} quote(s), ${conv.stats.codeFences} code fence(s), ${images.length}/${conv.imagesToDownload.length} image(s) downloaded`,
    ];
    if (conv.metadata.posts_included < conv.metadata.posts_count) {
      notes.push(`linux-do: archived ${conv.metadata.posts_included}/${conv.metadata.posts_count} posts (cap reached)`);
    }
    if (imgFailed > 0) notes.push(`linux-do: ${imgFailed} image download(s) failed`);

    return {
      markdown: conv.markdown,
      title: conv.metadata.title || undefined,
      images,
      metadata: {
        source: "linux-do-discourse-api",
        ...conv.metadata,
        stats: conv.stats,
      },
      flags,
      notes,
    };
  },
};

function stubResult(url: string, reason: string, errorDetail?: string) {
  return makeStub({
    url, module: "linux-do", kind: "fetch-failed",
    title: "linux.do topic (fetch failed)",
    summary: reason,
    errorDetail,
  });
}
