/**
 * linux.do is a Discourse instance. Discourse exposes a JSON API for every
 * topic at `<topic-url>.json` — that's the source of truth here, not opencli's
 * lossy web-read of the rendered HTML.
 *
 * Cloudflare gotcha: linux.do guards `/posts.json?post_ids[]=...` with a
 * Cloudflare browser-challenge that plain curl can't pass. So:
 *
 *   1. Initial topic JSON via plain curl (un-challenged) → 20 posts.
 *   2. For posts beyond the first 20, page through `/t/topic/<id>/<N>.json`
 *      (post-number pagination) using opencli's browser session, which
 *      carries the Cloudflare cookie. Each request returns ~20 more posts.
 *   3. We cap at `maxPosts` (default 50) so a 1k-post mega-thread doesn't
 *      explode the archive.
 */

import { execSync, spawnSync } from "node:child_process";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../_shared/browser-helpers.ts";

const MAX_POSTS_DEFAULT = 50;
const POSTS_PER_PAGE = 20;
const FETCH_TIMEOUT_MS = 30_000;

export interface LinuxDoPost {
  id: number;
  post_number: number;
  username: string;
  name?: string;
  cooked: string;
  created_at: string;
  reply_to_post_number?: number | null;
  reads?: number;
  score?: number;
  reply_count?: number;
}

export interface LinuxDoTopic {
  id: number;
  title: string;
  fancy_title?: string;
  posts_count: number;
  views?: number;
  like_count?: number;
  reply_count?: number;
  created_at: string;
  category_id?: number;
  tags?: Array<{ name: string; slug?: string }>;
  /**
   * Posts INCLUDED in our fetch. Always starts with the OP, capped at
   * `maxPosts`. The full topic may have more (`posts_count`).
   */
  posts: LinuxDoPost[];
  /** Canonical URL — `/t/topic/<id>` form, no post-number suffix. */
  canonicalUrl: string;
  finalUrl?: string;
  error?: string;
}

/**
 * Strip Discourse's `/N` post-number suffix and any tracking query params
 * to get the canonical topic URL.
 */
export function canonicalLinuxDoUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip query params + fragment — Discourse topic identity is just
    // the path. (`?utm_*` etc. are tracking; jump-to-post lives in the
    // path's trailing segment.)
    u.search = "";
    u.hash = "";
    // `/t/topic/<id>` keeps as-is. `/t/topic/<id>/<post-number>` →
    // strip the trailing post number. `/t/<slug>/<id>` → keep.
    const m = u.pathname.match(/^(\/t\/[^/]+\/\d+)(?:\/\d+)?\/?$/);
    if (m) u.pathname = m[1];
    return u.toString();
  } catch {
    return url;
  }
}

export interface LinuxDoFetchOpts {
  /** Cap on posts pulled into the archive. Default 50. */
  maxPosts?: number;
}

