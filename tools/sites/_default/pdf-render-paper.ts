/**
 * Paper-shape PDF pipeline. Branches by `HIRONO_USE_MARKER`:
 *
 *   - `HIRONO_USE_MARKER=1` → Marker (Datalab) — OmniDocBench-grade
 *     extraction with inline LaTeX math, section headings, and figure
 *     positioning. ~3-13 min/paper on Mac CPU. **NO FALLBACK**: failure
 *     throws L3 — the operator must fix the install or unset the flag.
 *
 *   - default → `pdftotext` + `cleanPdfText`. ~1 sec/paper. Lower
 *     quality on complex layouts; readable on simple ones.
 *
 * Embedded figures come from `pdfimages` (pdftotext path) or directly
 * from Marker's output (Marker path). Filenames are namespaced so the
 * three sources (`pdfimages` / `arxiv-fetch-figures` / Marker) can
 * coexist in `<slug>-figures/` without colliding.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

import { makeError } from "../../fetch-raw.ts";
import type { Result } from "../_shared/types.ts";

import { cleanPdfText } from "./pdf-render-clean.ts";
import { tryExtractWithMarker } from "./pdf-render-marker.ts";
import {
  MIN_FIGURE_BYTES,
  cleanFilesMatching,
  formatBytes,
  formatPdfDate,
  removeDirIfExists,
} from "./pdf-render-shared.ts";
import {
  extractTitleFromPdfBody,
  shouldFallbackToBodyTitle,
} from "./pdf-render-title.ts";

export interface PaperOpts {
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

/** Filenames the `pdfimages` path owns. */
const PDFIMAGES_FILE_PATTERN = /^fig-\d{3}-\d+\.(png|jpg|jpeg|tiff|gif|webp)$/i;

interface BodyExtraction {
  body: string;
  /** Marker-emitted image filenames (relative to figuresDir). Empty for pdftotext. */
  markerImageFiles: string[];
  /** Title string Marker parsed from the first H1, if available. */
  markerTitle?: string;
  /** Which extractor produced this. */
  source: "marker" | "pdftotext";
  /** True iff `pdftotext` execFile threw. */
  textExtractFailed: boolean;
}

interface PdfimagesFigure {
  name: string;
  bytes: number;
}

/**
 * Orchestrator. Reads as a top-down recipe — each helper below owns one
 * concern.
 */
export function composePaperContent(opts: PaperOpts): Result {
  const figuresDir = join(opts.slugDir, `${opts.slug}-figures`);

  cleanLegacyImagesDir(opts);

  const body = extractBody(opts, figuresDir);
  const titleLine = resolveTitle(opts, body);
  const pdfimagesFigures = body.source === "marker"
    ? []
    : extractPdfimagesFigures(opts.pdfPath, figuresDir);

  const markdown = renderPaperMarkdown({
    opts,
    titleLine,
    body,
    pdfimagesFigures,
  });

  return packagePaperResult({
    opts,
    titleLine,
    body,
    pdfimagesFigures,
    markdown,
  });
}

// ---------------------------------------------------------------------------
// Filesystem prep
// ---------------------------------------------------------------------------

/**
 * Drop the legacy `<slug>-images/` directory the old full-page-render
 * pipeline created. The paper path uses `<slug>-figures/` instead, so
 * the legacy dir is stale on refetch.
 */
function cleanLegacyImagesDir(opts: PaperOpts): void {
  removeDirIfExists(join(opts.slugDir, `${opts.slug}-images`));
}

// ---------------------------------------------------------------------------
// Body extraction (Marker or pdftotext)
// ---------------------------------------------------------------------------

function extractBody(opts: PaperOpts, figuresDir: string): BodyExtraction {
  if (process.env.HIRONO_USE_MARKER === "1") {
    return extractWithMarker(opts, figuresDir);
  }
  return extractWithPdftotext(opts);
}

function extractWithMarker(opts: PaperOpts, figuresDir: string): BodyExtraction {
  const result = tryExtractWithMarker({
    pdfPath: opts.pdfPath,
    slugDir: opts.slugDir,
    slug: opts.slug,
    figuresDir,
  });
  if (!result.ok) {
    // HIRONO_USE_MARKER was explicitly set, so any failure is the
    // operator's signal to fix the install — no silent fallback.
    throw makeError(
      "marker-extraction-failed",
      "L3",
      `Marker failed on ${opts.slug}: ${result.reason}`,
      {
        remediation: remediationFor(result.reason),
        domain: "pdf-render",
      },
    );
  }
  return {
    body: result.body,
    markerImageFiles: result.imageFiles,
    markerTitle: result.title,
    source: "marker",
    textExtractFailed: false,
  };
}

