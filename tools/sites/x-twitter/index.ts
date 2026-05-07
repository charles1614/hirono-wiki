/**
 * x.com / twitter.com — authenticated browser-eval extraction.
 *
 * X.com requires authentication to render tweet content reliably.
 * Plain curl returns the "Sign in to X" shell. opencli's browser
 * bridge (Chrome extension) forwards the operator's logged-in
 * session, so `browser open` + `eval` against a tweet URL returns
 * fully-hydrated `<article data-testid=tweet>` elements with
 * structured author / datetime / text / media metadata.
 *
 * Three URL shapes:
 *
 *   /<user>/status/<id>      — the OP tweet, plus the visible
 *                              reply / quote-tweet thread context
 *                              that X renders below it.
 *   /<user>                  — profile page; user bio + a few
 *                              recent timeline tweets.
 *   /i/status/<id>           — id-only tweet URL (less common);
 *                              treated as a status URL.
 *
 * Stub fallback when the browser session isn't signed in, the URL
 * 404s (deleted/suspended), or the eval returns no articles.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { sleepMs, closeBrowser, browserTimeoutMs } from "../_shared/browser-helpers.ts";
import { downloadImage } from "../../fetch-raw.ts";

interface XMediaRef {
  /** Source URL (pbs.twimg.com/media/...). */
  remoteUrl: string;
  /** Tweet-status URL the media is linked to (for the photo lightbox), if any. */
  linkedStatus?: string;
}

interface XTweet {
  /** Display name + handle, e.g. "Andrej Karpathy@karpathy". */
  authorRaw: string;
  /** Display name parsed from authorRaw. */
  displayName: string;
  /** Handle without @ prefix. */
  handle: string;
  /** ISO datetime from the <time> element, or empty if not visible. */
  datetime: string;
  /** Plain-text tweet content from [data-testid=tweetText]. */
  text: string;
  /** Media URLs (status photo refs only — not avatars / link cards). */
  media: XMediaRef[];
  /** True if this tweet is a quote-tweet of another tweet. */
  isQuote: boolean;
  /** True if this article is the canonical OP for the requested URL. */
  isOp: boolean;
}

interface XProfile {
  userNameRaw: string;
  displayName: string;
  handle: string;
  description: string;
}

interface XExtraction {
  finalUrl: string;
  shape: "status" | "profile" | "unknown";
  signedIn: boolean;
  title: string;
  tweets: XTweet[];
  profile?: XProfile;
  error?: string;
}

interface XConvertArgs {
  url: string;
  finalUrl: string;
  shape: "status" | "profile";
  signedIn: boolean;
  tweets: XTweet[];
  profile?: XProfile;
}

interface XConvertResult {
  markdown: string;
  imagesToDownload: { remoteUrl: string; localFilename: string }[];
  metadata: { shape: string; handle: string; datetime: string; tweet_count: number };
  stats: { bodyChars: number; tweetCount: number; mediaCount: number };
}

const HOSTS = new Set(["x.com", "twitter.com", "www.x.com", "www.twitter.com"]);

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function pathOf(url: string): string {
  try { return new URL(url).pathname; }
  catch { return ""; }
}

function classifyShape(url: string): "status" | "profile" | "unknown" {
  const p = pathOf(url);
  if (/^\/[^/]+\/status\/\d+/.test(p)) return "status";
  if (/^\/i\/status\/\d+/.test(p)) return "status";
  if (/^\/[^/]+\/?$/.test(p) && !/^\/i\/?$/.test(p)) return "profile";
  return "unknown";
}

