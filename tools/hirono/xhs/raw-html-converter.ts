/**
 * Convert raw xhs (xiaohongshu) note text into clean §2-contract markdown.
 *
 * Replaces the previous opencli-`xiaohongshu note`-via-table pipeline:
 *
 *   - opencli emits a `| field | value |` table where `value` for the body
 *     `content` field is a SINGLE space-joined string. Paragraph
 *     boundaries (xhs uses `\n\t\n` between text runs in `#detail-desc`)
 *     are silently collapsed.
 *   - The downstream `xhsReformatNoteTable` post-processor heuristically
 *     re-splits on emoji markers (`📌`/`👉`/`1️⃣`...) but paragraphs
 *     without those markers stay jammed.
 *
 * This converter takes the RAW `#detail-desc.textContent` directly (which
 * preserves the `\n\t\n` separators) and emits markdown with proper
 * paragraph blank lines. Layer-4 path (per CLAUDE.md §5a Step 2b).
 *
 * Pure function: no I/O, no network. Caller (fetchXhsViaAdapter) handles
 * the browser session, image downloads, and disk writes.
 */

export interface XhsMetadata {
  title: string;
  author: string;
  /** Display-format counts as scraped from `.like-wrapper .count` etc. */
  likes?: string;
  collects?: string;
  comments?: string;
}

export interface ConvertResult {
  markdown: string;
  /** Diagnostics (for adapterNotes). */
  stats: {
    paragraphs: number;
    tagsExtracted: number;
    images: number;
  };
}

/**
 * Split xhs body text into paragraphs. xhs's `#detail-desc.textContent`
 * separates paragraphs with `\n\t\n` (newline + tab + newline). Within a
 * paragraph, soft-wrapped lines use `\n` (no tab).
 *
 * For paragraphs that are clearly a numbered list (each line starts with
 * `1️⃣`/`2️⃣`/digits), keep the line breaks (markdown will render them as
 * separate items if blank-separated, or the user reads them with implicit
 * line-break by convention).
 *
 * Returns an array of paragraph strings, each free of the leading/trailing
 * separator whitespace.
 */
function splitParagraphs(descText: string): string[] {
  const raw = descText.replace(/\r\n/g, "\n");
  // Primary split: `\n\t\n` paragraph marker. Fall back to double-newline.
  const parts = raw.split(/\n\s*\t\s*\n|\n{2,}/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Detect a tags-only line: a paragraph whose entire content is hashtag
 * tokens (`#word #word2 ...`) optionally separated by whitespace.
 *
 * Returns the cleaned tag list (without `#` prefix, deduped, in order)
 * or null if not a pure tags paragraph.
 */
function extractTags(paragraph: string): string[] | null {
  const trimmed = paragraph.trim();
  if (trimmed.length === 0) return null;
  // Must be all #tags + whitespace; no other prose.
  if (!/^(?:#\S+\s*)+$/.test(trimmed.replace(/\s+/g, " "))) return null;
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const m of trimmed.matchAll(/#(\S+)/g)) {
    const tag = m[1];
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags.length > 0 ? tags : null;
}

/**
 * Render a paragraph's internal newlines into appropriate markdown.
 * Emoji-marker bullets (`📌` / `👉` / `1️⃣`...) on consecutive lines
 * become real blank-line-separated paragraphs (not soft-wrap). Other
 * single-newline runs are kept as-is — markdown renderers treat them as
 * soft wraps inside one block.
 */
function renderParagraph(p: string): string {
  // If every non-blank line starts with an emoji-marker, split on \n into
  // separate paragraphs. Otherwise return as-is.
  const lines = p.split("\n").filter((l) => l.trim().length > 0);
  const EMOJI_BULLET = /^(?:📌|👉|✅|❌|⚠️|🔥|💡|[1-9]️⃣|🔟)/;
  if (lines.length >= 2 && lines.every((l) => EMOJI_BULLET.test(l.trim()))) {
    return lines.map((l) => l.trim()).join("\n\n");
  }
  return p;
}

export function convertXhsHtml(
  descText: string,
  metadata: XhsMetadata,
  originUrl: string,
  imageRefs: string[],
): ConvertResult {
  const allParas = splitParagraphs(descText);
  // Trailing tags paragraph (if any) gets pulled out into the **标签 / Tags:** line.
  let tags: string[] = [];
  const bodyParas: string[] = [];
  for (let i = 0; i < allParas.length; i++) {
    const t = extractTags(allParas[i]);
    if (t && i === allParas.length - 1) {
      tags = t;
    } else {
      bodyParas.push(renderParagraph(allParas[i]));
    }
  }

  const fm: string[] = [`# ${metadata.title || "(Xiaohongshu note)"}`, ""];
  fm.push(`> 原文链接: ${originUrl}`);
  if (metadata.author) fm.push(`> 作者: ${metadata.author}`);
  const stats: string[] = [];
  if (metadata.likes) stats.push(`${metadata.likes} likes`);
  if (metadata.collects) stats.push(`${metadata.collects} collects`);
  if (metadata.comments) stats.push(`${metadata.comments} comments`);
  if (stats.length) fm.push(`> 互动: ${stats.join(" · ")}`);
  fm.push("", "---", "");

  const out: string[] = [...fm];
  if (bodyParas.length > 0) {
    out.push(bodyParas.join("\n\n"));
  } else {
    out.push("*[Text content unavailable — this may be an image-only post.]*");
  }
  out.push("");
  if (tags.length > 0) {
    out.push(`**标签 / Tags:** ${tags.map((t) => "#" + t).join(", ")}`);
    out.push("");
  }
  if (imageRefs.length > 0) {
    out.push("## Images");
    out.push("");
    for (const ref of imageRefs) {
      out.push(`![${ref}](${ref})`);
    }
    out.push("");
  }

  const markdown = out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  return {
    markdown,
    stats: {
      paragraphs: bodyParas.length,
      tagsExtracted: tags.length,
      images: imageRefs.length,
    },
  };
}
