/**
 * xhs site module — covers xhslink.com (shortlinks) and xiaohongshu.com.
 *
 * Pipeline:
 *
 *   1. Open the URL in opencli's headless browser (handles redirect
 *      from xhslink shortlinks → fresh xsec_token URL + xhs login session).
 *   2. Single eval pass extracts: title + descText + author + stats +
 *      image URLs + finalUrl. (See `extractXhsFullContent` in fetch-raw.ts;
 *      will move to fetcher.ts when a second site needs to share helpers.)
 *   3. Download images via curl, naming follows `<noteid>_NN.jpg`.
 *   4. Convert raw `descText` → §2-contract markdown via `convertXhsHtml`
 *      (paragraph splits on `\n\t\n`, trailing tags-only paragraph pulled
 *      into the `**标签 / Tags:**` line).
 *   5. If descText was empty (image-only post / auth failure), fall back
 *      to opencli `xiaohongshu download` for images and emit a
 *      `| field | value |` stub. The downstream xhsReformatNoteTable
 *      post-processor reformats the stub into §2.
 *
 * Reference implementation for the per-host site-module architecture
 * (see `~/.claude/plans/parsed-meandering-beaver.md`).
 */

import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { Site } from "../_shared/types.ts";
import { convertXhsHtml } from "./converter.ts";
import {
  extractXhsFullContent,
  extractXhsNoteId,
  downloadImageToPath,
  collectXhsAssets,
  reorderXhsImagesByDomPosition,
} from "./browser-extract.ts";
import { runOpencli, sleepMs } from "../_shared/browser-helpers.ts";

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export const site: Site = {
  name: "xhs",
  match: (url) => {
    const h = hostOf(url);
    return h === "xhslink.com" || h === "xiaohongshu.com" || /(?:^|\.)xiaohongshu\.com$/.test(h);
  },
  fetch: (url, opts) => {
    const beforeMtime = Date.now();
    mkdirSync(opts.slugDir, { recursive: true });

    const adapterNotes: string[] = [];
    const flags: string[] = [];
    const slugDir = opts.slugDir;

    // 1. Layer-4 body extraction
    const xhsFull = extractXhsFullContent(url);
    if (xhsFull.error) {
      adapterNotes.push(`xhs Layer-4 browser extraction failed: ${xhsFull.error.slice(0, 120)}`);
    } else if (xhsFull.descText.trim().length > 0) {
      const noteId = extractXhsNoteId(xhsFull.finalUrl || url) || extractXhsNoteId(url) || "xhs";
      // Canonical pattern: converter pre-allocates filenames + emits
      // `imagesToDownload`. Runtime here iterates that list to fetch.
      const conv = convertXhsHtml(
        xhsFull.descText,
        {
          title: xhsFull.title,
          author: xhsFull.author,
          likes: xhsFull.likes,
          collects: xhsFull.collects,
          comments: xhsFull.comments,
        },
        url,
        xhsFull.imageUrls,
        noteId,
      );
      const layer4Images: string[] = [];
      for (const dl of conv.imagesToDownload) {
        const dest = join(slugDir, dl.localFilename);
        if (downloadImageToPath(dl.remoteUrl, dest)) layer4Images.push(dl.localFilename);
      }
      adapterNotes.push(
        `xhs Layer-4: ${conv.stats.paragraphs} paragraph(s), ${conv.stats.tagsExtracted} tag(s), ${layer4Images.length}/${conv.imagesToDownload.length} image(s) downloaded`,
      );
      return {
        markdown: conv.markdown,
        title: xhsFull.title || undefined,
        images: layer4Images,
        metadata: {
          source: "xhs-raw-layer4",
          title: xhsFull.title,
          author: xhsFull.author,
          likes: xhsFull.likes,
          collects: xhsFull.collects,
          comments: xhsFull.comments,
        },
        flags,
        notes: adapterNotes,
      };
    } else {
      adapterNotes.push("xhs Layer-4: empty descText (likely image-only post or auth failure); falling back to legacy stub path");
    }

    // 2. Legacy stub path — image-only posts only
    flags.push("xhs-text-body-unavailable", "intentional-stub");
    let imageFiles: string[] = [];
    let downloadCallSucceeded = false;
    try {
      runOpencli(
        ["xiaohongshu", "download", url, "--output", slugDir, "-f", "json"],
        { timeoutMs: 120_000 },
      );
      downloadCallSucceeded = true;
      imageFiles = collectXhsAssets(slugDir, beforeMtime);
    } catch {
      adapterNotes.push("xhs download errored on first attempt");
    }

    if (downloadCallSucceeded && imageFiles.length === 0) {
      adapterNotes.push("xhs download produced 0 files; retrying once after 5s");
      sleepMs(5_000);
      const retryMtime = Date.now();
      try {
        runOpencli(
          ["xiaohongshu", "download", url, "--output", slugDir, "-f", "json"],
          { timeoutMs: 120_000 },
        );
        imageFiles = collectXhsAssets(slugDir, retryMtime);
      } catch {
        adapterNotes.push("xhs download retry errored");
      }
      if (imageFiles.length === 0) {
        flags.push("xhs-download-silent-fail");
        adapterNotes.push("xhs download silently failed twice — accepting note-only content");
      } else {
        adapterNotes.push(`xhs download retry recovered ${imageFiles.length} files`);
      }
    }

    // Remove any empty subdirectory the download command created
    for (const e of readdirSync(slugDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const subdir = join(slugDir, e.name);
      try {
        if (readdirSync(subdir).length === 0) rmSync(subdir, { recursive: true, force: true });
      } catch {}
    }

    // Reorder images by DOM display order
    if (imageFiles.length > 0) {
      const noteIdMatch = imageFiles[0].match(/^([^_]+)_\d+\./);
      const noteId = noteIdMatch ? noteIdMatch[1] : null;
      const { files: reordered, error: reorderError } = reorderXhsImagesByDomPosition(
        url, slugDir, imageFiles, noteId,
      );
      if (reorderError) {
        flags.push("xhs-dom-extraction-failed");
        adapterNotes.push(`xhs: DOM extraction failed (${reorderError.slice(0, 120)}); keeping opencli image order`);
      }
      if (reordered !== imageFiles) {
        adapterNotes.push(`xhs: reordered ${reordered.length} image(s) to match DOM display order`);
        imageFiles = reordered;
      }
    }

    // Assemble §2-shaped stub markdown directly (no post-processor reformat
    // needed — the legacy xhsReformatNoteTable converter is gone).
    const title = opts.titleHint?.trim() || "(Xiaohongshu note — title unavailable)";
    let markdown =
      `# ${title}\n\n` +
      `> 原文链接: ${url}\n` +
      `> Status: text-body-unavailable — xhs requires a fresh xsec_token; saved bookmarks use stale tokens.\n\n` +
      `---\n\n` +
      `*This entry is a metadata stub. Text body could not be extracted; ` +
      `images are fetched below where possible.*\n`;
    if (imageFiles.length > 0) {
      markdown += "\n## Images\n\n";
      imageFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      for (const f of imageFiles) markdown += `![${f}](${f})\n`;
      markdown += "\n";
    }

    return {
      markdown,
      images: imageFiles,
      metadata: { source: "xhs-stub", title },
      flags,
      notes: adapterNotes,
    };
  },
};
