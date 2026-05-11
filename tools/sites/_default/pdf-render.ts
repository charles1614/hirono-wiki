/**
 * PDF page-rendering pipeline. Hooks into `_default`'s non-HTML
 * detection path (P-20) — when curl returns a `Content-Type:
 * application/pdf` or `%PDF-` magic-bytes body, we pivot from the
 * stub-only path to a render path that produces an image-bearing
 * markdown document:
 *
 *   <slugDir>/
 *     content.md             ← §2 frontmatter + one ![Page N](...) per page
 *     <slug>-images/
 *       page-001.png
 *       page-002.png
 *       ...
 *     source.json            ← (written by writeRawArchive afterward)
 *
 * Engine: `mupdf` (npm) — official Artifex WASM bindings, identical
 * render output to pymupdf and `pdftoppm` for text-heavy PDFs at
 * 150 DPI. No system dependencies.
 *
 * See P-36 in `Meta/site-handling-patterns.md` for the full pattern
 * write-up + design rationale.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import * as mupdf from "mupdf";

import type { Result } from "../_shared/types.ts";
import { makeStub } from "../_shared/stub.ts";

/**
 * Render DPI. 150 DPI on a US-letter page (8.5×11") yields a
 * 1275×1650 PNG — readable at native size on a typical laptop
 * display, sharp under 2× zoom. Lower (72 DPI) is too soft for body
 * text; higher (300 DPI) is publication-quality but doubles file
 * size with no readability gain on screen.
 */
const RENDER_DPI = 150;

/**
 * Page-count threshold above which we emit a `_default-pdf-large`
 * flag. We still render every page — the threshold is just a signal
 * to the operator (and to bulk-fetch metrics) that this slug took
 * disproportionate disk space.
 */
const LARGE_PAGE_COUNT = 50;

interface RenderOpts {
  url: string;
  slugDir: string;
  /** Slug name — used as the prefix for the per-page image filenames. */
  slug: string;
}

/**
 * Render the PDF at `url` (already known to be a PDF — caller did
 * the Content-Type / magic-bytes detection). Returns a Result that
 * the caller can pass to writeRawArchive.
 *
 * Failure modes return `makeStub` with a typed flag:
 *
 *   _default-pdf-encrypted  — password-protected; we don't render
 *   _default-pdf-corrupt    — mupdf threw on load (malformed PDF)
 *   _default-pdf-fetch-failed — curl couldn't download the PDF
 */
