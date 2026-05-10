#!/usr/bin/env node
/**
 * sync.ts — push the canonical wiki repo to its Lark projection (Space 2).
 *
 * Commands:
 *   init-parents   Create the four top-level parent nodes (Meta/Sources/Entities/Topics) in Space 2.
 *   up             Full sync:
 *                    Pass 1 creates stub Lark docs for any local slug not yet in the map.
 *                    Pre-pass 2: backfill obj_tokens + emit mention-map.json to tmp.
 *                    Pass 2 preprocesses each file, SHA-compares, and updates if changed —
 *                      `lark-hirono optimize` is invoked with --frontmatter-as-callout +
 *                      --mention-map, so frontmatter becomes a Meta callout and markdown
 *                      links matching the mention-map become native mention_doc blocks
 *                      (populating Feishu's backlinks panel + graph view). Footnotes are
 *                      handled automatically by lark-hirono >= 0.1.29.
 *   status         Print map vs filesystem state.
 *
 * Depends on: `lark-hirono` >= 0.1.29 (global CLI), a valid lark-cli auth cache.
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
} from "../link-map.ts";
import { preprocess, type LinkMap as PpLinkMap } from "./preprocess.ts";
import { buildMentionMap } from "./build-mention-map.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const MAP_PATH = join(REPO_ROOT, ".wiki-lark-map.json");

// ---------------------------------------------------------------------------
// lark-hirono subprocess wrappers
// ---------------------------------------------------------------------------

interface OptimizeOpts {
  docId: string;
  inputPath: string;
  mentionMapPath?: string;
  frontmatterAsCallout?: boolean;
}

export function runLarkHironoOptimize(opts: OptimizeOpts): void {
  const args = ["optimize", "--doc", opts.docId, "--input", opts.inputPath];
  if (opts.frontmatterAsCallout) args.push("--frontmatter-as-callout");
  if (opts.mentionMapPath) args.push("--mention-map", opts.mentionMapPath);
  args.push("--no-highlight");
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

/**
 * Look up a wiki node's obj_token by its node_token. Needed because
 * lark-hirono's upload returns only the node_token, but `--mention-map`
 * requires obj_tokens to construct mention_doc elements. Entries created
 * via runLarkCliCreateNode already have obj_token; this covers legacy
 * entries that predate that change.
 */
function getObjToken(nodeToken: string): string {
  const res = spawnSync(
    "lark-cli",
    [
      "wiki", "spaces", "get_node",
      "--params", JSON.stringify({ token: nodeToken }),
      "--format", "json",
    ],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (res.status !== 0) {
    throw new Error(`get_node failed for ${nodeToken}: ${res.stderr.slice(0, 200)}`);
  }
  const parsed = JSON.parse(res.stdout) as { code?: number; data?: { node?: { obj_token?: string } } };
  if (parsed.code !== 0 || !parsed.data?.node?.obj_token) {
    throw new Error(`get_node bad response for ${nodeToken}: ${res.stdout.slice(0, 200)}`);
  }
  return parsed.data.node.obj_token;
}

/**
 * Ensure every doc in the map has an obj_token. Mutates + persists the map
 * as it resolves missing tokens. No-op if all entries are already populated.
 */
function ensureObjTokens(map: LinkMap): number {
  const missing = Object.entries(map.docs).filter(([_, e]) => !e.obj_token);
  if (missing.length === 0) return 0;
  console.log(`[up] backfill obj_token on ${missing.length} legacy entries...`);
  let filled = 0;
  for (const [slug, e] of missing) {
    try {
      e.obj_token = getObjToken(e.doc_id);
      saveMap(MAP_PATH, map);
      filled++;
      console.log(`  ✓ ${slug} → ${e.obj_token}`);
    } catch (err) {
      console.error(`  ✗ ${slug}: ${(err as Error).message.slice(0, 120)}`);
    }
  }
  return filled;
}

/** Write the current mention-map to a tmp file and return the path. Caller owns cleanup. */
function writeMentionMapFile(map: LinkMap, dir: string): string {
  const path = join(dir, "mentions.json");
  writeFileSync(path, JSON.stringify(buildMentionMap(map), null, 2) + "\n", "utf8");
  return path;
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

  // Pass 1: stub-create any slug not already in map.docs. Using
  // lark-cli wiki nodes create (not lark-hirono upload) so we capture
  // obj_token at creation time — needed for the mention-map in pass 2.
  console.log(`[up] Pass 1 (ensure stubs): ${fsBySlug.size} files total`);
  let created = 0;
  for (const [slug, repoPath] of fsBySlug) {
    if (map.docs[slug]) continue;
    const bucket = bucketOf(repoPath)!;
    const parent = map.parents[bucket]!;
    console.log(`[up]  create stub: ${repoPath}`);
    const { node_token, obj_token, url } = runLarkCliCreateNode({
      spaceId: map.space_id,
      title: slug,
      parentNodeToken: parent.doc_id,
    });
    const entry: DocEntry = {
      repo_path: repoPath,
      bucket,
      type: typeForBucket(bucket),
      doc_id: node_token,
      obj_token,
      url,
      content_sha: "",  // empty → pass 2 will always populate
      uploaded_at: new Date().toISOString(),
    };
    map.docs[slug] = entry;
    saveMap(MAP_PATH, map);
    created++;
  }
  console.log(`[up] Pass 1 complete: ${created} new stubs, ${fsBySlug.size - created} already in map`);

  // Pre-pass 2: backfill any legacy entries missing obj_token (pre-retirement
  // entries created via lark-hirono upload didn't capture it). Then emit the
  // mention-map JSON so lark-hirono's --mention-map can resolve our wiki-URL
  // markdown links to native mention_doc elements at upload time.
  ensureObjTokens(map);
  const syncTmpDir = mkdtempSync(join(tmpdir(), "wiki-sync-"));
  const mentionMapPath = writeMentionMapFile(map, syncTmpDir);

  // Build the preprocess-side link map from the full doc map.
  const ppLinkMap: PpLinkMap = {};
  for (const [slug, e] of Object.entries(map.docs)) {
    ppLinkMap[slug] = { doc_token: e.doc_id, url: e.url };
  }

  try {
    // Pass 2: preprocess each file, SHA-compare, update if changed.
    // lark-hirono 0.1.29+ handles frontmatter, footnotes, and mention-doc
    // block conversion, so this is the only upload pass we need.
    console.log(`[up] Pass 2 (content sync):`);
    let updated = 0;
    let unchanged = 0;
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
        runLarkHironoOptimize({
          docId: entry.doc_id,
          inputPath: tmpPath,
          frontmatterAsCallout: true,
          mentionMapPath,
        });
        entry.content_sha = sha;
        entry.uploaded_at = new Date().toISOString();
        if (entry.repo_path !== repoPath) entry.repo_path = repoPath;
        saveMap(MAP_PATH, map);
        updated++;
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }
    console.log(`[up] Pass 2 complete: ${updated} updated, ${unchanged} unchanged`);
  } finally {
    rmSync(syncTmpDir, { recursive: true, force: true });
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
