/**
 * arxiv.org abstract-page converter.
 *
 * Pure function: HTML string → §2-contract markdown + (no images, since
 * arxiv abstract pages don't embed figures — those live in the PDF /
 * HTML version).
 *
 * Output shape (article — §5e.i taxonomy):
 *
 *   # <Title>
 *
 *   > 原文链接: <abstract URL>
 *   > arXiv:<id> [<primary>] · <category-2> · <category-3>
 *   > Authors: A, B, C, ... (and N others)
 *   > Submitted on <date> [(v1)], revised <date> (vN) [if applicable]
 *
 *   ---
 *
 *   ## Abstract
 *
 *   <abstract text>
 *
 *   ## Comments
 *
 *   <comment text if present>
 *
 *   ## Links
 *
 *   - [PDF](https://arxiv.org/pdf/<id>)
 *   - [HTML (experimental)](https://arxiv.org/html/<id>v<N>)
 *   - [TeX Source](https://arxiv.org/src/<id>)
 *
 * Drops all bibliographic chrome (NASA ADS / Google Scholar / Semantic
 * Scholar links, BibSonomy/Reddit social bookmarks, BibTeX widget,
 * "Bibliographic and Citation Tools" section, browse navigation).
 */

import { JSDOM } from "jsdom";

import { applyCommonMarkdownCleanups } from "../_shared/markdown-cleanups.ts";

const AUTHOR_LIST_TRIM_AT = 8;  // show first N authors then "(and M others)"

export interface ArxivConvertResult {
  markdown: string;
  imagesToDownload: never[];  // arxiv abstract page has no images we localize
  metadata: {
    title: string;
    arxivId: string;
    primaryCategory: string;
    categories: string[];
    authors: string[];
    submittedDate: string;
    versions: string[];
  };
  stats: {
    abstractChars: number;
    authorCount: number;
    versionCount: number;
  };
}

export interface ArxivConvertOpts {
  html: string;
  url: string;
}