export function renderPdfFromUrl(opts: RenderOpts): Result {
  const { url, slugDir, slug } = opts;
  const imagesDir = join(slugDir, `${slug}-images`);

  // Step 1: download the PDF to disk in binary mode. We can't reuse
  // _default's plainFetch result because that decoded as utf-8 and
  // corrupts the binary stream.
  const pdfPath = join(slugDir, `${slug}.pdf`);
  try {
    execFileSync(
      "curl",
      [
        "-sfL",
        "--max-time", "60",
        "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
        "-H", "Accept: application/pdf,*/*;q=0.8",
        "-o", pdfPath,
        url,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch (e) {
    return makeStub({
      url,
      module: "_default",
      kind: "pdf-fetch-failed",
      title: "PDF download failed",
      summary: `curl failed to download the PDF`,
      advice: "The PDF URL didn't respond. Check the URL in a browser; if it loads there, retry the fetch.",
      errorDetail: e instanceof Error ? e.message.slice(0, 500) : String(e),
    });
  }
  if (!existsSync(pdfPath) || statSync(pdfPath).size < 64) {
    return makeStub({
      url,
      module: "_default",
      kind: "pdf-fetch-failed",
      title: "PDF download empty",
      summary: `curl produced an empty or implausibly-small file`,
      advice: "The PDF URL responded but the body was empty. Probable redirect or auth wall.",
    });
  }

  const pdfBytes = readFileSync(pdfPath);
  const pdfSize = pdfBytes.length;

  // Step 2: load via mupdf. Detect encryption + corruption.
  let doc: mupdf.PDFDocument;
  try {
    doc = mupdf.Document.openDocument(pdfBytes, "application/pdf") as mupdf.PDFDocument;
  } catch (e) {
    cleanupTempPdf(pdfPath);
    return makeStub({
      url,
      module: "_default",
      kind: "pdf-corrupt",
      title: "PDF corrupt or unparseable",
      summary: `mupdf failed to open the document`,
      advice: "The downloaded bytes don't parse as a valid PDF. Re-download via a browser and inspect.",
      errorDetail: e instanceof Error ? e.message.slice(0, 500) : String(e),
    });
  }
  if (doc.needsPassword()) {
    cleanupTempPdf(pdfPath);
    return makeStub({
      url,
      module: "_default",
      kind: "pdf-encrypted",
      title: "PDF requires a password",
      summary: `the document is password-protected; pages cannot be rendered`,
      advice:
        "PDF is encrypted. We don't render encrypted PDFs (no place to store the password securely). " +
        "Decrypt the PDF locally and host the unencrypted version, or accept the stub.",
    });
  }

  // Step 3: extract metadata.
  const pageCount = doc.countPages();
  const meta = {
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
  // Sample page-0 dimensions for the metadata callout. Pages within
  // a single PDF are usually uniform; if not, the callout is just an
  // approximation, which is fine.
  const page0 = doc.loadPage(0);
  const bounds = page0.getBounds();
  const pageWidthPt = bounds[2] - bounds[0];
  const pageHeightPt = bounds[3] - bounds[1];
  const pageWidthPx = Math.round(pageWidthPt * RENDER_DPI / 72);
  const pageHeightPx = Math.round(pageHeightPt * RENDER_DPI / 72);

  // Step 4: render each page to PNG.
  mkdirSync(imagesDir, { recursive: true });
  const matrix = mupdf.Matrix.scale(RENDER_DPI / 72, RENDER_DPI / 72);
  const renderedFiles: string[] = [];
  const renderErrors: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    try {
      const p = doc.loadPage(i);
      const pix = p.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
      const filename = `page-${pad3(i + 1)}.png`;
      writeFileSync(join(imagesDir, filename), pix.asPNG());
      renderedFiles.push(filename);
    } catch (e) {
      renderErrors.push(`page ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // Keep the source PDF on disk. The rendered PNGs are for visual
  // reference (inline-markdown / Lark sync); the PDF is for ingestion
  // — Claude (and other modern LLMs with PDF tool support) can read
  // a PDF directly far more efficiently than vision-mode reading of
  // N page screenshots. Half the arxiv ingest pool surfaced this gap
  // in the Day-1 batch (commit 4ea99fd): the rendered-PNG output is
  // useless to the LLM during ingestion. By keeping the PDF the
  // operator and the ingester both have the option.

  if (renderedFiles.length === 0) {
    // mupdf opened the doc but couldn't render any page. PDF stays —
    // the LLM can still read it via direct PDF input even when the
    // visual render path errors out.
    return makeStub({
      url,
      module: "_default",
      kind: "pdf-corrupt",
      title: "PDF rendering failed",
      summary: `mupdf opened the document but every page render threw`,
      advice: "Document is parseable but page-rendering hit errors. May be a corrupt page tree. The PDF itself is preserved at `<slug>.pdf` for direct LLM reading.",
      errorDetail: renderErrors.slice(0, 5).join("\n"),
    });
  }

  // Step 5: compose the markdown body.
  const titleLine = chooseTitle(meta, slug);
  const lines: string[] = [];
  lines.push(`# ${titleLine}`);
  lines.push("");
  lines.push(`> 原文链接: ${url}`);
  lines.push(`> Local PDF: \`${slug}.pdf\` (preserved alongside this content.md for direct LLM ingestion)`);
  lines.push(`> Format: PDF, ${pageCount} page${pageCount === 1 ? "" : "s"} · ${formatBytes(pdfSize)} · ${pageWidthPx}×${pageHeightPx} px @ ${RENDER_DPI} DPI (rendered)`);
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
  for (let i = 0; i < renderedFiles.length; i++) {
    lines.push(`![Page ${i + 1}](${slug}-images/${renderedFiles[i]})`);
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(`*End of document — ${pageCount} page${pageCount === 1 ? "" : "s"} rendered to PNG at ${RENDER_DPI} DPI.*`);
  lines.push("");

  const flags: string[] = ["pdf-rendered"];
  if (pageCount >= LARGE_PAGE_COUNT) flags.push("_default-pdf-large");
  if (renderErrors.length > 0) flags.push("_default-pdf-render-partial");

  return {
    markdown: lines.join("\n"),
    title: titleLine,
    images: renderedFiles.map((f) => `${slug}-images/${f}`),
    metadata: {
      source: "_default-pdf",
      title: titleLine,
      pdf_local_path: `${slug}.pdf`,
      pdf_metadata: meta,
      page_count: pageCount,
      pages_rendered: renderedFiles.length,
      page_width_px: pageWidthPx,
      page_height_px: pageHeightPx,
      render_dpi: RENDER_DPI,
      pdf_size_bytes: pdfSize,
    },
    flags,
    notes: [
      `_default-pdf: ${pageCount} page(s) rendered at ${RENDER_DPI} DPI, ${formatBytes(pdfSize)} source PDF` +
      (renderErrors.length > 0 ? `, ${renderErrors.length} render error(s)` : ""),
    ],
    error_detail: renderErrors.length > 0 ? renderErrors.slice(0, 5).join("\n") : undefined,
  };
}

function safeMeta(doc: mupdf.PDFDocument, key: string): string {
  try {
    const v = doc.getMetaData(key);
    return typeof v === "string" ? v.trim() : "";
  } catch { return ""; }
}

function chooseTitle(meta: Record<string, string>, fallback: string): string {
  if (meta.title && meta.title.length > 0) return meta.title;
  if (meta.subject && meta.subject.length > 0) return meta.subject;
  return `PDF: ${fallback}`;
}

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * PDF date strings look like `D:20240819163025+02'00'`. Format as
 * `2024-08-19 16:30 UTC+02` for the metadata callout. Falls back to
 * the raw string on parse failure.
 */
function formatPdfDate(raw: string): string {
  const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return raw;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

function cleanupTempPdf(path: string): void {
  try { unlinkSync(path); } catch { /* best-effort */ }
}