function remediationFor(reason: string): string {
  if (reason === "marker-not-installed") {
    return "Install Marker: `pip install marker-pdf`. Or unset HIRONO_USE_MARKER to use the pdftotext path.";
  }
  return "Inspect Marker stderr (above) for the failure cause. Or unset HIRONO_USE_MARKER to use the pdftotext path.";
}

function extractWithPdftotext(opts: PaperOpts): BodyExtraction {
  try {
    const raw = execFileSync(
      "pdftotext",
      ["-nopgbrk", "-enc", "UTF-8", opts.pdfPath, "-"],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return {
      body: cleanPdfText(raw),
      markerImageFiles: [],
      source: "pdftotext",
      textExtractFailed: false,
    };
  } catch {
    return {
      body: "",
      markerImageFiles: [],
      source: "pdftotext",
      textExtractFailed: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Title selection
// ---------------------------------------------------------------------------

/**
 * Title precedence:
 *   1. Marker H1 (already parsed during extraction).
 *   2. PDF info-metadata title (caller-provided `opts.titleLine`).
 *   3. Body-text first-line fallback (only when (2) is the sentinel).
 */
function resolveTitle(opts: PaperOpts, body: BodyExtraction): string {
  if (body.markerTitle) return body.markerTitle;
  if (!shouldFallbackToBodyTitle(opts.titleLine, opts.slug)) {
    return opts.titleLine;
  }
  if (body.body.length === 0) return opts.titleLine;
  const fromBody = extractTitleFromPdfBody(opts.pdfPath);
  return fromBody ?? opts.titleLine;
}

// ---------------------------------------------------------------------------
// pdfimages figure extraction
// ---------------------------------------------------------------------------

/**
 * Run `pdfimages` and return the kept figures (≥ MIN_FIGURE_BYTES).
 * Cleans stale `fig-*` files from prior refetches before running.
 * Files from other tools in the same dir are untouched.
 */
function extractPdfimagesFigures(
  pdfPath: string,
  figuresDir: string,
): PdfimagesFigure[] {
  cleanFilesMatching(figuresDir, PDFIMAGES_FILE_PATTERN);
  if (!existsSync(figuresDir)) mkdirSync(figuresDir, { recursive: true });

  try {
    execFileSync(
      "pdfimages",
      ["-all", "-p", pdfPath, join(figuresDir, "fig")],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch {
    // pdfimages can fail on heavily-vectorised PDFs (TikZ/PGF figures
    // aren't raster-extractable). Not fatal — paper still has body text
    // + the preserved PDF source for vision-mode reading.
  }

  const kept = readdirSync(figuresDir)
    .filter((f) => PDFIMAGES_FILE_PATTERN.test(f))
    .map((f) => ({ name: f, bytes: statSync(join(figuresDir, f)).size }))
    .filter((f) => f.bytes >= MIN_FIGURE_BYTES)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Drop the sub-threshold pdfimages output (logos, icons, page-
  // decoration noise). Don't touch non-pdfimages files — they belong
  // to other tools.
  const keptNames = new Set(kept.map((f) => f.name));
  for (const f of readdirSync(figuresDir)) {
    if (!PDFIMAGES_FILE_PATTERN.test(f)) continue;
    if (keptNames.has(f)) continue;
    try { unlinkSync(join(figuresDir, f)); } catch { /* best-effort */ }
  }

  return kept;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

interface RenderArgs {
  opts: PaperOpts;
  titleLine: string;
  body: BodyExtraction;
  pdfimagesFigures: PdfimagesFigure[];
}

function renderPaperMarkdown(args: RenderArgs): string {
  const lines: string[] = [];
  lines.push(...renderHeader(args));
  lines.push(...renderBody(args));
  if (args.body.source !== "marker" && args.pdfimagesFigures.length > 0) {
    lines.push(...renderFiguresAppendix(args));
  }
  return lines.join("\n");
}

function renderHeader({ opts, titleLine }: RenderArgs): string[] {
  const { url, slug, meta, pageCount, pdfSize, aspectRatio } = opts;
  const lines: string[] = [];
  lines.push(`# ${titleLine}`);
  lines.push("");
  lines.push(`> 原文链接: ${url}`);
  lines.push(`> Local PDF: \`${slug}.pdf\` (preserved alongside this content.md for direct LLM ingestion)`);
  lines.push(
    `> Format: PDF · ${pageCount} page${pageCount === 1 ? "" : "s"} · ` +
      `${formatBytes(pdfSize)} · paper-shape (aspect ${aspectRatio.toFixed(2)})`,
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

function renderBody({ opts, body }: RenderArgs): string[] {
  if (body.body.trim().length > 0) {
    return [body.body.trimEnd(), ""];
  }
  if (body.textExtractFailed) {
    return [
      `> ⚠️ Text extraction failed (\`pdftotext\` returned an error). The PDF itself is preserved at \`${opts.slug}.pdf\` — read it directly for body text.`,
      "",
    ];
  }
  return [
    `> ⚠️ No body text extracted. The PDF may be image-only / scanned; read \`${opts.slug}.pdf\` directly.`,
    "",
  ];
}

/**
 * pdftotext-path appendix: list each extracted raster. Marker's output
 * already places images inline at their reference points, so this
 * appendix is skipped on the Marker path.
 */
function renderFiguresAppendix({ opts, pdfimagesFigures }: RenderArgs): string[] {
  const lines: string[] = [];
  lines.push("---");
  lines.push("");
  lines.push(`## Extracted figures (${pdfimagesFigures.length})`);
  lines.push("");
  lines.push(
    `*Embedded raster images ≥ ${Math.round(MIN_FIGURE_BYTES / 1024)} KB extracted via \`pdfimages\`. ` +
      `Filename suffix is \`-PPP-NNN\` where PPP = source page number. ` +
      `Vector figures (TikZ/PGF) are absent — read \`${opts.slug}.pdf\` for those.*`,
  );
  lines.push("");
  for (const fig of pdfimagesFigures) {
    const m = fig.name.match(/-(\d{3})-\d+\./);
    const page = m ? parseInt(m[1], 10) : null;
    const alt = page ? `Embedded figure from page ${page}` : "Embedded figure";
    lines.push(`![${alt}](${opts.slug}-figures/${fig.name})`);
    lines.push("");
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Result packaging
// ---------------------------------------------------------------------------

interface PackageArgs {
  opts: PaperOpts;
  titleLine: string;
  body: BodyExtraction;
  pdfimagesFigures: PdfimagesFigure[];
  markdown: string;
}

function packagePaperResult({
  opts,
  titleLine,
  body,
  pdfimagesFigures,
  markdown,
}: PackageArgs): Result {
  const markerUsed = body.source === "marker";

  const flags: string[] = ["pdf-paper"];
  if (markerUsed) flags.push("pdf-marker");
  if (body.textExtractFailed) flags.push("_default-pdf-text-extract-failed");
  if (!markerUsed && pdfimagesFigures.length === 0) {
    flags.push("_default-pdf-no-figures-extracted");
  }

  const images = markerUsed
    ? body.markerImageFiles.map((f) => `${opts.slug}-figures/${f}`)
    : pdfimagesFigures.map((f) => `${opts.slug}-figures/${f.name}`);

  const figuresCount = markerUsed ? body.markerImageFiles.length : pdfimagesFigures.length;

  return {
    markdown,
    title: titleLine,
    images,
    metadata: {
      source: "_default-pdf",
      title: titleLine,
      shape: "paper",
      extractor: markerUsed ? "marker" : "pdftotext",
      pdf_local_path: `${opts.slug}.pdf`,
      pdf_metadata: opts.meta,
      page_count: opts.pageCount,
      aspect_ratio: Math.round(opts.aspectRatio * 100) / 100,
      figures_extracted: figuresCount,
      pdf_size_bytes: opts.pdfSize,
      body_text_chars: body.body.length,
    },
    flags,
    notes: [
      `_default-pdf paper-shape: ${opts.pageCount} page(s), ${body.body.length} text chars, ` +
        `${figuresCount} figure(s), ${formatBytes(opts.pdfSize)} source PDF`,
    ],
  };
}
