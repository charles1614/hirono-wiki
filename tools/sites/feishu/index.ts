/**
 * *.feishu.cn — Feishu (Lark) wiki and document hosts. Two paths:
 *
 *   1. Authenticated path: `lark-hirono fetch --doc <wiki-id>` resolves
 *      the wiki node + pulls clean markdown via the docx blocks API.
 *      Output uses Lark-specific XML (`<lark-table>` / `<lark-tr>` /
 *      `<lark-td>`) which we convert to standard markdown tables.
 *
 *   2. Stub fallback when:
 *      - lark-hirono / lark-cli isn't on PATH (operator hasn't installed)
 *      - The bot identity has no access to the foreign tenant (forBidden)
 *      - The doc was deleted upstream (resource deleted)
 *      - Network or extraction errors
 *
 * Wiki URL shape: `https://<tenant>.feishu.cn/wiki/<wiki-token>` —
 * `wiki-token` is what we pass to `lark-hirono fetch --doc`.
 */

import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

import type { Site, FetchOpts, Result } from "../_shared/types.ts";
import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";

interface FeishuConvertArgs {
  url: string;
  rawMarkdown: string;
  /** Doc-level title from the Lark API; takes precedence over body inference. */
  docTitle: string;
}

interface FeishuImageDownload {
  /** Lark media token; downloaded via `lark-cli docs +media-preview --token`. */
  token: string;
  /** Local filename to save under (e.g. `feishu-img-001.png`). */
  localFilename: string;
}

interface FeishuConvertResult {
  markdown: string;
  imagesToDownload: FeishuImageDownload[];
  metadata: { source: string; wikiId: string; title: string };
  stats: { bodyChars: number; tables: number; images: number };
}

const HOST_PATTERN = /\.feishu\.cn$/i;

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ""; }
}

