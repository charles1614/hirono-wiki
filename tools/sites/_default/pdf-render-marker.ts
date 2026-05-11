/**
 * Marker (Datalab) integration for paper-shape PDF body extraction.
 *
 * Opt-in via `HIRONO_USE_MARKER=1`. When set, `tryExtractWithMarker`
 * shells out to `marker_single`, parses the output, copies images into
 * the slug's figures directory with renamed filenames that don't
 * collide with pdfimages / arxiv-fetch-figures output, and returns the
 * cleaned markdown body.
 *
 * Failure modes (caller decides whether to throw or fall back):
 *   - `marker-not-installed`  — `marker_single` not on PATH
 *   - `marker-failed:<stderr>` — subprocess exit non-zero
 *   - `marker-output-missing`  — expected .md file absent after run
 *
 * Layout produced by `marker_single`:
 *   <outDir>/<basename>/
 *     <basename>.md              ← body, refs `_page_N_*.{jpeg,png}`
 *     _page_N_Figure_M.{jpeg,png}
 *     _page_N_Picture_M.{jpeg,png}
 *     <basename>_meta.json
 *
 * We rename the images to `marker-page-NNN-MMM.<ext>` so they sort by
 * page and don't collide with `fig-PPP-NNN.<ext>` (pdfimages) or
 * `figure-NNN.<ext>` (arxiv-fetch-figures) in the same dir.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

import { cleanFilesMatching, removeDirIfExists } from "./pdf-render-shared.ts";

export interface MarkerExtractOpts {
  pdfPath: string;
  /** Slug directory — Marker's tmp output lives at `<slugDir>/.marker-tmp/`. */
  slugDir: string;
  slug: string;
  /** Final figures directory — Marker's images get renamed + copied here. */
  figuresDir: string;
}

export interface MarkerExtractResult {
  ok: boolean;
  body: string;
  imageFiles: string[];
  title?: string;
  reason: string;
}

const FAIL = (reason: string): MarkerExtractResult => ({
  ok: false,
  body: "",
  imageFiles: [],
  reason,
});

/** Filename pattern this module owns. Used to clean stale files on refetch. */
const MARKER_FILE_PATTERN = /^marker-page-\d+-\d+\.(png|jpe?g|webp)$/i;

/**
 * Filename pattern owned by the pdftotext+pdfimages extractor path. We
 * sweep these too when staging Marker output, otherwise a slug whose
 * previous fetch used pdftotext leaves orphan `fig-*` files behind
 * when the operator opts into Marker.
 */
const PDFIMAGES_FILE_PATTERN = /^fig-\d{3}-\d+\.(png|jpe?g|webp|tiff|gif)$/i;

/** Filename pattern Marker emits. We rename to MARKER_FILE_PATTERN. */
const MARKER_OUTPUT_PATTERN = /^_page_(\d+)_(?:Figure|Picture)_(\d+)\.(png|jpe?g|webp)$/i;

/**
 * Run Marker on a PDF and stage its output into our pipeline's figures
 * directory. Returns an `ok:false` result on failure with a categorized
 * reason; never throws. Caller decides what to do on failure.
 */
