/**
 * Unit tests for the epoch.ai CSV parser + converter.
 *
 * The fetcher's network code (browser eval + curl CSV) is integration-only
 * and exercised by the per-host snapshot suite. Here we lock the pure
 * conversion logic: CSV parsing, column projection, cell formatting.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, convertEpochAiContent } from "../sites/epoch-ai/converter.ts";

test("parseCsv: simple rows", () => {
  const r = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
  assert.deepEqual(r, [["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
});

test("parseCsv: quoted fields with commas + escaped quotes", () => {
  const r = parseCsv(`name,note\n"GPU, A100","says ""hi"" inside"\n`);
  assert.deepEqual(r, [["name", "note"], ["GPU, A100", `says "hi" inside`]]);
});

test("parseCsv: handles CRLF line endings", () => {
  const r = parseCsv("a,b\r\n1,2\r\n");
  assert.deepEqual(r, [["a", "b"], ["1", "2"]]);
});

test("parseCsv: drops fully-empty rows", () => {
  const r = parseCsv("a,b\n,,\n1,2\n");
  assert.deepEqual(r, [["a", "b"], ["1", "2"]]);
});

test("convertEpochAiContent: small CSV → full markdown table", () => {
  const csv = `Hardware name,Manufacturer,TDP (W)\nA100,Nvidia,400\nH100,Nvidia,700\n`;
  const r = convertEpochAiContent({
    introHtml: "<p>Some intro.</p>",
    csvUrl: "https://epoch.ai/data/test.csv",
    csvText: csv,
    url: "https://epoch.ai/data/test",
  });
  assert.match(r.body, /^Some intro\.$/m);
  assert.match(r.body, /## Dataset \(top 2 of 2 rows\)/);
  assert.match(r.body, /\| Hardware name \| Manufacturer \| TDP \(W\) \|/);
  assert.match(r.body, /\| A100 \| Nvidia \| 400 \|/);
  assert.match(r.body, /\| H100 \| Nvidia \| 700 \|/);
  assert.equal(r.stats.csvRows, 2);
  assert.equal(r.stats.csvCols, 3);
  assert.equal(r.stats.embeddedRows, 2);
});

test("convertEpochAiContent: wide CSV → projects to primary columns", () => {
  const csv = [
    "Hardware name,Manufacturer,Type,Notes,Release date,Release price (USD),Tensor-FP16/BF16 performance (FLOP/s),FP8 performance (FLOP/s),FP4 performance (FLOP/s),Memory (bytes),Memory bandwidth (byte/s),TDP (W),OtherCol1,OtherCol2",
    "A100,Nvidia,GPU,Hopper-class,2020-05-14,15000,312000000000000.0,,,80000000000.0,2000000000000.0,400,foo,bar",
  ].join("\n");
  const r = convertEpochAiContent({
    introHtml: "",
    csvUrl: "https://epoch.ai/data/big.csv",
    csvText: csv,
    url: "https://epoch.ai/data/big",
  });
  // OtherCol1/OtherCol2 should NOT appear (projected away).
  assert.doesNotMatch(r.body, /OtherCol1/);
  // Primary columns DO appear.
  assert.match(r.body, /Hardware name/);
  assert.match(r.body, /TDP \(W\)/);
  // Big numbers reformatted as exponential.
  assert.match(r.body, /3\.12e\+14/);
  // Notes about column projection.
  assert.match(r.body, /Showing \d+ of 14 columns/);
});

test("convertEpochAiContent: empty CSV → falls back to intro + 'unavailable' note", () => {
  const r = convertEpochAiContent({
    introHtml: "<p>Just text.</p>",
    csvUrl: "",
    csvText: "",
    url: "https://epoch.ai/data/test",
  });
  assert.match(r.body, /Just text\./);
  assert.match(r.body, /Source CSV unavailable/);
  assert.equal(r.stats.csvRows, 0);
});

test("convertEpochAiContent: caps embedded rows at maxRows", () => {
  const lines = ["a,b"];
  for (let i = 0; i < 100; i++) lines.push(`row${i},${i}`);
  const r = convertEpochAiContent({
    introHtml: "",
    csvUrl: "https://epoch.ai/data/test.csv",
    csvText: lines.join("\n") + "\n",
    url: "https://epoch.ai/data/test",
    maxRows: 10,
  });
  assert.equal(r.stats.csvRows, 100);
  assert.equal(r.stats.embeddedRows, 10);
  assert.match(r.body, /## Dataset \(top 10 of 100 rows\)/);
});