function wikiIdFromUrl(url: string): string | null {
  const m = url.match(/\/wiki\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

interface FetchResult { markdown: string; title: string; identity: string; error?: string }

function tryFetchAs(wikiId: string, as: "user" | "bot"): FetchResult {
  try {
    const res = spawnSync(
      "lark-cli",
      ["docs", "+fetch", "--doc", wikiId, "--as", as, "--format", "json"],
      { encoding: "utf8", timeout: 60_000, maxBuffer: 32 * 1024 * 1024 },
    );
    const stdout = res.stdout || "";
    if (res.status !== 0 && !stdout.trim()) {
      return { markdown: "", title: "", identity: as, error: `lark-cli exited ${res.status}` };
    }
    let parsed: { ok?: boolean; data?: { markdown?: string; title?: string }; error?: { message?: string } };
    try { parsed = JSON.parse(stdout); }
    catch (e) { return { markdown: "", title: "", identity: as, error: `JSON parse failed: ${e instanceof Error ? e.message : e}` }; }
    if (parsed.ok === false) {
      const msg = parsed.error?.message || "lark-cli reported ok=false";
      const reasonMatch = msg.match(/need_user_authorization|forBidden|resource deleted|Network temporarily unavailable/i);
      return { markdown: "", title: "", identity: as, error: reasonMatch ? reasonMatch[0] : msg.slice(0, 200) };
    }
    const md = parsed.data?.markdown || "";
    const title = parsed.data?.title || "";
    if (!md.trim()) return { markdown: "", title: "", identity: as, error: "empty markdown" };
    return { markdown: md, title, identity: as };
  } catch (e) {
    return { markdown: "", title: "", identity: as, error: e instanceof Error ? e.message : String(e) };
  }
}

function fetchViaLarkHirono(wikiId: string): { markdown: string; title: string; identity?: string; error?: string } {
  // Try user identity first (broader read access on foreign tenants where
  // the user has been granted permission via the Feishu UI). Fall back to
  // bot identity (OAuth tenant token) when user auth isn't configured.
  const userTry = tryFetchAs(wikiId, "user");
  if (!userTry.error) return userTry;

  // Skip the bot fallback if the failure is a hard "doc gone" — bot
  // identity won't recover deleted resources either.
  if (/resource deleted/i.test(userTry.error)) return userTry;

  const botTry = tryFetchAs(wikiId, "bot");
  if (!botTry.error) return botTry;

  // Surface the more informative of the two errors. need_user_authorization
  // tells the operator they should run `lark-cli auth login`.
  const combinedMsg = /need_user_authorization/i.test(userTry.error)
    ? "need_user_authorization (run: lark-cli auth login)"
    : `user: ${userTry.error}; bot: ${botTry.error}`;
  return { markdown: "", title: "", error: combinedMsg };
}

function convertLarkTables(md: string): { md: string; tables: number } {
  let tables = 0;
  const out = md.replace(/<lark-table\b[^>]*>([\s\S]*?)<\/lark-table>/g, (_full, inner: string) => {
    tables++;
    const rowMatches = [...inner.matchAll(/<lark-tr\b[^>]*>([\s\S]*?)<\/lark-tr>/g)];
    if (rowMatches.length === 0) return "";
    const rows: string[][] = rowMatches.map((rm) => {
      const cells = [...rm[1].matchAll(/<lark-td\b[^>]*>([\s\S]*?)<\/lark-td>/g)];
      return cells.map((c) => c[1].replace(/\s+/g, " ").trim().replace(/\|/g, "\\|"));
    });
    if (rows.length === 0) return "";
    const colCount = Math.max(...rows.map((r) => r.length));
    for (const r of rows) while (r.length < colCount) r.push("");
    const header = `| ${rows[0].join(" | ")} |`;
    const sep = `| ${rows[0].map(() => "---").join(" | ")} |`;
    const body = rows.slice(1).map((r) => `| ${r.join(" | ")} |`).join("\n");
    return ["", header, sep, body, ""].filter((s) => s !== "").join("\n");
  });
  return { md: out, tables };
}

function inferTitle(md: string, url: string, docTitle: string): string {
  // Doc-level title from the Lark API is authoritative. Body-heading
  // inference is only a last-resort fallback.
  if (docTitle && docTitle.trim()) return docTitle.trim();
  const m = md.match(/^#{1,6}\s+(.+?)\s*$/m);
  if (m) return m[1].trim();
  const id = wikiIdFromUrl(url);
  return id ? `Feishu wiki ${id}` : "Feishu wiki page";
}

// Lark callout emoji codes → unicode glyphs we render as the blockquote
// lead. Falls back to a generic 📌 when the code isn't in the table.
const CALLOUT_EMOJI: Record<string, string> = {
  pushpin: "📌", bulb: "💡", bookmark: "🔖", gift: "🎁",
  rocket: "🚀", star: "⭐", warning: "⚠️", fire: "🔥",
  info: "ℹ️", question: "❓", check: "✅", x: "❌",
  notebook: "📓", book: "📚", chart: "📊", clock: "⏰",
};

function decodeEncodedHrefs(md: string): string {
  // lark-hirono percent-encodes link targets (https%3A%2F%2F…). Decode
  // any `](...)` whose target looks like a percent-encoded URL.
  return md.replace(
    /(\]\()((?:https?%3A%2F%2F|http%3A%2F%2F)[^)]+)(\))/gi,
    (_m, l, target, r) => {
      try { return `${l}${decodeURIComponent(target)}${r}`; }
      catch { return _m; }
    },
  );
}

function convertCallouts(md: string): string {
  return md.replace(
    /<callout\b([^>]*)>([\s\S]*?)<\/callout>/g,
    (_m, attrs: string, inner: string) => {
      const emojiMatch = attrs.match(/emoji="([^"]+)"/);
      const code = emojiMatch ? emojiMatch[1] : "";
      const glyph = CALLOUT_EMOJI[code] || "📌";
      const innerLines = inner.trim().split("\n");
      const quoted = innerLines.map((ln) => (ln.length > 0 ? `> ${ln}` : ">")).join("\n");
      return `\n> ${glyph}\n${quoted}\n`;
    },
  );
}

