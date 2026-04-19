#!/usr/bin/env node
/**
 * preprocess: transform a wiki .md file into a Lark-upload-ready .md string.
 *
 * Three passes:
 *   1. YAML frontmatter  →  visible Meta callout (lark-hirono renders blockquotes as callouts)
 *   2. [[Slug]] wikilinks →  markdown link using the link map (.wiki-lark-map.json)
 *   3. Footnote [^n] refs →  unicode superscript; defs collected into a "Footnotes" section
 *
 * Pure function: no API calls, no disk writes except --out.
 * Content inside fenced ``` blocks is left untouched.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

export type LinkMapEntry = { doc_token: string; url: string };
export type LinkMap = Record<string, LinkMapEntry>;

export interface PreprocessOptions {
  linkMap?: LinkMap;
  /** What to do when a [[Slug]] has no linkMap entry. */
  missingLinkMode?: "placeholder" | "plain" | "fail";
  /**
   * Strip the first leading H1 heading before emitting.
   * Default: true. Reason: Lark wiki nodes already render the node title
   * above the content; keeping the same H1 in the body shows a duplicated
   * title in the doc TOC.
   */
  stripFirstH1?: boolean;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export function preprocess(
  raw: string,
  opts: PreprocessOptions = {},
): string {
  const parsed = matter(raw);
  let body = parsed.content.replace(/^\n+/, "");
  const missingMode = opts.missingLinkMode ?? "placeholder";
  const stripH1 = opts.stripFirstH1 ?? true;

  if (stripH1) body = stripLeadingH1(body);

  const callout = renderMetaCallout(parsed.data);
  const withLinks = rewriteWikilinks(body, opts.linkMap ?? {}, missingMode);
  const withFootnotes = rewriteFootnotes(withLinks);

  const parts = [callout, withFootnotes.trimEnd()].filter(Boolean);
  return parts.join("\n\n") + "\n";
}

/**
 * Remove the first leading H1 (with its trailing blank line(s)) from the body.
 * Only the *leading* H1 is stripped — a later H1 is left alone. Content inside
 * a fenced code block is never considered (leading H1 must come before any fence).
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

// ---------------------------------------------------------------------------
// pass 1: frontmatter → Meta callout
// ---------------------------------------------------------------------------

const FRONTMATTER_ORDER = [
  "type",
  "created",
  "updated",
  "raw_source",
  "tags",
  "refs",
  "tier",
  "source_count",
  "highlights",
];

function renderMetaCallout(fm: Record<string, unknown>): string {
  const keys = Object.keys(fm);
  if (keys.length === 0) return "";

  const rows: string[] = ["> **Meta**"];
  const seen = new Set<string>();
  for (const key of FRONTMATTER_ORDER) {
    if (key in fm) {
      rows.push(formatRow(key, fm[key]));
      seen.add(key);
    }
  }
  for (const key of keys.sort()) {
    if (!seen.has(key)) rows.push(formatRow(key, fm[key]));
  }
  return rows.join("\n");
}

function formatRow(key: string, value: unknown): string {
  const label = key.replace(/_/g, " ");
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  return `> - **${cap}**: ${formatValue(value)}`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

// ---------------------------------------------------------------------------
// pass 2: [[Slug]] → markdown link
// ---------------------------------------------------------------------------

const FENCE_RE = /^```/;

function eachContentLine(body: string, fn: (line: string) => string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    out.push(inFence ? line : fn(line));
  }
  return out.join("\n");
}

function rewriteWikilinks(
  body: string,
  map: LinkMap,
  missingMode: "placeholder" | "plain" | "fail",
): string {
  return eachContentLine(body, (line) =>
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

// ---------------------------------------------------------------------------
// pass 3: footnotes → superscript + "Footnotes" section
// ---------------------------------------------------------------------------

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPT_DIGITS[d] ?? d)
    .join("");
}

function rewriteFootnotes(body: string): string {
  const defRegex = /^\[\^([^\]]+)\]:\s*(.+)$/;
  const defsByKey = new Map<string, string>();
  const linesWithoutDefs: string[] = [];
  let inFence = false;
  for (const line of body.split("\n")) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      linesWithoutDefs.push(line);
      continue;
    }
    const m = !inFence ? line.match(defRegex) : null;
    if (m) {
      defsByKey.set(m[1], m[2]);
    } else {
      linesWithoutDefs.push(line);
    }
  }

  if (defsByKey.size === 0) return body;

  // Number by order of first inline occurrence (outside fences).
  const orderedKeys: string[] = [];
  const keyToNumber = new Map<string, number>();
  let next = 1;
  const bodyNoDefs = linesWithoutDefs.join("\n");

  {
    let fence = false;
    for (const line of bodyNoDefs.split("\n")) {
      if (FENCE_RE.test(line)) {
        fence = !fence;
        continue;
      }
      if (fence) continue;
      for (const m of line.matchAll(/\[\^([^\]]+)\]/g)) {
        const k = m[1];
        if (!keyToNumber.has(k)) {
          keyToNumber.set(k, next++);
          orderedKeys.push(k);
        }
      }
    }
  }
  // Defined but never referenced — append at the end.
  for (const k of defsByKey.keys()) {
    if (!keyToNumber.has(k)) {
      keyToNumber.set(k, next++);
      orderedKeys.push(k);
    }
  }

  const rewritten = eachContentLine(bodyNoDefs, (line) =>
    line.replace(/\[\^([^\]]+)\]/g, (_m, k: string) => {
      const n = keyToNumber.get(k);
      return n !== undefined ? `⁽${toSuperscript(n)}⁾` : `[^${k}]`;
    }),
  );

  const footnoteSection = [
    "",
    "## Footnotes",
    "",
    ...orderedKeys.map((k) => {
      const n = keyToNumber.get(k)!;
      const def = defsByKey.get(k) ?? "(missing definition)";
      return `${n}. ${def}`;
    }),
  ].join("\n");

  return rewritten.trimEnd() + "\n\n" + footnoteSection + "\n";
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
