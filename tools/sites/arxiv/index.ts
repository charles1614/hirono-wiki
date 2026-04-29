/**
 * arxiv.org site module — abstract pages only (`/abs/<id>`).
 *
 * Replaces the legacy generic-converter fallback for arxiv URLs. The
 * legacy path produced output cluttered with bibliographic chrome (NASA
 * ADS / Google Scholar / Semantic Scholar links, BibSonomy/Reddit
 * social bookmarks, browse navigation, "Loading…" placeholders). The
 * site module strips all that and produces clean §2 markdown with just:
 * title, arXiv ID + categories, authors, submission history, abstract,
 * optional comments, and the canonical PDF/HTML/TeX-source links.
 */

import { mkdirSync } from "node:fs";

import type { Site } from "../_shared/types.ts";
import { fetchArxiv } from "./fetcher.ts";
import { convertArxiv } from "./converter.ts";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function pathOf(url: string): string {
  try { return new URL(url).pathname; }
  catch { return ""; }
}

export const site: Site = {
  name: "arxiv",
  match: (url) =>
    hostOf(url) === "arxiv.org" && pathOf(url).startsWith("/abs/"),
  fetch: (url, opts) => {
    mkdirSync(opts.slugDir, { recursive: true });

    const r = fetchArxiv(url);
    if (r.error || !r.html) {
      return stubResult(url, r.error || "empty HTML response");
    }
    const conv = convertArxiv({ html: r.html, url });
    if (!conv.metadata.title || conv.metadata.title === "(arXiv abstract)") {
      return stubResult(url, "arxiv title selector failed (page format may have changed)");
    }
    if (conv.stats.abstractChars < 100) {
      return stubResult(url, `arxiv abstract empty/short (${conv.stats.abstractChars} chars)`);
    }
    return {
      markdown: conv.markdown,
      title: conv.metadata.title,
      images: [],
      metadata: {
        source: "arxiv",
        title: conv.metadata.title,
        arxiv_id: conv.metadata.arxivId,
        primary_category: conv.metadata.primaryCategory,
        categories: conv.metadata.categories,
        authors: conv.metadata.authors,
        submitted_at: conv.metadata.submittedDate,
        versions: conv.metadata.versions,
        stats: conv.stats,
      },
      flags: [],
      notes: [
        `arxiv: ${conv.metadata.arxivId} (${conv.metadata.primaryCategory}), ` +
        `${conv.stats.authorCount} author(s), ` +
        `${conv.stats.versionCount} version(s), ` +
        `${conv.stats.abstractChars} abstract chars`,
      ],
    };
  },
};

function stubResult(url: string, reason: string) {
  return {
    markdown:
      `# arXiv abstract page: ${url}\n\n` +
      `> 原文链接: ${url}\n\n` +
      `---\n\n` +
      `*This entry is a metadata stub. ${reason}*\n`,
    images: [],
    metadata: { source: "arxiv-stub", reason },
    flags: ["intentional-stub", "arxiv-fetch-failed"],
    notes: [`arxiv: stub emitted — ${reason}`],
  };
}
