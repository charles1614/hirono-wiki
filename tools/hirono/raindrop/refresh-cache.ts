/**
 * `hirono raindrop refresh-cache` — populate .wiki-raindrop-cache.json by
 * calling the Raindrop public API.
 *
 * Usage:
 *   hirono raindrop refresh-cache [--token <token>] [--output <path>]
 *
 * Token precedence:
 *   1. --token <value>
 *   2. $RAINDROP_TOKEN env var
 *   3. Read from ~/.config/hirono/raindrop-token (one line, the token)
 *
 * Get a token from https://app.raindrop.io/settings/integrations → create
 * a new app → "Test token" works fine for personal use.
 *
 * This command fetches ALL bookmarks (collection id=0 = "Everything"),
 * paginating through 50 at a time until the API runs dry. Writes the
 * consolidated list to .wiki-raindrop-cache.json as a single JSON doc.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");
const DEFAULT_CACHE = join(REPO_ROOT, ".wiki-raindrop-cache.json");
const DEFAULT_TOKEN_PATH = join(homedir(), ".config", "hirono", "raindrop-token");

const RAINDROP_API = "https://api.raindrop.io/rest/v1";
const PAGE_SIZE = 50;  // max allowed by Raindrop API

interface ApiRaindrop {
  _id: number;
  title: string;
  link: string;
  created: string;
  tags?: string[];
  collection?: { $id?: number };
}

export interface CacheBookmark {
  bookmark_id: number;
  title: string;
  link: string;
  created?: string;
  collection_id?: number;
  tags?: string[];
}

function resolveToken(cliToken?: string): string {
  if (cliToken) return cliToken;
  const env = process.env.RAINDROP_TOKEN;
  if (env) return env;
  if (existsSync(DEFAULT_TOKEN_PATH)) {
    return readFileSync(DEFAULT_TOKEN_PATH, "utf8").trim();
  }
  throw new Error(
    `no Raindrop token found. Provide via --token, RAINDROP_TOKEN env, ` +
    `or write to ${DEFAULT_TOKEN_PATH}. ` +
    `Get one at https://app.raindrop.io/settings/integrations`
  );
}

/** Fetch one page. Uses native fetch (Node 18+). */
async function fetchPage(token: string, page: number): Promise<{ items: ApiRaindrop[]; count: number }> {
  // Collection id=0 is the special "all" collection (includes unsorted).
  const url = `${RAINDROP_API}/raindrops/0?perpage=${PAGE_SIZE}&page=${page}&sort=-created`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Raindrop API ${res.status} on page ${page}: ${body.slice(0, 300)}`);
  }
  const json = await res.json() as { items?: ApiRaindrop[]; count?: number };
  return { items: json.items ?? [], count: json.count ?? 0 };
}

export async function runRefresh(opts: { token?: string; outputPath?: string } = {}): Promise<{
  total: number;
  outputPath: string;
}> {
  const token = resolveToken(opts.token);
  const outputPath = opts.outputPath ?? DEFAULT_CACHE;

  const all: CacheBookmark[] = [];
  let page = 0;
  let apiTotal: number | undefined;

  while (true) {
    const { items, count } = await fetchPage(token, page);
    if (apiTotal === undefined) apiTotal = count;
    for (const it of items) {
      all.push({
        bookmark_id: it._id,
        title: it.title ?? "",
        link: it.link ?? "",
        created: it.created,
        collection_id: it.collection?.$id,
        tags: it.tags,
      });
    }
    process.stderr.write(`[refresh] page ${page + 1}: +${items.length} (total so far: ${all.length}${apiTotal ? `/${apiTotal}` : ""})\n`);
    if (items.length === 0) break;
    if (apiTotal !== undefined && all.length >= apiTotal) break;
    page++;
    // Defensive cap — Raindrop says max pagination is 50 pages × 50 = 2500
    if (page > 60) break;
  }

  const cache = {
    fetched_at: new Date().toISOString(),
    total: all.length,
    bookmarks: all,
  };
  writeFileSync(outputPath, JSON.stringify(cache, null, 2), "utf8");
  return { total: all.length, outputPath };
}

export async function main(argv: string[]): Promise<void> {
  const tokenIdx = argv.indexOf("--token");
  const token = tokenIdx >= 0 ? argv[tokenIdx + 1] : undefined;
  const outIdx = argv.indexOf("--output");
  const outputPath = outIdx >= 0 ? argv[outIdx + 1] : undefined;

  try {
    const { total, outputPath: path } = await runRefresh({ token, outputPath });
    console.log(`[refresh-cache] wrote ${total} bookmarks to ${path}`);
  } catch (err) {
    console.error(`[refresh-cache] ${(err as Error).message}`);
    process.exit(1);
  }
}
