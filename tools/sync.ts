#!/usr/bin/env node
/**
 * sync.ts — push the canonical wiki repo to its Lark projection (Space 2).
 *
 * Commands:
 *   init-parents   Create the four top-level parent nodes (Meta/Sources/Entities/Topics) in Space 2.
 *   up             Full two-pass sync:
 *                    Pass 1 creates stub Lark docs for any local slug not yet in the map.
 *                    Pass 2 preprocesses each file, SHA-compares, and updates if changed.
 *   status         Print map vs filesystem state.
 *
 * Depends on: `lark-hirono` (global CLI), a valid lark-cli auth cache.
 *
 * Side-effect contract: every state change to `.wiki-lark-map.json` is flushed to disk
 * immediately after the corresponding Lark API call, so interrupt-resume is safe.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type LinkMap,
  type DocEntry,
  type Bucket,
  BUCKETS,
  loadMap,
  saveMap,
  slugOf,
  bucketOf,
  typeForBucket,
  sha256,
  walkWikiDocs,
} from "./link-map.ts";
import { preprocess, type LinkMap as PpLinkMap } from "./preprocess.ts";
import { runFixMentions } from "./fix-mentions.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const MAP_PATH = join(REPO_ROOT, ".wiki-lark-map.json");

// ---------------------------------------------------------------------------
// lark-hirono subprocess wrappers
// ---------------------------------------------------------------------------

interface UploadResult {
  doc_id: string;
  url: string;
}

interface UploadOpts {
  inputPath: string;
  title?: string;
  wikiSpace: string;
  wikiNode?: string;
  stripTitle?: boolean;
}

export function runLarkHironoUpload(opts: UploadOpts): UploadResult {
  const args = ["upload", opts.inputPath];
  if (opts.title) args.push("--title", opts.title);
  args.push("--wiki-space", opts.wikiSpace);
  if (opts.wikiNode) args.push("--wiki-node", opts.wikiNode);
  if (opts.stripTitle) args.push("--strip-title");
  args.push("--no-highlight");  // deterministic output for v0

  const res = spawnSync("lark-hirono", args, { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(
      `lark-hirono upload failed (exit ${res.status})\n---stderr---\n${res.stderr}\n---stdout---\n${res.stdout}`,
    );
  }
  const url = parseDoneUrl(res.stdout);
  if (!url) {
    throw new Error(`could not find "Done. URL:" line in lark-hirono output:\n${res.stdout}`);
  }
  return { doc_id: extractDocId(url), url };
}

interface OptimizeOpts {
  docId: string;
  inputPath: string;
}

export function runLarkHironoOptimize(opts: OptimizeOpts): void {
  const args = ["optimize", "--doc", opts.docId, "--input", opts.inputPath, "--no-highlight"];
  const res = spawnSync("lark-hirono", args, { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(
      `lark-hirono optimize failed (exit ${res.status})\n---stderr---\n${res.stderr}\n---stdout---\n${res.stdout}`,
    );
  }
}

// lark-cli is used for structural operations (creating top-level wiki nodes at space root,
// which lark-hirono upload doesn't support because it expects a --wiki-node parent).

export interface CreateNodeResult {
  node_token: string;
  obj_token: string;
  url: string;
}

export function runLarkCliCreateNode(opts: {
  spaceId: string;
  title: string;
  parentNodeToken?: string;
}): CreateNodeResult {
  const data: Record<string, unknown> = {
    node_type: "origin",
    obj_type: "docx",
    title: opts.title,
  };
  if (opts.parentNodeToken) data.parent_node_token = opts.parentNodeToken;

  const res = spawnSync(
    "lark-cli",
    [
      "wiki", "nodes", "create",
      "--params", JSON.stringify({ space_id: opts.spaceId }),
      "--data", JSON.stringify(data),
      "--format", "json",
    ],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error(
      `lark-cli wiki nodes create failed (exit ${res.status})\n---stderr---\n${res.stderr}\n---stdout---\n${res.stdout}`,
    );
  }
  let parsed: { code?: number; data?: { node?: { node_token?: string; obj_token?: string } } };
  try {
    parsed = JSON.parse(res.stdout);
  } catch (e) {
    throw new Error(`lark-cli returned non-JSON:\n${res.stdout}`);
  }
  if (parsed.code !== 0 || !parsed.data?.node?.node_token || !parsed.data.node.obj_token) {
    throw new Error(`unexpected lark-cli create response: ${res.stdout}`);
  }
  const node_token = parsed.data.node.node_token;
  const obj_token = parsed.data.node.obj_token;
  return {
    node_token,
    obj_token,
    url: `https://www.feishu.cn/wiki/${node_token}`,
  };
}

function parseDoneUrl(stdout: string): string | null {
  const m = stdout.match(/Done\. URL:\s*(\S+)/);
  return m ? m[1] : null;
}

function extractDocId(url: string): string {
  // Matches https://www.feishu.cn/wiki/XXXX or .../docx/XXXX
  const m = url.match(/\/(?:wiki|docx)\/([^/?#]+)/);
  if (!m) throw new Error(`malformed Lark doc URL: ${url}`);
  return m[1];
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

function stubParentMd(bucket: Bucket): string {
  return `# ${bucket}\n\nParent node for ${bucket} pages. This is a projection of \`~/Projects/writing/wiki/${bucket}/\` — do not edit here.\n`;
}

function stubDocMd(slug: string): string {
  return `# ${slug}\n\nStub — content will be uploaded by pass 2.\n`;
}

function cmdInitParents(): void {
  const map = loadMap(MAP_PATH);
  let any = false;
  for (const bucket of BUCKETS) {
    if (map.parents[bucket]) {
      console.log(`[init-parents] ${bucket} already exists: ${map.parents[bucket]!.url}`);
      continue;
    }
    console.log(`[init-parents] creating ${bucket}...`);
    // Step 1: create the top-level wiki node (lark-cli handles space-root creation;
    // lark-hirono upload does not, since it expects a --wiki-node parent).
    const { node_token, url } = runLarkCliCreateNode({
      spaceId: map.space_id,
      title: bucket,
    });
    map.parents[bucket] = { doc_id: node_token, url };
    saveMap(MAP_PATH, map);  // persist before filling content so we don't leak nodes
    // Step 2: fill the empty node with a brief description via lark-hirono optimize.
    const tmpDir = mkdtempSync(join(tmpdir(), "wiki-init-"));
    try {
      const tmpPath = join(tmpDir, `${bucket}.md`);
      writeFileSync(tmpPath, stubParentMd(bucket));
      runLarkHironoOptimize({ docId: node_token, inputPath: tmpPath });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    console.log(`[init-parents] ✓ ${bucket} → ${url}`);
    any = true;
  }
  if (!any) console.log("[init-parents] nothing to do; all four parents already exist.");
}

function cmdUp(): void {
  const map = loadMap(MAP_PATH);
  const missing = BUCKETS.filter((b) => !map.parents[b]);
  if (missing.length) {
    throw new Error(
      `missing parent nodes: ${missing.join(", ")}. Run \`npx tsx sync.ts init-parents\` first.`,
    );
  }

  const repoPaths = walkWikiDocs(REPO_ROOT);
  const fsBySlug = new Map<string, string>();
  for (const p of repoPaths) {
    const slug = slugOf(p);
    const existing = fsBySlug.get(slug);
    if (existing && existing !== p) {
      throw new Error(
        `slug collision: [[${slug}]] is both "${existing}" and "${p}". Rename one (schema.md §collision rule).`,
      );
    }
    fsBySlug.set(slug, p);
  }

  // Pass 1: stub-create any slug not already in map.docs.
  console.log(`[up] Pass 1 (ensure stubs): ${fsBySlug.size} files total`);
  let created = 0;
  for (const [slug, repoPath] of fsBySlug) {
    if (map.docs[slug]) continue;
    const bucket = bucketOf(repoPath)!;
    const parent = map.parents[bucket]!;
    console.log(`[up]  create stub: ${repoPath}`);
    const tmpDir = mkdtempSync(join(tmpdir(), "wiki-stub-"));
    try {
      const tmpPath = join(tmpDir, `${slug}.md`);
      writeFileSync(tmpPath, stubDocMd(slug));
      const { doc_id, url } = runLarkHironoUpload({
        inputPath: tmpPath,
        title: slug,
        wikiSpace: map.space_id,
        wikiNode: parent.doc_id,
        stripTitle: true,
      });
      const entry: DocEntry = {
        repo_path: repoPath,
        bucket,
        type: typeForBucket(bucket),
        doc_id,
        url,
        content_sha: "",
        uploaded_at: new Date().toISOString(),
      };
      map.docs[slug] = entry;
      saveMap(MAP_PATH, map);
      created++;
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
  console.log(`[up] Pass 1 complete: ${created} new stubs, ${fsBySlug.size - created} already in map`);

  // Build the preprocess-side link map from the full doc map.
  const ppLinkMap: PpLinkMap = {};
  for (const [slug, e] of Object.entries(map.docs)) {
    ppLinkMap[slug] = { doc_token: e.doc_id, url: e.url };
  }

  // Pass 2: preprocess each file, SHA-compare, update if changed.
  console.log(`[up] Pass 2 (content sync):`);
  let updated = 0;
  let unchanged = 0;
  const updatedSlugs = new Set<string>();
  for (const [slug, repoPath] of fsBySlug) {
    const raw = readFileSync(join(REPO_ROOT, repoPath), "utf8");
    const content = preprocess(raw, { linkMap: ppLinkMap, missingLinkMode: "placeholder" });
    const sha = sha256(content);
    const entry = map.docs[slug];
    if (!entry) throw new Error(`internal: slug ${slug} missing from map after pass 1`);
    if (entry.content_sha === sha) {
      unchanged++;
      continue;
    }
    console.log(`[up]  update: ${repoPath}`);
    const tmpDir = mkdtempSync(join(tmpdir(), "wiki-up-"));
    try {
      const tmpPath = join(tmpDir, `${slug}.md`);
      writeFileSync(tmpPath, content);
      runLarkHironoOptimize({ docId: entry.doc_id, inputPath: tmpPath });
      entry.content_sha = sha;
      entry.uploaded_at = new Date().toISOString();
      if (entry.repo_path !== repoPath) entry.repo_path = repoPath;
      saveMap(MAP_PATH, map);
      updated++;
      updatedSlugs.add(slug);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
  console.log(`[up] Pass 2 complete: ${updated} updated, ${unchanged} unchanged`);

  // Pass 3: upgrade markdown-link text_runs to native mention_doc blocks.
  // Content updates via lark-hirono optimize regenerate blocks from the .md,
  // which means previously-upgraded mention_docs regress back to text_run+link.
  // Scope the fix to just the docs we updated in pass 2 (no-op otherwise).
  if (updatedSlugs.size > 0) {
    console.log(`[up] Pass 3 (mention upgrade) on ${updatedSlugs.size} updated doc(s):`);
    runFixMentions({ only: updatedSlugs, logLabel: "up/fix-mentions" });
  } else {
    console.log(`[up] Pass 3 skipped (nothing to upgrade)`);
  }
}

function cmdStatus(): void {
  const map = loadMap(MAP_PATH);
  console.log(`Space: ${map.space_id}`);
  console.log(`Parents:`);
  for (const b of BUCKETS) {
    const p = map.parents[b];
    console.log(`  ${b.padEnd(9)} ${p ? p.url : "(not created)"}`);
  }

  const fsPaths = walkWikiDocs(REPO_ROOT);
  const fsSlugs = new Set(fsPaths.map(slugOf));
  const mapSlugs = new Set(Object.keys(map.docs));
  const localOnly = [...fsSlugs].filter((s) => !mapSlugs.has(s)).sort();
  const mapOnly = [...mapSlugs].filter((s) => !fsSlugs.has(s)).sort();

  console.log(`\nFiles on disk: ${fsPaths.length}`);
  console.log(`Docs in map:   ${Object.keys(map.docs).length}`);

  if (localOnly.length) {
    console.log(`\nLocal-only (upload pending): ${localOnly.length}`);
    for (const s of localOnly.slice(0, 20)) console.log(`  ${s}`);
    if (localOnly.length > 20) console.log(`  ... +${localOnly.length - 20} more`);
  }
  if (mapOnly.length) {
    console.log(`\nMap-only (deleted locally?): ${mapOnly.length}`);
    for (const s of mapOnly.slice(0, 20)) console.log(`  ${s}`);
  }
  if (!localOnly.length && !mapOnly.length) {
    console.log(`\n✓ filesystem and map are in agreement`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const [cmd] = process.argv.slice(2);
  switch (cmd) {
    case "init-parents": cmdInitParents(); break;
    case "up":           cmdUp(); break;
    case "status":       cmdStatus(); break;
    default:
      console.error(`usage: tsx sync.ts <init-parents|up|status>`);
      process.exit(2);
  }
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