export function fetchLinuxDoTopic(url: string, opts: LinuxDoFetchOpts = {}): LinuxDoTopic {
  const cap = opts.maxPosts ?? MAX_POSTS_DEFAULT;
  const canonicalUrl = canonicalLinuxDoUrl(url);
  const jsonUrl = canonicalUrl.replace(/\/?$/, ".json");

  let initial: any;
  try {
    initial = JSON.parse(curlGet(jsonUrl));
  } catch (e) {
    return failed(canonicalUrl, `topic JSON fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (typeof initial !== "object" || initial === null || !initial.post_stream) {
    return failed(canonicalUrl, "topic JSON missing post_stream");
  }

  const stream: number[] = Array.isArray(initial.post_stream.stream)
    ? initial.post_stream.stream.filter((x: unknown): x is number => typeof x === "number")
    : [];
  const initialPosts: LinuxDoPost[] = (initial.post_stream.posts || []).map(normalizePost);
  const collected: LinuxDoPost[] = [...initialPosts];
  const have = new Set(collected.map((p) => p.id));

  // Need to fetch more? Use post-number pagination via the browser
  // session (Cloudflare-protected). Open ONCE, close in finally.
  const wantTotal = Math.min(cap, stream.length);
  if (collected.length < wantTotal) {
    let browserOpened = false;
    try {
      // Highest post_number we already have determines the next page start.
      // Discourse's `/N.json` returns posts starting at post_number N.
      let nextStart = Math.max(...collected.map((p) => p.post_number)) + 1;
      while (collected.length < wantTotal) {
        const pageUrl = `${canonicalUrl}/${nextStart}.json`;
        if (!browserOpened) {
          const openRes = spawnSync(
            "opencli",
            ["browser", "open", pageUrl],
            { encoding: "utf8", timeout: browserTimeoutMs("open") },
          );
          if (openRes.status !== 0) break;
          browserOpened = true;
        } else {
          const navRes = spawnSync(
            "opencli",
            ["browser", "open", pageUrl],
            { encoding: "utf8", timeout: browserTimeoutMs("open") },
          );
          if (navRes.status !== 0) break;
        }
        sleepMs(2000);
        const evalRes = spawnSync(
          "opencli",
          ["browser", "eval", "(() => document.body.textContent || '')()"],
          { encoding: "utf8", timeout: browserTimeoutMs("eval"), maxBuffer: 32 * 1024 * 1024 },
        );
        if (evalRes.status !== 0) break;
        const body = stripOpencliJsonWrapper(evalRes.stdout || "");
        let pageData: any;
        try { pageData = JSON.parse(body); } catch { break; }
        const more: LinuxDoPost[] = (pageData?.post_stream?.posts || []).map(normalizePost);
        if (more.length === 0) break;
        let added = 0;
        for (const p of more) {
          if (!have.has(p.id)) {
            collected.push(p);
            have.add(p.id);
            added++;
          }
        }
        if (added === 0) break;  // no progress — bail to avoid infinite loop
        nextStart = Math.max(...collected.map((p) => p.post_number)) + 1;
      }
    } finally {
      if (browserOpened) closeBrowser();
    }
  }

  collected.sort((a, b) => a.post_number - b.post_number);
  const capped = collected.slice(0, cap);

  return {
    id: initial.id,
    title: initial.title || "",
    fancy_title: initial.fancy_title,
    posts_count: initial.posts_count ?? capped.length,
    views: initial.views,
    like_count: initial.like_count,
    reply_count: initial.reply_count,
    created_at: initial.created_at || "",
    category_id: initial.category_id,
    tags: Array.isArray(initial.tags) ? initial.tags.map((t: any) => ({ name: t.name, slug: t.slug })) : undefined,
    posts: capped,
    canonicalUrl,
  };
}

function normalizePost(p: any): LinuxDoPost {
  return {
    id: p.id,
    post_number: p.post_number,
    username: p.username || "",
    name: p.name || undefined,
    cooked: p.cooked || "",
    created_at: p.created_at || "",
    reply_to_post_number: p.reply_to_post_number ?? null,
    reads: p.reads,
    score: p.score,
    reply_count: p.reply_count,
  };
}

function failed(canonicalUrl: string, error: string): LinuxDoTopic {
  return {
    id: 0,
    title: "",
    posts_count: 0,
    created_at: "",
    posts: [],
    canonicalUrl,
    error,
  };
}

function curlGet(url: string): string {
  // Discourse rate-limits aggressive scraping. A small UA + accept header
  // makes us look like a normal client; we don't try to bypass throttling.
  return execSync(
    `curl -fsSL --max-time ${Math.floor(FETCH_TIMEOUT_MS / 1000)} ` +
    `-H "Accept: application/json" ` +
    `-H "User-Agent: Mozilla/5.0 (compatible; wiki-archiver/0.1)" ` +
    `${JSON.stringify(url)}`,
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
}

/**
 * opencli's `browser eval` wraps the return value in additional shell
 * formatting + a trailing update banner. The actual JSON the page returned
 * is the longest prefix of stdout that parses. Trim banner + leading
 * whitespace, then return.
 */
function stripOpencliJsonWrapper(stdout: string): string {
  // The page's body is JSON text; opencli's eval returns it as the
  // function result's string. Find the first `{` and walk to its matched `}`.
  const start = stdout.indexOf("{");
  if (start < 0) return "";
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
  return end < 0 ? "" : stdout.slice(start, end + 1);
}
