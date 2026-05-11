/**
 * Shape-aware PDF pipeline. Triggered when `_default`'s non-HTML
 * detection (P-20) sees a `Content-Type: application/pdf` or `%PDF-`
 * magic-bytes body. Branches on page aspect ratio:
 *
 *   - **Paper-shape** (portrait, aspect ≤ 1.4) — extract body text via
 *     pdftotext + embedded figures via pdfimages; emit a TEXT-FIRST
 *     content.md with figures inlined. arxiv papers route through a
 *     dedicated HTML-first path in `tools/sites/arxiv/` (figures get
 *     captions); this generic path is the fallback for any other
 *     paper-shaped PDF (intuitionlabs.ai, openreview.net, conference
 *     proceedings, internal company reports).
 *
 *   - **Slide-shape** (landscape, aspect > 1.4) — DO NOT parse. Slide
 *     decks are dense images-per-slide; OCR'ing 40 slides into prose
 *     produces noise. Emit a metadata-only stub; the PDF stays on disk
 *     for human / LLM-vision review.
 *
 * Output layout:
 *
 *   <slugDir>/
 *     content.md             ← §2 frontmatter + body text + ![figure]() inlines
 *     <slug>.pdf             ← preserved source binary
 *     <slug>-figures/        ← embedded figures extracted via pdfimages
 *       fig-NNN.png
 *       ...
 *
 * Engines:
 *   - `mupdf` (npm, WASM) — load PDF, page dimensions, encryption check
 *   - `pdftotext -layout` (poppler) — body text extraction
 *   - `pdfimages -all -p` (poppler) — embedded figure extraction
 *
 * See P-36 in `Meta/site-handling-patterns.md` for the full pattern
 * write-up + design rationale.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import * as mupdf from "mupdf";

import type { Result } from "../_shared/types.ts";
import { makeStub } from "../_shared/stub.ts";

/**
 * Aspect-ratio threshold for slide-deck classification. Page dimensions
 * are width/height in PostScript points (1/72"). Heuristic ranges:
 *
 *   < 1.0   →  portrait (paper, A4 = 0.71, US-letter = 0.77)
 *   1.0-1.4 →  square-ish (rare; treated as paper)
 *   > 1.4   →  landscape (slide deck — 16:9 = 1.78, 4:3 = 1.33 is borderline)
 *
 * The 4:3 case at 1.33 is genuinely ambiguous; we treat it as paper so
 * we don't accidentally skip a 4:3 paper. 16:9 slide decks (the modern
 * default) are well above 1.4.
 */
const SLIDE_ASPECT_THRESHOLD = 1.4;

/**
 * Minimum size for an extracted embedded image to count as a "real
 * figure" worth inlining. Below this, the image is usually a logo,
 * icon, ruler glyph, or watermark — pdf-embedded raster noise that
 * pollutes the content.md if included.
 */
const MIN_FIGURE_BYTES = 30 * 1024; // 30 KB

interface RenderOpts {
  url: string;
  slugDir: string;
  /** Slug name — used as the prefix for the per-figure image filenames. */
  slug: string;
}

/**
 * Process a PDF at `url` into a §2-shaped content.md. Returns a Result
 * the caller passes to writeRawArchive.
 *
 * Failure modes return `makeStub` with a typed flag:
 *
 *   _default-pdf-fetch-failed   — curl couldn't download the PDF
 *   _default-pdf-corrupt        — mupdf threw on load
 *   _default-pdf-encrypted      — password-protected
 *   _default-pdf-slide-deck     — landscape; intentional stub (not an error)
 */
export function renderPdfFromUrl(opts: RenderOpts): Result {
  const { url, slugDir, slug } = opts;

  // Step 1: download the PDF to disk in binary mode.
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

  // Step 2: load via mupdf — detect encryption + corruption.
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
      summary: `the document is password-protected; pages cannot be processed`,
      advice:
        "PDF is encrypted. We don't process encrypted PDFs (no place to store the password securely). " +
        "Decrypt the PDF locally and host the unencrypted version, or accept the stub.",
    });
  }

  // Step 3: extract metadata + classify shape.
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
  const page0 = doc.loadPage(0);
  const bounds = page0.getBounds();
  const pageWidthPt = bounds[2] - bounds[0];
  const pageHeightPt = bounds[3] - bounds[1];
  const aspectRatio = pageWidthPt / pageHeightPt;
  // Title fallback: PDF info-title is often empty for arxiv/LaTeX-built
  // PDFs. We'll defer the final title decision until after body
  // extraction so we can pull from the body's first non-empty line
  // when the info-title is missing.
  let titleLine = chooseTitle(meta, slug);

  // Step 4: branch on shape.
  if (aspectRatio > SLIDE_ASPECT_THRESHOLD) {
    return composeSlideContent({
      url, slugDir, slug, titleLine, meta,
      pageCount, pageWidthPt, pageHeightPt, aspectRatio, pdfSize, doc,
    });
  }
  return composePaperContent({
    url, slugDir, slug, titleLine, meta,
    pageCount, pageWidthPt, pageHeightPt, aspectRatio, pdfSize, pdfPath,
  });
}

