/**
 * Slide-deck PDF pipeline.
 *
 * Slides are dense images-per-page with overlaid text + graphics that
 * don't separate cleanly into text + figures (the way a paper does).
 * Trying to OCR each slide into prose produces noise. Instead, render
 * each slide to PNG at SLIDE_DPI and inline it as `![Slide N](...)` so
 * the body is a sequential visual walkthrough — the natural shape for
 * a presentation. The PDF itself is also preserved for direct viewing.
 *
 * Output layout:
 *   <slugDir>/
 *     content.md           ← §2 frontmatter + ![Slide N](...) inlines
 *     <slug>.pdf
 *     <slug>-slides/
 *       slide-001.png
 *       slide-002.png
 *       ...
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import * as mupdf from "mupdf";

import type { Result } from "../_shared/types.ts";
import { makeStub } from "../_shared/stub.ts";

import {
  SLIDE_DPI,
  formatBytes,
  formatPdfDate,
  pad3,
  removeDirIfExists,
} from "./pdf-render-shared.ts";

export interface SlideOpts {
  url: string;
  slugDir: string;
  slug: string;
  titleLine: string;
  meta: Record<string, string>;
  pageCount: number;
  pageWidthPt: number;
  pageHeightPt: number;
  aspectRatio: number;
  pdfSize: number;
  doc: mupdf.PDFDocument;
}

interface RenderOutcome {
  rendered: string[];
  errors: string[];
}

export function composeSlideContent(opts: SlideOpts): Result {
  cleanLegacyDirs(opts);
  const slidesDir = join(opts.slugDir, `${opts.slug}-slides`);
  removeDirIfExists(slidesDir);
  mkdirSync(slidesDir, { recursive: true });

  const outcome = renderAllSlides(opts, slidesDir);
  if (outcome.rendered.length === 0) {
    return makeRenderFailedStub(opts, outcome.errors);
  }

  const markdown = renderSlideDeckMarkdown(opts, outcome.rendered);
  return packageSlideResult(opts, outcome, markdown);
}

// ---------------------------------------------------------------------------
// Filesystem prep
// ---------------------------------------------------------------------------

function cleanLegacyDirs(opts: SlideOpts): void {
  // Earlier pipeline versions wrote `<slug>-images/` (full-page renders)
  // or `<slug>-figures/` (paper-shape). Neither applies to slides; drop
  // them on refetch so the on-disk layout matches `content.md`.
  removeDirIfExists(join(opts.slugDir, `${opts.slug}-images`));
  removeDirIfExists(join(opts.slugDir, `${opts.slug}-figures`));
}

// ---------------------------------------------------------------------------
// Slide rendering
// ---------------------------------------------------------------------------

function renderAllSlides(opts: SlideOpts, slidesDir: string): RenderOutcome {
  const matrix = mupdf.Matrix.scale(SLIDE_DPI / 72, SLIDE_DPI / 72);
  const rendered: string[] = [];
  const errors: string[] = [];
  for (let i = 0; i < opts.pageCount; i++) {
    try {
      const page = opts.doc.loadPage(i);
      const pix = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
      const filename = `slide-${pad3(i + 1)}.png`;
      writeFileSync(join(slidesDir, filename), pix.asPNG());
      rendered.push(filename);
    } catch (e) {
      errors.push(`slide ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { rendered, errors };
}

function makeRenderFailedStub(opts: SlideOpts, errors: string[]): Result {
  return makeStub({
    url: opts.url,
    module: "_default",
    kind: "pdf-corrupt",
    title: "Slide-deck rendering failed",
    summary: `mupdf opened the document but every slide render threw`,
    advice:
      `Slide-shape PDF parseable but rendering hit errors. ` +
      `The PDF itself is preserved at \`${opts.slug}.pdf\` for direct viewing.`,
    errorDetail: errors.slice(0, 5).join("\n"),
  });
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderSlideDeckMarkdown(opts: SlideOpts, rendered: string[]): string {
  const slideWidthPx = Math.round((opts.pageWidthPt * SLIDE_DPI) / 72);
  const slideHeightPx = Math.round((opts.pageHeightPt * SLIDE_DPI) / 72);

  const lines: string[] = [];
  lines.push(...renderHeader(opts, slideWidthPx, slideHeightPx));
  for (let i = 0; i < rendered.length; i++) {
    lines.push(`![Slide ${i + 1}](${opts.slug}-slides/${rendered[i]})`);
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(
    `*End of deck — ${opts.pageCount} slide${opts.pageCount === 1 ? "" : "s"}. ` +
      `PDF preserved at \`${opts.slug}.pdf\` for direct viewing.*`,
  );
  lines.push("");
  return lines.join("\n");
}

function renderHeader(opts: SlideOpts, widthPx: number, heightPx: number): string[] {
  const { url, slug, titleLine, meta, pageCount, pdfSize, aspectRatio } = opts;
  const lines: string[] = [];
  lines.push(`# ${titleLine}`);
  lines.push("");
  lines.push(`> 原文链接: ${url}`);
  lines.push(`> Local PDF: \`${slug}.pdf\` (preserved alongside this content.md)`);
  lines.push(
    `> Format: PDF · ${pageCount} slide${pageCount === 1 ? "" : "s"} · ` +
      `${formatBytes(pdfSize)} · slide-deck shape (aspect ${aspectRatio.toFixed(2)}) · ` +
      `rendered at ${widthPx}×${heightPx} px / ${SLIDE_DPI} DPI`,
  );
  if (meta.author) lines.push(`> Author: ${meta.author}`);
  if (meta.subject) lines.push(`> Subject: ${meta.subject}`);
  if (meta.creator || meta.producer) {
    const tools = [meta.creator, meta.producer].filter(Boolean).join(" / ");
    lines.push(`> Producer: ${tools}`);
  }
  if (meta.creationDate) lines.push(`> Created: ${formatPdfDate(meta.creationDate)}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines;
}

// ---------------------------------------------------------------------------
// Result packaging
// ---------------------------------------------------------------------------

function packageSlideResult(
  opts: SlideOpts,
  outcome: RenderOutcome,
  markdown: string,
): Result {
  const slideWidthPx = Math.round((opts.pageWidthPt * SLIDE_DPI) / 72);
  const slideHeightPx = Math.round((opts.pageHeightPt * SLIDE_DPI) / 72);

  const flags: string[] = ["pdf-slide-deck"];
  if (outcome.errors.length > 0) flags.push("_default-pdf-render-partial");

  return {
    markdown,
    title: opts.titleLine,
    images: outcome.rendered.map((f) => `${opts.slug}-slides/${f}`),
    metadata: {
      source: "_default-pdf",
      title: opts.titleLine,
      shape: "slide-deck",
      pdf_local_path: `${opts.slug}.pdf`,
      pdf_metadata: opts.meta,
      page_count: opts.pageCount,
      slides_rendered: outcome.rendered.length,
      slide_width_px: slideWidthPx,
      slide_height_px: slideHeightPx,
      render_dpi: SLIDE_DPI,
      aspect_ratio: Math.round(opts.aspectRatio * 100) / 100,
      pdf_size_bytes: opts.pdfSize,
    },
    flags,
    notes: [
      `_default-pdf slide-deck: ${opts.pageCount} slide(s) rendered at ${SLIDE_DPI} DPI, ` +
        `${formatBytes(opts.pdfSize)} source PDF` +
        (outcome.errors.length > 0 ? `, ${outcome.errors.length} render error(s)` : ""),
    ],
    error_detail: outcome.errors.length > 0 ? outcome.errors.slice(0, 5).join("\n") : undefined,
  };
}
