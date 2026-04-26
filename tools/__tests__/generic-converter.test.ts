/**
 * Unit tests for `convertGenericHtml` — the jsdom+turndown+GFM converter
 * used by the generic web-fetch path. Tests focus on the two systematic
 * defects this converter fixes vs opencli's built-in MD output:
 *
 *   1. `<table>` → pipe-delimited markdown table (was: line-per-cell text)
 *   2. `<pre><code class="language-X">` → fenced code with language tag
 *      (was: numbered list pseudo-code)
 *
 * Plus the chrome-stripping and image-localization behaviors.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { convertGenericHtml } from "../sites/_shared/generic-converter.ts";

test("convertGenericHtml: <table> → pipe-delimited markdown", () => {
  const html = `<article>
    <h1>Specs</h1>
    <table>
      <thead><tr><th>Model</th><th>Cores</th><th>TDP</th></tr></thead>
      <tbody>
        <tr><td>A100</td><td>108</td><td>400W</td></tr>
        <tr><td>H100</td><td>132</td><td>700W</td></tr>
      </tbody>
    </table>
  </article>`;
  const r = convertGenericHtml({ html, url: "https://example.com/spec" });
  assert.match(r.body, /\| Model \| Cores \| TDP \|/);
  assert.match(r.body, /\| A100 \| 108 \| 400W \|/);
  assert.match(r.body, /\| H100 \| 132 \| 700W \|/);
  assert.equal(r.stats.tables >= 4, true, `expected >=4 table rows, got ${r.stats.tables}`);
});

test("convertGenericHtml: <pre><code class='language-python'> → fenced with language", () => {
  const html = `<main>
    <pre><code class="language-python">def hello():
    print("hi")
</code></pre>
  </main>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.match(r.body, /```python\n/);
  assert.match(r.body, /def hello\(\):/);
  assert.match(r.body, /\n```/);
  assert.equal(r.stats.codeFences, 1);
});

test("convertGenericHtml: <pre><code class='lang-bash'> also picks up language", () => {
  const html = `<main><pre><code class="lang-bash">echo hi
ls -la
</code></pre></main>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.match(r.body, /```bash\n/);
  assert.match(r.body, /echo hi/);
});

test("convertGenericHtml: <pre data-code-wrap='js'> picks up language", () => {
  const html = `<main><pre data-code-wrap="js"><code>const x = 1;
</code></pre></main>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.match(r.body, /```js\n/);
  assert.match(r.body, /const x = 1;/);
});

test("convertGenericHtml: bare <pre> → fenced with no language", () => {
  const html = `<main><pre>plain code
</pre></main>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.match(r.body, /```\nplain code\n```/);
});

test("convertGenericHtml: strips <nav>, <header>, <footer>, <aside>, <script>", () => {
  const html = `
    <header>SITE HEADER</header>
    <nav>NAV LINKS</nav>
    <article>
      <h1>Real article</h1>
      <p>Body content here.</p>
    </article>
    <aside>SIDEBAR</aside>
    <footer>FOOTER COPY</footer>
    <script>alert('x');</script>
  `;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.match(r.body, /Real article/);
  assert.match(r.body, /Body content here/);
  assert.doesNotMatch(r.body, /SITE HEADER/);
  assert.doesNotMatch(r.body, /NAV LINKS/);
  assert.doesNotMatch(r.body, /FOOTER COPY/);
  assert.doesNotMatch(r.body, /SIDEBAR/);
  assert.doesNotMatch(r.body, /alert/);
});

test("convertGenericHtml: localizes <img> refs with prefix", () => {
  const html = `<article>
    <p>Lead.</p>
    <img src="https://cdn.example.com/a.png" alt="A">
    <img src="/relative/b.jpg" alt="B">
  </article>`;
  const r = convertGenericHtml({
    html,
    url: "https://example.com/article",
    imagePrefix: "myhost",
  });
  assert.equal(r.imagesToDownload.length, 2);
  assert.equal(r.imagesToDownload[0].remoteUrl, "https://cdn.example.com/a.png");
  assert.equal(r.imagesToDownload[0].localFilename, "myhost-img-001.png");
  assert.equal(r.imagesToDownload[1].remoteUrl, "https://example.com/relative/b.jpg");
  assert.equal(r.imagesToDownload[1].localFilename, "myhost-img-002.jpg");
  assert.match(r.body, /myhost-img-001\.png/);
  assert.match(r.body, /myhost-img-002\.jpg/);
  assert.doesNotMatch(r.body, /https:\/\/cdn\.example\.com/);
});

test("convertGenericHtml: drops data: URI images and missing-src", () => {
  const html = `<article>
    <img src="data:image/png;base64,xxx" alt="placeholder">
    <img alt="no-src">
    <img src="https://x.com/real.png" alt="real">
  </article>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.equal(r.imagesToDownload.length, 1);
  assert.match(r.imagesToDownload[0].remoteUrl, /real\.png$/);
});

test("convertGenericHtml: strips Sphinx headerlink anchors", () => {
  const html = `<main>
    <h2 id="overview">Overview<a class="headerlink" href="#overview" title="Link to this heading">[#]</a></h2>
    <p>Content.</p>
  </main>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.match(r.body, /^## Overview$/m);
  assert.doesNotMatch(r.body, /\[#\]/);
});

test("convertGenericHtml: bold-colon normalization", () => {
  const html = `<p><strong>Result：</strong> success</p>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  // Bold should NOT contain the colon — it should follow.
  assert.match(r.body, /\*\*Result\*\*[:：]/);
});

test("convertGenericHtml: drops empty heading lines", () => {
  // Sometimes turndown emits a bare `## ` for a heading element with only
  // decorative children (an anchor link we already stripped).
  const html = `<main>
    <h2></h2>
    <p>Body.</p>
    <h2>Real</h2>
    <p>More.</p>
  </main>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.doesNotMatch(r.body, /^#{1,6}\s*$/m);
  assert.match(r.body, /^## Real$/m);
});

test("convertGenericHtml: flattens <div>/<h*> children in <td>/<th> for table conversion", () => {
  // Mimics developer.nvidia.com: <table> inside .joplin-table-wrapper,
  // <th> with <h3> children, <td> with <div> children, <br> for cell breaks.
  const html = `<main>
    <div class="joplin-table-wrapper"><table>
      <thead><tr>
        <th><h3>Compute Capability</h3></th>
        <th><h3>Data Center</h3></th>
      </tr></thead>
      <tbody>
        <tr><td><div>9.0</div></td><td><div>NVIDIA H200<br>NVIDIA H100</div></td></tr>
      </tbody>
    </table></div>
  </main>`;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.match(r.body, /\| Compute Capability \| Data Center \|/);
  assert.match(r.body, /\|\s*9\.0\s*\|\s*NVIDIA H200 \/ NVIDIA H100\s*\|/);
  assert.equal(r.stats.tables >= 3, true, `expected >=3 table rows, got ${r.stats.tables}`);
});

test("convertGenericHtml: complex page (table + code + image + nav chrome) — end-to-end", () => {
  const html = `
    <nav>top nav</nav>
    <main>
      <h1>Benchmarks</h1>
      <p>Comparison of three models.</p>
      <table>
        <thead><tr><th>Model</th><th>MMLU</th></tr></thead>
        <tbody>
          <tr><td>A</td><td>80.1</td></tr>
          <tr><td>B</td><td>81.2</td></tr>
        </tbody>
      </table>
      <h2>Reproduction</h2>
      <pre><code class="language-python">model = load("A")
score = eval(model, "MMLU")
</code></pre>
      <p>See <img src="https://x.com/diagram.png" alt="diagram"> for details.</p>
    </main>
    <footer>copyright</footer>
  `;
  const r = convertGenericHtml({ html, url: "https://example.com/" });
  assert.match(r.body, /^# Benchmarks$/m);
  assert.match(r.body, /\| Model \| MMLU \|/);
  assert.match(r.body, /\|\s*A\s+\|\s*80\.1\s*\|/);
  assert.match(r.body, /^## Reproduction$/m);
  assert.match(r.body, /```python\n/);
  assert.match(r.body, /model = load\("A"\)/);
  assert.equal(r.imagesToDownload.length, 1);
  assert.doesNotMatch(r.body, /top nav/);
  assert.doesNotMatch(r.body, /copyright/);
});
