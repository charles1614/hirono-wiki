/**
 * Body-text-based title fallback for paper-shape PDFs.
 *
 * LaTeX-built arxiv PDFs almost always ship with empty `info:Title`
 * metadata. The pipeline's `chooseTitle()` then falls back to
 * `PDF: <slug>` — useful as a sentinel but ugly as a wiki page title.
 *
 * This module extracts a real title from the PDF's first page:
 *   1. Run pdftotext on page 1 only.
 *   2. Apply letter-spacing normalization (the same fix `cleanPdfText`
 *      uses) so "F LUX" → "FLUX".
 *   3. Pick the first plausible-title line (length 8-200 chars,
 *      excluding arxiv banner / date footnotes).
 *   4. If line 1 ends in `:`, glue line 2 onto it
 *      ("Beyond the Buzz:\nA Pragmatic Take" → "Beyond the Buzz: A Pragmatic Take").
 *
 * Skip the whole pass when the caller's existing title isn't the
 * sentinel form (i.e. PDF info-title was non-empty).
 */

import { execFileSync } from "node:child_process";

const MIN_TITLE_LEN = 8;
const MAX_TITLE_LEN = 200;

/**
 * Return a body-extracted title, or `null` if extraction failed or no
 * candidate qualified. Caller decides whether to apply.
 */
export function extractTitleFromPdfBody(pdfPath: string): string | null {
  const rawPage1 = readFirstPageText(pdfPath);
  if (!rawPage1) return null;

  const candidates = collectTitleCandidates(rawPage1);
  if (candidates.length === 0) return null;

  return joinTwoLineTitle(candidates[0], candidates[1]);
}

/**
 * Whether `currentTitle` is the sentinel-shaped placeholder that
 * indicates the caller wants this fallback applied.
 */
export function shouldFallbackToBodyTitle(currentTitle: string, slug: string): boolean {
  return currentTitle === `PDF: ${slug}` || currentTitle === slug;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function readFirstPageText(pdfPath: string): string {
  try {
    return execFileSync(
      "pdftotext",
      ["-nopgbrk", "-enc", "UTF-8", "-l", "1", pdfPath, "-"],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
  } catch {
    return "";
  }
}

function collectTitleCandidates(rawPage1: string): string[] {
  return rawPage1
    .split(/\r?\n/)
    .map((l) => l.trim())
    .map(normalizeLetterSpacing)
    .filter((l) => l.length >= MIN_TITLE_LEN && l.length <= MAX_TITLE_LEN)
    .filter((l) => !/^arXiv:/i.test(l))
    .filter((l) => !/^(\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4})$/.test(l));
}

/**
 * Letter-spacing collapse — kept private to this module so we don't
 * couple to pdf-render-clean.ts. Same regex, two passes for chains.
 */
function normalizeLetterSpacing(line: string): string {
  const glue = (s: string) =>
    s.replace(/\b([A-Z]) ([A-Z]{2,})\b/g, (_m, head, tail) => head + tail);
  return glue(glue(line));
}

/**
 * If the first candidate ends in `:`, treat the second as its
 * continuation and join. Otherwise return the first.
 */
function joinTwoLineTitle(first: string, second?: string): string {
  if (second && first.endsWith(":")) {
    return `${first} ${second}`.replace(/\s+/g, " ");
  }
  return first;
}