// ---------------------------------------------------------------------------
// Paper-shape path: pdftotext body + pdfimages figures + assembled markdown
// ---------------------------------------------------------------------------

interface PaperOpts {
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
  pdfPath: string;
}

function composePaperContent(opts: PaperOpts): Result {
  const { url, slugDir, slug, meta, pageCount, pdfSize, pdfPath } = opts;
  let titleLine = opts.titleLine;
  const figuresDir = join(slugDir, `${slug}-figures`);
  // The previous fetcher rendered full-page PNGs into `<slug>-images/`.
  // The new paper path doesn't use those — text + figures replace
  // them. Drop the dir on refetch so the slug's filesystem matches
  // what content.md actually references.
  const legacyImagesDir = join(slugDir, `${slug}-images`);
  if (existsSync(legacyImagesDir)) {
    try { rmSync(legacyImagesDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }

  // Primary extractor: Marker (Datalab) when HIRONO_USE_MARKER=1. Marker
  // is OmniDocBench-grade for scientific papers — handles 2-column
  // layout, inline LaTeX math, section headings, and figure positioning
  // dramatically better than pdftotext. The cost: ~13 min/paper on Mac
  // CPU (much faster on CUDA). Opt-in so bulk fetches stay fast.
  //
  // Fallback: pdftotext + cleanPdfText post-processing. Default mode
  // (no -layout) handles 2-column reading order; the cleanup pass
  // drops chart-text intrusions, footers, letter-spacing artifacts.
  // Trades quality for speed: ~1 sec/paper vs Marker's 13 min, but
  // complex layouts (inline figures, attention-mask diagrams) come
  // out garbled.
  let bodyText = "";
  let bodyImages: string[] = [];
  let textExtractFailed = false;
  let markerUsed = false;
  let markerSkipReason = "";

  const useMarker = process.env.HIRONO_USE_MARKER === "1";
  if (useMarker) {
    const markerResult = tryExtractWithMarker(pdfPath, slugDir, slug, figuresDir);
    if (markerResult.ok) {
      bodyText = markerResult.body;
      bodyImages = markerResult.imageFiles;
      if (markerResult.title) titleLine = markerResult.title;
      markerUsed = true;
    } else {
      markerSkipReason = markerResult.reason;
    }
  } else {
    markerSkipReason = "HIRONO_USE_MARKER not set";
  }

  if (!markerUsed) {
    // Fallback path: pdftotext default mode + cleanPdfText.
    try {
      const raw = execFileSync(
        "pdftotext",
        ["-nopgbrk", "-enc", "UTF-8", pdfPath, "-"],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      );
      bodyText = cleanPdfText(raw);
    } catch (e) {
      textExtractFailed = true;
      bodyText = "";
    }
  }

  // Title fallback: if PDF info-title is empty (very common for
  // LaTeX-built arxiv PDFs), extract from the body's pre-cleanup raw
  // dump. The raw first non-empty line is usually the paper's actual
  // title, post letter-spacing normalization. Skip when Marker already
  // produced a title (it parses the H1 directly).
  if (
    !markerUsed &&
    bodyText.length > 0 &&
    (titleLine === `PDF: ${slug}` || titleLine === slug)
  ) {
    // Look at the raw extraction (before cleanPdfText skipped cover-page
    // sections). Pull title from the first 5 non-empty lines.
    let rawForTitle = "";
    try {
      rawForTitle = execFileSync(
        "pdftotext",
        ["-nopgbrk", "-enc", "UTF-8", "-l", "1", pdfPath, "-"],
        { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      );
    } catch { /* best-effort */ }
    if (rawForTitle) {
      const candidateLines = rawForTitle
        .split(/\r?\n/)
        .map((l) => l.trim())
        // Apply same letter-spacing fix the body got.
        .map((l) => l.replace(/\b([A-Z]) ([A-Z]{2,})\b/g, (_m, h, t) => h + t).replace(/\b([A-Z]) ([A-Z]{2,})\b/g, (_m, h, t) => h + t))
        .filter((l) => l.length >= 8 && l.length <= 200)
        // Skip lines that look like arxiv banners / dates / footnotes.
        .filter((l) => !/^arXiv:/i.test(l))
        .filter((l) => !/^(\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4})$/.test(l));
      if (candidateLines.length > 0) {
        // Heuristic: a title is usually one or two short lines at the top.
        // If line 1 ends in a colon, line 2 is the rest (e.g.
        // "Beyond the Buzz: / A Pragmatic Take on Inference Disaggregation").
        const first = candidateLines[0];
        const second = candidateLines[1];
        if (second && first.endsWith(":")) {
          titleLine = `${first} ${second}`.replace(/\s+/g, " ");
        } else {
          titleLine = first;
        }
      }
    }
  }

  // Clean stale pdfimages-extracted figures from prior refetches.
  // We ONLY remove files matching the pdfimages naming convention
  // (`fig-PPP-NNN.{png,jpg,...}`) — other tools (arxiv-fetch-figures
  // writes `figure-NNN.png` with captions, Marker writes
  // `marker-page-NNN-PPP.{jpeg,png}`) layer their output into the same
  // dir and we must not clobber theirs.
  if (existsSync(figuresDir)) {
    for (const f of readdirSync(figuresDir)) {
      if (/^fig-\d{3}-\d+\.(png|jpg|jpeg|tiff|gif|webp)$/i.test(f)) {
        try { unlinkSync(join(figuresDir, f)); } catch { /* best-effort */ }
      }
    }
  } else {
    mkdirSync(figuresDir, { recursive: true });
  }

  // When Marker already provided figures, skip pdfimages (Marker is
  // higher-quality + has proper figure-vs-decoration distinction).
  let figuresExtracted = 0;
  if (!markerUsed) {
    // Extract embedded figures via pdfimages. -all keeps original encoding;
    // -p prefixes filenames with the page number for traceability.
    try {
      execFileSync(
        "pdfimages",
        ["-all", "-p", pdfPath, join(figuresDir, "fig")],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
    } catch {
      // pdfimages can fail on heavily-vectorised PDFs (TikZ/PGF figures
      // aren't extractable as raster). Not fatal — the paper still has
      // its body text + the preserved PDF for vision-mode reading.
    }
  }

  // Filter to "real" figures: ≥ MIN_FIGURE_BYTES, and only the
  // pdfimages-naming-convention files (don't accidentally inline an
  // arxiv-HTML figure here — that's the Source-page author's choice).
  const pdfimagesName = /^fig-\d{3}-\d+\.(png|jpg|jpeg|tiff|gif|webp)$/i;
  const allFigs = existsSync(figuresDir)
    ? readdirSync(figuresDir)
      .filter((f) => pdfimagesName.test(f))
      .map((f) => ({ name: f, bytes: statSync(join(figuresDir, f)).size }))
      .filter((f) => f.bytes >= MIN_FIGURE_BYTES)
      .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  figuresExtracted = allFigs.length;

  // Drop the sub-MIN_FIGURE_BYTES pdfimages output (logos, icons,
  // page-decoration noise). Leave non-pdfimages files alone — they
  // were written by another tool (e.g. arxiv-fetch-figures).
  if (existsSync(figuresDir)) {
    for (const f of readdirSync(figuresDir)) {
      if (!pdfimagesName.test(f)) continue;
      if (allFigs.find((kept) => kept.name === f)) continue;
      try { unlinkSync(join(figuresDir, f)); } catch { /* best-effort */ }
    }
  }

  // Compose content.md.
  const lines: string[] = [];
  lines.push(`# ${titleLine}`);
  lines.push("");
  lines.push(`> 原文链接: ${url}`);
  lines.push(`> Local PDF: \`${slug}.pdf\` (preserved alongside this content.md for direct LLM ingestion)`);
  lines.push(`> Format: PDF · ${pageCount} page${pageCount === 1 ? "" : "s"} · ${formatBytes(pdfSize)} · paper-shape (aspect ${opts.aspectRatio.toFixed(2)})`);
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

  if (bodyText.trim().length > 0) {
    // Plain text body. Wrap into a fenced-text block? No — keep as raw
    // text so headings/lists get rendered. pdftotext output is usually
    // fine for prose; the LLM doing the ingest reads it as markdown.
    lines.push(bodyText.trimEnd());
    lines.push("");
  } else if (textExtractFailed) {
    lines.push("> ⚠️ Text extraction failed (`pdftotext` returned an error). The PDF itself is preserved at `" + slug + ".pdf` — read it directly for body text.");
    lines.push("");
  } else {
    lines.push("> ⚠️ No body text extracted. The PDF may be image-only / scanned; read `" + slug + ".pdf` directly.");
    lines.push("");
  }

  // Only emit the "## Extracted figures" appendix on the pdftotext
  // fallback path. Marker's output already references its own extracted
  // images inline at the right positions — appending another figures
  // list would duplicate.
  if (!markerUsed && allFigs.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## Extracted figures (${allFigs.length})`);
    lines.push("");
    lines.push(`*Embedded raster images ≥ ${Math.round(MIN_FIGURE_BYTES / 1024)} KB extracted via \`pdfimages\`. Filename suffix is \`-PPP-NNN\` where PPP = source page number. Vector figures (TikZ/PGF) are absent — read \`${slug}.pdf\` for those.*`);
    lines.push("");
    for (const fig of allFigs) {
      // pdfimages -p produces names like fig-001-0.png where 001 = page,
      // 0 = image-within-page-counter. Surface the page number in the alt.
      const m = fig.name.match(/-(\d{3})-\d+\./);
      const page = m ? parseInt(m[1], 10) : null;
      const alt = page ? `Embedded figure from page ${page}` : "Embedded figure";
      lines.push(`![${alt}](${slug}-figures/${fig.name})`);
      lines.push("");
    }
  }

  const flags: string[] = ["pdf-paper"];
  if (markerUsed) flags.push("pdf-marker");
  if (textExtractFailed) flags.push("_default-pdf-text-extract-failed");
  if (!markerUsed && allFigs.length === 0) flags.push("_default-pdf-no-figures-extracted");

  const allImages = markerUsed
    ? bodyImages.map((f) => `${slug}-figures/${f}`)
    : allFigs.map((f) => `${slug}-figures/${f.name}`);

  return {
    markdown: lines.join("\n"),
    title: titleLine,
    images: allImages,
    metadata: {
      source: "_default-pdf",
      title: titleLine,
      shape: "paper",
      extractor: markerUsed ? "marker" : "pdftotext",
      marker_skip_reason: markerUsed ? undefined : markerSkipReason || undefined,
      pdf_local_path: `${slug}.pdf`,
      pdf_metadata: meta,
      page_count: pageCount,
      aspect_ratio: Math.round(opts.aspectRatio * 100) / 100,
      figures_extracted: markerUsed ? bodyImages.length : figuresExtracted,
      pdf_size_bytes: pdfSize,
      body_text_chars: bodyText.length,
    },
    flags,
    notes: [
      `_default-pdf paper-shape: ${pageCount} page(s), ${bodyText.length} text chars, ${allFigs.length} figure(s), ${formatBytes(pdfSize)} source PDF`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Slide-deck path: stub content.md + preserved PDF, no rendering
// ---------------------------------------------------------------------------

interface SlideOpts {
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

/**
 * Slide-deck path: each "page" IS the content unit (one slide per page,
 * with overlaid text + graphics that don't separate cleanly into text +
 * figures). Render each slide to PNG and inline as `![Slide N](...)` so
 * the markdown body is a sequential visual walkthrough — the natural
 * representation for a presentation. The PDF itself is also preserved
 * for direct viewing.
 *
 * Slide DPI: 120 (lower than papers' 150). Slides at 16:9 / 4:3 are
 * already wide pixel-dimensions at 120 DPI — 16:9 at 960×540 pts
 * renders to ~1600×900 px, which is plenty readable without ballooning
 * the disk footprint when each deck has 40+ slides.
 */
function composeSlideContent(opts: SlideOpts): Result {
  const { url, slugDir, slug, titleLine, meta, pageCount, pdfSize, doc } = opts;
  const slidesDir = join(slugDir, `${slug}-slides`);
  // Drop legacy dirs from prior pipeline versions (the old generic
  // page-rendering wrote `-images/`; the paper path doesn't apply).
  const legacyImagesDir = join(slugDir, `${slug}-images`);
  if (existsSync(legacyImagesDir)) {
    try { rmSync(legacyImagesDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
  const legacyFiguresDir = join(slugDir, `${slug}-figures`);
  if (existsSync(legacyFiguresDir)) {
    try { rmSync(legacyFiguresDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }

  // Clean any stale slide renderings from a prior fetch.
  if (existsSync(slidesDir)) {
    try { rmSync(slidesDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
  mkdirSync(slidesDir, { recursive: true });

  const SLIDE_DPI = 120;
  const matrix = mupdf.Matrix.scale(SLIDE_DPI / 72, SLIDE_DPI / 72);
  const renderedFiles: string[] = [];
  const renderErrors: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    try {
      const p = doc.loadPage(i);
      const pix = p.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
      const filename = `slide-${pad3(i + 1)}.png`;
      writeFileSync(join(slidesDir, filename), pix.asPNG());
      renderedFiles.push(filename);
    } catch (e) {
      renderErrors.push(`slide ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (renderedFiles.length === 0) {
    return makeStub({
      url,
      module: "_default",
      kind: "pdf-corrupt",
      title: "Slide-deck rendering failed",
      summary: `mupdf opened the document but every slide render threw`,
      advice: "Slide-shape PDF parseable but rendering hit errors. The PDF itself is preserved at `" + slug + ".pdf` for direct viewing.",
      errorDetail: renderErrors.slice(0, 5).join("\n"),
    });
  }

  // Compose content.md: header + each slide inlined.
  const slideWidthPx = Math.round(opts.pageWidthPt * SLIDE_DPI / 72);
  const slideHeightPx = Math.round(opts.pageHeightPt * SLIDE_DPI / 72);

  const lines: string[] = [];
  lines.push(`# ${titleLine}`);
  lines.push("");
  lines.push(`> 原文链接: ${url}`);
  lines.push(`> Local PDF: \`${slug}.pdf\` (preserved alongside this content.md)`);
  lines.push(`> Format: PDF · ${pageCount} slide${pageCount === 1 ? "" : "s"} · ${formatBytes(pdfSize)} · slide-deck shape (aspect ${opts.aspectRatio.toFixed(2)}) · rendered at ${slideWidthPx}×${slideHeightPx} px / ${SLIDE_DPI} DPI`);
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
    lines.push(`![Slide ${i + 1}](${slug}-slides/${renderedFiles[i]})`);
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(`*End of deck — ${pageCount} slide${pageCount === 1 ? "" : "s"}. PDF preserved at \`${slug}.pdf\` for direct viewing.*`);
  lines.push("");

  const flags: string[] = ["pdf-slide-deck"];
  if (renderErrors.length > 0) flags.push("_default-pdf-render-partial");

  return {
    markdown: lines.join("\n"),
    title: titleLine,
    images: renderedFiles.map((f) => `${slug}-slides/${f}`),
    metadata: {
      source: "_default-pdf",
      title: titleLine,
      shape: "slide-deck",
      pdf_local_path: `${slug}.pdf`,
      pdf_metadata: meta,
      page_count: pageCount,
      slides_rendered: renderedFiles.length,
      slide_width_px: slideWidthPx,
      slide_height_px: slideHeightPx,
      render_dpi: SLIDE_DPI,
      aspect_ratio: Math.round(opts.aspectRatio * 100) / 100,
      pdf_size_bytes: pdfSize,
    },
    flags,
    notes: [
      `_default-pdf slide-deck: ${pageCount} slide(s) rendered at ${SLIDE_DPI} DPI, ${formatBytes(pdfSize)} source PDF` +
      (renderErrors.length > 0 ? `, ${renderErrors.length} render error(s)` : ""),
    ],
    error_detail: renderErrors.length > 0 ? renderErrors.slice(0, 5).join("\n") : undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Clean raw `pdftotext -layout` output into something readable as markdown.
 *
 * pdftotext preserves the PDF's column-based spatial layout — centered
 * title blocks get ~50 spaces of leading indent, page-footer text appears
 * mid-flow, the arxiv vertical banner shows up as a random line. The raw
 * dump is technically correct but unreadable.
 *
 * Passes (order matters):
 *   1. Per-line trim (drops the centered-text indent + trailing whitespace).
 *   2. Drop arxiv vertical-banner lines (`arXiv:NNNN.NNNNNvN [cs.XX] ...`).
 *   3. Drop page-footer boilerplate (`Preprint. Under review.`, conference
 *      copyright lines, bare page numbers).
 *   4. Re-join hyphenated line-breaks (`infer-\nence` → `inference`) inside
 *      paragraphs — they're an artifact of PDF line-wrapping, not real
 *      hyphenation.
 *   5. Collapse runs of 3+ blank lines into 2 (preserve paragraph breaks).
 *   6. Strip leading + trailing blank lines from the whole document.
 */
function cleanPdfText(raw: string): string {
  // Pass 1: per-line trim
  let lines = raw.split(/\r?\n/).map((line) => line.replace(/\s+$/, "").replace(/^\s+/, ""));

  // Pass 1.5: collapse letter-spaced text. PDF fonts with character
  // tracking render section headers like "FLUX" as "F LUX" (the font
  // inserts wide kerning between letters and pdftotext interprets each
  // gap as a word break). Examples: "A BSTRACT" / "P REPRINT" /
  // "S OFTWARE" / "F LUX". Normalize: a single uppercase letter
  // followed by space + 2+ uppercase letters → glue together.
  // Run the regex 2x because patterns like "P REPRINT" produce "PREPRINT"
  // on first pass, leaving "A PREPRINT" — and the next pattern like
  // "A P REPRINT" needs the second pass to fully resolve.
  for (let i = 0; i < 2; i++) {
    lines = lines.map((line) =>
      line.replace(/\b([A-Z]) ([A-Z]{2,})\b/g, (_m, head, tail) => head + tail),
    );
  }

  // Pass 2 + 3: drop boilerplate + chart-axis-label noise
  const DROP_PATTERNS: RegExp[] = [
    /^arXiv:\s*\d+\.\d+v?\d*\s*\[/i,           // arxiv banner
    /^Preprint\.\s*Under\s+review\.?\s*$/i,     // arxiv preprint footer
    /^Under\s+review\s+as\s+a\s+conference\s+paper/i,
    /^Published\s+as\s+a\s+conference\s+paper/i,
    /^Copyright\s+©?\s*\d{4}/i,                 // generic copyright
    /^\d{1,3}\s*$/,                             // bare page number
    /^\d+(\.\d+)?\s*$/,                         // chart-axis bare float (4.4, 0.8)
    /^Page\s+\d+\s+of\s+\d+$/i,                 // "Page N of M"
    /^\*+\s*$/,                                 // bare footnote marker "*" or "**"
    /^†+\s*$/,                                  // bare dagger footnote marker
    /^These\s+authors\s+contributed\s+equally/i, // common arxiv footnote
  ];
  lines = lines.filter((line) => !DROP_PATTERNS.some((re) => re.test(line)));

  // Pass 4: collapse line-wrap hyphenation. PDF line-breaks can hit two
  // shapes:
  //   - Syllable break: "infer-\nence"     → should be "inference"
  //   - Compound word:  "prefill-\nheavy"  → should be "prefill-heavy"
  // Disambiguating requires a dictionary; we don't have one. The safest
  // collapse is to keep the hyphen but remove the line break, joining the
  // tokens. That gives "infer-ence" (slightly ugly but readable) and
  // "prefill-heavy" (perfectly correct). Net win: real compound words
  // never get destroyed; the syllable-break case stays legible.
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (
      /[a-z]-$/.test(cur) &&  // ends in lowercase + hyphen
      next &&
      /^[a-z]/.test(next)     // next starts lowercase
    ) {
      merged.push(cur + next);  // keep the hyphen, drop the line break
      i++;
    } else {
      merged.push(cur);
    }
  }
  lines = merged;

  // Pass 4.5: drop chart-text intrusions. When pdftotext encounters an
  // embedded figure (bar chart, scatter plot, line graph), it extracts
  // the figure's axis labels + legend entries as text inline with the
  // surrounding prose. Symptoms: short non-sentence lines like
  // "Speedup", "EAGLE-2", "A100 PCIe TP communication", "Data scale"
  // appearing between paragraphs.
  //
  // Heuristic: split into blocks (separated by blank lines). Tag each
  // block as either prose (any line ends in .!?:; OR any line > 60 chars
  // OR matches a section/caption opener) or short-orphan (all lines ≤ 60
  // chars + no sentence-terminator). When 2+ consecutive short-orphan
  // blocks appear (the chart-cluster), drop them. Single short-orphan
  // blocks survive (they're plausibly figure captions or section
  // headings, which we keep).
  const SENTENCE_ENDERS = /[.!?:;]\s*$/;
  const SECTION_OR_CAPTION = /^(?:Figure|Table|Algorithm|Listing)\s+\d+[:.]|^\d+(?:\.\d+)?\s+[A-Z]|^[IVX]+\.\s+[A-Z]/;
  // English connective stop-words — these appear in prose but almost
  // never in chart-axis labels or figure legends. A line with 2+ of
  // these is overwhelmingly likely to be prose, even if it's long and
  // has no sentence-terminator (line-wrapped mid-sentence).
  const STOP_WORDS = new Set([
    "the", "a", "an", "of", "and", "to", "in", "is", "for", "with",
    "that", "this", "are", "on", "as", "be", "or", "not", "by", "from",
    "at", "we", "our", "their", "its", "it", "but", "if", "than", "have",
    "has", "can", "was", "were", "these", "those",
  ]);
  const hasStopWords = (s: string): boolean => {
    const tokens = s.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
    let count = 0;
    for (const t of tokens) {
      if (STOP_WORDS.has(t)) count++;
      if (count >= 2) return true;
    }
    return false;
  };
  type BlockKind = "prose" | "short-orphan" | "blank";
  const blocks: { kind: BlockKind; start: number; end: number }[] = [];
  let i2 = 0;
  while (i2 < lines.length) {
    if (lines[i2] === "") {
      let j = i2;
      while (j < lines.length && lines[j] === "") j++;
      blocks.push({ kind: "blank", start: i2, end: j });
      i2 = j;
      continue;
    }
    const start = i2;
    while (i2 < lines.length && lines[i2] !== "") i2++;
    const blockLines = lines.slice(start, i2);
    // A block is prose if ANY line in it shows prose-shape:
    //   - ends in sentence-terminator, OR
    //   - is long AND contains stop-words (line-wrapped mid-sentence), OR
    //   - matches section/caption opener
    const isProse = blockLines.some((l) =>
      SENTENCE_ENDERS.test(l) ||
      (l.length > 60 && hasStopWords(l)) ||
      SECTION_OR_CAPTION.test(l),
    );
    blocks.push({ kind: isProse ? "prose" : "short-orphan", start, end: i2 });
  }
  // Find runs of short-orphan blocks (each separated only by blank
  // blocks) and mark for drop when run length ≥ 2.
  const drop = new Set<number>();  // line indexes to delete
  for (let bi = 0; bi < blocks.length; bi++) {
    if (blocks[bi].kind !== "short-orphan") continue;
    let runEnd = bi;
    let count = 1;
    while (runEnd + 2 < blocks.length && blocks[runEnd + 1].kind === "blank" && blocks[runEnd + 2].kind === "short-orphan") {
      runEnd += 2;
      count++;
    }
    if (count >= 2) {
      for (let bk = bi; bk <= runEnd; bk++) {
        for (let li = blocks[bk].start; li < blocks[bk].end; li++) drop.add(li);
      }
      bi = runEnd;
    }
  }
  if (drop.size > 0) {
    lines = lines.filter((_, idx) => !drop.has(idx));
  }

  // Pass 5: drop the cover-page title block. Title + authors are already
  // in the frontmatter; the body should start at the actual content.
  // Look for the first line matching the canonical paper-section openers
  // ("Abstract", "1 Introduction", "I. INTRODUCTION", etc.) within the
  // first ~40 lines. If found, drop everything before it.
  const SECTION_OPENERS: RegExp[] = [
    /^Abstract$/,
    /^ABSTRACT$/,
    /^Introduction$/,
    /^1\s+Introduction$/,
    /^1\.\s+Introduction$/,
    /^I\.\s+INTRODUCTION$/i,
    /^Executive\s+Summary$/i,
  ];
  const HEAD_SEARCH_LIMIT = 40;
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, HEAD_SEARCH_LIMIT); i++) {
    if (SECTION_OPENERS.some((re) => re.test(lines[i]))) {
      startIdx = i;
      break;
    }
  }
  if (startIdx > 0) lines = lines.slice(startIdx);

  // Pass 6: collapse 3+ blank-line runs to 2 (paragraph break)
  let out = lines.join("\n").replace(/\n{3,}/g, "\n\n");

  // Pass 7: strip leading + trailing blank lines
  out = out.replace(/^\s*\n+/, "").replace(/\n+\s*$/, "\n");

  return out;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * PDF date strings look like `D:20240819163025+02'00'`. Format as
 * `2024-08-19 16:30` for the metadata callout. Falls back to the raw
 * string on parse failure.
 */
function formatPdfDate(raw: string): string {
  const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!m) return raw;
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
}

function cleanupTempPdf(path: string): void {
  try { unlinkSync(path); } catch { /* best-effort */ }
}

interface MarkerExtractResult {
  ok: boolean;
  body: string;
  imageFiles: string[];
  title?: string;
  reason: string;
}

/**
 * Run Marker (Datalab, `pip install marker-pdf`) over the PDF and parse
 * its output into our `<slug>-figures/` layout. Marker is OmniDocBench-
 * grade for scientific papers — it produces a publication-quality
 * markdown with LaTeX inline math, proper section headings, and figures
 * positioned at their reference points.
 *
 * Layout (Marker output):
 *   <tmpdir>/<basename>/
 *     <basename>.md             ← markdown body, references _page_*_*.{jpeg,png}
 *     _page_N_Figure_M.{jpeg,png}
 *     _page_N_Picture_M.{jpeg,png}
 *     <basename>_meta.json
 *
 * Our integration:
 *   - run `marker_single <pdf> --output_dir <tmp>`
 *   - read the .md, rewrite `![](_page_N_*)` → `![](<slug>-figures/marker-page-NNN-PPP.<ext>)`
 *   - copy image files to <slug>-figures/ with the renamed filenames
 *   - return body + image list
 *
 * Failure modes (return ok:false with a reason; caller falls back to pdftotext):
 *   - marker binary not on PATH ("marker-not-installed")
 *   - marker process failed ("marker-failed:<stderr-snippet>")
 *   - expected .md missing ("marker-output-missing")
 */
function tryExtractWithMarker(
  pdfPath: string,
  slugDir: string,
  slug: string,
  figuresDir: string,
): MarkerExtractResult {
  const empty: MarkerExtractResult = { ok: false, body: "", imageFiles: [], reason: "" };

  // Locate marker binary. Check PATH; absent → fall back.
  const which = spawnSync("which", ["marker_single"], { encoding: "utf8" });
  if (which.status !== 0 || !which.stdout.trim()) {
    return { ...empty, reason: "marker-not-installed" };
  }
  const markerBin = which.stdout.trim();

  // Run marker into a temp dir; it creates <tmp>/<basename>/ inside.
  const tmpDir = join(slugDir, ".marker-tmp");
  if (existsSync(tmpDir)) {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
  }
  mkdirSync(tmpDir, { recursive: true });

  const proc = spawnSync(
    markerBin,
    [pdfPath, "--output_dir", tmpDir],
    {
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
      // No timeout — Marker on Mac CPU can take 10-20 min per paper.
      // The fetch pipeline already has its own outer limits via the
      // operator workflow; we don't add another here.
    },
  );
  if (proc.status !== 0) {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
    const stderr = (proc.stderr || "").toString().slice(0, 200);
    return { ...empty, reason: `marker-failed:${stderr}` };
  }

  // Marker creates <tmpDir>/<basename>/ where basename = PDF stem without ext.
  const pdfBase = pdfPath.replace(/^.*\//, "").replace(/\.pdf$/i, "");
  const markerOutDir = join(tmpDir, pdfBase);
  const markerMdPath = join(markerOutDir, `${pdfBase}.md`);
  if (!existsSync(markerMdPath)) {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }
    return { ...empty, reason: "marker-output-missing" };
  }

  let markerMd = readFileSync(markerMdPath, "utf8");

  // Parse title from H1 (first line `# Title`). Marker emits the paper
  // title as the first H1. We strip it from the body since pdf-render
  // composes its own H1 from titleLine.
  let title: string | undefined;
  const h1Match = markerMd.match(/^#\s+(.+?)\s*$/m);
  if (h1Match) {
    title = h1Match[1].replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    // Remove ONLY the first H1 line (and any blank line right after).
    markerMd = markerMd.replace(/^#\s+.+?\s*$\n?(?:\n)?/m, "");
  }

  // Copy + rename Marker's image files into <slug>-figures/.
  // Marker emits `_page_N_Figure_M.jpeg`, `_page_N_Picture_M.jpeg`.
  // Rename to `marker-page-NNN-MMM.<ext>` so they sort by page +
  // don't collide with our other figure naming conventions (pdfimages
  // `fig-PPP-NNN.png` / arxiv-fetch-figures `figure-NNN.png`).
  const imageFiles: string[] = [];
  // First clean any stale `marker-*` files from prior runs.
  if (existsSync(figuresDir)) {
    for (const f of readdirSync(figuresDir)) {
      if (/^marker-page-\d+-\d+\.(png|jpe?g|webp)$/i.test(f)) {
        try { unlinkSync(join(figuresDir, f)); } catch { /* */ }
      }
    }
  } else {
    mkdirSync(figuresDir, { recursive: true });
  }
  const refMap = new Map<string, string>();  // original → new filename
  for (const f of readdirSync(markerOutDir)) {
    const m = f.match(/^_page_(\d+)_(?:Figure|Picture)_(\d+)\.(png|jpe?g|webp)$/i);
    if (!m) continue;
    const page = m[1].padStart(3, "0");
    const idx = m[2].padStart(3, "0");
    const ext = m[3].toLowerCase();
    const newName = `marker-page-${page}-${idx}.${ext}`;
    const src = join(markerOutDir, f);
    const dst = join(figuresDir, newName);
    try {
      const bytes = readFileSync(src);
      writeFileSync(dst, bytes);
      imageFiles.push(newName);
      refMap.set(f, newName);
    } catch { /* skip on copy error */ }
  }

  // Rewrite image refs in the markdown: `![](_page_N_*.jpeg)` → `![](<slug>-figures/marker-page-NNN-MMM.jpeg)`.
  for (const [orig, renamed] of refMap.entries()) {
    // Replace the literal filename. Don't anchor — marker may write
    // refs with optional id/attribute prefixes.
    const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    markerMd = markerMd.replace(new RegExp(escaped, "g"), `${slug}-figures/${renamed}`);
  }

  // Clean up marker's tmp dir.
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }

  return {
    ok: true,
    body: markerMd.trim(),
    imageFiles,
    title,
    reason: "",
  };
}
