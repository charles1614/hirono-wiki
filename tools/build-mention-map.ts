#!/usr/bin/env node
/**
 * build-mention-map: emit mentions.json from .wiki-lark-map.json.
 *
 * The emitted JSON is consumed by `lark-hirono upload|optimize --mention-map`
 * (version 0.1.29+), which rewrites markdown links whose URL matches a key
 * into native Feishu `mention_doc` block elements post-upload. That's what
 * populates the backlinks panel and graph view.
 *
 * Format (matches lark-hirono's loadMentionMap):
 *   { "<url>": { "obj_token": "..." }, ... }
 *
 * For each doc in the link map we register THREE URL shapes pointing at the
 * same obj_token:
 *   - the wiki URL (what preprocess.ts emits for [[Slug]] links)
 *   - my.feishu.cn/docx/<obj_token>
 *   - www.feishu.cn/docx/<obj_token>
 * Upstream does exact URL matching, so the variants are defensive insurance
 * in case Feishu normalizes URLs somewhere in the pipeline.
 *
 *   npx tsx build-mention-map.ts              # write .wiki-mention-map.json
 *   npx tsx build-mention-map.ts --out <path> # custom output path
 *   npx tsx build-mention-map.ts --stdout     # print to stdout, no write
 */

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMap, type LinkMap } from "./link-map.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const MAP_PATH = join(REPO_ROOT, ".wiki-lark-map.json");
const DEFAULT_OUT = join(REPO_ROOT, ".wiki-mention-map.json");

export interface MentionEntry {
  obj_token: string;
  // obj_type defaults to 22 (docx) upstream — we omit it so the default applies
  // title also omitted — upstream falls back to text_run.content which is exactly
  // what the human wrote between the [[...]] brackets
}

export type MentionMapFile = Record<string, MentionEntry>;

/**
 * Build the mention-map object from a link map. Registers 3 URL shapes per
 * doc so both wiki-URL and docx-URL forms resolve to the same obj_token.
 */
export function buildMentionMap(map: LinkMap): MentionMapFile {
  const out: MentionMapFile = {};
  for (const e of Object.values(map.docs)) {
    if (!e.obj_token) continue;
    const entry: MentionEntry = { obj_token: e.obj_token };
    // Primary: the wiki URL our preprocess emits for [[Slug]] links.
    out[e.url] = entry;
    // Defensive: alternate docx-URL forms Feishu might normalize to.
    out[`https://my.feishu.cn/docx/${e.obj_token}`] = entry;
    out[`https://www.feishu.cn/docx/${e.obj_token}`] = entry;
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const stdout = args.includes("--stdout");
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 && args[outIdx + 1] ? resolve(args[outIdx + 1]) : DEFAULT_OUT;

  const map = loadMap(MAP_PATH);
  const mentionMap = buildMentionMap(map);
  const serialized = JSON.stringify(mentionMap, null, 2) + "\n";

  if (stdout) {
    process.stdout.write(serialized);
    return;
  }
  writeFileSync(outPath, serialized, "utf8");
  const docCount = Object.values(map.docs).filter((e) => e.obj_token).length;
  console.log(
    `[build-mention-map] wrote ${outPath} — ${Object.keys(mentionMap).length} URL entries (${docCount} docs × 3 URL shapes)`,
  );
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
