/**
 * Shape-aware PDF dispatcher. Triggered when `_default`'s non-HTML
 * detection (P-20) sees a `Content-Type: application/pdf` or `%PDF-`
 * magic-bytes body.
 *
 * Pipeline:
 *   1. Download → disk.
 *   2. Load via mupdf → detect encryption + corruption.
 *   3. Read PDF metadata + page-0 dimensions → classify shape.
 *   4. Branch:
 *        aspect ≤ 1.4  → composePaperContent (pdf-render-paper.ts)
 *        aspect > 1.4  → composeSlideContent (pdf-render-slide.ts)
 *
 * Output layout (per shape, see each sub-module):
 *   <slugDir>/
 *     content.md            ← §2 frontmatter + body
 *     <slug>.pdf            ← preserved source binary
 *     <slug>-figures/       ← paper-shape: embedded figures
 *     <slug>-slides/        ← slide-shape: rasterized slide PNGs
 *
 * Engines:
 *   - `mupdf`     (npm, WASM)  — load PDF, dimensions, encryption check, slide raster.
 *   - `pdftotext` (poppler)    — paper-shape body text (default extractor).
 *   - `pdfimages` (poppler)    — paper-shape embedded figures.
 *   - `marker_single` (Datalab) — paper-shape body + figures when
 *                                 `HIRONO_USE_MARKER=1` is set.
 *
 * See P-36 in `00_Meta/site-handling-patterns.md` for the full pattern
 * write-up + design rationale.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import * as mupdf from "mupdf";

import { makeStub } from "../_shared/stub.ts";
import type { Result } from "../_shared/types.ts";

import { composePaperContent } from "./pdf-render-paper.ts";
import { composeSlideContent } from "./pdf-render-slide.ts";
import {
  SLIDE_ASPECT_THRESHOLD,
  chooseTitle,
  removeFileIfExists,
  safeMeta,
} from "./pdf-render-shared.ts";

interface RenderOpts {
  url: string;
  slugDir: string;
  /** Slug name — used as the prefix for per-figure / per-slide files. */
  slug: string;
}

interface DownloadOk {
  ok: true;
  pdfPath: string;
  pdfBytes: Buffer;
}

interface DownloadFail {
  ok: false;
  stub: Result;
}

interface LoadOk {
  ok: true;
  doc: mupdf.PDFDocument;
}

interface LoadFail {
  ok: false;
  stub: Result;
}

/**
 * Failure modes returned as `makeStub` with a typed flag:
 *
 *   _default-pdf-fetch-failed   — curl couldn't download the PDF.
 *   _default-pdf-corrupt        — mupdf threw on load.
 *   _default-pdf-encrypted      — password-protected; cannot process.
 *
 * Slide-shape rendering failures and Marker extraction failures are
 * handled inside their respective sub-modules.
 */
export function renderPdfFromUrl(opts: RenderOpts): Result {
  const download = downloadPdf(opts);
  if (!download.ok) return download.stub;

  const loaded = loadPdf(opts, download);
  if (!loaded.ok) return loaded.stub;

  return dispatchByShape(opts, download.pdfPath, download.pdfBytes.length, loaded.doc);
}

// ---------------------------------------------------------------------------
// Step 1: download
// ---------------------------------------------------------------------------

const CURL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";

/** Minimum byte count for a downloaded PDF to be plausibly real. */
const MIN_PLAUSIBLE_PDF_BYTES = 64;

