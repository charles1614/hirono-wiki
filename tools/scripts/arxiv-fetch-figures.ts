#!/usr/bin/env node
/**
 * Fetch clean, isolated figures from arxiv's HTML rendering of a paper.
 *
 * arxiv ships an experimental HTML version at `arxiv.org/html/<id>v<N>`
 * for most papers (~since 2023). Unlike the rendered-PDF page screenshots
 * we get via pdftoppm, the HTML version exposes each `<figure>` as a
 * separate `<img>` paired with `<figcaption>` containing "Figure N: ...".
 *
 * This script:
 *   1. Fetches the HTML.
 *   2. Parses every `<figure>` element, extracting:
 *        - img src (relative to the HTML page's URL)
 *        - figcaption text (used to derive "Figure N" → filename)
 *   3. Downloads each figure image into a local directory.
 *   4. Writes a `figures-index.json` mapping filename → caption.
 *
 * Usage:
 *   node arxiv-fetch-figures.mjs <arxiv-id> [out-dir]
 *
 * Examples:
 *   node arxiv-fetch-figures.mjs 2506.05508v1 /tmp/btb-figs
 *   node arxiv-fetch-figures.mjs 2503.01840v3
 *      → writes to ./<id>-figures/
 *
 * Caveats:
 *   - Not every arxiv paper has an HTML version; some have rendering
 *     errors. On 404 we exit non-zero so the caller can fall back to
 *     pdfimages or page-screenshot.
 *   - HTML rendering errors sometimes drop a figure entirely (e.g.
 *     mathy figures that latexml couldn't render). The figures-index.json
 *     records what was actually downloaded — eye-read the captions
 *     before assuming Figure 1 is fig-001.png.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { JSDOM } from "jsdom";

const arxivId = process.argv[2];
const outDir = process.argv[3] ?? `./${arxivId}-figures`;

if (!arxivId) {
  console.error("usage: arxiv-fetch-figures.mjs <arxiv-id-with-version> [out-dir]");
  console.error("example: arxiv-fetch-figures.mjs 2506.05508v1 /tmp/btb-figs");
  process.exit(2);
}

const htmlUrl = `https://arxiv.org/html/${arxivId}`;
const baseUrl = htmlUrl.replace(/\/$/, "") + "/";

console.error(`[arxiv-figures] fetching HTML: ${htmlUrl}`);
const html = execFileSync(
  "curl",
  ["-sfL", "-A", "Mozilla/5.0", "--max-time", "30", htmlUrl],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);

const dom = new JSDOM(html);
const doc = dom.window.document;

mkdirSync(outDir, { recursive: true });

interface Entry {
  local: string;
  caption: string;
  figureNumber: number | null;
  remote: string;
}
const index: Entry[] = [];

const figures = Array.from(doc.querySelectorAll("figure"));
console.error(`[arxiv-figures] found ${figures.length} <figure> elements`);

for (const fig of figures) {
  const img = fig.querySelector("img");
  if (!img) continue;
  const src = img.getAttribute("src");
  if (!src) continue;

  const caption = (fig.querySelector("figcaption")?.textContent ?? "").trim().replace(/\s+/g, " ");
  // "Figure 1:..." or "Figure 1." → 1
  const m = caption.match(/^Figure\s+(\d+)/i);
  const figNum = m ? parseInt(m[1], 10) : null;
  // Local filename: figure-001.png (zero-padded). When figNum is unknown
  // (sub-figures, table screenshots, etc.), fall back to the URL basename.
  const ext = (src.match(/\.([a-zA-Z]{3,4})(?:$|\?)/)?.[1] ?? "png").toLowerCase();
  const local = figNum !== null
    ? `figure-${String(figNum).padStart(3, "0")}.${ext}`
    : `aux-${index.length.toString().padStart(3, "0")}-${src.split("/").pop()}`;

  // Resolve URL. arxiv's HTML sometimes ships buggy src paths where the
  // version-id is duplicated (e.g. src="2504.14960v3/images/foo.png" joined
  // against baseUrl="https://arxiv.org/html/2504.14960v3/" → 404). Build a
  // candidate list: naive resolution first, then version-id-stripped fallback.
  const candidates: string[] = [];
  const naive = new URL(src, baseUrl).toString();
  candidates.push(naive);
  const dupPattern = `/${arxivId}/${arxivId}/`;
  if (naive.includes(dupPattern)) {
    candidates.push(naive.replace(dupPattern, `/${arxivId}/`));
  }

  const destPath = join(outDir, local);
  if (existsSync(destPath)) {
    index.push({ local, caption: caption.slice(0, 300), figureNumber: figNum, remote: candidates[0] });
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
    console.error(`[arxiv-figures] FAILED: ${local} (tried ${candidates.length} URL variant${candidates.length === 1 ? "" : "s"})`);
    continue;
  }
  console.error(`[arxiv-figures] downloaded: ${local}`);
  index.push({ local, caption: caption.slice(0, 300), figureNumber: figNum, remote: downloaded });
}

const indexPath = join(outDir, "figures-index.json");
writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.error(`[arxiv-figures] wrote ${index.length} figures + index to ${outDir}`);
console.error(`[arxiv-figures] index: ${indexPath}`);
