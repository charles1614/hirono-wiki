/**
 * Unit tests for the responsive-image srcset → largest-candidate
 * rewrite in `article-converter.ts`. Surfaced concretely by the
 * blog.google Ironwood post: 4 captured images were all 1–6 KB
 * thumbnails because the inline `<img src>` pointed at the small-
 * viewport variant while higher-res candidates lived in `srcset`.
 *
 * Two surface-areas to test:
 *   1. `pickLargestSrcsetCandidate` — parser-level: width descriptors
 *      beat DPR; within-type largest wins; unitless last-candidate
 *      fallback; malformed input.
 *   2. `upgradeImgSrcsetToLargest` — DOM walker over `<img srcset>`
 *      + `<picture><source srcset>` structures; idempotent.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
  pickLargestSrcsetCandidate,
  upgradeImgSrcsetToLargest,
} from "../sites/_shared/article-converter.ts";

// ── pickLargestSrcsetCandidate ──────────────────────────────────────────

test("pickLargestSrcsetCandidate: width descriptors — picks largest Nw", () => {
  const r = pickLargestSrcsetCandidate("a.webp 240w, b.webp 800w, c.webp 1600w");
  assert.deepEqual(r, { url: "c.webp", rank: 1600 });
});

test("pickLargestSrcsetCandidate: width unordered — still picks largest", () => {
  const r = pickLargestSrcsetCandidate("c.webp 1600w, a.webp 240w, b.webp 800w");
  assert.deepEqual(r, { url: "c.webp", rank: 1600 });
});

test("pickLargestSrcsetCandidate: DPR descriptors when no widths", () => {
  const r = pickLargestSrcsetCandidate("a.png 1x, b.png 2x, c.png 3x");
  assert.deepEqual(r, { url: "c.png", rank: 3 });
});

test("pickLargestSrcsetCandidate: w descriptors outrank x descriptors when both present", () => {
  // 1600w should win over 3x — width tells you the actual asset size.
  const r = pickLargestSrcsetCandidate("a.png 3x, b.webp 1600w");
  assert.deepEqual(r, { url: "b.webp", rank: 1600 });
});

test("pickLargestSrcsetCandidate: w outranks x even when w value < x value", () => {
  // 100w wins over 3x. Width is always preferred — chosen by spec; cb tests should encode this.
  const r = pickLargestSrcsetCandidate("a.png 3x, b.webp 100w");
  assert.deepEqual(r, { url: "b.webp", rank: 100 });
});

test("pickLargestSrcsetCandidate: unitless URLs — last entry wins (low-to-high convention)", () => {
  const r = pickLargestSrcsetCandidate("a.webp, b.webp, c.webp");
  assert.deepEqual(r, { url: "c.webp", rank: 0 });
});

test("pickLargestSrcsetCandidate: empty string returns null", () => {
  assert.equal(pickLargestSrcsetCandidate(""), null);
  assert.equal(pickLargestSrcsetCandidate("   "), null);
});

test("pickLargestSrcsetCandidate: single candidate, no descriptor", () => {
  const r = pickLargestSrcsetCandidate("only.webp");
  assert.deepEqual(r, { url: "only.webp", rank: 0 });
});

test("pickLargestSrcsetCandidate: single candidate with width descriptor", () => {
  const r = pickLargestSrcsetCandidate("img.webp 1200w");
  assert.deepEqual(r, { url: "img.webp", rank: 1200 });
});

test("pickLargestSrcsetCandidate: query-string URLs survive", () => {
  // URLs with query strings (no whitespace) parse correctly — the regex
  // splits on the LAST whitespace before the descriptor.
  const r = pickLargestSrcsetCandidate("img.php?w=240&id=1 240w, img.php?w=1600&id=1 1600w");
  assert.deepEqual(r, { url: "img.php?w=1600&id=1", rank: 1600 });
});

test("pickLargestSrcsetCandidate: fractional DPR descriptors", () => {
  const r = pickLargestSrcsetCandidate("a.png 1x, b.png 1.5x, c.png 2x");
  assert.deepEqual(r, { url: "c.png", rank: 2 });
});

// ── upgradeImgSrcsetToLargest ──────────────────────────────────────────

function makeRoot(innerHtml: string): { root: Element; doc: Document } {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="root">${innerHtml}</div></body></html>`);
  const root = dom.window.document.getElementById("root")!;
  return { root, doc: dom.window.document };
}

test("upgradeImgSrcsetToLargest: <img srcset> with width descriptors → src upgraded", () => {
  const { root, doc } = makeRoot(
    `<img src="thumb.webp" srcset="thumb.webp 240w, medium.webp 800w, full.webp 1600w" alt="x">`,
  );
  const upgraded = upgradeImgSrcsetToLargest(root, doc);
  const img = root.querySelector("img")!;
  assert.equal(upgraded, 1);
  assert.equal(img.getAttribute("src"), "full.webp");
  assert.equal(img.hasAttribute("srcset"), false, "srcset should be stripped after upgrade");
});

test("upgradeImgSrcsetToLargest: <picture><source srcset><img> structure", () => {
  const { root, doc } = makeRoot(`
    <picture>
      <source srcset="thumb.webp 240w, medium.webp 800w, full.webp 1600w" type="image/webp">
      <img src="thumb.webp" alt="x">
    </picture>
  `);
  const upgraded = upgradeImgSrcsetToLargest(root, doc);
  const img = root.querySelector("img")!;
  assert.equal(upgraded, 1);
  assert.equal(img.getAttribute("src"), "full.webp");
});

test("upgradeImgSrcsetToLargest: <picture> with multiple <source>s — picks largest across sources", () => {
  const { root, doc } = makeRoot(`
    <picture>
      <source srcset="a-webp.webp 1200w" type="image/webp">
      <source srcset="a-jpg.jpg 1600w" type="image/jpeg">
      <img src="a-thumb.jpg" alt="x">
    </picture>
  `);
  const upgraded = upgradeImgSrcsetToLargest(root, doc);
  const img = root.querySelector("img")!;
  assert.equal(upgraded, 1);
  assert.equal(img.getAttribute("src"), "a-jpg.jpg", "1600w > 1200w; jpeg source wins");
});

test("upgradeImgSrcsetToLargest: <img> with no srcset is left untouched", () => {
  const { root, doc } = makeRoot(`<img src="solo.webp" alt="x">`);
  const upgraded = upgradeImgSrcsetToLargest(root, doc);
  const img = root.querySelector("img")!;
  assert.equal(upgraded, 0);
  assert.equal(img.getAttribute("src"), "solo.webp");
});

test("upgradeImgSrcsetToLargest: idempotent — second call is a no-op", () => {
  const { root, doc } = makeRoot(
    `<img src="thumb.webp" srcset="thumb.webp 240w, full.webp 1600w" alt="x">`,
  );
  const first = upgradeImgSrcsetToLargest(root, doc);
  const second = upgradeImgSrcsetToLargest(root, doc);
  assert.equal(first, 1);
  assert.equal(second, 0);
  assert.equal(root.querySelector("img")!.getAttribute("src"), "full.webp");
});

test("upgradeImgSrcsetToLargest: multiple <img>s, mixed shapes", () => {
  const { root, doc } = makeRoot(`
    <img src="a-thumb.webp" srcset="a-thumb.webp 240w, a-full.webp 1600w" alt="a">
    <picture>
      <source srcset="b-medium.webp 800w, b-full.webp 1600w">
      <img src="b-thumb.webp" alt="b">
    </picture>
    <img src="c-solo.webp" alt="c">
  `);
  const upgraded = upgradeImgSrcsetToLargest(root, doc);
  assert.equal(upgraded, 2);
  const imgs = Array.from(root.querySelectorAll("img"));
  assert.equal(imgs[0].getAttribute("src"), "a-full.webp");
  assert.equal(imgs[1].getAttribute("src"), "b-full.webp");
  assert.equal(imgs[2].getAttribute("src"), "c-solo.webp");
});

test("upgradeImgSrcsetToLargest: <picture> with both source and img srcset — img srcset wins if larger", () => {
  // Edge case: both have srcset. The function picks the largest across BOTH.
  const { root, doc } = makeRoot(`
    <picture>
      <source srcset="src-800w.webp 800w">
      <img src="thumb.webp" srcset="img-1600w.webp 1600w" alt="x">
    </picture>
  `);
  const upgraded = upgradeImgSrcsetToLargest(root, doc);
  assert.equal(upgraded, 1);
  assert.equal(root.querySelector("img")!.getAttribute("src"), "img-1600w.webp");
});

test("upgradeImgSrcsetToLargest: malformed srcset gracefully ignored", () => {
  const { root, doc } = makeRoot(
    `<img src="orig.webp" srcset="not a valid srcset, weird descriptor 99q" alt="x">`,
  );
  const upgraded = upgradeImgSrcsetToLargest(root, doc);
  const img = root.querySelector("img")!;
  // "not", "a", "valid", and "srcset," all look like solo URLs to our
  // permissive matcher — but "weird descriptor 99q" has a bad descriptor.
  // Either way, the function shouldn't crash; if a fallback was found
  // it's the last unitless URL seen, otherwise src is unchanged. Just
  // assert it doesn't throw + finishes.
  assert.ok(upgraded >= 0);
  assert.ok(img.getAttribute("src"));
});