function convertImages(md: string): { md: string; images: FeishuImageDownload[] } {
  const images: FeishuImageDownload[] = [];
  let counter = 0;
  const out = md.replace(
    /<image\b[^>]*\btoken="([^"]+)"[^>]*\/?>/g,
    (_m, token: string) => {
      counter++;
      // Default to .png; the actual extension is detected at download time
      // and the file name + reference are rewritten then.
      const localFilename = `feishu-img-${String(counter).padStart(3, "0")}.png`;
      images.push({ token, localFilename });
      return `![](${localFilename})`;
    },
  );
  return { md: out, images };
}

function dedent(s: string): string {
  // Drop the smallest common leading-space indent across non-blank lines.
  // Lark column/grid children typically arrive with 2 or 4 leading spaces.
  const lines = s.split("\n");
  let minIndent = Infinity;
  for (const ln of lines) {
    if (!ln.trim()) continue;
    const m = ln.match(/^( *)/);
    const n = m ? m[1].length : 0;
    if (n < minIndent) minIndent = n;
  }
  if (!isFinite(minIndent) || minIndent === 0) return s;
  return lines.map((ln) => ln.slice(minIndent)).join("\n");
}

function applyMiscLarkCleanups(md: string): string {
  let out = md;
  // Strip Lark color tags: `## Heading {color="DarkRedBackground"}` → `## Heading`
  out = out.replace(/\s*\{color="[^"]+"\}/g, "");
  // Unwrap `<text color="X">INNER</text>` (color metadata is lost, content kept).
  out = out.replace(/<text\b[^>]*>([\s\S]*?)<\/text>/g, "$1");
  // Wrap inline `<equation>X</equation>` content in `$X$` for LaTeX rendering.
  out = out.replace(/<equation>\s*([\s\S]*?)\s*<\/equation>/g, (_m, inner: string) => {
    const t = inner.trim();
    return t ? `$${t}$` : "";
  });
  // Unwrap `<mention-doc token="X" type="Y">TEXT</mention-doc>` to plain text
  // — we don't have the resolved URL handy; keeping the link text preserves
  // the reader's understanding of what was cited.
  out = out.replace(/<mention-doc\b[^>]*>([\s\S]*?)<\/mention-doc>/g, "$1");
  // Lark layout wrappers (<grid>, <column>) — replace each block with its
  // dedented inner content so embedded images / paragraphs render at top
  // level. Naive tag-strip would leave the 4-space indentation that Lark's
  // exporter applies to column children, causing markdown to render those
  // lines as code blocks.
  out = out.replace(/<grid\b[^>]*>([\s\S]*?)<\/grid>/g, (_m, inner: string) => dedent(inner));
  out = out.replace(/<column\b[^>]*>([\s\S]*?)<\/column>/g, (_m, inner: string) => dedent(inner));
  // Drop any stray opening/closing layout tag that fell outside the block
  // matchers above (defensive).
  out = out.replace(/<\/?(?:column|grid)\b[^>]*>/g, "");
  out = out.replace(/<\/?lark-[a-z-]+\b[^>]*>/g, "");
  return out;
}

export function convertFeishu(opts: FeishuConvertArgs): FeishuConvertResult {
  const wikiId = wikiIdFromUrl(opts.url) || "";
  let body = opts.rawMarkdown;
  const title = inferTitle(body, opts.url, opts.docTitle);
  // If the body opens with a heading whose text matches the title, drop
  // it so we don't double-H1. (This usually only fires when we fell
  // back to the body-heading inference path.)
  const titleLine = new RegExp(`^#{1,6}\\s+${title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`, "m");
  body = body.replace(titleLine, "").replace(/^\n+/, "");

  body = decodeEncodedHrefs(body);

  // Collapse Lark XML tables into markdown.
  const tableConv = convertLarkTables(body);
  body = tableConv.md;

  // Convert <callout> blocks (need to run BEFORE generic-XML strip).
  body = convertCallouts(body);

  // Extract <image token="X"/> placeholders into download list and rewrite
  // to standard `![](localFilename)` markdown.
  const imageConv = convertImages(body);
  body = imageConv.md;

  // Misc: strip color tags, unwrap <text>, convert <equation>, mention-doc, layout tags.
  body = applyMiscLarkCleanups(body);

  // Compose §2 frontmatter.
  const fm: string[] = [
    `# ${title}`,
    ``,
    `> 原文链接: ${opts.url}`,
    `> Source: lark-hirono (authenticated Feishu API)`,
    ``,
    `---`,
    ``,
  ];
  let markdown = fm.join("\n") + body;
  markdown = markdown.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");

  return {
    markdown,
    imagesToDownload: imageConv.images,
    metadata: { source: "feishu", wikiId, title },
    stats: { bodyChars: body.length, tables: tableConv.tables, images: imageConv.images.length },
  };
}

function downloadFeishuMedia(token: string, slugDir: string, localFilename: string, identity: "user" | "bot"): { ok: boolean; finalFilename: string; bytes: number } {
  // lark-cli's media-preview refuses absolute output paths; spawn from
  // inside slugDir and pass a relative `./<filename>`. Auto-detect the
  // extension via response content-type; lark-cli overwrites the path with
  // the right ext if it differs.
  const res = spawnSync(
    "lark-cli",
    ["docs", "+media-preview", "--token", token, "--output", `./${localFilename}`, "--as", identity, "--overwrite"],
    { encoding: "utf8", cwd: slugDir, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
  );
  if (res.status !== 0) return { ok: false, finalFilename: localFilename, bytes: 0 };
  // lark-cli media-preview prefixes a status line ("Previewing: …") before
  // the JSON body. Slice from the first `{` so JSON.parse works.
  const stdout = res.stdout || "";
  const start = stdout.indexOf("{");
  if (start < 0) return { ok: false, finalFilename: localFilename, bytes: 0 };
  let parsed: { ok?: boolean; data?: { saved_path?: string; content_type?: string; size_bytes?: number } };
  try { parsed = JSON.parse(stdout.slice(start)); }
  catch { return { ok: false, finalFilename: localFilename, bytes: 0 }; }
  if (!parsed.ok || !parsed.data?.saved_path) {
    return { ok: false, finalFilename: localFilename, bytes: 0 };
  }
  // saved_path is absolute; recover the basename so the markdown ref
  // matches whatever extension lark-cli decided (.png, .jpeg, .gif, …).
  const finalFilename = parsed.data.saved_path.split("/").pop() || localFilename;
  return { ok: true, finalFilename, bytes: parsed.data.size_bytes || 0 };
}

function stub(url: string, reason: string, kind: "auth-gated" | "deleted" | "no-tool" | "extraction-failed" | "user-auth-required"): Result {
  const titleMap = {
    "auth-gated": "Feishu wiki page (auth-gated)",
    "deleted": "Feishu wiki page (deleted)",
    "no-tool": "Feishu wiki page (lark-hirono unavailable)",
    "extraction-failed": "Feishu wiki page (fetch failed)",
    "user-auth-required": "Feishu wiki page (user auth required)",
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
      `*This entry is a metadata stub. Feishu wiki content is auth-gated.`,
      `Run \`lark-hirono fetch --doc <wiki-token>\` (where <wiki-token> is`,
      `the last path segment of the wiki URL) to retrieve content from a`,
      `tenant where the bot has access.*`,
      ``,
    ].join("\n"),
    images: [],
    metadata: { source: "feishu-stub", reason },
    flags: ["intentional-stub", `feishu-${kind}`],
    notes: [`feishu: stub emitted — ${reason}`],
  };
}

export const site: Site = {
  name: "feishu",
  match: (url: string) => HOST_PATTERN.test(hostOf(url)),
  fetch: (url: string, opts: FetchOpts): Result => {
    mkdirSync(opts.slugDir, { recursive: true });

    const wikiId = wikiIdFromUrl(url);
    if (!wikiId) return stub(url, "could not extract wiki id from URL", "extraction-failed");

    // Confirm lark-hirono is on PATH before invoking; otherwise stub
    // immediately so the operator knows what to install.
    const which = spawnSync("which", ["lark-hirono"], { encoding: "utf8" });
    if (which.status !== 0) {
      return stub(url, "lark-hirono CLI not on PATH (npm install -g lark-hirono)", "no-tool");
    }

    const r = fetchViaLarkHirono(wikiId);
    if (r.error) {
      const kind = /resource deleted/i.test(r.error) ? "deleted"
                 : /need_user_authorization/i.test(r.error) ? "user-auth-required"
                 : /forBidden/i.test(r.error) ? "auth-gated"
                 : "extraction-failed";
      return stub(url, r.error.slice(0, 160), kind);
    }
    if (!r.markdown.trim()) {
      return stub(url, "lark-hirono returned empty output", "extraction-failed");
    }

    const conv = convertFeishu({ url, rawMarkdown: r.markdown, docTitle: r.title });

    // Download embedded images via lark-cli docs +media-preview. Track
    // the per-image identity (user first, fall back to bot on 403).
    let markdown = conv.markdown;
    const images: string[] = [];
    let imgFailed = 0;
    for (const dl of conv.imagesToDownload) {
      let res = downloadFeishuMedia(dl.token, opts.slugDir, dl.localFilename, "user");
      if (!res.ok) res = downloadFeishuMedia(dl.token, opts.slugDir, dl.localFilename, "bot");
      if (res.ok) {
        if (res.finalFilename !== dl.localFilename) {
          // Rewrite the markdown ref to the final filename (extension fixed).
          const escaped = dl.localFilename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          markdown = markdown.replace(new RegExp(`\\(${escaped}\\)`, "g"), `(${res.finalFilename})`);
        }
        images.push(res.finalFilename);
      } else {
        imgFailed++;
      }
    }

    const flags: string[] = imgFailed > 0 ? ["feishu-image-download-partial"] : [];
    return {
      markdown,
      title: conv.metadata.title,
      images,
      metadata: {
        source: "feishu",
        wiki_id: conv.metadata.wikiId,
        title: conv.metadata.title,
        stats: conv.stats,
      },
      flags,
      notes: [
        `feishu: ${conv.stats.bodyChars} body chars, ${conv.stats.tables} table(s) converted from <lark-table>, ` +
        `${images.length}/${conv.imagesToDownload.length} image(s) downloaded` +
        (imgFailed > 0 ? ` (${imgFailed} failed)` : ""),
      ],
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "feishu",
  converterName: "convertFeishu",
  // All *.feishu.cn tenants share a single snapshot bucket (snapshot-create
  // collapses the per-tenant subdomain to feishu.cn so we don't sprawl).
  snapshotHosts: ["feishu.cn"],
  runFromFixture(input: InputDoc) {
    if (input.fn !== "convertFeishu") {
      throw new Error(`feishu test-hooks: unexpected fn ${input.fn}`);
    }
    const [opts] = input.args as [FeishuConvertArgs];
    const r = convertFeishu(opts);
    const { markdown, ...rest } = r;
    return { markdown, rest: rest as Record<string, unknown> };
  },
  capture(url: string): CaptureResult {
    const wikiId = wikiIdFromUrl(url);
    if (!wikiId) throw new Error(`feishu capture: no wiki id in URL ${url}`);
    const r = fetchViaLarkHirono(wikiId);
    if (r.error) throw new Error(`feishu capture: ${r.error}`);
    if (!r.markdown.trim()) throw new Error(`feishu capture: empty lark-hirono output`);
    const args: [FeishuConvertArgs] = [{ url, rawMarkdown: r.markdown, docTitle: r.title }];
    const result = convertFeishu(args[0]);
    const { markdown, ...rest } = result;
    return {
      input: { fn: "convertFeishu", args },
      markdown,
      rest: rest as Record<string, unknown>,
    };
  },
};
