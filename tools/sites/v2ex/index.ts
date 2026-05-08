/**
 * v2ex.com — Chinese tech-discussion forum.
 *
 * NOT a Discourse instance — its `<topic>.json` API doesn't exist;
 * v2ex runs its own stack. Plain curl + a real Chrome UA gets clean
 * server-rendered HTML; we parse the topic + replies ourselves and
 * emit split-speaker markdown.
 *
 * Path filter: `/t/<topic-id>` only. Member pages, the homepage,
 * and node listings fall through to `_default`.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { fetchV2exTopic } from "./fetcher.ts";
import { convertV2exTopic } from "./converter.ts";
import { downloadImage } from "../../fetch-raw.ts";
import { makeStub } from "../_shared/stub.ts";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function isTopicUrl(url: string): boolean {
  return /\/t\/\d+/.test(url);
}

export const site: Site = {
  name: "v2ex",
  match: (url) => hostOf(url) === "v2ex.com" && isTopicUrl(url),
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const topic = fetchV2exTopic(url);
    if (topic.error || topic.posts.length === 0) {
      return makeStub({
        url,
        module: "v2ex",
        kind: "fetch-failed",
        title: "v2ex topic (fetch failed)",
        summary: topic.error || "no posts extracted",
        advice:
          "v2ex's topic page failed to parse. The page may require login (rare for public " +
          "topics), the topic may be deleted, or the HTML structure may have changed and " +
          "the selectors in `tools/sites/v2ex/fetcher.ts` need updating.",
        errorDetail: topic.error,
      });
    }

    const conv = convertV2exTopic(topic);

    // Localize images.
    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest, undefined, url);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = [];
    if (imgFailed > 0) flags.push("v2ex-image-download-partial");

    return {
      markdown: conv.markdown,
      title: conv.metadata.title,
      images,
      metadata: {
        source: "v2ex",
        ...conv.metadata,
        stats: conv.stats,
      },
      flags,
      notes: [
        `v2ex: ${conv.metadata.posts_included} post(s)` +
        (conv.metadata.views !== undefined ? `, ${conv.metadata.views} views` : "") +
        `, ${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};
