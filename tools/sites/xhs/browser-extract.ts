/**
 * xhs (Xiaohongshu / xhslink) browser-side helpers — opencli `browser`
 * + native `xiaohongshu` adapter calls used by `tools/sites/xhs/index.ts`.
 *
 * Functions exported here:
 *   - `extractXhsFullContent(url)` — main extractor: title + author +
 *     body + image URLs in one browser session
 *   - `extractXhsImageUrlsInOrder(url)` — DOM-order image extractor
 *     (for reordering opencli's flat `download` output)
 *   - `reorderXhsImagesByDomPosition(...)` — secondary pass to align
 *     filename order with display order
 *   - `extractXhsNoteId(url)` — pull the note ID out of various URL shapes
 *   - `collectXhsAssets(slugDir, afterMtime)` — gather images opencli
 *     wrote (handles its sub-directory layout quirks)
 *   - `downloadImageToPath(url, dest)` — image download with xhs-specific
 *     Referer header handling
 *
 * Internal helpers (not exported):
 *   - `resolveXhsViaBrowser` — follows xhslink shortlinks via the browser
 *   - `xhsSearchQuery`, `findFreshXhsUrl` — title-based search fallback
 *     for stale-token URLs
 *
 * Was previously in `tools/fetch-raw.ts`; moved here as part of the
 * single-arch cleanup so xhs-specific code lives in xhs/.
 */

import { existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { sleepMs, closeBrowser, runOpencli, browserTimeoutMs } from "../_shared/browser-helpers.ts";

/**
 * Native xhs adapter. Unlike wechat/zhihu, xhs needs TWO calls:
 *   - `xiaohongshu note <url> -f md` → stdout markdown (body + interaction data)
 *   - `xiaohongshu download <url> --output <dir>` → images/videos, saved flat as
 *                                                     <noteid>_N.jpg at the dir root
 *     (no nested subdir like wechat; no .md file from download.)
 * We combine: use `note` for markdown, `download` for assets, then append an
 * asset-list section to the markdown.
 */
/**
 * Scan slugDir for image/video files whose mtime says they were created by the
 * most recent download call. Encapsulates the "did this download attempt
 * actually produce files?" check so both the initial call and the retry use
 * the same logic.
 */
/**
 * Collect xhs-downloaded images. As of opencli 1.7.4+, `xiaohongshu download`
 * saves images into a `<note-id>/` subdirectory, not flat at slugDir root.
 * We flatten them back up to slugDir so our filename references in the
 * assembled markdown stay simple.
 *
 * Returns basenames relative to slugDir (either plain filename if already
 * flat, or empty string for files we moved up).
 */
export function collectXhsAssets(slugDir: string, afterMtime: number): string[] {
  const files: string[] = [];
  const imageExt = /\.(jpe?g|png|webp|mp4|mov|gif|avif)$/i;

  // Pass 1: pick up any flat files at slugDir root (legacy/future behavior)
  for (const f of readdirSync(slugDir)) {
    try {
      const full = join(slugDir, f);
      const st = statSync(full);
      if (st.isFile() && st.mtimeMs >= afterMtime - 1000 && imageExt.test(f)) {
        files.push(f);
      }
    } catch {}
  }

  // Pass 2: check subdirectories created by opencli (e.g. `<note-id>/`).
  // Move all image files up to slugDir root + remove the empty subdir.
  for (const entry of readdirSync(slugDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const subdir = join(slugDir, entry.name);
    let subdirHasRecentFiles = false;
    try {
      const subdirStat = statSync(subdir);
      if (subdirStat.mtimeMs < afterMtime - 1000) continue;
      for (const childName of readdirSync(subdir)) {
        const childFull = join(subdir, childName);
        try {
          const childStat = statSync(childFull);
          if (!childStat.isFile() || !imageExt.test(childName)) continue;
          subdirHasRecentFiles = true;
          // Move up to slugDir, disambiguating if a same-named file already exists
          const destName = existsSync(join(slugDir, childName))
            ? `${entry.name}_${childName}`
            : childName;
          try {
            renameSync(childFull, join(slugDir, destName));
            files.push(destName);
          } catch {}
        } catch {}
      }
      // Remove now-empty subdir (or try)
      if (subdirHasRecentFiles) {
        try { rmSync(subdir, { recursive: true, force: true }); } catch {}
      }
    } catch {}
  }
  return files;
}


/**
 * Resolve an xhs URL (xhslink shortlink or any xiaohongshu.com URL with
 * possibly-stale xsec_token) to its current canonical URL with a fresh,
 * session-valid xsec_token. Uses opencli's browser bridge, which inherits
 * the user's logged-in xhs cookies.
 *
 * Two-step dance:
 *   1. `opencli browser open <url>` — navigate; xhs redirects/refreshes
 *      tokens server-side
 *   2. `opencli browser eval 'window.location.href'` — read the final URL
 *
 * Returns the resolved URL (with fresh xsec_token) on success, null if
 * the browser navigation or eval failed. On success the browser is left
 * open — caller must close it or it'll be closed on next adapter invocation.
 */
function resolveXhsViaBrowser(url: string): string | null {
  // NOTE: we deliberately do NOT close the browser in the success path — the
  // caller (fetchXhsViaAdapter) runs further `opencli browser` commands after
  // us in the same session. The caller is responsible for closing via a
  // finally block. This function's OWN finally block only runs if WE throw;
  // in that case the caller's finally will have already fired by the time it
  // matters.
  let browserOpened = false;
  try {
    // Navigate. This can 200, 404 from xhslink, etc. — we swallow and check eval.
    spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    browserOpened = true;
    // Let xhs's JS run a beat; in practice ≤1s is plenty for redirects.
    sleepMs(2000);
    const res = spawnSync("opencli", ["browser", "eval", "window.location.href"], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
    });
    if (res.status !== 0) return null;
    // stdout contains the URL possibly followed by opencli version notice; first
    // non-empty line starting with http is our answer.
    for (const line of (res.stdout || "").split("\n")) {
      const t = line.trim();
      if (/^https?:\/\/(?:www\.)?xiaohongshu\.com\//.test(t)) {
        return t;
      }
    }
    return null;
  } catch {
    // Throw path: if WE opened the browser and our caller might not know,
    // close defensively before returning null.
    if (browserOpened) closeBrowser();
    return null;
  }
}


/**
 * Extract image URLs from the live xhs post DOM in display order. Opens the
 * URL in opencli's browser (which has user cookies), filters `<img>` elements
 * by minimum size (to skip avatars + UI icons), and dedupes by final URL
 * segment (xhs's carousel often repeats each image as a thumbnail).
 *
 * Returns the absolute URL list in author-intended display order, or an
 * empty array on any failure.
 */
/**
 * Result of DOM-based image extraction. `urls` holds the ordered image URLs
 * (possibly empty — a legitimate "no large images on this post"); `error`
 * is set ONLY when the DOM query itself failed (browser open/eval threw,
 * non-zero exit, unparseable output). This lets the caller distinguish
 * "no images to reorder" from "extractor broken; flag quality".
 */
export interface XhsDomExtractResult {
  urls: string[];
  error?: string;
}

/**
 * Combined Layer-4 xhs extractor: opens the page in opencli's browser,
 * extracts body text + metadata + image URLs in a single eval pass, and
 * closes the session. Returns everything the new converter needs.
 *
 * Body comes from `#detail-desc.textContent` — preserves the `\n\t\n`
 * paragraph separators that opencli's `xiaohongshu note` collapses.
 * Image URLs use the same carousel-dedup logic as
 * `extractXhsImageUrlsInOrder` (sort by `left` position, drop wrap-around
 * negatives, dedupe by image-id segment).
 */
export interface XhsFullContent {
  title: string;
  descText: string;
  author: string;
  likes?: string;
  collects?: string;
  comments?: string;
  imageUrls: string[];
  /** Resolved final URL after any redirects (e.g. xhslink.com → xiaohongshu.com/discovery/item/<noteid>). */
  finalUrl?: string;
  error?: string;
}

export function extractXhsFullContent(url: string): XhsFullContent {
  let browserOpened = false;
  try {
    spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    browserOpened = true;
    sleepMs(3500);
    const evalScript = `(() => {
      const t = document.querySelector("#detail-title");
      const d = document.querySelector("#detail-desc");
      const author = document.querySelector(".author .name") || document.querySelector("a.name") || document.querySelector("span.username");
      // Stats: walk .interactions .count, but skip per-comment likes (each
      // comment has its own like-wrapper). The article-level stats live in
      // .engage-bar (or similar footer container); they are LAST in DOM
      // order. Strategy: filter out any count whose ancestor is a comment
      // node (.parent-comment / .comment-item / .reply-container), then
      // take the last seen for each category — equivalently, skip counts
      // inside comment containers entirely.
      const stats = { likes: "", collects: "", comments: "" };
      document.querySelectorAll(".interactions .count").forEach(c => {
        // Exclude counts inside any comment container.
        if (c.closest(".parent-comment, .comment-item, .reply-container, .comment-content")) return;
        const txt = (c.textContent || "").trim();
        if (!txt || /^[^0-9]+$/.test(txt)) return;
        const par = c.closest(".like-wrapper, .collect-wrapper, .chat-wrapper");
        if (!par) return;
        if (par.className.indexOf("collect") >= 0) stats.collects = txt;
        else if (par.className.indexOf("chat") >= 0) stats.comments = txt;
        else stats.likes = txt;
      });
      // Images — same carousel-dedup as extractXhsImageUrlsInOrder, plus
      // exclusion of any image inside a comment container (xhs comments
      // can include attached images that match our width/CDN filters but
      // are not part of the note body).
      const items = Array.from(document.querySelectorAll("img"))
        .filter(i => {
          const w = i.naturalWidth || i.width;
          if (!(w >= 400 && i.src.indexOf("xhscdn") > 0)) return false;
          if (i.closest(".parent-comment, .comment-item, .reply-container, .comment-content")) return false;
          return true;
        })
        .map(i => ({ src: i.src, left: Math.round(i.getBoundingClientRect().left) }))
        .filter(it => typeof it.left === "number" && it.left >= 0)
        .sort((a, b) => a.left - b.left);
      const seen = new Set();
      const imageUrls = [];
      for (const it of items) {
        const m = it.src.match(/\\/([^/!]+)!/);
        const key = m ? m[1] : it.src;
        if (seen.has(key)) continue;
        seen.add(key);
        imageUrls.push(it.src);
      }
      return JSON.stringify({
        title: t ? (t.textContent || "").trim() : "",
        descText: d ? (d.textContent || "") : "",
        author: author ? (author.textContent || "").trim().replace(/关注$/, "").trim() : "",
        likes: stats.likes,
        collects: stats.collects,
        comments: stats.comments,
        imageUrls,
        finalUrl: window.location.href,
      });
    })()`;
    const res = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 8 * 1024 * 1024,
    });
    if (res.status !== 0) {
      return { title: "", descText: "", author: "", imageUrls: [], error: `eval exited ${res.status}` };
    }
    const stdout = res.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) return { title: "", descText: "", author: "", imageUrls: [], error: "no JSON object in eval output" };
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < stdout.length; i++) {
      const c = stdout[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === "\"") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) return { title: "", descText: "", author: "", imageUrls: [], error: "unterminated JSON object" };
    try {
      const parsed = JSON.parse(stdout.slice(start, end + 1));
      return {
        title: parsed.title || "",
        descText: parsed.descText || "",
        author: parsed.author || "",
        likes: parsed.likes || undefined,
        collects: parsed.collects || undefined,
        comments: parsed.comments || undefined,
        imageUrls: Array.isArray(parsed.imageUrls) ? parsed.imageUrls : [],
        finalUrl: parsed.finalUrl || undefined,
      };
    } catch (e) {
      return { title: "", descText: "", author: "", imageUrls: [], error: `JSON parse failed: ${e instanceof Error ? e.message : e}` };
    }
  } catch (e) {
    return { title: "", descText: "", author: "", imageUrls: [], error: `extractXhsFullContent threw: ${e instanceof Error ? e.message : e}` };
  } finally {
    if (browserOpened) closeBrowser();
  }
}

