#!/usr/bin/env node
/**
 * fix-mentions: post-upload pass that converts markdown-link text_runs
 * into native mention_doc blocks in Lark.
 *
 * Why this exists: the content pipeline (preprocess + lark-hirono) emits
 * `[Display](https://www.feishu.cn/wiki/TOKEN)` markdown links, which
 * Feishu renders as clickable `text_run` elements with a link style.
 * These DO NOT populate the backlinks panel or graph view. Only native
 * `mention_doc` elements trigger Lark's auto-backlink machinery.
 *
 * What it does:
 *  1. For each doc in .wiki-lark-map.json that lacks an obj_token,
 *     look it up via `lark-cli wiki spaces get_node`.
 *  2. For each doc's blocks, find every text_run whose link URL matches
 *     a known wiki URL in our map; replace with a mention_doc element
 *     carrying the target's obj_token + obj_type=22 (docx).
 *  3. PATCH the affected blocks via the Feishu docx block API.
 *
 * Safe to re-run: blocks already containing mention_doc are left alone.
 *
 *   npx tsx fix-mentions.ts            # full pass
 *   npx tsx fix-mentions.ts --dry-run  # report only, no writes
 *   npx tsx fix-mentions.ts --only <slug>[,<slug>,...]  # scope to specific docs
 */

import { spawnSync, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMap, saveMap, type DocEntry, type LinkMap } from "./link-map.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const MAP_PATH = join(REPO_ROOT, ".wiki-lark-map.json");

const OBJ_TYPE_DOCX = 22;
const PATCH_SLEEP_MS = 150;  // politeness delay between PATCH calls

// ---------------------------------------------------------------------------
// lark-cli wrappers
// ---------------------------------------------------------------------------

function runLarkCliJson(args: string[], timeoutMs = 30_000): unknown {
  const res = spawnSync("lark-cli", args, { encoding: "utf8", timeout: timeoutMs });
  if (res.status !== 0) {
    throw new Error(
      `lark-cli ${args.join(" ")} failed (exit ${res.status}):\n${res.stderr}\n${res.stdout}`,
    );
  }
  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new Error(`non-JSON output from lark-cli:\n${res.stdout.slice(0, 400)}`);
  }
}

function getNodeByToken(nodeToken: string): { obj_token: string; obj_type: string } {
  const out = runLarkCliJson([
    "wiki", "spaces", "get_node",
    "--params", JSON.stringify({ token: nodeToken }),
    "--format", "json",
  ]) as { code?: number; data?: { node?: { obj_token?: string; obj_type?: string } } };
  if (out.code !== 0 || !out.data?.node?.obj_token || !out.data.node.obj_type) {
    throw new Error(`get_node failed for ${nodeToken}: ${JSON.stringify(out).slice(0, 400)}`);
  }
  return { obj_token: out.data.node.obj_token, obj_type: out.data.node.obj_type };
}