function downloadPdf(opts: RenderOpts): DownloadOk | DownloadFail {
  const pdfPath = join(opts.slugDir, `${opts.slug}.pdf`);
  try {
    execFileSync(
      "curl",
      [
        "-sfL",
        "--max-time", "60",
        "-A", CURL_USER_AGENT,
        "-H", "Accept: application/pdf,*/*;q=0.8",
        "-o", pdfPath,
        opts.url,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch (e) {
    return {
      ok: false,
      stub: makeStub({
        url: opts.url,
        module: "_default",
        kind: "pdf-fetch-failed",
        title: "PDF download failed",
        summary: `curl failed to download the PDF`,
        advice: "The PDF URL didn't respond. Check the URL in a browser; if it loads there, retry the fetch.",
        errorDetail: e instanceof Error ? e.message.slice(0, 500) : String(e),
      }),
    };
  }
  if (!existsSync(pdfPath) || statSync(pdfPath).size < MIN_PLAUSIBLE_PDF_BYTES) {
    return {
      ok: false,
      stub: makeStub({
        url: opts.url,
        module: "_default",
        kind: "pdf-fetch-failed",
        title: "PDF download empty",
        summary: `curl produced an empty or implausibly-small file`,
        advice: "The PDF URL responded but the body was empty. Probable redirect or auth wall.",
      }),
    };
  }
  return { ok: true, pdfPath, pdfBytes: readFileSync(pdfPath) };
}

// ---------------------------------------------------------------------------
// Step 2: load + validate
// ---------------------------------------------------------------------------

function loadPdf(opts: RenderOpts, download: DownloadOk): LoadOk | LoadFail {
  let doc: mupdf.PDFDocument;
  try {
    doc = mupdf.Document.openDocument(download.pdfBytes, "application/pdf") as mupdf.PDFDocument;
  } catch (e) {
    removeFileIfExists(download.pdfPath);
    return {
      ok: false,
      stub: makeStub({
        url: opts.url,
        module: "_default",
        kind: "pdf-corrupt",
        title: "PDF corrupt or unparseable",
        summary: `mupdf failed to open the document`,
        advice: "The downloaded bytes don't parse as a valid PDF. Re-download via a browser and inspect.",
        errorDetail: e instanceof Error ? e.message.slice(0, 500) : String(e),
      }),
    };
  }
  if (doc.needsPassword()) {
    removeFileIfExists(download.pdfPath);
    return {
      ok: false,
      stub: makeStub({
        url: opts.url,
        module: "_default",
        kind: "pdf-encrypted",
        title: "PDF requires a password",
        summary: `the document is password-protected; pages cannot be processed`,
        advice:
          "PDF is encrypted. We don't process encrypted PDFs (no place to store the password securely). " +
          "Decrypt the PDF locally and host the unencrypted version, or accept the stub.",
      }),
    };
  }
  return { ok: true, doc };
}

// ---------------------------------------------------------------------------
// Step 3: classify shape + dispatch
// ---------------------------------------------------------------------------

interface PdfMeta {
  pageCount: number;
  pageWidthPt: number;
  pageHeightPt: number;
  aspectRatio: number;
  meta: Record<string, string>;
  titleLine: string;
}

function dispatchByShape(
  opts: RenderOpts,
  pdfPath: string,
  pdfSize: number,
  doc: mupdf.PDFDocument,
): Result {
  const m = readPdfMetadata(opts.slug, doc);

  if (m.aspectRatio > SLIDE_ASPECT_THRESHOLD) {
    return composeSlideContent({
      url: opts.url,
      slugDir: opts.slugDir,
      slug: opts.slug,
      titleLine: m.titleLine,
      meta: m.meta,
      pageCount: m.pageCount,
      pageWidthPt: m.pageWidthPt,
      pageHeightPt: m.pageHeightPt,
      aspectRatio: m.aspectRatio,
      pdfSize,
      doc,
    });
  }

  return composePaperContent({
    url: opts.url,
    slugDir: opts.slugDir,
    slug: opts.slug,
    titleLine: m.titleLine,
    meta: m.meta,
    pageCount: m.pageCount,
    pageWidthPt: m.pageWidthPt,
    pageHeightPt: m.pageHeightPt,
    aspectRatio: m.aspectRatio,
    pdfSize,
    pdfPath,
  });
}

function readPdfMetadata(slug: string, doc: mupdf.PDFDocument): PdfMeta {
  const pageCount = doc.countPages();
  const meta: Record<string, string> = {
    title: safeMeta(doc, "info:Title"),
    author: safeMeta(doc, "info:Author"),
    subject: safeMeta(doc, "info:Subject"),
    keywords: safeMeta(doc, "info:Keywords"),
    creator: safeMeta(doc, "info:Creator"),
    producer: safeMeta(doc, "info:Producer"),
    format: safeMeta(doc, "format"),
    creationDate: safeMeta(doc, "info:CreationDate"),
    modDate: safeMeta(doc, "info:ModDate"),
  };
  const page0 = doc.loadPage(0);
  const bounds = page0.getBounds();
  const pageWidthPt = bounds[2] - bounds[0];
  const pageHeightPt = bounds[3] - bounds[1];
  return {
    pageCount,
    pageWidthPt,
    pageHeightPt,
    aspectRatio: pageWidthPt / pageHeightPt,
    meta,
    // Caller may override post body-extraction (see pdf-render-paper.ts
    // `resolveTitle`). At dispatch time this is the PDF-info best-effort.
    titleLine: chooseTitle(meta, slug),
  };
}
