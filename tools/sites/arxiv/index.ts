/**
 * arxiv.org site module — claims every URL on arxiv.org. Behaviour
 * branches on the path:
 *
 *   - `/abs/<id>`   — full extraction: title + categories + authors +
 *                     submission history + abstract. The canonical case.
 *   - `/pdf/<id>`   — stub pointing operator at the abstract page (where
 *                     metadata + body live in HTML). PDF text extraction
 *                     would require a separate tool and is out of scope.
 *   - everything else — stub. arxiv listings/browse pages have no
 *                     useful long-form body to extract.
 *
 * Replaces the legacy stack:
 *   - `arxivStripTrailingChrome` (non-`/abs/` chrome strip)
 *   - `arxivStructureImprove` (non-`/abs/` rebuild)
 *   - `arxivPdfNote` (`/pdf/` note)
 *
 * All three were operating on opencli web-read output. With the unified
 * architecture, there's no opencli web-read for arxiv — this module
 * owns the full pipeline and emits clean stubs for the cases the
 * legacy code half-heartedly tried to support.
 */

import { mkdirSync } from "node:fs";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
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

import { renderPdfFromUrl } from "../_default/pdf-render.ts";

/** Extract `<id>` from an arxiv URL like `/abs/2402.13499` or `/pdf/2402.13499`. */
function extractArxivId(url: string): string | null {
  const m = url.match(/\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5}|[a-z\-]+\/[0-9]{7})(?:v\d+)?(?:[\/.]|$)/);
  return m ? m[1] : null;
}

function pdfStub(url: string): Result {
  const id = extractArxivId(url);
  const abstractUrl = id ? `https://arxiv.org/abs/${id}` : null;
  const lines = [
    `# arXiv Paper (PDF URL)`,
    ``,
    `> 原文链接: ${url}`,
  ];
  if (abstractUrl) {
    lines.push(`> Abstract: ${abstractUrl}`);
  }
  lines.push(
    ``,
    `---`,
    ``,
    `*This entry is a metadata stub. The URL points at an arXiv PDF;`,
    `we don't extract PDF text in this pipeline. ${abstractUrl
      ? `Visit the [abstract page](${abstractUrl}) for HTML metadata.`
      : "The abstract page (one path level up) has the HTML body."}*`,
    ``,
  );
  return {
    markdown: lines.join("\n"),
    images: [],
    metadata: { source: "arxiv-pdf-stub", arxiv_id: id ?? null, abstract_url: abstractUrl },
    flags: ["intentional-stub", "arxiv-pdf"],
    notes: [`arxiv: PDF URL — emitted stub pointing at abstract ${abstractUrl ?? "(unknown id)"}`],
  };
}

function listingStub(url: string): Result {
  return {
    markdown: [
      `# arXiv listing page`,
      ``,
      `> 原文链接: ${url}`,
      ``,
      `---`,
      ``,
      `*This entry is a metadata stub. The URL is an arXiv browse / listing page,`,
      `not an article. Bookmark a specific paper's abstract page (\`/abs/<id>\`)`,
      `to capture content.*`,
      ``,
    ].join("\n"),
    images: [],
    metadata: { source: "arxiv-listing-stub" },
    flags: ["intentional-stub", "arxiv-listing"],
    notes: [`arxiv: non-/abs/ URL — emitted listing stub`],
  };
}

function fetchFailureStub(url: string, reason: string): Result {
  return {
    markdown: [
      `# arXiv abstract page: ${url}`,
      ``,
      `> 原文链接: ${url}`,
      ``,
      `---`,
      ``,
      `*This entry is a metadata stub. ${reason}*`,
      ``,
    ].join("\n"),
    images: [],
    metadata: { source: "arxiv-stub", reason },
    flags: ["intentional-stub", "arxiv-fetch-failed"],
    notes: [`arxiv: stub emitted — ${reason}`],
  };
}

export const site: Site = {
  name: "arxiv",
  match: (url) => hostOf(url) === "arxiv.org",
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });

    const path = pathOf(url);
    if (path.startsWith("/pdf/")) {
      // P-36: render the PDF to per-page PNGs + structured markdown.
      // Fall back to the legacy stub if the renderer hits a known
      // failure mode (encrypted, corrupt, fetch failed) — those
      // already produce typed stubs themselves with appropriate
      // `_default-pdf-*` flags, but for arxiv specifically the
      // operator-friendly fallback is to just stub-redirect to the
      // /abs/ page where the metadata + body live in HTML, so we
      // additionally re-stub on render failure with the existing
      // `pdfStub` advice.
      const slug = opts.slugDir.split("/").filter(Boolean).pop() ?? "arxiv-pdf";
      const r = renderPdfFromUrl({ url, slugDir: opts.slugDir, slug });
      if (Array.isArray(r.flags) && r.flags.includes("intentional-stub")) {
        // Render path bailed (encrypted/corrupt/fetch-failed). Use
        // arxiv's existing stub which points at the /abs/ page.
        return pdfStub(url);
      }
      return r;
    }
    if (!path.startsWith("/abs/")) return listingStub(url);

    const r = fetchArxiv(url);
    if (r.error || !r.html) {
      return fetchFailureStub(url, r.error || "empty HTML response");
    }
    const conv = convertArxiv({ html: r.html, url });
    if (!conv.metadata.title || conv.metadata.title === "(arXiv abstract)") {
      return fetchFailureStub(url, "arxiv title selector failed (page format may have changed)");
    }
    if (conv.stats.abstractChars < 100) {
      return fetchFailureStub(url, `arxiv abstract empty/short (${conv.stats.abstractChars} chars)`);
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
