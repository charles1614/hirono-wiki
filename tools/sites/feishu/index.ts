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

function fetchViaLarkHirono(wikiId: string): { markdown: string; error?: string } {
  try {
    const res = spawnSync("lark-hirono", ["fetch", "--doc", wikiId], {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    const stdout = res.stdout || "";
    const stderr = res.stderr || "";
    // lark-hirono writes diagnostic text to stderr on failure; check for
    // known failure markers in either stream.
    const combined = stdout + "\n" + stderr;
    if (res.status !== 0 || /Failed to fetch document|forBidden|resource deleted/i.test(combined)) {
      const reasonMatch = combined.match(/forBidden|resource deleted|Network temporarily unavailable/i);
      const reason = reasonMatch ? reasonMatch[0] : `lark-hirono exited ${res.status}`;
      return { markdown: "", error: reason };
    }
    if (!stdout.trim()) return { markdown: "", error: "lark-hirono returned empty output" };
    return { markdown: stdout };
  } catch (e) {
    return { markdown: "", error: e instanceof Error ? e.message : String(e) };
  }
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

function inferTitle(md: string, url: string): string {
  // Look at the first heading line.
  const m = md.match(/^#{1,6}\s+(.+?)\s*$/m);
  if (m) return m[1].trim();
  // Fall back to the wiki ID for a deterministic title.
  const id = wikiIdFromUrl(url);
  return id ? `Feishu wiki ${id}` : "Feishu wiki page";
}

export function convertFeishu(opts: FeishuConvertArgs): FeishuConvertResult {
  const wikiId = wikiIdFromUrl(opts.url) || "";
  let body = opts.rawMarkdown;
  // Demote the highest heading in the body to make space for the §2 H1.
  // lark-hirono emits the first content heading at H3 typically; if there
  // happens to be an H1 in the body, demote it so we don't double-H1.
  const title = inferTitle(body, opts.url);
  // Strip the title heading from the body if it appears as a top-level line.
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

function stub(url: string, reason: string, kind: "auth-gated" | "deleted" | "no-tool" | "extraction-failed"): Result {
  const titleMap = {
    "auth-gated": "Feishu wiki page (auth-gated)",
    "deleted": "Feishu wiki page (deleted)",
    "no-tool": "Feishu wiki page (lark-hirono unavailable)",
    "extraction-failed": "Feishu wiki page (fetch failed)",
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
                 : /forBidden/i.test(r.error) ? "auth-gated"
                 : "extraction-failed";
      return stub(url, r.error.slice(0, 160), kind);
    }
    if (!r.markdown.trim()) {
      return stub(url, "lark-hirono returned empty output", "extraction-failed");
    }

    const conv = convertFeishu({ url, rawMarkdown: r.markdown });
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
    const args: [FeishuConvertArgs] = [{ url, rawMarkdown: r.markdown }];
    const result = convertFeishu(args[0]);
    const { markdown, ...rest } = result;
    return {
      input: { fn: "convertFeishu", args },
      markdown,
      rest: rest as Record<string, unknown>,
    };
  },
};
