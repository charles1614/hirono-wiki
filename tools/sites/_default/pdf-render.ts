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
  const titleLine = chooseTitle(meta, slug);

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
  const { url, slugDir, slug, titleLine, meta, pageCount, pdfSize, pdfPath } = opts;
  const figuresDir = join(slugDir, `${slug}-figures`);
  // The previous fetcher rendered full-page PNGs into `<slug>-images/`.
  // The new paper path doesn't use those — text + figures replace
  // them. Drop the dir on refetch so the slug's filesystem matches
  // what content.md actually references.
  const legacyImagesDir = join(slugDir, `${slug}-images`);
  if (existsSync(legacyImagesDir)) {
    try { rmSync(legacyImagesDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }

  // Extract body text via pdftotext. -layout preserves column structure
  // (single-column papers come out clean; 2-column gets reasonable output).
  // -nopgbrk drops the form-feed page-break characters.
  let bodyText = "";
  let textExtractFailed = false;
  try {
    const raw = execFileSync(
      "pdftotext",
      ["-layout", "-nopgbrk", "-enc", "UTF-8", pdfPath, "-"],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    bodyText = cleanPdfText(raw);
  } catch (e) {
    textExtractFailed = true;
    bodyText = "";
  }

  // Clean stale pdfimages-extracted figures from prior refetches.
  // We ONLY remove files matching the pdfimages naming convention
  // (`fig-PPP-NNN.{png,jpg,...}`) — other tools (arxiv-fetch-figures
  // writes `figure-NNN.png` with captions) layer their output into
  // the same dir and we must not clobber theirs.
  if (existsSync(figuresDir)) {
    for (const f of readdirSync(figuresDir)) {
      if (/^fig-\d{3}-\d+\.(png|jpg|jpeg|tiff|gif|webp)$/i.test(f)) {
        try { unlinkSync(join(figuresDir, f)); } catch { /* best-effort */ }
      }
    }
  } else {
    mkdirSync(figuresDir, { recursive: true });
  }
  // Extract embedded figures via pdfimages. -all keeps original encoding;
  // -p prefixes filenames with the page number for traceability.
  let figuresExtracted = 0;
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

  if (allFigs.length > 0) {
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
  if (textExtractFailed) flags.push("_default-pdf-text-extract-failed");
  if (allFigs.length === 0) flags.push("_default-pdf-no-figures-extracted");

  return {
    markdown: lines.join("\n"),
    title: titleLine,
    images: allFigs.map((f) => `${slug}-figures/${f.name}`),
    metadata: {
      source: "_default-pdf",
      title: titleLine,
      shape: "paper",
      pdf_local_path: `${slug}.pdf`,
      pdf_metadata: meta,
      page_count: pageCount,
      aspect_ratio: Math.round(opts.aspectRatio * 100) / 100,
      figures_extracted: figuresExtracted,
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

  // Pass 2 + 3: drop boilerplate
  const DROP_PATTERNS: RegExp[] = [
    /^arXiv:\s*\d+\.\d+v?\d*\s*\[/i,          // arxiv banner
    /^Preprint\.\s*Under\s+review\.?\s*$/i,    // arxiv preprint footer
    /^Under\s+review\s+as\s+a\s+conference\s+paper/i,
    /^Published\s+as\s+a\s+conference\s+paper/i,
    /^Copyright\s+©?\s*\d{4}/i,                // generic copyright
    /^\d{1,3}\s*$/,                            // bare page number
    /^Page\s+\d+\s+of\s+\d+$/i,                // "Page N of M"
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
