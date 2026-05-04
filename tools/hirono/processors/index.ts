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
 * As of 2026-05-04, the bulk of site-specific cleanup logic has moved
 * into per-host site modules under `tools/sites/<host>/converter.ts`
 * (which is the modern home — see `docs/fetcher-architecture.md`).
 * The remaining processors here are for hosts that haven't migrated yet
 * (xhsReformatNoteTable for the legacy xhs adapter path; new site-
 * specific processors should normally land as a new site module's
 * converter, not here).
 */

import type { PostProcessor } from "../shared/post-process.ts";
import { xhsReformatNoteTable } from "./xiaohongshu.ts";

// Per-host processors land here, one import per file. The pipeline runs
// these in array order BEFORE the cross-site shared processors.

export const siteSpecificProcessors: PostProcessor[] = [
  xhsReformatNoteTable,
];
