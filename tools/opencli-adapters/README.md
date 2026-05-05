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

## Wiring into a site module

Custom opencli adapters are consumed by site modules under
`tools/sites/<host>/`. Once an adapter is authored + verified:

1. Build a site module under `tools/sites/<host>/` that calls the adapter
   from its `fetcher.ts` via `runOpencli([...])` (imported from
   `tools/sites/_shared/browser-helpers.ts`).
2. Register the module in `tools/sites/index.ts` and
   `tools/sites/test-hooks-registry.ts`.
3. Capture fixtures + a snapshot via
   `npx tsx tools/__tests__/approve.ts`.

See `tools/sites/MIGRATION.md` for the full recipe and
`tools/sites/xhs/` / `tools/sites/zhihu/` for reference modules that
drive opencli adapters.

## No adapters here yet

This directory is intentionally empty — most sites we've added work via
plain curl + JSDOM (see `tools/sites/_shared/article-site-factory.ts`)
or via opencli's `browser open + eval` interface (see `tools/sites/xhs/`,
`tools/sites/weixin/`, `tools/sites/zhihu/`). The custom-adapter path is
reserved for sites where neither curl nor browser-eval is sufficient
and a dedicated opencli adapter would be a meaningful win.
