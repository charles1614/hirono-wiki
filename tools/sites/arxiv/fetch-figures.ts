/**
 * Fetch clean, isolated figures from arxiv's HTML rendering of a paper.
 *
 * arxiv ships an experimental HTML version at `arxiv.org/html/<id>v<N>`
 * for most papers (~since 2023). Unlike the rendered-PDF page screenshots
 * we get via pdftoppm, the HTML version exposes each `<figure>` as a
 * separate `<img>` paired with `<figcaption>` containing "Figure N: ...".
 *
 * What this does:
 *   1. Fetches the HTML.
 *   2. Parses every `<figure>` element, extracting:
 *        - img src (relative to the HTML page's URL)
 *        - figcaption text (used to derive "Figure N" → filename)
 *   3. Downloads each figure image into a local directory.
 *   4. Writes a `figures-index.json` mapping filename → caption.
 *
 * Called from:
 *   - `tools/sites/arxiv/index.ts` — auto-invoked for `/pdf/<id>` URLs
 *     after the generic PDF pipeline runs, layering captioned figures
 *     into `<slug>-figures/` alongside the pdfimages output.
 *   - `tools/scripts/arxiv-fetch-figures-cli.ts` — standalone CLI wrapper
 *     for manual re-runs / debugging.
 *
 * Caveats:
 *   - Not every arxiv paper has an HTML version; older / mathy papers
 *     return 404. We treat that as "no figures available" and return
 *     `{ ok: false, ... }` — caller continues without captioned figures.
 *   - HTML rendering errors sometimes drop a figure entirely (e.g.
 *     mathy figures latexml couldn't render). The figures-index.json
 *     records what was actually downloaded — read the captions before
 *     assuming Figure 1 is figure-001.png.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

export interface ArxivFigureEntry {
  local: string;
  caption: string;
  figureNumber: number | null;
  remote: string;
}

export interface FetchFiguresResult {
  ok: boolean;
  reason?: string;
  figuresWritten: number;
  htmlBytes: number;
  entries: ArxivFigureEntry[];
}

export interface FetchFiguresOpts {
  /** Full arxiv ID with version, e.g. "2506.05508v1". */
  arxivId: string;
  /** Output directory; will be created if absent. */
  outDir: string;
  /** Set true to log per-figure progress to stderr. */
  verbose?: boolean;
}

/**
 * Fetch + save arxiv HTML-derived figures. Synchronous (uses curl via
 * spawnSync), to fit the rest of the fetch-pipeline's sync style.
 *
 * Returns a result describing what landed. On HTML-version-not-available
 * (404), returns `{ ok: false, reason: "html-not-available" }` so the
 * caller can continue gracefully — the absence of HTML figures is not
 * a fetch failure.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fetchArxivHtmlFigures(opts: FetchFiguresOpts): FetchFiguresResult {
  const { arxivId, outDir, verbose = false } = opts;
  const htmlUrl = `https://arxiv.org/html/${arxivId}`;
  const baseUrl = htmlUrl.replace(/\/$/, "") + "/";

  // Fetch HTML. Returns "" on 404; caller treats that as "no HTML version."
  let html = "";
  try {
    html = execFileSync(
      "curl",
      ["-sfL", "-A", "Mozilla/5.0", "--max-time", "30", htmlUrl],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
  } catch {
    return { ok: false, reason: "html-not-available", figuresWritten: 0, htmlBytes: 0, entries: [] };
  }
  if (html.length < 1000) {
    return { ok: false, reason: "html-too-small", figuresWritten: 0, htmlBytes: html.length, entries: [] };
  }

  const dom = new JSDOM(html);
  const doc = dom.window.document;
  mkdirSync(outDir, { recursive: true });

  const figures = Array.from(doc.querySelectorAll("figure"));
  if (verbose) {
    process.stderr.write(`[arxiv-figures] found ${figures.length} <figure> elements\n`);
  }
  const entries: ArxivFigureEntry[] = [];

  for (const fig of figures) {
    const img = fig.querySelector("img");
    if (!img) continue;
    const src = img.getAttribute("src");
    if (!src) continue;

    const caption = (fig.querySelector("figcaption")?.textContent ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const m = caption.match(/^Figure\s+(\d+)/i);
    const figNum = m ? parseInt(m[1], 10) : null;
    const ext = (src.match(/\.([a-zA-Z]{3,4})(?:$|\?)/)?.[1] ?? "png").toLowerCase();
    const local = figNum !== null
      ? `figure-${String(figNum).padStart(3, "0")}.${ext}`
      : `aux-${entries.length.toString().padStart(3, "0")}-${src.split("/").pop()}`;

    // Resolve URL. arxiv's HTML ships buggy src paths where the
    // version-id is duplicated (the HTML's src= already includes the
    // arxiv id, then baseUrl prepends the id again). Build a candidate
    // list: naive first, then dup-id-stripped fallback. The dup match
    // accounts for both `<id>/<id>/` (when input has same version) and
    // `<id>/<id>v<N>/` (when input has no version but HTML uses
    // canonical versioned-id internally).
    const candidates: string[] = [];
    const naive = new URL(src, baseUrl).toString();
    candidates.push(naive);
    // Strip the arxiv-id-without-version prefix; the trailing id-with-or-
    // without-version becomes the canonical "the rest" of the path.
    const baseId = arxivId.replace(/v\d+$/, "");
    const dupRe = new RegExp(`/${escapeRegex(baseId)}/(${escapeRegex(baseId)}(?:v\\d+)?)/`);
    const dupMatch = naive.match(dupRe);
    if (dupMatch) {
      candidates.push(naive.replace(dupRe, `/${dupMatch[1]}/`));
    }

    const destPath = join(outDir, local);
    if (existsSync(destPath)) {
      entries.push({ local, caption: caption.slice(0, 300), figureNumber: figNum, remote: candidates[0] });
      continue;
    }

    let downloaded: string | null = null;
    for (const url of candidates) {
      const dl = spawnSync(
        "curl",
        ["-sfL", "-A", "Mozilla/5.0", "--max-time", "30", "-o", destPath, url],
        { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" },
      );
      if (dl.status === 0) {
        downloaded = url;
        break;
      }
    }
    if (!downloaded) {
      if (verbose) {
        process.stderr.write(`[arxiv-figures] FAILED: ${local}\n`);
      }
      continue;
    }
    if (verbose) {
      process.stderr.write(`[arxiv-figures] downloaded: ${local}\n`);
    }
    entries.push({ local, caption: caption.slice(0, 300), figureNumber: figNum, remote: downloaded });
  }

  const indexPath = join(outDir, "figures-index.json");
  writeFileSync(indexPath, JSON.stringify(entries, null, 2));

  return {
    ok: true,
    figuresWritten: entries.length,
    htmlBytes: html.length,
    entries,
  };
}
