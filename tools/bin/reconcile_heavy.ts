#!/usr/bin/env node
/**
 * reconcile_heavy: per-doc deep drift check by hashing the assembled text
 * content of each Lark doc's block tree, comparing against the hash from
 * the previous sync.
 *
 *   First run for a doc: records its current `remote_content_sha` to the
 *   map (no drift reported).
 *   Subsequent runs: any change in the assembled-content hash is drift —
 *   typically caused by someone editing the doc directly in Lark, since
 *   sync.ts's pass 3 (fix-mentions) is the only legitimate writer.
 *
 * Reports drift; rewrite is not implemented in v0.5 (use `sync.ts up` to
 * resync the affected docs after investigating).
 *
 *   npx tsx reconcile_heavy.ts            # check all docs; sets baseline sha on first run
 *   npx tsx reconcile_heavy.ts --dry-run  # like above but never writes the map
 *   npx tsx reconcile_heavy.ts --only A,B # subset
 */

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { loadMap, saveMap, type LinkMap } from "../link-map.ts";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..");
const MAP_PATH = join(REPO_ROOT, ".wiki-lark-map.json");

// block_type → content key. Mirrors lark-hirono's CONTENT_KEY (subset).
const CONTENT_KEY: Record<number, string> = {
  2: "text",
  3: "heading1", 4: "heading2", 5: "heading3",
  6: "heading4", 7: "heading5", 8: "heading6",
  9: "heading7", 10: "heading8", 11: "heading9",
  12: "bullet", 13: "ordered", 14: "code", 15: "quote",
  16: "equation", 17: "todo", 19: "callout",
  34: "quote_container",
};

interface BlockElement {
  text_run?: { content?: string };
  mention_doc?: { title?: string; token?: string };
  equation?: { content?: string };
}

interface DocxBlock {
  block_id: string;
  block_type: number;
  [k: string]: { elements?: BlockElement[] } | unknown;
}

function fetchBlocks(docId: string): DocxBlock[] {
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
    throw new Error(`fetchBlocks failed for ${docId}: ${res.stderr.slice(0, 200)}`);
  }
  const blocks: DocxBlock[] = [];
  for (const line of res.stdout.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("[")) continue;  // skip status lines
    try {
      blocks.push(JSON.parse(t) as DocxBlock);
    } catch {
      // ignore non-JSON
    }
  }
  return blocks;
}

/**
 * Build a normalized text stream from the doc's blocks.
 * For each block in API order: emit a tag prefix + the text content.
 *   text_run → its `content`
 *   mention_doc → "[[<token>]]" so different display text doesn't break the hash,
 *                 but a different mention target does.
 *   equation → its `content`
 * Whitespace normalized to single spaces, surrounding whitespace trimmed.
 */
export function assembleContent(blocks: DocxBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    const key = CONTENT_KEY[block.block_type];
    if (!key) continue;
    const content = (block as Record<string, unknown>)[key] as { elements?: BlockElement[] } | undefined;
    const els = content?.elements;
    if (!els) continue;
    const acc: string[] = [`<${key}>`];
    for (const el of els) {
      if (el.text_run?.content) acc.push(el.text_run.content);
      else if (el.mention_doc?.token) acc.push(`[[${el.mention_doc.token}]]`);
      else if (el.equation?.content) acc.push(`$${el.equation.content}$`);
    }
    parts.push(acc.join(" ").replace(/\s+/g, " ").trim());
  }
  return parts.join("\n");
}

function sha(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

interface Result {
  slug: string;
  url: string;
  status: "first-baseline" | "no-drift" | "drift" | "error";
  detail?: string;
}

function checkDoc(
  slug: string,
  entry: LinkMap["docs"][string],
): { result: Result; newSha?: string } {
  let blocks: DocxBlock[];
  try {
    blocks = fetchBlocks(entry.doc_id);
  } catch (err) {
    return {
      result: {
        slug,
        url: entry.url,
        status: "error",
        detail: (err as Error).message.slice(0, 200),
      },
    };
  }
  const content = assembleContent(blocks);
  const newSha = sha(content);
  const prior = (entry as { remote_content_sha?: string }).remote_content_sha;
  if (!prior) {
    return {
      result: { slug, url: entry.url, status: "first-baseline", detail: `recorded sha=${newSha.slice(0, 12)}` },
      newSha,
    };
  }
  if (prior === newSha) {
    return { result: { slug, url: entry.url, status: "no-drift" } };
  }
  return {
    result: {
      slug,
      url: entry.url,
      status: "drift",
      detail: `prior=${prior.slice(0, 12)} now=${newSha.slice(0, 12)} (someone edited in Lark, or sync regression)`,
    },
    newSha,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 && args[onlyIdx + 1] ? new Set(args[onlyIdx + 1].split(",")) : null;

  const map = loadMap(MAP_PATH);
  const entries = Object.entries(map.docs).filter(([slug]) => !only || only.has(slug));
  console.log(`[reconcile_heavy] ${dryRun ? "(dry-run) " : ""}checking ${entries.length} docs`);

  const counts = { baseline: 0, clean: 0, drift: 0, error: 0 };

  for (const [slug, entry] of entries) {
    const { result, newSha } = checkDoc(slug, entry);
    switch (result.status) {
      case "first-baseline":
        counts.baseline++;
        console.log(`  baseline   ${slug}: ${result.detail}`);
        if (!dryRun && newSha) {
          (entry as { remote_content_sha?: string }).remote_content_sha = newSha;
          saveMap(MAP_PATH, map);
        }
        break;
      case "no-drift":
        counts.clean++;
        break;
      case "drift":
        counts.drift++;
        console.log(`  DRIFT      ${slug}: ${result.detail}`);
        // Don't auto-update on drift; that would silently mask the issue. The
        // operator's options are: re-sync from local (`sync.ts up`) or
        // explicitly accept the remote state by re-running without --dry-run
        // after deleting the prior sha (manual).
        break;
      case "error":
        counts.error++;
        console.log(`  ERROR      ${slug}: ${result.detail}`);
        break;
    }
  }

  console.log(
    `[reconcile_heavy] ${counts.clean} clean, ${counts.baseline} baselined, ${counts.drift} drift, ${counts.error} error`,
  );
  process.exit(counts.drift > 0 || counts.error > 0 ? 1 : 0);
}

const isEntryPoint =
  process.argv[1] !== undefined && THIS_FILE === resolve(process.argv[1]);
if (isEntryPoint) main();
