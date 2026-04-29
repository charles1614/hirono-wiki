/**
 * Substack converter.
 *
 * Pure function: raw HTML → §2-body markdown + image download list +
 * extracted metadata (title, author, publish date).
 *
 * Strategy:
 *   1. Extract `<div class="available-content">` (or fallback `body.markup`)
 *      outerHTML — that's the article body.
 *   2. Extract `<title>`, `og:title`, `og:description`, `article:author`,
 *      `article:published_time` from `<head>` for the H1 + metadata callout.
 *   3. Run shared `convertGenericHtml` on the body — jsdom + turndown + GFM
 *      tables, image localization (per the universal pattern stack).
 *   4. Apply substack-specific cleanups on the resulting markdown — these
 *      were previously in `substackReformat` post-processor; ported here
 *      because they're substack-shape-specific structural transforms, not
 *      generic chrome strips.
 *
 * The cleanups handle: click-to-enlarge image-link wrappers, embedded
 * "related post" cards (collapse to one-line blockquote), trailing footer
 * truncation (Subscribe / Discussion / Ready for more), inline subscribe
 * CTAs, paywall markers, bare-anchor heading prefixes, over-escaped
 * periods.
 */

import { JSDOM } from "jsdom";
import { convertGenericHtml } from "../_shared/generic-converter.ts";

export interface SubstackConvertResult {
  markdown: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  metadata: {
    title: string;
    author: string;
    publishedAt: string;
  };
  stats: {
    bodyChars: number;
    cardsCollapsed: number;
    headerChromeStripped: number;
    images: number;
  };
}

export interface SubstackConvertOpts {
  html: string;
  url: string;
  imagePrefix?: string;
}