export function tryExtractWithMarker(opts: MarkerExtractOpts): MarkerExtractResult {
  const markerBin = locateMarkerBinary();
  if (!markerBin) return FAIL("marker-not-installed");

  const tmpDir = join(opts.slugDir, ".marker-tmp");
  removeDirIfExists(tmpDir);
  mkdirSync(tmpDir, { recursive: true });

  const runResult = runMarkerSubprocess(markerBin, opts.pdfPath, tmpDir);
  if (!runResult.ok) {
    removeDirIfExists(tmpDir);
    return FAIL(`marker-failed:${runResult.stderrSnippet}`);
  }

  const pdfStem = basename(opts.pdfPath).replace(/\.pdf$/i, "");
  const markerOutDir = join(tmpDir, pdfStem);
  const markerMdPath = join(markerOutDir, `${pdfStem}.md`);
  if (!existsSync(markerMdPath)) {
    removeDirIfExists(tmpDir);
    return FAIL("marker-output-missing");
  }

  const rawMd = readFileSync(markerMdPath, "utf8");
  const { body, title } = stripTitleH1(rawMd);

  const renamed = stageMarkerImages(markerOutDir, opts.figuresDir);
  const bodyWithLocalRefs = rewriteImageRefs(body, renamed, opts.slug);

  removeDirIfExists(tmpDir);

  return {
    ok: true,
    body: bodyWithLocalRefs.trim(),
    imageFiles: [...renamed.values()],
    title,
    reason: "",
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function locateMarkerBinary(): string | null {
  const which = spawnSync("which", ["marker_single"], { encoding: "utf8" });
  if (which.status !== 0) return null;
  const path = which.stdout.trim();
  return path.length > 0 ? path : null;
}

function runMarkerSubprocess(
  markerBin: string,
  pdfPath: string,
  outDir: string,
): { ok: boolean; stderrSnippet: string } {
  // No timeout — Marker on Mac CPU can take 10-20 min per paper. The
  // fetch pipeline's outer loop already governs total wall-clock.
  const res = spawnSync(
    markerBin,
    [pdfPath, "--output_dir", outDir],
    {
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  if (res.status === 0) return { ok: true, stderrSnippet: "" };
  const stderr = (res.stderr ?? "").toString();
  return { ok: false, stderrSnippet: stderr.slice(0, 200) };
}

/**
 * Marker emits the paper title as the first H1. Our pipeline composes
 * its own H1 from the title-fallback chain, so we strip Marker's H1
 * here and return both the cleaned body + the parsed title.
 */
function stripTitleH1(markerMd: string): { body: string; title?: string } {
  const h1Match = markerMd.match(/^#\s+(.+?)\s*$/m);
  if (!h1Match) return { body: markerMd };

  const title = h1Match[1].replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  const body = markerMd.replace(/^#\s+.+?\s*$\n?(?:\n)?/m, "");
  return { body, title };
}

/**
 * Copy Marker's `_page_N_Figure_M.jpeg` / `_page_N_Picture_M.jpeg`
 * outputs into `figuresDir` with the pipeline's canonical
 * `marker-page-NNN-MMM.<ext>` names. Returns a map of original →
 * renamed for the image-ref rewrite pass.
 *
 * Cleans stale `marker-page-*` files first so repeated runs don't
 * accumulate orphans. Files written by other tools (pdfimages,
 * arxiv-fetch-figures) are untouched.
 */
function stageMarkerImages(
  markerOutDir: string,
  figuresDir: string,
): Map<string, string> {
  // Clean both Marker's own pattern (prior Marker run) and the
  // pdftotext+pdfimages pattern (prior non-Marker run). Without the
  // second sweep, switching extractor mode mid-corpus leaves orphan
  // `fig-*` files referenced nowhere in content.md.
  cleanFilesMatching(figuresDir, MARKER_FILE_PATTERN);
  cleanFilesMatching(figuresDir, PDFIMAGES_FILE_PATTERN);
  if (!existsSync(figuresDir)) mkdirSync(figuresDir, { recursive: true });

  const renamed = new Map<string, string>();
  for (const f of readdirSync(markerOutDir)) {
    const m = f.match(MARKER_OUTPUT_PATTERN);
    if (!m) continue;
    const page = m[1].padStart(3, "0");
    const idx = m[2].padStart(3, "0");
    const ext = m[3].toLowerCase();
    const renamedName = `marker-page-${page}-${idx}.${ext}`;
    const src = join(markerOutDir, f);
    const dst = join(figuresDir, renamedName);
    try {
      writeFileSync(dst, readFileSync(src));
      renamed.set(f, renamedName);
    } catch {
      /* skip on per-file copy error */
    }
  }
  return renamed;
}

/**
 * Rewrite image references in the markdown body: replace each
 * original Marker filename with `<slug>-figures/<renamed-name>` so
 * the markdown reads correctly when placed alongside the slug's
 * figures directory.
 */
function rewriteImageRefs(
  body: string,
  renamed: Map<string, string>,
  slug: string,
): string {
  let out = body;
  for (const [orig, renamedName] of renamed.entries()) {
    const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), `${slug}-figures/${renamedName}`);
  }
  return out;
}
