#!/usr/bin/env node
/**
 * preprocess: translate [[Slug]] wikilinks into `[display](url)` markdown
 * links, using a link map for URL resolution.
 *
 * As of lark-hirono 0.1.29, frontmatter → Meta callout, footnote section
 * rendering, and leading-H1 stripping are all handled upstream (via
 * --frontmatter-as-callout, auto-footnote detection, and --strip-title).
 * The only transformation that stays wiki-specific is wikilink translation,
 * because `[[X]]` is Obsidian-style syntax that upstream doesn't (and
 * shouldn't) know about — its meaning is governed by the per-wiki link map.
 *
 * Frontmatter is preserved byte-exactly (not parsed + re-serialized) so
 * lark-hirono sees the original YAML for its own callout pass.
 * Content inside fenced ``` blocks is never rewritten.
 *
 *   tsx preprocess.ts <input.md> [--out <path>] [--link-map <path>] [--missing placeholder|plain|fail]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type LinkMapEntry = { doc_token: string; url: string };
export type LinkMap = Record<string, LinkMapEntry>;

export interface PreprocessOptions {
  linkMap?: LinkMap;
  /** What to do when a [[Slug]] has no linkMap entry. */
  missingLinkMode?: "placeholder" | "plain" | "fail";
  /**
   * Strip the first leading H1 heading from the body (default true).
   * Lark wiki nodes render the node title above the content; keeping
   * the same H1 in the body produces a duplicate in the doc TOC.
   *
   * lark-hirono's `--strip-title` flag is upload-only as of 0.1.29; our
   * content-sync path uses `optimize --input`, which doesn't honor it.
   * So we strip locally. If upstream adds --strip-title to optimize,
   * this pass becomes redundant and can retire.
   */
  stripFirstH1?: boolean;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export function preprocess(raw: string, opts: PreprocessOptions = {}): string {
  const { frontmatter, body } = splitFrontmatter(raw);
  const missingMode = opts.missingLinkMode ?? "placeholder";
  const stripH1 = opts.stripFirstH1 ?? true;
  const stripped = stripH1 ? stripLeadingH1(body) : body;
  const rewritten = rewriteWikilinks(stripped, opts.linkMap ?? {}, missingMode);
  return frontmatter + rewritten;
}

/**
 * Remove the leading H1 line (and its following blank line) from body.
 * Only the *first* H1 is touched; later H1s are left alone. No-op if
 * the body's first non-blank line isn't an H1.
 */
function stripLeadingH1(body: string): string {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return body;
  if (!/^#\s+/.test(lines[i])) return body;
  i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  return lines.slice(i).join("\n");
}

/**
 * Split a document into (frontmatter-block, body). Frontmatter is detected
 * only if the file STARTS with `---\n` and has a closing `---\n` on its own
 * line. Returns empty frontmatter + original content otherwise. The split is
 * byte-exact: we do not parse/re-emit YAML.
 */
export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  // ^---\n, then any content (non-greedy), then \n---\n
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!m) return { frontmatter: "", body: raw };
  return { frontmatter: m[0], body: raw.slice(m[0].length) };
}

// ---------------------------------------------------------------------------
// wikilink rewriting
// ---------------------------------------------------------------------------

const FENCE_RE = /^```/;

function rewriteWikilinks(
  body: string,
  map: LinkMap,
  missingMode: "placeholder" | "plain" | "fail",
): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    out.push(
      line.replace(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_m, rawSlug: string, rawDisplay: string | undefined) => {
          const slug = rawSlug.trim();
          const text = (rawDisplay ?? rawSlug).trim();
          const entry = map[slug];
          if (entry) return `[${text}](${entry.url})`;
          if (missingMode === "fail") {
            throw new Error(`Unresolved wikilink: [[${slug}]]`);
          }
          if (missingMode === "plain") return text;
          return `[${text}](wiki-unresolved:${encodeURIComponent(slug)})`;
        },
      ),
    );
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function readLinkMap(path: string | undefined): LinkMap {
  if (!path) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LinkMap;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

function main(): void {
  const args = process.argv.slice(2);
  let input: string | undefined;
  let output: string | undefined;
  let linkMapPath: string | undefined;
  let missingMode: "placeholder" | "plain" | "fail" = "placeholder";

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === "--out" || a === "-o") && i + 1 < args.length) output = args[++i];
    else if (a === "--link-map" && i + 1 < args.length) linkMapPath = args[++i];
    else if (a === "--missing" && i + 1 < args.length) {
      const v = args[++i];
      if (v !== "placeholder" && v !== "plain" && v !== "fail") {
        console.error(`invalid --missing value: ${v}`);
        process.exit(2);
      }
      missingMode = v;
    } else if (!input && !a.startsWith("-")) input = a;
  }

  if (!input) {
    console.error(
      "usage: tsx preprocess.ts <input.md> [--out <path>] [--link-map <path>] [--missing placeholder|plain|fail]",
    );
    process.exit(2);
  }

  const raw = readFileSync(resolve(input), "utf8");
  const linkMap = readLinkMap(linkMapPath ? resolve(linkMapPath) : undefined);
  const result = preprocess(raw, { linkMap, missingLinkMode: missingMode });

  if (output) writeFileSync(resolve(output), result, "utf8");
  else process.stdout.write(result);
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isEntryPoint) main();
