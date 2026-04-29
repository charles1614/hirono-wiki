/**
 * sebastianraschka.com/llm-architecture-gallery/ converter.
 *
 * The gallery is a CATALOG shape (§5e.i): one `<article>` per LLM
 * architecture, each with `data-compare-*` attrs + a `<dl class="…fact-grid">`
 * + meta links (article / config.json / tech report) + a figure image.
 *
 * Output structure:
 *
 *   # LLM Architecture Gallery
 *   > 原文链接: …
 *   > Last updated: …
 *
 *   ---
 *
 *   <intro paragraphs>
 *
 *   ## Architectures
 *
 *   ### <Title>
 *
 *   ![<alt>](images/<basename>.webp)
 *
 *   > **Summary:** <summary>
 *   > **Highlight:** <highlight>
 *
 *   | Field | Value |
 *   | --- | --- |
 *   | Date | … |
 *   | Scale | … |
 *   ⋮
 *
 *   **Resources:** [View in article](url) · [config.json](url) · [Tech report](url)
 *
 *   ---
 *
 *   …repeat per card…
 */

import { JSDOM } from "jsdom";

export interface RaschkaGalleryConvertResult {
  body: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  stats: {
    cards: number;
    introChars: number;
    images: number;
  };
}

export interface RaschkaGalleryConvertOpts {
  html: string;
  url: string;
}

/**
 * Card-level fact rows we surface in the markdown table, in display order.
 * We pull values from `data-compare-*` attributes when available (those are
 * authored as the canonical compare-tool data) and fall back to the inner
 * `<dl class="…fact-grid">` for license / vocab / key-detail which only
 * appear in the fact sheet.
 */
const FACT_ORDER: { key: string; label: string; from: "attr" | "dl" }[] = [
  { key: "date",       label: "Date",        from: "attr" },
  { key: "scale",      label: "Scale",       from: "attr" },
  { key: "context",    label: "Context",     from: "attr" },
  { key: "decoder",    label: "Decoder",     from: "attr" },
  { key: "attention",  label: "Attention",   from: "attr" },
  { key: "layer-mix",  label: "Layer mix",   from: "attr" },
  { key: "kv",         label: "KV cache",    from: "attr" },
  { key: "vocab",      label: "Vocab",       from: "dl" },
  { key: "license",    label: "License",     from: "dl" },
  // "key-detail" deliberately omitted — it duplicates `data-compare-highlight`
  // verbatim, which we already render as a Highlight blockquote above the table.
  { key: "aai-total",  label: "AAI total",   from: "attr" },
  { key: "aai-profile",label: "AAI profile", from: "attr" },
];

