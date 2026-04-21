# Project-local opencli adapters

This directory is the home for custom [opencli](https://github.com/jackwener/opencli)
adapters authored against specific sites the hirono pipeline needs to fetch.

## Why project-local

Adapters live here (in the wiki repo, committed to git) rather than in your
home directory so the project stays **self-contained and portable**. Clone
the repo on a new machine, run `hirono doctor --fix`, and the opencli CLI
immediately sees these adapters without a separate install step.

## Layout

Each adapter is one JS file under `<site>/<command>.js`:

```
tools/opencli-adapters/
├── README.md                      # this file
├── <site>/
│   ├── <command>.js               # module that calls cli({...})
│   ├── <other-command>.js
│   └── fixtures/                  # optional: sample responses for tests
└── <other-site>/...
```

Example (not yet written — Phase 2+):

```
tools/opencli-adapters/
├── arxiv/
│   └── paper.js                   # opencli arxiv paper <id> → abstract + metadata
└── linuxdo/
    └── thread.js                  # opencli linuxdo thread <id> → posts
```

## How opencli discovers these adapters

The `~/.opencli/clis/wiki-custom` symlink points here (`tools/opencli-adapters`).
opencli scans `~/.opencli/clis/*/` for adapter files at CLI invocation time;
because of the symlink, it finds everything under here automatically.

Verify the symlink with `hirono doctor`. Create it with `hirono doctor --fix`.

## Authoring a new adapter

The authoring workflow follows opencli's `opencli-explorer` skill:

1. **Recon**: open the site in opencli's Chrome (`opencli browser open <url>`),
   inspect the DOM + network requests to understand how content is delivered
   (SPA / SSR / JSONP / token-authed / streaming).
2. **Discover the endpoint**: `opencli browser network` (or `eval`) to capture
   the actual API call that returns the data you want.
3. **Decide auth strategy**: PUBLIC (no auth), COOKIE (browser session),
   HEADER (token), or INTERCEPT (Pinia store / UI automation).
4. **Scaffold** with `opencli browser init <site>/<command>` (writes to
   `~/.opencli/clis/<site>/`; move the file into this dir + symlink accordingly).
5. **Implement** the `cli({site, name, strategy, columns, func})` module.
6. **Verify** with `opencli browser verify <site>/<command>` before committing.

### Minimum viable adapter shape

```js
import { cli, Strategy } from "@jackwener/opencli/registry";

cli({
  site: "mysite",
  name: "my-command",
  description: "scrape X from mysite",
  domain: "mysite.com",
  strategy: Strategy.COOKIE,
  browser: true,
  args: [{ name: "id", type: "string", required: true }],
  columns: ["title", "url", "body"],

  func: async (page, kwargs) => {
    await page.goto(`https://mysite.com/p/${kwargs.id}`);
    const data = await page.evaluate(`(async () => {
      const res = await fetch('/api/posts/${kwargs.id}', { credentials: 'include' });
      return res.json();
    })()`);
    return [{
      title: data.title || "",
      url: `https://mysite.com/p/${kwargs.id}`,
      body: data.body || "",
    }];
  },
});
```

## Wiring into fetch-raw.ts

Once an adapter is authored + verified, plug it into the fetch pipeline by:

1. Adding a new variant to the `OpencliAdapter` union type in
   `tools/fetch-raw.ts` (e.g. `"arxiv-paper"`).
2. Adding a matching rule to `DISPATCH_RULES` so URLs of that site route to
   your adapter.
3. Adding a `fetchXxxViaAdapter()` helper (shape follows
   `fetchZhihuArticleViaAdapter` etc.) that calls `runOpencli([...])` and
   harvests the adapter's output.
4. Adding a case in `fetchUrlAndStore`'s switch for your new adapter.

## No adapters yet

This directory is intentionally empty at Phase 1 — the infrastructure
exists, but we haven't authored a custom adapter yet. First one lands when
we hit a site where post-processors aren't enough (probably arxiv.org for
PDF abstract extraction or linux.do for forum threads).