export function convertSubstack(opts: SubstackConvertOpts): SubstackConvertResult {
  const dom = new JSDOM(opts.html);
  const doc = dom.window.document;

  // ── Metadata extraction ─────────────────────────────────────────────────
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() || "";
  const docTitle = (doc.querySelector("title")?.textContent || "").trim();
  const title = ogTitle || docTitle || opts.url;

  const author =
    doc.querySelector('meta[name="author"]')?.getAttribute("content")?.trim() ||
    doc.querySelector('meta[property="article:author"]')?.getAttribute("content")?.trim() ||
    "";

  const publishedAt =
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content")?.trim() ||
    "";

  // ── Body extraction ─────────────────────────────────────────────────────
  // Substack's article body lives in `.available-content`. The inner
  // `.body.markup` is sometimes the only container present (older posts);
  // fall back to it. Otherwise fall back to `<article>` if present.
  const bodyEl =
    doc.querySelector(".available-content") ||
    doc.querySelector(".body.markup") ||
    doc.querySelector("article");
  if (!bodyEl) {
    return {
      markdown: "",
      imagesToDownload: [],
      metadata: { title, author, publishedAt },
      stats: { bodyChars: 0, cardsCollapsed: 0, headerChromeStripped: 0, images: 0 },
    };
  }

  // Generic converter handles jsdom + turndown + GFM + image localization.
  const generic = convertGenericHtml({
    html: bodyEl.outerHTML,
    url: opts.url,
    imagePrefix: opts.imagePrefix ?? "substack",
  });

  let body = generic.body;
  let cardsCollapsed = 0;
  let headerChromeStripped = 0;

  // ── Substack-specific cleanups (ported from substackReformat) ───────────

  // 1. Body-top chrome strip — avatars + author profile links + dates +
  //    bare counters + Share/Comment/Paid labels at the very top of the
  //    extracted body. Only fires if these patterns dominate the first
  //    ~40 lines (>= 4 chrome lines), so prose articles aren't damaged.
  {
    const lines = body.split("\n");
    const isAvatar = (l: string) => /!\[(?:[^\]]*?\s)?[Aa]vatar[^\]]*\]\([^)]+\)/.test(l);
    const isAuthor = (l: string) => /^\[[^\]]+\]\(https:\/\/substack\.com\/@[^)]+\)\s*$/.test(l);
    const isDate = (l: string) => /^[A-Z][a-z]{2,8} \d{1,2}, \d{4}\s*$/.test(l);
    const isCounter = (l: string) => /^[\d,]{1,10}$/.test(l);
    const isLabel = (l: string) => l === "∙ Paid" || l === "Paid" || l === "Share" || l === "Comment";
    const dropMask = new Array(lines.length).fill(false);
    let i = 0;
    while (i < lines.length && i < 40) {
      const t = lines[i].trim();
      if (t === "") { i++; continue; }
      if (isAvatar(t) || isAuthor(t) || isDate(t) || isCounter(t) || isLabel(t)) {
        dropMask[i] = true;
        headerChromeStripped++;
        i++;
        continue;
      }
      break;
    }
    if (headerChromeStripped >= 4) {
      // Also drop trailing blanks before the first kept line.
      let firstKept = 0;
      while (firstKept < lines.length && (dropMask[firstKept] || lines[firstKept].trim() === "")) {
        if (!dropMask[firstKept]) dropMask[firstKept] = true;
        firstKept++;
      }
      body = lines.filter((_, idx) => !dropMask[idx]).join("\n");
    } else {
      headerChromeStripped = 0;
    }
  }

  // 2. Multi-line link wrappers (click-to-enlarge images, profile-link
  //    cards, etc.) — handled by convertGenericHtml's line-walker before
  //    we get here. Single-line wrapper form (rare) is still handled
  //    below as a belt-and-braces pass.
  body = body.replace(
    /\[\s*(!\[[^\]]*\]\([^)]+\))\s*\]\([^)]+\)/g,
    "$1",
  );

  // 3. Embedded related-post cards — collapse multi-line card markup to
  //    a single `> 🔗 **Related:** [Title](url) — Author · Date` blockquote.
  //
  //    Substack ships many card variants — the title heading level varies
  //    (`##`–`#####`), the date may sit INSIDE the title-link block, the
  //    author may or may not be present, and the trailing "Read full
  //    story" link is sometimes absent. The detector below is a permissive
  //    two-stage scan rather than a state machine:
  //
  //      Stage A: find a `[ \n\n #{2,6} Title \n... \n ](url)` block.
  //               That gives us {cardTitle, cardUrl} and any trailing
  //               metadata-shaped lines inside (date, etc.).
  //      Stage B: optionally consume the immediately-following author line
  //               (`[Name](https://substack.com/profile/...)`), date line
  //               (`Mon DD, YYYY` / `12 April 2023`), `·` separator, and
  //               trailing "Read full story" link block — within ~12
  //               non-blank lines after Stage A's closing `](url)`.
  {
    const srcLines = body.split("\n");
    const keep: string[] = [];
    let i = 0;
    while (i < srcLines.length) {
      if (srcLines[i].trim() === "[") {
        // Stage A: find `[\n*##+ Title\n* ... \n*](url)` block.
        let j = i + 1;
        while (j < srcLines.length && srcLines[j].trim() === "") j++;
        const titleMatch = j < srcLines.length ? srcLines[j].match(/^(#{2,6})\s+(.+?)\s*$/) : null;
        if (titleMatch) {
          const cardTitle = titleMatch[2].trim();
          // Walk forward to find the closing `](url)` line. Capture any
          // intermediate non-blank lines as in-block metadata (often a date).
          const inBlockMeta: string[] = [];
          let cardUrl = "";
          let titleBlockEnd = -1;
          for (let k = j + 1; k < Math.min(j + 12, srcLines.length); k++) {
            const t = srcLines[k].trim();
            if (t === "") continue;
            const m = t.match(/^\]\(([^)]+)\)\s*$/);
            if (m) {
              cardUrl = m[1];
              titleBlockEnd = k;
              break;
            }
            inBlockMeta.push(t);
          }
          if (cardUrl && titleBlockEnd > 0) {
            // Stage B: scan up to 15 non-blank lines after the title block
            //   for author / date / Read-full-story.
            let cardEnd = titleBlockEnd;
            let authorLine = "";
            let dateLine = inBlockMeta.find((m) => /^[\w\d][^\n]*\d{4}\s*$/.test(m)) || "";
            let nonBlankSeen = 0;
            for (let m = titleBlockEnd + 1; m < Math.min(titleBlockEnd + 30, srcLines.length); m++) {
              const t = srcLines[m].trim();
              if (t === "") continue;
              nonBlankSeen++;
              // Skip standalone empty-text-link `[](url)` filler.
              if (/^\[\]\([^)]+\)\s*$/.test(t)) { cardEnd = m; continue; }
              // Author line (substack profile link).
              if (!authorLine && /^(?:\[\]\([^)]+\))?\[[^\]]+\]\(https:\/\/substack\.com\/profile/.test(srcLines[m])) {
                authorLine = srcLines[m];
                cardEnd = m;
                continue;
              }
              // `·` separator after author.
              if (t === "·") { cardEnd = m; continue; }
              // Date line.
              if (!dateLine && /^[\w\d][^\n]*\d{4}\s*$/.test(t)) {
                dateLine = t;
                cardEnd = m;
                continue;
              }
              // "Read full story" link block: `[ \n Read full story \n ](url)`.
              if (t === "[") {
                let n = m + 1;
                while (n < srcLines.length && srcLines[n].trim() === "") n++;
                if (n < srcLines.length && srcLines[n].trim() === "Read full story") {
                  let p = n + 1;
                  while (p < srcLines.length && srcLines[p].trim() === "") p++;
                  if (p < srcLines.length && /^\]\([^)]+\)\s*$/.test(srcLines[p].trim())) {
                    cardEnd = p;
                    m = p;
                    continue;
                  }
                }
              }
              // Anything else → end of card.
              if (nonBlankSeen > 1) break;
            }
            // Build the collapsed blockquote.
            const authorNames = [...authorLine.matchAll(/\[([^\]]+)\]\(https:\/\/substack\.com\/profile[^)]+\)/g)].map((m) => m[1]);
            const andOthers = authorLine.match(/and\s+(\d+)\s+others?/i);
            const authorStr = authorNames.join(", ") +
              (andOthers ? ` (and ${andOthers[1]} others)` : "");
            // Compose the blockquote: title + optional ` — Author` + optional ` · Date`.
            let collapsed = `> 🔗 **Related:** [${cardTitle}](${cardUrl})`;
            if (authorStr) collapsed += ` — ${authorStr}`;
            if (dateLine) collapsed += ` · ${dateLine}`;
            keep.push(collapsed);
            cardsCollapsed++;
            i = cardEnd + 1;
            continue;
          }
        }
      }
      keep.push(srcLines[i]);
      i++;
    }
    if (cardsCollapsed > 0) {
      body = keep.join("\n").replace(/\n{3,}/g, "\n\n");
    }
  }

  // 3b. Demote body headings by one level. Substack uses `<h1>` for section
  //     headings (e.g. `# 1. DeepSeek V3/R1`) inside the article body. Our
  //     §2 contract reserves `# ` for the frontmatter article title, so
  //     every body heading shifts down: H1→H2, H2→H3, H3→H4, etc. (H6
  //     stays at H6 — no level deeper than H6 in markdown.)
  //
  //     Done with a fence-aware pass so heading-shaped lines inside
  //     fenced code blocks aren't accidentally demoted.
  {
    const lines = body.split("\n");
    let inFence = false;
    let demoted = 0;
    const out: string[] = [];
    for (const line of lines) {
      if (/^```/.test(line.trim())) {
        inFence = !inFence;
        out.push(line);
        continue;
      }
      if (inFence) { out.push(line); continue; }
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      if (m && m[1].length < 6) {
        out.push(`#${m[1]} ${m[2]}`);
        demoted++;
      } else {
        out.push(line);
      }
    }
    if (demoted > 0) body = out.join("\n");
  }

  // 4. Bare-anchor heading prefixes — `## []({#anchor "Title")**Title**` →
  //    `## Title`. Substack renders `<h2 id="..."><a href="#..."></a>X</h2>`
  //    which turndown emits with the empty-anchor + bold-redundant form.
  body = body.replace(
    /^(#{1,6})\s*\[\]\(#[^)]*\)\s*\*\*(.+?)\*\*\s*$/gm,
    "$1 $2",
  );
  body = body.replace(
    /^(#{1,6})\s*\[\]\(#[^)]*\)\s*(.+?)\s*$/gm,
    "$1 $2",
  );

  // 5. Over-escaped periods — turndown emits `1\.` for numeric-list-style
  //    text in prose (when the body has `1. Foo` as plain text rather than
  //    a markdown list). Restore in non-fenced regions.
  {
    const fenceAware: string[] = [];
    let inFence = false;
    for (const line of body.split("\n")) {
      if (/^```/.test(line.trim())) { inFence = !inFence; fenceAware.push(line); continue; }
      if (inFence) { fenceAware.push(line); continue; }
      fenceAware.push(line.replace(/(\w)\\\.(?=\s|\w)/g, "$1."));
    }
    body = fenceAware.join("\n");
  }

  // 6. Inline reader-supported / Subscribe CTA blocks, mid-article and
  //    end-of-body. Strip wherever found.
  body = body.replace(
    /\n\n[A-Z][^.\n]+ is a reader-supported publication[^\n]*\n\nSubscribe\n?/g,
    "\n\n",
  );

  // 7. Trailing footer truncation. Substack appends a multi-section footer
  //    below every post body: "#### Subscribe to X", "#### Discussion about
  //    this post", "### Ready for more?", "#### No posts". Truncate at the
  //    first such marker.
  {
    const footerMarkers: RegExp[] = [
      /\n#{2,4}\s+Subscribe to\s+\S/,
      /\n#{2,4}\s+Discussion about this post\b/,
      /\n#{2,4}\s+Ready for more\?/,
      /\n#{2,4}\s+No posts\b/,
    ];
    let cutAt = -1;
    for (const re of footerMarkers) {
      const m = re.exec(body);
      if (m && (cutAt < 0 || m.index < cutAt)) cutAt = m.index;
    }
    if (cutAt > 0) body = body.slice(0, cutAt).replace(/\n+$/, "") + "\n";
  }

  // 8. Trailing engagement counters — "47\n\n55\n\nShare" at end of doc.
  body = body.replace(/(\n\s*\d+\s*)+\n\s*Share\s*$/g, "\n");

  // 9. Trailing nav — `PreviousNext` / `Previous Next`.
  body = body.replace(/\n(?:PreviousNext|Previous\s+Next|Previous|Next)\s*$/g, "\n");

  // 10. Paywall markers — truncate.
  {
    const paywallMarkers: RegExp[] = [
      /^## This post is for paid subscribers\s*$/m,
      /^## Continue reading\s*$/m,
      /^\[Subscribe\]\(https:\/\/[^)]+\/subscribe/m,
    ];
    for (const re of paywallMarkers) {
      const m = re.exec(body);
      if (m && typeof m.index === "number") {
        body = body.slice(0, m.index).trimEnd() + "\n";
        break;
      }
    }
  }

  body = body.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  // ── Compose final markdown with §2 frontmatter ──────────────────────────
  const frontmatter: string[] = [`# ${title}`, "", `> 原文链接: ${opts.url}`];
  if (author) frontmatter.push(`> 作者: ${author}`);
  if (publishedAt) frontmatter.push(`> 发表于: ${formatDate(publishedAt)}`);
  frontmatter.push("");
  frontmatter.push("---");
  frontmatter.push("");

  const markdown = frontmatter.join("\n") + body;

  return {
    markdown,
    imagesToDownload: generic.imagesToDownload,
    metadata: { title, author, publishedAt },
    stats: {
      bodyChars: body.length,
      cardsCollapsed,
      headerChromeStripped,
      images: generic.imagesToDownload.length,
    },
  };
}

function formatDate(iso: string): string {
  // Substack publishes ISO-8601 with millis + Z. Show YYYY-MM-DD.
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : iso;
}