function getBlocks(docId: string): DocxBlock[] {
  // --page-all with --format ndjson streams one block per line
  const res = spawnSync(
    "lark-cli",
    [
      "api", "GET",
      `/open-apis/docx/v1/documents/${docId}/blocks`,
      "--page-all",
      "--format", "ndjson",
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (res.status !== 0) {
    throw new Error(`blocks fetch failed for ${docId}: ${res.stderr}\n${res.stdout}`);
  }
  const blocks: DocxBlock[] = [];
  for (const line of res.stdout.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("[")) continue;  // skip "[page N] fetching..." status lines
    try {
      blocks.push(JSON.parse(t) as DocxBlock);
    } catch {
      // ignore non-JSON lines
    }
  }
  return blocks;
}

function patchBlockElements(
  docId: string,
  blockId: string,
  elements: Element[],
): boolean {
  const res = spawnSync(
    "lark-cli",
    [
      "api", "PATCH",
      `/open-apis/docx/v1/documents/${docId}/blocks/${blockId}?document_revision_id=-1`,
      "--data", JSON.stringify({ update_text_elements: { elements } }),
    ],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (res.status !== 0) {
    console.error(`  PATCH failed: ${res.stderr.slice(0, 200)}`);
    return false;
  }
  try {
    const out = JSON.parse(res.stdout) as { code?: number; msg?: string };
    if (out.code !== 0) {
      console.error(`  PATCH returned ${out.code}: ${out.msg}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): void {
  // Synchronous wait via execSync("sleep ...") — cheap and reliable for CLI use.
  if (ms <= 0) return;
  execSync(`sleep ${(ms / 1000).toFixed(3)}`);
}

// ---------------------------------------------------------------------------
// block element types (minimal shape we need)
// ---------------------------------------------------------------------------

interface TextRun {
  content: string;
  text_element_style?: {
    link?: { url?: string };
    [k: string]: unknown;
  };
}

interface MentionDoc {
  token: string;
  obj_type: number;
  url: string;
  title: string;
  text_element_style?: Record<string, unknown>;
}

interface Element {
  text_run?: TextRun;
  mention_doc?: MentionDoc;
  [k: string]: unknown;
}

interface BlockContent {
  elements?: Element[];
  [k: string]: unknown;
}

export interface DocxBlock {
  block_id: string;
  block_type: number;
  [k: string]: BlockContent | unknown;
}

// block_type → content-key mapping (subset of lark-hirono's CONTENT_KEY)
const CONTENT_KEY: Record<number, string> = {
  2: "text",
  3: "heading1", 4: "heading2", 5: "heading3",
  6: "heading4", 7: "heading5", 8: "heading6",
  9: "heading7", 10: "heading8", 11: "heading9",
  12: "bullet", 13: "ordered", 14: "code", 15: "quote",
  17: "todo", 19: "callout",
  34: "quote_container",
};

function elementsOf(block: DocxBlock): Element[] | null {
  const key = CONTENT_KEY[block.block_type];
  if (!key) return null;
  const content = (block as Record<string, unknown>)[key] as BlockContent | undefined;
  return content?.elements ?? null;
}

// ---------------------------------------------------------------------------
// URL → target lookup
// ---------------------------------------------------------------------------

export interface Target {
  slug: string;
  obj_token: string;
  title: string;
}

export function buildUrlIndex(map: LinkMap): Map<string, Target> {
  const idx = new Map<string, Target>();
  for (const [slug, e] of Object.entries(map.docs)) {
    if (!e.obj_token) continue;
    const target: Target = { slug, obj_token: e.obj_token, title: slug };
    // Canonical wiki URL
    idx.set(e.url, target);
    // Sometimes Feishu normalizes to /docx/ — handle that form too
    const docxUrl = `https://my.feishu.cn/docx/${e.obj_token}`;
    idx.set(docxUrl, target);
    const docxUrl2 = `https://www.feishu.cn/docx/${e.obj_token}`;
    idx.set(docxUrl2, target);
  }
  return idx;
}

// ---------------------------------------------------------------------------
// backfill obj_tokens
// ---------------------------------------------------------------------------

function backfillObjTokens(map: LinkMap, dryRun: boolean, label = "fix-mentions"): number {
  const need = Object.entries(map.docs).filter(([_, e]) => !e.obj_token);
  if (need.length === 0) return 0;
  console.log(`[${label}] backfill: ${need.length} docs missing obj_token`);
  let filled = 0;
  for (const [slug, e] of need) {
    if (dryRun) {
      console.log(`  would backfill: ${slug}`);
      continue;
    }
    try {
      const info = getNodeByToken(e.doc_id);
      e.obj_token = info.obj_token;
      saveMap(MAP_PATH, map);
      filled++;
      console.log(`  ✓ ${slug} → obj_token=${info.obj_token}`);
    } catch (err) {
      console.error(`  ✗ ${slug}: ${(err as Error).message.slice(0, 120)}`);
    }
  }
  return filled;
}

// ---------------------------------------------------------------------------
// per-doc conversion
// ---------------------------------------------------------------------------

export interface DocPlan {
  docId: string;
  slug: string;
  updates: Array<{ blockId: string; newElements: Element[]; changedCount: number }>;
}

/** Pure: given already-fetched blocks, compute the PATCH plan. Testable. */
export function planDocFromBlocks(
  blocks: DocxBlock[],
  docId: string,
  slug: string,
  urlIndex: Map<string, Target>,
): DocPlan {
  const updates: DocPlan["updates"] = [];
  for (const block of blocks) {
    const elements = elementsOf(block);
    if (!elements || elements.length === 0) continue;
    let changedCount = 0;
    const next: Element[] = elements.map((el) => {
      const tr = el.text_run;
      const url = tr?.text_element_style?.link?.url;
      if (!tr || !url) return el;
      const target = urlIndex.get(url);
      if (!target) return el;
      changedCount++;
      const mention: MentionDoc = {
        token: target.obj_token,
        obj_type: OBJ_TYPE_DOCX,
        url,
        title: tr.content,  // preserve display text the human wrote
      };
      return { mention_doc: mention };
    });
    if (changedCount > 0) {
      updates.push({ blockId: block.block_id, newElements: next, changedCount });
    }
  }
  return { docId, slug, updates };
}

function planDoc(docId: string, slug: string, urlIndex: Map<string, Target>): DocPlan {
  return planDocFromBlocks(getBlocks(docId), docId, slug, urlIndex);
}

function applyDocPlan(
  plan: DocPlan,
  dryRun: boolean,
  _label = "fix-mentions",
): { ok: number; fail: number } {
  let ok = 0;
  let fail = 0;
  for (const u of plan.updates) {
    if (dryRun) {
      console.log(`  would PATCH block ${u.blockId} (${u.changedCount} link→mention)`);
      ok++;
      continue;
    }
    if (patchBlockElements(plan.docId, u.blockId, u.newElements)) {
      ok++;
    } else {
      fail++;
    }
    sleep(PATCH_SLEEP_MS);
  }
  return { ok, fail };
}

// ---------------------------------------------------------------------------
// public entry point (called by sync.ts up, and by main below)
// ---------------------------------------------------------------------------

export interface RunFixMentionsOptions {
  dryRun?: boolean;
  /** If present, restrict processing to these slugs. null/undefined = all docs. */
  only?: Set<string> | null;
  /** Label printed in log lines. Default "fix-mentions". */
  logLabel?: string;
}

export interface RunFixMentionsResult {
  backfilled: number;
  docsTouched: number;
  blocks: number;
  ok: number;
  fail: number;
}

export function runFixMentions(opts: RunFixMentionsOptions = {}): RunFixMentionsResult {
  const dryRun = opts.dryRun ?? false;
  const only = opts.only ?? null;
  const label = opts.logLabel ?? "fix-mentions";

  const map = loadMap(MAP_PATH);

  const filled = backfillObjTokens(map, dryRun, label);
  if (filled > 0) console.log(`[${label}] backfilled ${filled} obj_tokens`);

  const urlIndex = buildUrlIndex(map);
  console.log(
    `[${label}] URL index: ${urlIndex.size} entries (across ${Object.keys(map.docs).length} docs)`,
  );

  const entries = Object.entries(map.docs).filter(([slug, e]) => {
    if (only && !only.has(slug)) return false;
    return !!e.obj_token;
  });

  let totalBlocks = 0;
  let totalOk = 0;
  let totalFail = 0;
  let docsTouched = 0;
  for (const [slug, e] of entries) {
    const plan = planDoc(e.doc_id, slug, urlIndex);
    if (plan.updates.length === 0) continue;
    docsTouched++;
    console.log(`[${label}] ${slug}: ${plan.updates.length} block(s) to update`);
    const { ok, fail } = applyDocPlan(plan, dryRun, label);
    totalOk += ok;
    totalFail += fail;
    totalBlocks += plan.updates.length;
    // Bump uploaded_at so reconcile_light doesn't flag the post-PATCH Lark
    // edit timestamp as out-of-band drift. Skip in dry-run; skip on full
    // failure (some PATCHes may have landed but we're being conservative).
    if (!dryRun && ok > 0) {
      e.uploaded_at = new Date().toISOString();
      saveMap(MAP_PATH, map);
    }
  }

  const verb = dryRun ? "would touch" : "touched";
  console.log(
    `[${label}] ${verb} ${totalBlocks} blocks across ${docsTouched} docs (ok=${totalOk}, fail=${totalFail})`,
  );

  return {
    backfilled: filled,
    docsTouched,
    blocks: totalBlocks,
    ok: totalOk,
    fail: totalFail,
  };
}

// ---------------------------------------------------------------------------
// main (CLI)
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyIdx = args.indexOf("--only");
  const only =
    onlyIdx >= 0 && args[onlyIdx + 1]
      ? new Set(args[onlyIdx + 1].split(","))
      : null;
  runFixMentions({ dryRun, only });
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
