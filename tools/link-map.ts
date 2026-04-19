/**
 * link-map: the slug → Lark metadata map tying the canonical repo to its Lark projection.
 *
 * Persists to `.wiki-lark-map.json` at repo root (gitignored). Used by sync.ts
 * and by the preprocess pass that resolves [[Slug]] → URL.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type Bucket = "Meta" | "Sources" | "Entities" | "Topics";
export const BUCKETS: readonly Bucket[] = ["Meta", "Sources", "Entities", "Topics"] as const;

export type DocType = "source" | "entity" | "topic" | "meta";

export interface DocEntry {
  repo_path: string;        // POSIX, relative to repo root
  bucket: Bucket;
  type: DocType;
  doc_id: string;           // Lark wiki node_token (what lark-hirono uses as --doc)
  obj_token?: string;       // Docx obj_token — distinct from doc_id; needed for mention_doc.
                            //   Populated lazily by tools/fix-mentions.ts on first use.
  url: string;
  content_sha: string;      // sha256 of last-uploaded *preprocessed* content ("" on fresh stub)
  uploaded_at: string;      // ISO timestamp
}

export interface ParentEntry {
  doc_id: string;
  url: string;
}

export interface LinkMap {
  space_id: string;
  parents: Partial<Record<Bucket, ParentEntry>>;
  docs: Record<string, DocEntry>;  // keyed by slug
}

const SPACE_ID_DEFAULT = "7630375570303372466";

// ---------------------------------------------------------------------------
// persistence
// ---------------------------------------------------------------------------

export function loadMap(path: string): LinkMap {
  if (!existsSync(path)) {
    return { space_id: SPACE_ID_DEFAULT, parents: {}, docs: {} };
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<LinkMap>;
  return {
    space_id: parsed.space_id ?? SPACE_ID_DEFAULT,
    parents: parsed.parents ?? {},
    docs: parsed.docs ?? {},
  };
}

export function saveMap(path: string, map: LinkMap): void {
  writeFileSync(path, JSON.stringify(map, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// slug + bucket helpers (pure)
// ---------------------------------------------------------------------------

/** Slug = filename without .md extension. Unique across the whole repo per schema. */
export function slugOf(repoPath: string): string {
  return basename(repoPath).replace(/\.md$/i, "");
}

/** Bucket = first path component if it matches one of BUCKETS; null otherwise. */
export function bucketOf(repoPath: string): Bucket | null {
  const first = repoPath.split(/[/\\]/)[0];
  return (BUCKETS as readonly string[]).includes(first) ? (first as Bucket) : null;
}

export function typeForBucket(b: Bucket): DocType {
  switch (b) {
    case "Meta":     return "meta";
    case "Sources":  return "source";
    case "Entities": return "entity";
    case "Topics":   return "topic";
  }
}

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// ---------------------------------------------------------------------------
// filesystem walk
// ---------------------------------------------------------------------------

/** Walk the repo for .md files inside one of the four buckets. Returns POSIX repo-relative paths. */
export function walkWikiDocs(repoRoot: string): string[] {
  const out: string[] = [];
  for (const bucket of BUCKETS) {
    const bucketDir = join(repoRoot, bucket);
    if (!existsSync(bucketDir)) continue;
    walkDir(repoRoot, bucketDir, out);
  }
  return out.sort();
}

function walkDir(root: string, dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;  // skip .gitkeep etc.
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkDir(root, full, out);
    } else if (st.isFile() && name.toLowerCase().endsWith(".md")) {
      out.push(relative(root, full).split(sep).join("/"));
    }
  }
}
