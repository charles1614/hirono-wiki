/**
 * Site router. Walks the registered sites and returns the first whose
 * `match(url)` returns true. The router has no per-site knowledge —
 * sites are self-describing via the contract in `_shared/types.ts`.
 *
 * Hosts not yet migrated to a site module fall through to the legacy
 * dispatch in `tools/fetch-raw.ts` (DISPATCH_RULES + per-adapter switch).
 * Each migration moves one host into `tools/sites/<host>/` and registers
 * it here; the legacy dispatch shrinks as a side effect.
 */

import type { Site } from "./_shared/types.ts";
import { site as xhs } from "./xhs/index.ts";
import { site as github } from "./github/index.ts";

export const SITES: readonly Site[] = [
  xhs,
  github,
];

export function routeSite(url: string): Site | null {
  for (const s of SITES) {
    if (s.match(url)) return s;
  }
  return null;
}
