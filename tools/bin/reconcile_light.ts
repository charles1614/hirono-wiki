#!/usr/bin/env node
/**
 * reconcile_light: cheap per-doc drift check between the canonical repo
 * and Lark Space 2. One `lark-cli wiki spaces get_node` call per doc.
 *
 * Two checks per doc:
 *   1. Lark node title == local slug? (after pipeline normalization, the
 *      wiki node title equals the slug we passed at upload.)
 *   2. Lark obj_edit_time > our map.uploaded_at? (a newer Lark edit
 *      timestamp implies someone touched the doc directly in Lark.)
 *
 * Reports drift; never writes. Exit code 0 on clean, 1 on any drift.
 *
 *   npx tsx reconcile_light.ts                    # all docs
 *   npx tsx reconcile_light.ts --only A,B         # subset
 *   npx tsx reconcile_light.ts --json             # NDJSON output for piping
 *   npx tsx reconcile_light.ts --refresh-baseline # set uploaded_at = Lark
 *                                                 # obj_edit_time for every doc.
 *                                                 # Use this once after a known-
 *                                                 # clean sync to absorb prior
 *                                                 # pipeline timing lag.
 */

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMap, saveMap, type LinkMap } from "../link-map.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const MAP_PATH = join(REPO_ROOT, ".wiki-lark-map.json");

// Tolerance for skew between our recorded `uploaded_at` and Lark's
// `obj_edit_time`. We record uploaded_at at the start of pass 2; pass 3
// (fix-mentions) PATCHes block elements minutes later for batch syncs.
// 5 min absorbs typical batch timing without masking actual human edits.
const EDIT_TIME_TOLERANCE_MS = 5 * 60 * 1000;

interface NodeInfo {
  node_token: string;
  obj_token: string;
  title: string;
  obj_edit_time: number;  // unix seconds
}

function getNode(nodeToken: string): NodeInfo {
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
  const parsed = JSON.parse(res.stdout) as {
    code?: number;
    data?: { node?: { node_token?: string; obj_token?: string; title?: string; obj_edit_time?: string } };
  };
  if (parsed.code !== 0 || !parsed.data?.node) {
    throw new Error(`get_node bad response for ${nodeToken}: ${res.stdout.slice(0, 200)}`);
  }
  const n = parsed.data.node;
  return {
    node_token: n.node_token!,
    obj_token: n.obj_token!,
    title: n.title ?? "",
    obj_edit_time: parseInt(n.obj_edit_time ?? "0", 10),
  };
}

interface Issue {
  slug: string;
  url: string;
  kind: "title-mismatch" | "remote-edit-after-upload";
  detail: string;
}

function checkDoc(
  slug: string,
  entry: LinkMap["docs"][string],
): Issue[] {
  const issues: Issue[] = [];
  let info: NodeInfo;
  try {
    info = getNode(entry.doc_id);
  } catch (err) {
    issues.push({
      slug,
      url: entry.url,
      kind: "title-mismatch",
      detail: `failed to fetch node info: ${(err as Error).message.slice(0, 120)}`,
    });
    return issues;
  }
  if (info.title !== slug) {
    issues.push({
      slug,
      url: entry.url,
      kind: "title-mismatch",
      detail: `Lark title="${info.title}" expected="${slug}"`,
    });
  }
  const uploadedAtMs = Date.parse(entry.uploaded_at);
  if (!isNaN(uploadedAtMs)) {
    const remoteEditMs = info.obj_edit_time * 1000;
    if (remoteEditMs > uploadedAtMs + EDIT_TIME_TOLERANCE_MS) {
      const lagSec = Math.round((remoteEditMs - uploadedAtMs) / 1000);
      issues.push({
        slug,
        url: entry.url,
        kind: "remote-edit-after-upload",
        detail: `Lark edited ${lagSec}s after our last sync (Lark=${new Date(remoteEditMs).toISOString()}, upload=${entry.uploaded_at})`,
      });
    }
  }
  return issues;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const refresh = args.includes("--refresh-baseline");
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 && args[onlyIdx + 1] ? new Set(args[onlyIdx + 1].split(",")) : null;

  const map = loadMap(MAP_PATH);
  const entries = Object.entries(map.docs).filter(([slug]) => !only || only.has(slug));
  if (!json) {
    const mode = refresh ? "(refresh-baseline) " : "";
    console.log(`[reconcile_light] ${mode}checking ${entries.length} docs in space ${map.space_id}`);
  }

  let totalIssues = 0;
  let checked = 0;
  let refreshed = 0;
  for (const [slug, entry] of entries) {
    if (refresh) {
      // Bump uploaded_at to Lark's obj_edit_time, suppressing drift from
      // prior pipeline lag. Skip drift reporting entirely in this mode.
      try {
        const info = getNode(entry.doc_id);
        const remoteIso = new Date(info.obj_edit_time * 1000).toISOString();
        if (entry.uploaded_at !== remoteIso) {
          entry.uploaded_at = remoteIso;
          refreshed++;
          saveMap(MAP_PATH, map);
        }
      } catch (err) {
        if (!json) console.log(`  ERROR refreshing ${slug}: ${(err as Error).message.slice(0, 120)}`);
      }
      continue;
    }
    const issues = checkDoc(slug, entry);
    checked++;
    if (issues.length === 0) continue;
    totalIssues += issues.length;
    for (const i of issues) {
      if (json) console.log(JSON.stringify(i));
      else console.log(`  DRIFT [${i.kind}] ${i.slug}: ${i.detail}`);
    }
  }
  if (refresh) {
    if (!json) console.log(`[reconcile_light] refreshed uploaded_at on ${refreshed}/${entries.length} docs`);
    process.exit(0);
  }
  if (!json) {
    if (totalIssues === 0) {
      console.log(`[reconcile_light] ✓ ${checked} docs checked, no drift`);
    } else {
      console.log(`[reconcile_light] ${totalIssues} issue(s) across ${checked} docs`);
    }
  }
  process.exit(totalIssues === 0 ? 0 : 1);
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
