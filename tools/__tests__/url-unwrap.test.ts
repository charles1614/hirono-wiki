/**
 * Unit tests for `unwrapShareUrl` — the share-aggregator URL detector
 * documented as pattern P-32 in `00_Meta/site-handling-patterns.md`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { unwrapShareUrl } from "../sites/_shared/url-unwrap.ts";

test("unwrapShareUrl: share.google?link= unwraps to the target URL", () => {
  const r = unwrapShareUrl(
    "https://share.google?link=https://linux.do/t/topic/537374&utm_campaign=share-sdl-iga-3p",
  );
  assert.ok(r);
  assert.equal(r.unwrapped, "https://linux.do/t/topic/537374");
  assert.equal(r.wrapperHost, "share.google");
});

test("unwrapShareUrl: www.share.google strips www and matches", () => {
  const r = unwrapShareUrl("https://www.share.google/?link=https://linux.do/t/topic/1");
  assert.ok(r);
  assert.equal(r.wrapperHost, "share.google");
});

test("unwrapShareUrl: returns null for non-wrapper hosts", () => {
  assert.equal(unwrapShareUrl("https://linux.do/t/topic/537374"), null);
  assert.equal(unwrapShareUrl("https://example.com?link=https://other.com"), null);
});

test("unwrapShareUrl: returns null when target param is missing", () => {
  assert.equal(unwrapShareUrl("https://share.google"), null);
  assert.equal(unwrapShareUrl("https://share.google?utm_source=foo"), null);
});

test("unwrapShareUrl: returns null when target isn't an http(s) URL", () => {
  assert.equal(unwrapShareUrl("https://share.google?link=javascript:alert(1)"), null);
  assert.equal(unwrapShareUrl("https://share.google?link=mailto:x@y.com"), null);
  assert.equal(unwrapShareUrl("https://share.google?link=not-a-url"), null);
});

test("unwrapShareUrl: returns null for malformed URLs", () => {
  assert.equal(unwrapShareUrl("not-a-url"), null);
  assert.equal(unwrapShareUrl(""), null);
});
