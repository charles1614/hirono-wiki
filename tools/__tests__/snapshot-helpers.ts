/**
 * Helpers for the per-host snapshot regression suite.
 *
 * Each per-host snapshot pairs a known-good `content.md` with a sidecar
 * `<slug>.invariants.json` capturing feature counts captured at snapshot time.
 * The snapshot test asserts the FRESH fetch's counts match the sidecar within
 * the tolerances documented in the plan ("Snapshot invariants" section):
 *
 *   exact:       h1, frontmatter present, remote-image refs == 0,
 *                fences, tables, images, chrome denylist == 0
 *   ±1:          h2 count
 *   ±2:          h3 count
 *   not asserted: body_chars (byte length flakes on legit edits)
 *
 * Usage from the CLI to regenerate a sidecar after a fresh fetch:
 *
 *   npx tsx tools/__tests__/snapshot-helpers.ts capture <snapshot-md-path>
 *
 * which writes <snapshot-md-path-without-.md>.invariants.json next to it.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, basename, join } from "node:path";

export interface SnapshotInvariants {
  /** §2 contract: exactly one `# ` heading at column 0 outside code fences. */
  h1: number;
  /** First 10 lines contain `> 原文链接:`. */
  frontmatter_present: boolean;
  /** Number of remote `![alt](http(s)://…)` image refs in body (must be 0). */
  remote_images: number;
  /** Count of ` ``` ` fence lines (NOT pairs) — should match snapshot exactly. */
  fences: number;
  /** Count of lines starting with `|` (table rows or separators). */
  tables: number;
  /** Count of `![alt](path)` image refs (any local or remote). */
  images: number;
  /** Count of `^## ` headings outside code fences (tolerance ±1). */
  h2s: number;
  /** Count of `^### ` headings outside code fences (tolerance ±2). */
  h3s: number;
  /** Body length post-frontmatter (in chars). NOT asserted; tracked for diagnostics. */
  body_chars: number;
  /** Bare-text lines matching the chrome denylist (must equal zero). */
  chrome_denylist_matches: number;
  /** Runs of 3+ asterisks `\*{3,}` outside code fences (must be 0; signals
   *  unbalanced bold from nested-emphasis HTML — see `normalizeEmphasis` in
   *  `tools/sites/weixin/converter.ts`). */
  unbalanced_bold_runs: number;
  /** Empty-text headings like `## ` with no content (must be 0; signals
   *  H1-demotion artifact when the source's H1 first child was decorative
   *  whitespace). */
  empty_headings: number;
  /** Any line containing `附录（位置未识别）` (must be 0; the legacy
   *  weixin-DOM splicer's "couldn't anchor; appended at end" sentinel — its
   *  presence means content placement failed). */
  splicer_appendix_markers: number;
}

/**
 * Lines whose ENTIRE content (after trim) equals one of these strings are
 * treated as standalone chrome and must NOT appear in the body. Substring
 * matches inside prose are NOT asserted (so "Click Subscribe to..." passes).
 */
export const CHROME_DENYLIST: ReadonlySet<string> = new Set([
  "Subscribe", "Share", "Copy link", "Comment", "Like", "Save", "Follow",
  "More", "Open in App",
  "订阅", "分享", "复制链接", "评论", "点赞", "关注", "收藏",
]);

/**
 * Compute feature counts from a markdown string. Fence-aware: lines inside
 * triple-backtick fences are excluded from heading / table / chrome counts.
 */