function extractXTwitter(url: string): XExtraction {
  const empty = (over: Partial<XExtraction> = {}): XExtraction => ({
    finalUrl: url, shape: classifyShape(url), signedIn: false,
    title: "", tweets: [], ...over,
  });

  let opened = false;
  try {
    const openRes = spawnSync("opencli", ["browser", "open", url], {
      encoding: "utf8",
      timeout: browserTimeoutMs("open"),
    });
    if (openRes.status !== 0) {
      return empty({ error: `browser open failed: ${(openRes.stderr || "").slice(0, 200)}` });
    }
    opened = true;
    sleepMs(4000);

    const evalScript = `(() => {
      const path = window.location.pathname;
      const isStatus = /^\\/(?:[^/]+|i)\\/status\\/\\d+/.test(path);
      const shape = isStatus ? "status" : (/^\\/[^/]+\\/?$/.test(path) ? "profile" : "unknown");

      const signinBtn = document.querySelector('a[href="/login"], a[href="/i/flow/login"]');
      const signedIn = !signinBtn;

      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const opAuthorMatch = path.match(/^\\/([^/]+)\\/status\\//);
      const opHandleFromUrl = opAuthorMatch ? opAuthorMatch[1].toLowerCase() : "";

      const tweets = articles.map((a, idx) => {
        const userNameEl = a.querySelector('[data-testid="User-Name"]');
        const authorRaw = userNameEl ? (userNameEl.textContent || "").trim() : "";
        const handleMatch = authorRaw.match(/@([A-Za-z0-9_]+)/);
        const handle = handleMatch ? handleMatch[1] : "";
        const displayName = handle
          ? authorRaw.split("@" + handle)[0].trim()
          : authorRaw;

        const textEl = a.querySelector('[data-testid="tweetText"]');
        const text = textEl ? (textEl.textContent || "").trim() : "";

        const timeEl = a.querySelector("time");
        const datetime = timeEl ? (timeEl.getAttribute("datetime") || "") : "";

        const photoNodes = Array.from(a.querySelectorAll('div[data-testid="tweetPhoto"] img'));
        const media = photoNodes.map(img => {
          const src = img.getAttribute("src") || "";
          let p = img.parentElement;
          let linkedStatus = "";
          while (p && p !== a) {
            if (p.tagName === "A") { linkedStatus = p.getAttribute("href") || ""; break; }
            p = p.parentElement;
          }
          return { remoteUrl: src, linkedStatus };
        }).filter(m => m.remoteUrl);

        const isQuote = !!a.querySelector('article[data-testid="tweet"]');
        const isOp = isStatus
          ? (handle.toLowerCase() === opHandleFromUrl && idx < 3)
          : idx === 0;

        return { authorRaw, displayName, handle, datetime, text, media, isQuote, isOp };
      });

      let profile = null;
      if (shape === "profile") {
        const userNameEl = document.querySelector('[data-testid="UserName"]');
        const userDescEl = document.querySelector('[data-testid="UserDescription"]');
        const userNameRaw = userNameEl ? (userNameEl.textContent || "").trim() : "";
        const handleMatch = userNameRaw.match(/@([A-Za-z0-9_]+)/);
        const handle = handleMatch ? handleMatch[1] : "";
        const displayName = handle
          ? userNameRaw.split("@" + handle)[0].trim()
          : userNameRaw;
        profile = {
          userNameRaw, displayName, handle,
          description: userDescEl ? (userDescEl.textContent || "").trim() : "",
        };
      }

      return JSON.stringify({
        finalUrl: window.location.href,
        shape, signedIn,
        title: document.title,
        tweets, profile,
      });
    })()`;

    const evalRes = spawnSync("opencli", ["browser", "eval", evalScript], {
      encoding: "utf8",
      timeout: browserTimeoutMs("eval"),
      maxBuffer: 64 * 1024 * 1024,
    });
    if (evalRes.status !== 0) {
      return empty({ error: `browser eval failed: ${(evalRes.stderr || "").slice(0, 200)}` });
    }

    const stdout = evalRes.stdout || "";
    const start = stdout.indexOf("{");
    if (start < 0) return empty({ error: "no JSON in eval output" });
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < stdout.length; i++) {
      const c = stdout[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) return empty({ error: "unterminated JSON" });

    const p = JSON.parse(stdout.slice(start, end + 1));
    return {
      finalUrl: p.finalUrl || url,
      shape: p.shape || classifyShape(url),
      signedIn: !!p.signedIn,
      title: p.title || "",
      tweets: Array.isArray(p.tweets) ? p.tweets : [],
      profile: p.profile || undefined,
    };
  } catch (e) {
    return empty({ error: `extractXTwitter threw: ${e instanceof Error ? e.message : e}` });
  } finally {
    if (opened) closeBrowser();
  }
}

function guessExt(url: string): string {
  try {
    const u = new URL(url);
    const fmt = u.searchParams.get("format");
    if (fmt) return `.${fmt.toLowerCase()}`;
  } catch { /* fall through */ }
  const m = url.match(/\.(jpg|jpeg|png|webp|gif)(?:\?|$)/i);
  return m ? `.${m[1].toLowerCase()}` : ".jpg";
}

