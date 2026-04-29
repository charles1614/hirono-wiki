/**
 * Test hooks for the sebastianraschka-gallery site module.
 * Path-prefixed match: `sebastianraschka.com/llm-architecture-gallery/`.
 * See `tools/sites/_shared/test-hooks-types.ts`.
 */

import type { SiteTestHooks, InputDoc, CaptureResult } from "../_shared/test-hooks-types.ts";
import { convertRaschkaGallery, type RaschkaGalleryConvertOpts } from "./converter.ts";
import { fetchRaschkaGallery } from "./fetcher.ts";

function runFromFixture(input: InputDoc): { markdown: string; rest: Record<string, unknown> } {
  if (input.fn !== "convertRaschkaGallery") {
    throw new Error(`sebastianraschka-gallery test-hooks: unexpected fn ${input.fn}`);
  }
  const [opts] = input.args as [RaschkaGalleryConvertOpts];
  const r = convertRaschkaGallery(opts);
  // Note: convertRaschkaGallery returns `body`, not `markdown` — map to standardized shape.
  const { body, ...rest } = r;
  return { markdown: body, rest: rest as Record<string, unknown> };
}

function capture(url: string): CaptureResult {
  const r = fetchRaschkaGallery(url);
  if (r.error) throw new Error(`sebastianraschka-gallery fetch failed: ${r.error}`);
  if (!r.html || r.html.length < 1000) {
    throw new Error(`sebastianraschka-gallery HTML empty/short (${r.html.length} chars)`);
  }
  const args: [RaschkaGalleryConvertOpts] = [{ html: r.html, url }];
  const result = convertRaschkaGallery(args[0]);
  const { body, ...rest } = result;
  return {
    input: { fn: "convertRaschkaGallery", args },
    markdown: body,
    rest: rest as Record<string, unknown>,
  };
}

export const testHooks: SiteTestHooks = {
  name: "sebastianraschka-gallery",
  converterName: "convertRaschkaGallery",
  snapshotHosts: ["sebastianraschka.com"],
  runFromFixture,
  capture,
};