export function countFeatures(md: string): SnapshotInvariants {
  const sepIdx = md.indexOf("\n---\n");
  const preamble = sepIdx >= 0 ? md.slice(0, sepIdx + 5) : "";
  const body = sepIdx >= 0 ? md.slice(sepIdx + 5) : md;

  // Frontmatter check: does any of the first 10 lines have `> 原文链接:`?
  const firstLines = md.split("\n").slice(0, 10).join("\n");
  const frontmatter_present = /^> 原文链接:/m.test(firstLines);

  let h1 = 0;
  let h2s = 0;
  let h3s = 0;
  let fences = 0;
  let tables = 0;
  let chromeMatches = 0;
  let inFence = false;

  // Walk WHOLE document for h1 (preamble has the canonical title)
  for (const l of md.split("\n")) {
    if (/^```/.test(l.trim())) {
      fences++;
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^# /.test(l)) h1++;
  }

  // Walk BODY only for body-level features
  inFence = false;
  for (const l of body.split("\n")) {
    if (/^```/.test(l.trim())) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^## /.test(l)) h2s++;
    else if (/^### /.test(l)) h3s++;
    if (/^\|/.test(l)) tables++;
    if (CHROME_DENYLIST.has(l.trim())) chromeMatches++;
  }

  // Image count + remote-image count (anywhere in body, ignore code fences)
  let images = 0;
  let remote_images = 0;
  inFence = false;
  for (const l of body.split("\n")) {
    if (/^```/.test(l.trim())) { inFence = !inFence; continue; }
    if (inFence) continue;
    for (const m of l.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      images++;
      if (/^https?:\/\//i.test(m[1])) remote_images++;
    }
  }

  // Quality-defect counts — each MUST be zero, surfaced as hard-rule
  // assertions in per-host-snapshot.test.ts.
  let unbalanced_bold_runs = 0;
  let empty_headings = 0;
  let splicer_appendix_markers = 0;
  inFence = false;
  for (const l of md.split("\n")) {
    if (/^```/.test(l.trim())) { inFence = !inFence; continue; }
    if (inFence) continue;
    // Unbalanced bold runs:
    //   (a) Three+ consecutive asterisks (`****X****`, `******X******`) from
    //       self-nested <strong> chains.
    //   (b) Odd number of `**` markers on a line (`**A**丨B**` = 3 markers
    //       from adjacent <strong>s with text between). After stripping
    //       inline-code spans (which can legitimately contain `**` like
    //       Python's `2**(10+i)`), an odd count means at least one open
    //       without close.
    if (/\*{3,}/.test(l)) {
      unbalanced_bold_runs++;
    } else {
      // Strip CommonMark-style inline-code spans of any backtick width:
      // `` ` `…` ``, `` `` `…` `` ``, etc. Width-matched closing.
      const stripped = l.replace(/(`+)[^\n]*?\1/g, "");
      const matches = stripped.match(/\*\*/g);
      if (matches && matches.length % 2 === 1) unbalanced_bold_runs++;
    }
    // Empty ATX heading like `## ` with no text — H1-demotion artifact.
    if (/^#{1,6}\s*$/.test(l)) empty_headings++;
    // Legacy weixin DOM-splicer's "couldn't anchor" sentinel.
    if (l.includes("附录（位置未识别）")) splicer_appendix_markers++;
  }

  return {
    h1,
    frontmatter_present,
    remote_images,
    fences,
    tables,
    images,
    h2s,
    h3s,
    body_chars: body.length,
    chrome_denylist_matches: chromeMatches,
    unbalanced_bold_runs,
    empty_headings,
    splicer_appendix_markers,
  };
}

/** Path of the invariants sidecar for a given snapshot file. */
export function invariantsPathFor(snapshotPath: string): string {
  // foo/bar/<slug>.md → foo/bar/<slug>.invariants.json
  const dir = dirname(snapshotPath);
  const base = basename(snapshotPath).replace(/\.md$/, "");
  return join(dir, `${base}.invariants.json`);
}

export function loadInvariants(snapshotPath: string): SnapshotInvariants {
  const p = invariantsPathFor(snapshotPath);
  if (!existsSync(p)) {
    throw new Error(`Missing invariants sidecar at ${p}`);
  }
  return JSON.parse(readFileSync(p, "utf8")) as SnapshotInvariants;
}

export function writeInvariants(snapshotPath: string, inv: SnapshotInvariants): void {
  const p = invariantsPathFor(snapshotPath);
  writeFileSync(p, JSON.stringify(inv, null, 2) + "\n");
}

/**
 * Compare a fresh fetch's invariants against a sidecar. Returns a list of
 * human-readable failure messages, or an empty list if all checks pass.
 */
export function diffInvariants(
  fresh: SnapshotInvariants,
  expected: SnapshotInvariants,
  label: string,
): string[] {
  const fails: string[] = [];
  const eq = (k: keyof SnapshotInvariants, kind: string) => {
    if (fresh[k] !== expected[k]) {
      fails.push(`${label}: ${kind} ${String(k)} = ${String(fresh[k])} (expected ${String(expected[k])})`);
    }
  };
  const tol = (k: keyof SnapshotInvariants, allow: number) => {
    const f = fresh[k] as number;
    const e = expected[k] as number;
    if (Math.abs(f - e) > allow) {
      fails.push(`${label}: ${String(k)} = ${f} (expected ${e} ±${allow})`);
    }
  };
  eq("h1", "exact");
  eq("frontmatter_present", "exact");
  eq("remote_images", "exact");
  eq("fences", "exact");
  eq("tables", "exact");
  eq("images", "exact");
  eq("chrome_denylist_matches", "exact");
  eq("unbalanced_bold_runs", "exact");
  eq("empty_headings", "exact");
  eq("splicer_appendix_markers", "exact");
  tol("h2s", 1);
  tol("h3s", 2);
  // body_chars intentionally NOT asserted
  return fails;
}

// ---------------------------------------------------------------------------
// CLI: `npx tsx tools/__tests__/snapshot-helpers.ts capture <path>`
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, target] = process.argv.slice(2);
  if (cmd === "capture" && target) {
    const md = readFileSync(target, "utf8");
    const inv = countFeatures(md);
    writeInvariants(target, inv);
    console.log(`captured invariants → ${invariantsPathFor(target)}`);
    console.log(JSON.stringify(inv, null, 2));
  } else {
    console.error("usage: snapshot-helpers.ts capture <path/to/snapshot.md>");
    process.exit(2);
  }
}