export function convertXTwitter(opts: XConvertArgs): XConvertResult {
  const allImages: { remoteUrl: string; localFilename: string }[] = [];
  let imgCounter = 0;

  const renderTweet = (t: XTweet, fallbackHref: string): string => {
    const authorLine = t.handle
      ? `**${t.displayName || t.handle}** [@${t.handle}](https://x.com/${t.handle})`
      : `**${t.displayName || "Unknown"}**`;
    const dateLine = t.datetime ? ` · [${t.datetime.slice(0, 10)}](${fallbackHref})` : "";
    const lines: string[] = [];
    lines.push(`${authorLine}${dateLine}`);
    lines.push("");
    if (t.text) {
      lines.push(t.text);
      lines.push("");
    }
    for (const m of t.media) {
      imgCounter++;
      const ext = guessExt(m.remoteUrl);
      const localFilename = `x-twitter-img-${String(imgCounter).padStart(3, "0")}${ext}`;
      allImages.push({ remoteUrl: m.remoteUrl, localFilename });
      lines.push(`![](${localFilename})`);
      lines.push("");
    }
    return lines.join("\n").trimEnd();
  };

  let title: string;
  let frontmatterMeta: string[] = [];
  let opTweet: XTweet | undefined;

  if (opts.shape === "profile" && opts.profile) {
    title = `@${opts.profile.handle || "x-user"} on X`;
    frontmatterMeta.push(`> 作者: [${opts.profile.displayName}](https://x.com/${opts.profile.handle})`);
    if (opts.profile.description) {
      frontmatterMeta.push(`> ${opts.profile.description}`);
    }
  } else {
    opTweet = opts.tweets.find(t => t.isOp) || opts.tweets[0];
    if (opTweet) {
      const opHandle = opTweet.handle || "x-user";
      const summary = (opTweet.text || "").replace(/\s+/g, " ").trim().slice(0, 80);
      title = summary
        ? `@${opHandle}: ${summary}${opTweet.text.length > 80 ? "…" : ""}`
        : `Tweet by @${opHandle}`;
      frontmatterMeta.push(`> 作者: [${opTweet.displayName || opHandle}](https://x.com/${opHandle})`);
      if (opTweet.datetime) {
        frontmatterMeta.push(`> 发表于: ${opTweet.datetime.slice(0, 10)}`);
      }
    } else {
      title = "Tweet (content empty)";
    }
  }

  const fm: string[] = [
    `# ${title}`,
    "",
    `> 原文链接: ${opts.url}`,
    ...frontmatterMeta,
    "",
    "---",
    "",
  ];

  const sections: string[] = [];

  if (opts.shape === "status" && opTweet) {
    sections.push(renderTweet(opTweet, opts.finalUrl));
    sections.push("");
    const others = opts.tweets.filter(t => t !== opTweet && t.text);
    if (others.length > 0) {
      sections.push("## Replies / Thread context");
      sections.push("");
      for (const t of others) {
        sections.push("---");
        sections.push("");
        sections.push(renderTweet(t, opts.finalUrl));
        sections.push("");
      }
    }
  } else if (opts.shape === "profile") {
    const visible = opts.tweets.filter(t => t.text);
    if (visible.length > 0) {
      sections.push("## Recent tweets");
      sections.push("");
      for (let i = 0; i < visible.length; i++) {
        if (i > 0) {
          sections.push("---");
          sections.push("");
        }
        sections.push(renderTweet(visible[i], opts.finalUrl));
        sections.push("");
      }
    }
  }

  let markdown = fm.join("\n") + sections.join("\n");
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  const handle = opts.shape === "profile"
    ? (opts.profile?.handle || "")
    : (opTweet?.handle || "");
  const datetime = opTweet?.datetime || "";

  return {
    markdown,
    imagesToDownload: allImages,
    metadata: {
      shape: opts.shape,
      handle,
      datetime,
      tweet_count: opts.tweets.length,
    },
    stats: {
      bodyChars: markdown.length,
      tweetCount: opts.tweets.length,
      mediaCount: allImages.length,
    },
  };
}

