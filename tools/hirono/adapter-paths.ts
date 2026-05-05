/**
 * Path helpers for opencli custom-adapter integration.
 *
 * Contract: project-local adapter code lives at
 *   {repo}/tools/opencli/clis/<site>/<name>.js
 * and is discovered by opencli via the symlink
 *   ~/.opencli/clis/wiki-custom -> {repo}/tools/opencli/clis
 *
 * The symlink is created/verified by `hirono doctor --fix`. This module
 * exposes the paths + a check function the doctor invokes; the actual
 * symlink mutation happens in tools/hirono/doctor.ts (kept there to
 * localize side effects).
 */

import { existsSync, lstatSync, readlinkSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const THIS_FILE = fileURLToPath(import.meta.url);
export const REPO_ROOT = resolve(dirname(THIS_FILE), "..", "..", "..");

/** Absolute path to the repo-local opencli adapters directory. */
export const LOCAL_ADAPTERS_DIR = join(REPO_ROOT, "tools", "opencli", "clis");

/** Absolute path to the symlink we expect to find in the user's home dir. */
export const GLOBAL_SYMLINK_PATH = join(homedir(), ".opencli", "clis", "wiki-custom");

/** Directory that must exist as the parent of the symlink. */
export const GLOBAL_SYMLINK_PARENT = join(homedir(), ".opencli", "clis");

export interface SymlinkStatus {
  /** Does a link or file exist at the symlink path at all? */
  exists: boolean;
  /** Is the entry specifically a symlink? */
  isSymlink: boolean;
  /** If symlink: what path does it point to? */
  target: string | null;
  /** If exists: does it resolve to the expected LOCAL_ADAPTERS_DIR? */
  correct: boolean;
  /** Human-readable summary line for doctor output. */
  summary: string;
}

export function inspectSymlink(): SymlinkStatus {
  if (!existsSync(GLOBAL_SYMLINK_PATH)) {
    return {
      exists: false,
      isSymlink: false,
      target: null,
      correct: false,
      summary: `missing: ${GLOBAL_SYMLINK_PATH} does not exist`,
    };
  }
  try {
    const stat = lstatSync(GLOBAL_SYMLINK_PATH);
    if (!stat.isSymbolicLink()) {
      return {
        exists: true,
        isSymlink: false,
        target: null,
        correct: false,
        summary: `wrong type: ${GLOBAL_SYMLINK_PATH} exists but is NOT a symlink (probably a directory — remove it first)`,
      };
    }
    const target = readlinkSync(GLOBAL_SYMLINK_PATH);
    // Resolve relative symlinks against the symlink's parent for comparison
    const resolvedTarget = resolve(dirname(GLOBAL_SYMLINK_PATH), target);
    const correct = resolvedTarget === LOCAL_ADAPTERS_DIR;
    return {
      exists: true,
      isSymlink: true,
      target: resolvedTarget,
      correct,
      summary: correct
        ? `ok: ${GLOBAL_SYMLINK_PATH} → ${resolvedTarget}`
        : `wrong target: ${GLOBAL_SYMLINK_PATH} → ${resolvedTarget} (expected ${LOCAL_ADAPTERS_DIR})`,
    };
  } catch (err) {
    return {
      exists: true,
      isSymlink: false,
      target: null,
      correct: false,
      summary: `inspect failed: ${(err as Error).message}`,
    };
  }
}

/** List adapter .js files discoverable under LOCAL_ADAPTERS_DIR. */
export function listLocalAdapters(): Array<{ site: string; name: string; path: string }> {
  const adapters: Array<{ site: string; name: string; path: string }> = [];
  if (!existsSync(LOCAL_ADAPTERS_DIR)) return adapters;
  for (const site of readdirSync(LOCAL_ADAPTERS_DIR)) {
    const siteDir = join(LOCAL_ADAPTERS_DIR, site);
    try {
      if (!statSync(siteDir).isDirectory()) continue;
    } catch { continue; }
    for (const entry of readdirSync(siteDir)) {
      if (!entry.endsWith(".js")) continue;
      adapters.push({
        site,
        name: entry.replace(/\.js$/, ""),
        path: join(siteDir, entry),
      });
    }
  }
  return adapters;
}