export function convertArxiv(opts: ArxivConvertOpts): ArxivConvertResult {
  const dom = new JSDOM(opts.html);
  const doc = dom.window.document;

  // ── Title ────────────────────────────────────────────────────────────────
  const titleEl = doc.querySelector("h1.title");
  let title = "";
  if (titleEl) {
    // <h1 class="title mathjax"><span class="descriptor">Title:</span>Pretraining...</h1>
    const desc = titleEl.querySelector(".descriptor");
    if (desc) desc.remove();
    title = collapseWs(titleEl.textContent || "");
  }
  if (!title) title = "(arXiv abstract)";

  // ── arXiv ID + primary category ──────────────────────────────────────────
  // <td class="tablecell arxivid"><a href="/abs/2509.25149">arXiv:2509.25149</a> [cs.CL]</td>
  // OR from URL: /abs/<id> path.
  let arxivId = "";
  let primaryCategory = "";
  const idMatch = opts.url.match(/\/abs\/([\w.\-]+?)(?:v\d+)?(?:\?|#|$)/);
  if (idMatch) arxivId = idMatch[1];
  const idCell = doc.querySelector(".tablecell.arxivid, .arxivid");
  if (idCell) {
    const txt = collapseWs(idCell.textContent || "");
    const catMatch = txt.match(/\[([\w.]+)\]/);
    if (catMatch) primaryCategory = catMatch[1];
  }

  // ── Categories (subjects) ────────────────────────────────────────────────
  // <td class="tablecell subjects"><span class="primary-subject">Computation and Language (cs.CL)</span>; ...
  const categories: string[] = [];
  const subjectsCell = doc.querySelector(".tablecell.subjects");
  if (subjectsCell) {
    const txt = collapseWs(subjectsCell.textContent || "");
    for (const m of txt.matchAll(/\(([\w.]+)\)/g)) categories.push(m[1]);
  }
  if (!primaryCategory && categories.length > 0) primaryCategory = categories[0];

  // ── Authors ──────────────────────────────────────────────────────────────
  const authors: string[] = [];
  const authorsEl = doc.querySelector("div.authors");
  if (authorsEl) {
    for (const a of Array.from(authorsEl.querySelectorAll("a"))) {
      const t = collapseWs(a.textContent || "");
      if (t) authors.push(t);
    }
  }

  // ── Abstract ─────────────────────────────────────────────────────────────
  let abstract = "";
  const abstractEl = doc.querySelector("blockquote.abstract");
  if (abstractEl) {
    const desc = abstractEl.querySelector(".descriptor");
    if (desc) desc.remove();
    abstract = (abstractEl.textContent || "").trim();
    // Normalize internal whitespace per paragraph; preserve double-newline paragraph breaks.
    abstract = abstract
      .split(/\n\s*\n/)
      .map((p) => collapseWs(p))
      .filter((p) => p.length > 0)
      .join("\n\n");
  }

  // ── Submission history ───────────────────────────────────────────────────
  // <div class="submission-history">From: ...<br><strong>[v1]</strong> Mon, 29 Sep 2025 ...</div>
  const versions: string[] = [];
  let submittedDate = "";
  const submEl = doc.querySelector("div.submission-history");
  if (submEl) {
    const txt = (submEl.textContent || "").trim();
    // Capture each `[vN] <date>...` block.
    for (const m of txt.matchAll(/\[(v\d+)\]\s+(\w+,\s*\d{1,2}\s+\w+\s+\d{4})/g)) {
      versions.push(`${m[1]}: ${m[2]}`);
      if (m[1] === "v1") submittedDate = m[2];
    }
  }

  // ── Comments (optional) ──────────────────────────────────────────────────
  let comments = "";
  const commentsCell = doc.querySelector(".tablecell.comments");
  if (commentsCell) {
    comments = collapseWs(commentsCell.textContent || "");
  }

  // ── Compose markdown ─────────────────────────────────────────────────────
  const fm: string[] = [`# ${title}`, ""];
  fm.push(`> 原文链接: ${opts.url}`);
  if (arxivId) {
    const catSuffix = categories.length > 0 ? ` [${primaryCategory}]${categories.length > 1 ? " · " + categories.slice(1).join(" · ") : ""}` : "";
    fm.push(`> arXiv:${arxivId}${catSuffix}`);
  }
  if (authors.length > 0) {
    const head = authors.slice(0, AUTHOR_LIST_TRIM_AT).join(", ");
    const rest = authors.length > AUTHOR_LIST_TRIM_AT ? ` (and ${authors.length - AUTHOR_LIST_TRIM_AT} others)` : "";
    fm.push(`> Authors: ${head}${rest}`);
  }
  if (versions.length > 0) {
    fm.push(`> ${versions.join(" · ")}`);
  }
  fm.push("", "---", "");

  const sections: string[] = [];
  if (abstract) {
    sections.push("## Abstract", "", abstract, "");
  }
  if (comments) {
    sections.push("## Comments", "", comments, "");
  }
  // Links section — use the canonical URL pattern derived from arxivId.
  if (arxivId) {
    const v = versions[versions.length - 1]?.split(":")[0] || "";
    const links: string[] = [
      `- [PDF](https://arxiv.org/pdf/${arxivId})`,
      `- [HTML (experimental)](https://arxiv.org/html/${arxivId}${v ? v : ""})`,
      `- [TeX Source](https://arxiv.org/src/${arxivId})`,
    ];
    sections.push("## Links", "", ...links, "");
  }

  let markdown = fm.join("\n") + sections.join("\n");
  markdown = applyCommonMarkdownCleanups(markdown);
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  return {
    markdown,
    imagesToDownload: [],
    metadata: {
      title,
      arxivId,
      primaryCategory,
      categories,
      authors,
      submittedDate,
      versions,
    },
    stats: {
      abstractChars: abstract.length,
      authorCount: authors.length,
      versionCount: versions.length,
    },
  };
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
