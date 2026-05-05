/**
 * Cross-cutting markdown cleanups — apply to every URL's output
 * regardless of which site module produced it. These are the
 * "Bucket A" processors from the legacy `tools/hirono/shared/post-process.ts`
 * pipeline: pure, host-agnostic operations whose presence makes any
 * markdown output marginally cleaner without depending on the source.
 *
 * Run by `tools/fetch-raw.ts` after every `site.fetch()` returns,
 * and by callers that operate on already-fetched markdown
 * (raindrop export, sweep-issues, snapshot-create).
 *
 * What lives here (8 functions):
 *   - stripEmptyAnchorLinks          — `[](#anchor)` permalink chrome
 *   - stripShareWidgetLines          — Twitter / LinkedIn / "Share" rows
 *   - stripTrailingTagList           — concatenated `[tag1][tag2][tag3]` footers
 *   - stripDecorativeEmojiImages     — twemoji image refs → shortcodes
 *   - unescapeBracketsInLinks        — `[\[ref\]]` → `[[ref]]`
 *   - stripColorTags                 — `<text color="...">x</text>` → `x`
 *   - resolveRelativeImageUrls       — `/img.png` → absolute against origin
 *   - enforceSingleH1                — exactly one `#` per document
 *
 * What does NOT belong here:
 *   - host-specific cleanup (lives in the host's site module converter)
 *   - DOM-level transforms (live in `_shared/article-converter.ts`)
 *   - markdown-syntax fixes that should run pre-output (live in
 *     `_shared/markdown-cleanups.ts`)
 *
 * The internal implementations are still imported from
 * `tools/hirono/shared/post-process.ts` for now — when that file is
 * deleted (final cleanup), the 8 transforms move into this file.
 */

import type { PostProcessor } from "../../hirono/shared/post-process.ts";
import {
  stripEmptyAnchorLinks,
  stripShareWidgetLines,
  stripTrailingTagList,
  stripDecorativeEmojiImages,
  unescapeBracketsInLinks,
  stripColorTags,
  resolveRelativeImageUrls,
  enforceSingleH1,
} from "../../hirono/shared/post-process.ts";

/** Ordered Bucket A pipeline. Order matters: relative-URL resolution must
 *  run before strip-empty-anchor-links etc. so that resolved URLs survive
 *  later scrubbing passes. enforceSingleH1 runs last so it can demote any
 *  body H1 the host's converter emitted. */
const POST_CLEANUPS: readonly PostProcessor[] = [
  resolveRelativeImageUrls,
  stripEmptyAnchorLinks,
  stripDecorativeEmojiImages,
  stripTrailingTagList,
  stripShareWidgetLines,
  unescapeBracketsInLinks,
  stripColorTags,
  enforceSingleH1,
];

export interface PostCleanupResult {
  md: string;
  /** Names of cleanups that actually changed something. */
  appliedNames: string[];
  /** New absolute image URLs surfaced by `resolveRelativeImageUrls`. */
  newAbsoluteImageUrls: string[];
  /** Notes from each cleanup, concatenated. */
  notes: string[];
  /** Quality flags surfaced by cleanups (rare; mostly empty). */
  extraFlags: string[];
}

/**
 * Run the cross-cutting cleanup pipeline. Always runs every cleanup
 * — these are host-agnostic. The `originUrl` is used by
 * `resolveRelativeImageUrls` to compute absolute URLs.
 */
export function applyPostCleanups(md: string, originUrl: string): PostCleanupResult {
  let current = md;
  const applied: string[] = [];
  const notes: string[] = [];
  const urls: string[] = [];
  const flags: string[] = [];
  for (const p of POST_CLEANUPS) {
    const r = p.transform(current, originUrl);
    const hasFlags = (r.extraFlags?.length ?? 0) > 0;
    if (r.md !== current || r.notes.length > 0 || r.newAbsoluteImageUrls.length > 0 || hasFlags) {
      applied.push(p.name);
    }
    current = r.md;
    notes.push(...r.notes);
    urls.push(...r.newAbsoluteImageUrls);
    if (r.extraFlags) flags.push(...r.extraFlags);
  }
  return { md: current, appliedNames: applied, newAbsoluteImageUrls: urls, notes, extraFlags: flags };
}
