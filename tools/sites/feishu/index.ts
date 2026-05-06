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

interface FeishuConvertResult {
  markdown: string;
  metadata: { source: string; wikiId: string; title: string };
  stats: { bodyChars: number; tables: number };
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

export function convertFeishu(opts: FeishuConvertArgs): FeishuConvertResult {
  const wikiId = wikiIdFromUrl(opts.url) || "";
  let body = opts.rawMarkdown;
  const title = inferTitle(body, opts.url, opts.docTitle);
  // If the body opens with a heading whose text matches the title, drop
  // it so we don't double-H1. (This usually only fires when we fell
  // back to the body-heading inference path.)
  const titleLine = new RegExp(`^#{1,6}\\s+${title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`, "m");
  body = body.replace(titleLine, "").replace(/^\n+/, "");

  // Collapse Lark XML tables into markdown.
  const conv = convertLarkTables(body);
  body = conv.md;

  // Strip stray standalone <lark-*> tags that didn't fall under the table
  // converter (none expected today, defensive).
  body = body.replace(/<\/?lark-[a-z-]+\b[^>]*>/g, "");

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
    metadata: { source: "feishu", wikiId, title },
    stats: { bodyChars: body.length, tables: conv.tables },
  };
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
    return {
      markdown: conv.markdown,
      title: conv.metadata.title,
      images: [],
      metadata: {
        source: "feishu",
        wiki_id: conv.metadata.wikiId,
        title: conv.metadata.title,
        stats: conv.stats,
      },
      flags: [],
      notes: [
        `feishu: ${conv.stats.bodyChars} body chars, ${conv.stats.tables} table(s) converted from <lark-table>`,
      ],
    };
  },
};

export const testHooks: SiteTestHooks = {
  name: "feishu",
  converterName: "convertFeishu",
  snapshotHosts: [
    "swfvqxo30ma.feishu.cn",
    "d0a901er7io.feishu.cn",
    "scnajei2ds6y.feishu.cn",
    "upiwgvvcb4.feishu.cn",
    "my.feishu.cn",
  ],
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