export function extractXhsImageUrlsInOrder(url: string): XhsDomExtractResult {
  // Browser lifetime is fully owned by this function — open at the top,
  // close in finally so any throw or early return still frees the tab.
  let browserOpened = false;
  try {
    spawnSync("opencli", ["browser", "open", url], { encoding: "utf8", timeout: browserTimeoutMs("open") });
    browserOpened = true;
    sleepMs(3_000);
    // Extract {src, left} per image — we need the horizontal viewport position
    // because xhs's carousel is circular: the LAST image is duplicated to the
    // LEFT of the cover (at a negative X offset) for wrap-around scrolling.
    // DOM order alone puts that wrap-around copy FIRST, which is wrong.
    // Sorting by `left` (ascending), filtering out negative-left wrap-arounds,
    // and deduping by image ID gives the author's actual display order.
    // Filter: width >=400, xhscdn URL, AND not inside a comment container
    // (xhs comments can have attached images that match the size+CDN
    // filters but aren't part of the note body).
    const js = "JSON.stringify(Array.from(document.querySelectorAll('img'))"
      + ".filter(function(i){var w=i.naturalWidth||i.width;"
      + "if(!(w>=400 && i.src.indexOf('xhscdn')>0))return false;"
      + "if(i.closest('.parent-comment, .comment-item, .reply-container, .comment-content'))return false;"
      + "return true;})"
      + ".map(function(i){return {src:i.src, left:Math.round(i.getBoundingClientRect().left)}}))";
    const res = spawnSync("opencli", ["browser", "eval", js], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 4 * 1024 * 1024,
    });
    if (res.status !== 0) {
      return { urls: [], error: `browser eval exited ${res.status}` };
    }
    const stdout = res.stdout || "";
    const jsonStart = stdout.indexOf("[");
    if (jsonStart < 0) {
      return { urls: [], error: "no JSON array in eval output" };
    }
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < stdout.length; i++) {
      if (stdout[i] === "[") depth++;
      else if (stdout[i] === "]") { depth--; if (depth === 0) { jsonEnd = i; break; } }
    }
    if (jsonEnd < 0) {
      return { urls: [], error: "unterminated JSON array in eval output" };
    }
    let items: Array<{ src: string; left: number }>;
    try {
      const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
      items = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return { urls: [], error: `JSON parse failed: ${e instanceof Error ? e.message : e}` };
    }
    // Step 1: drop wrap-around copies positioned off-screen to the left.
    //   negative `left` means the carousel placed this image before the
    //   actual first slot for circular-scroll preview.
    const visible = items.filter((it) => typeof it.left === "number" && it.left >= 0);
    // Step 2: sort by `left` ascending — this is the author's canonical order.
    visible.sort((a, b) => a.left - b.left);
    // Step 3: dedupe by xhs image ID. xhs uses several CDN paths —
    // `/spectrum/`, `/notes_uhdr/`, etc. — and sometimes serves the same
    // image over both `https://` and `http://` in the same page. Extract
    // the image ID as the last path segment before `!` (which precedes
    // the encoding-param tail like `!nd_dft_wlteh_webp_3`). This is a
    // stable identifier across CDN-path / protocol / timestamp variations.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of visible) {
      if (typeof it.src !== "string") continue;
      // Prefer the `<segment>!` pattern (present on all xhs CDN URLs).
      // Fall back to full src if not found (shouldn't happen for xhscdn).
      const m = it.src.match(/\/([^/!]+)!/);
      const key = m ? m[1] : it.src;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it.src);
    }
    // Successful extraction — 0 urls is a valid outcome (non-image post).
    return { urls: out };
  } catch (e) {
    return {
      urls: [],
      error: `extractXhsImageUrlsInOrder threw: ${e instanceof Error ? e.message : e}`,
    };
  } finally {
    if (browserOpened) closeBrowser();
  }
}