function stub(url: string, kind: "auth-required" | "empty" | "extraction-failed", reason: string): Result {
  const titleMap = {
    "auth-required": "Tweet / X post (sign-in required)",
    "empty": "Tweet / X post (no content extracted)",
    "extraction-failed": "Tweet / X post (extraction failed)",
  } as const;
  const adviceMap = {
    "auth-required":
      "The opencli browser session isn't signed in to x.com. Sign in via " +
      "the linked Chrome session, then re-fetch.",
    "empty":
      "The page rendered but no tweet articles were found — the post " +
      "may have been deleted, the account suspended/protected, or X " +
      "may have throttled this view. Try opening the URL manually.",
    "extraction-failed":
      "Browser eval did not return parseable JSON. Could be a transient " +
      "opencli/Chrome issue; retry the fetch.",
  } as const;
  return {
    markdown: [
      `# ${titleMap[kind]}`,
      ``,
      `> 原文链接: ${url}`,
      `> Status: ${reason}`,
      ``,
      `---`,
      ``,
      `*This entry is a metadata stub. ${adviceMap[kind]}*`,
      ``,
    ].join("\n"),
    images: [],
    metadata: { source: "x-twitter-stub", reason, kind },
    flags: ["intentional-stub", `x-twitter-${kind}`],
    notes: [`x-twitter: stub emitted — ${kind}: ${reason}`],
  };
}

export const site: Site = {
  name: "x-twitter",
  match: (url: string) => HOSTS.has(hostOf(url)),
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });

    const x = extractXTwitter(url);
    if (x.error) return stub(url, "extraction-failed", x.error.slice(0, 160));
    if (!x.signedIn) return stub(url, "auth-required", "browser session is not signed in to x.com");

    if (x.shape === "status" && x.tweets.length === 0) {
      return stub(url, "empty", "no tweet articles in hydrated DOM");
    }
    if (x.shape === "profile" && !x.profile) {
      return stub(url, "empty", "profile header missing in hydrated DOM");
    }
    if (x.shape === "unknown") {
      return stub(url, "empty", `unrecognized URL shape (path=${pathOf(url)})`);
    }

    const conv = convertXTwitter({
      url,
      finalUrl: x.finalUrl,
      shape: x.shape,
      signedIn: x.signedIn,
      tweets: x.tweets,
      profile: x.profile,
    });

    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      const dest = join(opts.slugDir, dl.localFilename);
      const bytes = downloadImage(dl.remoteUrl, dest, undefined, x.finalUrl || url);
      if (bytes > 0) images.push(dl.localFilename);
      else imgFailed++;
    }

    const flags: string[] = imgFailed > 0 ? ["x-twitter-image-download-partial"] : [];
    return {
      markdown: conv.markdown,
      title: conv.metadata.handle ? `@${conv.metadata.handle}` : undefined,
      images,
      metadata: {
        source: "x-twitter",
        shape: conv.metadata.shape,
        handle: conv.metadata.handle,
        datetime: conv.metadata.datetime,
        tweet_count: conv.metadata.tweet_count,
        stats: conv.stats,
      },
      flags,
      notes: [
        `x-twitter: ${x.shape}, ${conv.stats.tweetCount} tweet(s), ` +
        `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "x-twitter",
  converterName: "convertXTwitter",
  snapshotHosts: ["x.com", "twitter.com"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertXTwitter") {
      throw new Error(`x-twitter test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [XConvertArgs];
    const r = convertXTwitter(opts);
    const { markdown, ...rest } = r;
    return { markdown, rest: rest as Record<string, unknown> };
  },
  capture(url: string): CaptureResult {
    const x = extractXTwitter(url);
    if (x.error) throw new Error(`x-twitter capture: ${x.error}`);
    if (!x.signedIn) throw new Error(`x-twitter capture: browser not signed in`);
    if (x.shape === "unknown") throw new Error(`x-twitter capture: unknown URL shape ${pathOf(url)}`);
    if (x.shape === "status" && x.tweets.length === 0) {
      throw new Error(`x-twitter capture: no tweet articles found`);
    }
    if (x.shape === "profile" && !x.profile) {
      throw new Error(`x-twitter capture: no profile header found`);
    }
    const args: [XConvertArgs] = [{
      url,
      finalUrl: x.finalUrl,
      shape: x.shape,
      signedIn: x.signedIn,
      tweets: x.tweets,
      profile: x.profile,
    }];
    const r = convertXTwitter(args[0]);
    const { markdown, ...rest } = r;
    return {
      input: { fn: "convertXTwitter", args },
      markdown,
      rest: rest as Record<string, unknown>,
    };
  },
};
