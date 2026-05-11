#!/usr/bin/env node
/**
 * Tiny PDF→text extractor built on the mupdf-wasm npm package already
 * installed for the PDF-render pipeline. Used during ingest to feed
 * arxiv-style /pdf/ slugs into the LLM as text (vs. reading per-page
 * PNGs). Plain text output, one form-feed per page-break (so the LLM
 * can see structure).
 *
 * Usage:
 *   node pdf-extract-text.mjs <file.pdf> [first-page] [last-page]
 *
 * Defaults: first-page=1, last-page=all.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as mupdf from "mupdf";

const argv = process.argv.slice(2);
if (argv.length < 1) {
  console.error("usage: pdf-extract-text.mjs <file.pdf> [first-page] [last-page]");
  process.exit(2);
}

const pdfPath = resolve(argv[0]);
const first = argv[1] ? Math.max(1, parseInt(argv[1], 10)) : 1;
const last = argv[2] ? parseInt(argv[2], 10) : -1;

const bytes = readFileSync(pdfPath);
const doc = mupdf.Document.openDocument(bytes, "application/pdf");
const total = doc.countPages();
const lastPage = last < 0 ? total : Math.min(last, total);

for (let i = first - 1; i < lastPage; i++) {
  const page = doc.loadPage(i);
  // structuredText('preserve-whitespace') gives us text with line breaks.
  // asText() concatenates the page's text content.
  const sText = page.toStructuredText("preserve-whitespace");
  const text = sText.asText();
  process.stdout.write(`\n\n=== PAGE ${i + 1} ===\n\n`);
  process.stdout.write(text);
}