/**
 * Download a remote URL to `destPath` via curl. Returns true on success.
 * Used by the xhs DOM-order reorder path — we can't rely on opencli to
 * give us the image URLs, so we fetch them ourselves in display order.
 *
 * Atomic: curl writes to `<destPath>.part`, size is verified (>1000 bytes
 * to filter out xhs's placeholder-error stubs), then renamed into place.
 */
export function downloadImageToPath(url: string, destPath: string): boolean {
  const tmpPath = `${destPath}.part`;
  const res = spawnSync(
    "curl",
    [
      "-fsSL",
      "--max-filesize", "20971520",  // 20 MB cap
      "--connect-timeout", "10",
      "--max-time", "45",
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-H", "Referer: https://www.xiaohongshu.com/",
      "-o", tmpPath,
      url,
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (res.status !== 0) {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return false;
  }
  let ok = false;
  try { ok = statSync(tmpPath).size > 1000; } catch { ok = false; }
  if (!ok) {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return false;
  }
  try {
    renameSync(tmpPath, destPath);
  } catch {
    try { if (existsSync(tmpPath)) rmSync(tmpPath, { force: true }); } catch {}
    return false;
  }
  return true;
}

/**
 * After opencli's `xiaohongshu download` has saved image files to slugDir
 * with its own `_1.jpg`-style ordering (which may NOT match the author's
 * intended display order), re-fetch images from the live xhs DOM in
 * display order and replace opencli's files. Returns the ordered list of
 * local filenames (`_01.jpg`, `_02.jpg`, ...); falls back to the
 * opencli-provided list on any failure.
 *
 * Strategy:
 *   1. Extract image URLs from the live post DOM (display order, deduped)
 *   2. Download each into `<noteid>_01.jpg`, `_02.jpg`, ... (zero-padded
 *      for cross-tool sort stability)
 *   3. Delete opencli's `_1.jpg` through `_N.jpg` files (they're the same
 *      images in a different order; keep disk tidy)
 *   4. Return the new ordered list
 */
/**
 * Reorder result: `files` is the final ordered image list (or opencli's
 * original if we couldn't improve), `error` is set ONLY when the DOM
 * extractor itself failed — lets the caller push `xhs-dom-extraction-failed`
 * onto quality_flags without conflating "no reorder needed" with
 * "reorder broken".
 */
interface XhsReorderResult {
  files: string[];
  error?: string;
}

export function reorderXhsImagesByDomPosition(
  url: string,
  slugDir: string,
  opencliFiles: string[],
  noteId: string | null,
): XhsReorderResult {
  if (opencliFiles.length === 0) return { files: opencliFiles };
  const extraction = extractXhsImageUrlsInOrder(url);
  if (extraction.error) {
    // DOM query failed. Surface the error; keep opencli's order.
    return { files: opencliFiles, error: extraction.error };
  }
  const orderedUrls = extraction.urls;
  if (orderedUrls.length === 0) return { files: opencliFiles };
  // Count-sanity:
  //   DOM == opencli  → normal case, reorder 1:1
  //   DOM <  opencli  → opencli has duplicates (e.g. same image returned
  //                     twice by the xhs note API). DOM's dedupe by ID is
  //                     authoritative — use DOM count, delete extras.
  //   DOM >  opencli  → something weird; trust opencli to avoid data loss.
  if (orderedUrls.length > opencliFiles.length) return { files: opencliFiles };

  const prefix = noteId || opencliFiles[0].replace(/_\d+\.[a-z]+$/i, "");
  // Pad to at least 2 digits so new filenames DIFFER from opencli's
  // `_1.jpg`..`_8.jpg` single-digit naming. Otherwise name collision
  // causes the "delete opencli's files" step to delete our own downloads.
  const pad = Math.max(2, String(orderedUrls.length).length);
  const newFiles: string[] = [];
  for (let i = 0; i < orderedUrls.length; i++) {
    const ext = (orderedUrls[i].match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] ?? "jpg").toLowerCase();
    const name = `${prefix}_${String(i + 1).padStart(pad, "0")}.${ext === "jpeg" ? "jpg" : ext}`;
    const dest = join(slugDir, name);
    const ok = downloadImageToPath(orderedUrls[i], dest);
    if (!ok) {
      // Clean up partial downloads before aborting; keep opencli's originals
      for (const partial of newFiles) {
        try { rmSync(join(slugDir, partial), { force: true }); } catch {}
      }
      return { files: opencliFiles };
    }
    newFiles.push(name);
  }
  // Success — delete opencli's originals. Name collision is impossible now
  // because pad ≥ 2 ensures newFiles use `_01..._NN` while opencli used
  // `_1..._N`. Belt-and-suspenders: skip deleting any file whose name
  // appears in newFiles.
  const newSet = new Set(newFiles);
  for (const f of opencliFiles) {
    if (newSet.has(f)) continue;
    try { rmSync(join(slugDir, f), { force: true }); } catch {}
  }
  return { files: newFiles };
}

/**
 * Clean an xhs title for use as a search query. Strips the "小红书" suffix
 * (often appended to titles) and trims.
 */
function xhsSearchQuery(title: string): string {
  return title
    .replace(/\s*-?\s*小红书\s*$/, "")
    .trim()
    .slice(0, 80);
}

/**
 * Extract note-id from an xhs URL (full or xhslink form). Returns null if
 * the URL doesn't look like an xhs URL we recognize.
 */
export function extractXhsNoteId(url: string): string | null {
  // Full URL form: /discovery/item/<noteid> or /explore/<noteid> or /search_result/<noteid>
  const m = url.match(/\/(?:discovery\/item|explore|search_result)\/([a-f0-9]+)/i);
  if (m) return m[1];
  return null;
}

/**
 * Try to rescue a stale xsec_token URL by searching xhs for the note's
 * title. Returns a fresh search-result URL on a match, null otherwise.
 *
 * Strategy: search by title, check that the top result's note_id (if we
 * know ours) matches. If no id to verify, trust the top result if the
 * title substring matches.
 */
function findFreshXhsUrl(titleHint: string, originalUrl: string): string | null {
  if (!titleHint) return null;
  const query = xhsSearchQuery(titleHint);
  if (!query) return null;
  const targetId = extractXhsNoteId(originalUrl);
  let searchStdout = "";
  try {
    searchStdout = runOpencli(
      ["xiaohongshu", "search", query, "-f", "json", "--limit", "5"],
      { timeoutMs: 60_000 },
    );
  } catch {
    return null;
  }
  // Parse the JSON array (opencli emits rows)
  let rows: Array<{ url?: string; title?: string }>;
  try {
    const parsed = JSON.parse(searchStdout.slice(searchStdout.search(/[\[{]/)));
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
  // Prefer a row whose URL contains our target note-id; fall back to top
  // result when we don't have an id.
  if (targetId) {
    for (const row of rows) {
      if (row.url && row.url.includes(targetId)) return row.url;
    }
  }
  // No id match. Require a STRONG title match to avoid false positives
  // (xhs titles are often re-shared; many different posts mention the same
  // keyword). Accept a row only if either:
  //   (a) the returned title is a prefix of our query (xhs often truncates
  //       long titles with "..." or cuts at a shorter length), OR
  //   (b) the returned title is substantially (≥70% of its length) contained
  //       in our query as a contiguous substring
  //
  // The megatron case shows why: original title
  //   "megatron是一个伟大的工程但也有伟大的负担"
  // returned candidate
  //   "Slime集成了SGLang和Megatron"
  // share only "Megatron" (8 chars); rejecting this is correct.
  const queryLower = query.toLowerCase();
  const stripEllipsis = (s: string) => s.replace(/\s*(?:\.\.\.|…)\s*$/, "").trim();
  for (const row of rows) {
    if (!row.url || !row.title) continue;
    const titleLower = stripEllipsis(row.title.toLowerCase());
    if (titleLower.length < 6) continue;

    // (a) title is a prefix of query (handles xhs truncation of long titles)
    if (queryLower.startsWith(titleLower)) return row.url;

    // (b) find longest contiguous substring shared; accept iff it covers
    //     ≥70% of the shorter side (catches cases where the title has a
    //     few extra chars vs the query, or vice versa)
    let bestLen = 0;
    for (let i = 0; i < queryLower.length; i++) {
      for (let j = 0; j < titleLower.length; j++) {
        let k = 0;
        while (
          i + k < queryLower.length &&
          j + k < titleLower.length &&
          queryLower[i + k] === titleLower[j + k]
        ) k++;
        if (k > bestLen) bestLen = k;
      }
    }
    const shortLen = Math.min(queryLower.length, titleLower.length);
    if (bestLen >= Math.ceil(shortLen * 0.7) && bestLen >= 10) {
      return row.url;
    }
  }
  return null;
}
