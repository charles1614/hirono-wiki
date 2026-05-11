/**
 * Shared helpers for the PDF-render pipeline. Pure functions only; no
 * side effects beyond the filesystem cleanup helper, which is documented
 * locally.
 *
 * Consumed by `pdf-render.ts` (dispatcher), `pdf-render-paper.ts`,
 * `pdf-render-slide.ts`, `pdf-render-marker.ts`. Don't import from
 * pdftotext-cleanup or paper-composition here — keep dependencies flowing
 * inward.
 */

import { readdirSync, existsSync, unlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as mupdf from "mupdf";

/**
 * Render DPI for slide-shape PDFs. 120 DPI on a 16:9 / 4:3 slide pt-size
 * page yields ~1600×900 / 1440×1080 px — readable at full screen
 * without ballooning disk usage when a deck has 40+ slides.
 */
export const SLIDE_DPI = 120;

/**
 * Aspect-ratio threshold for slide-deck classification. Page width/height
 * in PostScript points:
 *   <1.0    portrait (paper). A4 ≈ 0.71, US letter ≈ 0.77.
 *   1.0-1.4 square-ish (rare; treated as paper).
 *   >1.4    landscape (slide deck). 4:3 = 1.33 stays as paper to avoid
 *           misclassifying older 4:3 papers; 16:9 = 1.78 is well above.
 */
export const SLIDE_ASPECT_THRESHOLD = 1.4;

/**
 * Minimum size for an extracted pdfimages figure to count as a real
 * figure (vs logo/icon/page-decoration noise).
 */
export const MIN_FIGURE_BYTES = 30 * 1024;

/**
 * Read a single string-typed metadata field from a mupdf document.
 * Returns "" on any error or non-string value.
 */
export function safeMeta(doc: mupdf.PDFDocument, key: string): string {
  try {
    const v = doc.getMetaData(key);
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Title-fallback used when PDF info-metadata is empty. Prefers
 * `info:Title`, then `info:Subject`, then a marker showing the slug
 * (which downstream callers should replace via body-line extraction
 * when possible).
 */
export function chooseTitle(meta: Record<string, string>, fallback: string): string {
  if (meta.title && meta.title.length > 0) return meta.title;
  if (meta.subject && meta.subject.length > 0) return meta.subject;
  return `PDF: ${fallback}`;
}

export function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * PDF date strings look like `D:20240819163025+02'00'`. Format as
 * `2024-08-19 16:30` for the metadata callout. Falls back to the raw
 * string on parse failure.
 */
export function formatPdfDate(raw: string): string {
  const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return raw;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

/**
 * Delete every file in `dir` matching `pattern`. Used by the pipeline
 * to clean stale figures from prior refetches without clobbering files
 * written by other tools (the dir is multi-owner: pdfimages writes
 * `fig-PPP-NNN.png`, arxiv-fetch-figures writes `figure-NNN.png`,
 * Marker writes `marker-page-NNN-MMM.jpeg`).
 *
 * Best-effort: missing dir is a no-op; per-file unlink errors are
 * swallowed.
 */
export function cleanFilesMatching(dir: string, pattern: RegExp): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const f of readdirSync(dir)) {
    if (!pattern.test(f)) continue;
    try {
      unlinkSync(join(dir, f));
      n++;
    } catch {
      /* best-effort */
    }
  }
  return n;
}

/**
 * Remove a directory tree if it exists. Best-effort — used to clean
 * legacy / temp dirs.
 */
export function removeDirIfExists(path: string): void {
  if (!existsSync(path)) return;
  try {
    rmSync(path, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

/**
 * Remove a single file if it exists. Best-effort.
 */
export function removeFileIfExists(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    /* best-effort */
  }
}
