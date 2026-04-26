/**
 * Per-host site-specific post-processors.
 *
 * Convention (per the plan in `Meta/` / repo CLAUDE.md):
 *   - One file per host: `tools/hirono/processors/<host>.ts`
 *   - Each file exports a `PostProcessor` whose `match` predicate scopes to
 *     that exact hostname (or a small URL-path subset of it).
 *   - Site-specific cleanup belongs HERE — it localizes blast radius, makes
 *     retirement easy (delete the file when its host migrates to a perfect
 *     community adapter), and keeps `tools/hirono/shared/post-process.ts`
 *     scoped to truly cross-site cleanups.
 *   - Tests for each processor live in `tools/__tests__/post-process-fixtures.test.ts`
 *     using the same fixture-pair convention as the existing 47 tests.
 *
 * This file re-exports the per-host processors so `post-process.ts` can
 * compose them ahead of the generic / cross-site ones in the PROCESSORS
 * pipeline.
 *
 * As of the initial scaffold, NO per-host files have been migrated here yet.
 * The 11 legacy site-specific processors still live in `post-process.ts`
 * itself (substackReformat, deepwikiStripNav, etc.).
 * They will be retired or migrated into this directory one-by-one as their
 * hosts move to community-adapter coverage.
 */

import type { PostProcessor } from "../shared/post-process.ts";
import { xhsReformatNoteTable } from "./xiaohongshu.ts";

// Per-host processors land here, one import per file. The pipeline runs
// these in array order BEFORE the cross-site shared processors.

export const siteSpecificProcessors: PostProcessor[] = [
  xhsReformatNoteTable,
];
