/**
 * Test-hooks contract for site modules.
 *
 * Every site module under `tools/sites/<name>/` exports a `testHooks`
 * value of this shape via `tools/sites/<name>/test-hooks.ts`. The central
 * registry at `tools/sites/test-hooks-registry.ts` collects them; the
 * test infrastructure (`converter-fixtures.test.ts`, `capture-fixtures.ts`,
 * `coverage-gate.test.ts`, `approve.ts`, `check-drift.ts`) iterates the
 * registry instead of maintaining parallel switch statements.
 *
 * Two responsibilities:
 *
 *   1. `runFromFixture(input)` — given a previously-captured input.json
 *      (with `fn` and `args`), call the converter and return the
 *      standardized `{ markdown, rest }` shape. Callers compare bytes
 *      against `expected.md` (markdown) and `expected.json` (rest).
 *
 *   2. `capture(url)` — fetch from a live URL, prepare converter args,
 *      run the converter once, and return the bundle. Caller decides
 *      what to do with it (write fixture, show eye-read prompt, both).
 *
 * Splitting capture from write enables the `approve.ts` workflow: capture
 * once, validate against structural rules, prompt the operator, write
 * artifacts atomically only on approval.
 */

export interface InputDoc {
  /** Converter function name. Used as a sanity check + for diagnostics. */
  fn: string;
  /** Serialized args matching the converter's signature. */
  args: unknown[];
}

export interface CaptureResult {
  /** The captured InputDoc — written verbatim to `<name>.input.json`. */
  input: InputDoc;
  /** Converter's markdown output. */
  markdown: string;
  /** Non-markdown fields of the converter result (imagesToDownload, stats, etc.). */
  rest: Record<string, unknown>;
}

export interface SiteTestHooks {
  /**
   * Module name. Must match the directory name under `tools/sites/`.
   * Also used as the default fixture subdirectory name under
   * `tools/__tests__/fixtures/converters/<name>/`.
   */
  name: string;

  /**
   * Converter function name as stored in `input.json:fn`. The registry
   * also exposes this for `runConverter()` lookup by `fn` value.
   */
  converterName: string;

  /**
   * Snapshot host directories under `tools/__tests__/snapshots/`. A site
   * module may cover multiple CNAMEs (xhs covers `xhslink.com` and
   * `xiaohongshu.com`; substack covers `magazine.sebastianraschka.com`
   * and `newsletter.semianalysis.com`). Snapshots are stored per-host;
   * coverage-gate accepts any of these as satisfying the snapshot
   * requirement.
   */
  snapshotHosts: string[];

  /**
   * Run the converter from a captured input doc. Returns the standardized
   * `{markdown, rest}` shape. Used by:
   *   - converter-fixtures.test.ts (byte-equal regression)
   *   - approve.ts (re-run on captured input to verify reproducibility)
   *   - check-drift.ts (re-run on a fresh capture, compare against snapshot)
   */
  runFromFixture: (input: InputDoc) => { markdown: string; rest: Record<string, unknown> };

  /**
   * Acquire raw input from a live URL, run the converter, return the
   * full bundle. Pure: no file I/O. Caller writes artifacts.
   *
   * May throw on fetch / extraction failure. Throw messages should be
   * actionable (e.g. "browser eval timed out", "auth-gated").
   */
  capture: (url: string) => CaptureResult;
}