export function convertRaschkaGallery(
  opts: RaschkaGalleryConvertOpts,
): RaschkaGalleryConvertResult {
  const dom = new JSDOM(opts.html);
  const doc = dom.window.document;

  // ── Intro section ────────────────────────────────────────────────────────
  const introParas: string[] = [];
  let lastUpdated = "";
  const intro = doc.querySelector(".llm-architecture-overview__intro");
  if (intro) {
    const meta = intro.querySelector(".llm-architecture-overview__meta");
    if (meta) {
      // First text node is "Last updated: <date>".
      const t = (meta.textContent || "").trim().split("\n")[0].trim();
      lastUpdated = t.replace(/^Last updated:\s*/, "").replace(/\(view changes\).*$/, "").trim();
    }
    intro.querySelectorAll(".llm-architecture-overview__copy").forEach((p) => {
      const text = paragraphToMarkdown(p as Element, opts.url);
      if (text) introParas.push(text);
    });
  }

  // ── Architecture cards ───────────────────────────────────────────────────
  const cards = Array.from(
    doc.querySelectorAll<Element>("article.llm-architecture-overview__card"),
  );

  const imagesToDownload: { remoteUrl: string; localFilename: string }[] = [];
  const cardBlocks: string[] = [];

  for (const card of cards) {
    const title = card.getAttribute("data-compare-title")?.trim() || "Untitled";

    // Image. The card's <img> sits inside the figure button.
    const img = card.querySelector("img");
    let imageMd = "";
    if (img) {
      const remoteSrc = img.getAttribute("src") || "";
      if (remoteSrc) {
        const remoteUrl = absoluteUrl(remoteSrc, opts.url);
        const baseName = remoteSrc.split("/").pop() || "image.webp";
        const localName = `images/${sanitizeFilename(baseName)}`;
        imagesToDownload.push({ remoteUrl, localFilename: localName });
        const alt = (img.getAttribute("alt") || title).replace(/[\[\]]/g, "");
        imageMd = `![${alt}](${localName})`;
      }
    }

    const summary = card.getAttribute("data-compare-summary")?.trim() || "";
    const highlight = card.getAttribute("data-compare-highlight")?.trim() || "";

    // Pull dl fact entries we don't get from data-compare-*.
    const dlFacts = new Map<string, string>();
    card.querySelectorAll(".llm-architecture-overview__fact-item").forEach((item) => {
      const key = item.getAttribute("data-fact-key") || "";
      const dd = item.querySelector(".llm-architecture-overview__fact-def");
      const val = collapseWhitespace(dd?.textContent || "");
      if (key && val) dlFacts.set(key, val);
    });

    // Build fact rows — skip empty / N/A.
    const rows: string[] = [];
    for (const f of FACT_ORDER) {
      let val = "";
      if (f.from === "attr") {
        const attrName = `data-compare-${f.key}`;
        val = card.getAttribute(attrName)?.trim() || "";
      } else {
        val = dlFacts.get(f.key) || "";
      }
      if (!val || val.toUpperCase() === "N/A") continue;
      // `context` numbers are bare (e.g. "1,024") — append " tokens".
      if (f.key === "context") val = `${val} tokens`;
      rows.push(`| ${f.label} | ${escapeCell(val)} |`);
    }

    // Meta resource links (article / config / tech report).
    const links: string[] = [];
    card.querySelectorAll<Element>(".llm-architecture-overview__title-meta-link").forEach((a) => {
      const text = collapseWhitespace(a.textContent || "");
      const href = a.getAttribute("href") || "";
      if (text && href && href !== "#") {
        links.push(`[${text}](${href})`);
      }
    });

    // Compose card block.
    const block: string[] = [];
    block.push(`### ${title}`);
    block.push("");
    if (imageMd) {
      block.push(imageMd);
      block.push("");
    }
    if (summary) {
      block.push(`> **Summary:** ${escapeBlockquote(summary)}`);
    }
    if (highlight) {
      block.push(`> **Highlight:** ${escapeBlockquote(highlight)}`);
    }
    if (summary || highlight) block.push("");
    if (rows.length > 0) {
      block.push("| Field | Value |");
      block.push("| --- | --- |");
      block.push(...rows);
      block.push("");
    }
    if (links.length > 0) {
      block.push(`**Resources:** ${links.join(" · ")}`);
      block.push("");
    }
    block.push("---");
    cardBlocks.push(block.join("\n"));
  }

  // ── Compose body ─────────────────────────────────────────────────────────
  const parts: string[] = [];
  if (lastUpdated) {
    parts.push(`> Last updated: ${lastUpdated}`);
    parts.push("");
  }
  if (introParas.length > 0) {
    parts.push(introParas.join("\n\n"));
    parts.push("");
  }
  parts.push(`## Architectures (${cards.length})`);
  parts.push("");
  parts.push(cardBlocks.join("\n\n"));

  const body = parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  return {
    body,
    imagesToDownload,
    stats: {
      cards: cards.length,
      introChars: introParas.join("\n\n").length,
      images: imagesToDownload.length,
    },
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Convert a paragraph DOM node to markdown, preserving inline `<a>` links
 * and `<code>` spans. Falls back to plain textContent for any other inline
 * elements. Used for intro paragraphs where links carry real value (the
 * card fact tables don't have inline content; plain text suffices there).
 */
function paragraphToMarkdown(p: Element, baseUrl: string): string {
  const out: string[] = [];
  const walk = (n: Node): void => {
    if (n.nodeType === 3 /* TEXT_NODE */) {
      out.push(n.textContent || "");
      return;
    }
    if (n.nodeType !== 1 /* ELEMENT_NODE */) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "a") {
      const text = collapseWhitespace(el.textContent || "");
      const href = el.getAttribute("href") || "";
      if (text && href && href !== "#") {
        out.push(`[${text}](${absoluteUrl(href, baseUrl)})`);
      } else if (text) {
        out.push(text);
      }
      return;
    }
    if (tag === "code") {
      out.push(`\`${el.textContent || ""}\``);
      return;
    }
    el.childNodes.forEach(walk);
  };
  p.childNodes.forEach(walk);
  return collapseWhitespace(out.join(""));
}

function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 120);
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeBlockquote(s: string): string {
  return s.replace(/\n/g, " ");
}
