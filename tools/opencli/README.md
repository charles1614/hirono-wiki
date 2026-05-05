# tools/opencli/

In-repo home of opencli adapters and accumulated site context for the wiki corpus. Files here are git-tracked, code-reviewed, portable across machines.

## Layout

```
tools/opencli/
├── clis/<site>/<name>.js     # custom in-repo adapter source (Layer 2)
├── sites/<site>/             # accumulated recon notes, fixtures, endpoint refs
├── install-symlinks.sh       # idempotent bootstrap (run once on every machine)
├── community-adapter-audit.md  # per-host record of Layer-1 community coverage
├── host-counts.json          # graduation watchdog snapshot
└── README.md                 # this file
```

## First-time setup on a new machine

1. Make sure `opencli` is installed and `~/.opencli/clis/` exists.
2. Run the bootstrap: `bash tools/opencli/install-symlinks.sh`
3. Verify: `opencli list | grep <your-custom-site>` should show the in-repo adapter.

The bootstrap creates `~/.opencli/clis/<site>/<name>.js → <repo>/tools/opencli/clis/<site>/<name>.js` so opencli's loader sees the in-repo source. Same for `~/.opencli/sites/<site>` ← repo's `sites/<site>`.

## When to add a custom adapter

Most hosts go through `tools/sites/<host>/` directly (see
[`tools/sites/MIGRATION.md`](../sites/MIGRATION.md)). A custom opencli
adapter under `clis/<site>/` makes sense when:

- The site has a stable XHR / hydration JSON endpoint that's awkward to
  drive from `browser eval` directly (multi-page pagination, complex
  cursor protocols).
- The wiki bookmarks ≥3 URLs on the host AND the per-page extraction
  has substantial recurring boilerplate that benefits from being
  packaged as a reusable opencli command.

The graduation watchdog (`hirono raindrop check`) flags hosts that
cross from one bookmark to several so promotion candidates are
visible.

## Authoring a Layer-2 adapter

Walk the `opencli-explorer` skill workflow:

1. **Recon** — `opencli browser open <sample-url>` + `opencli browser network` + `opencli browser eval` to find the authoritative endpoint (XHR / hydration JSON / SSR).
2. **Auth** — pick PUBLIC / COOKIE / HEADER / INTERCEPT.
3. **Scaffold** — write `tools/opencli/clis/<site>/<name>.js` using the `cli({...})` API.
4. **Symlink** — re-run `install-symlinks.sh`.
5. **Verify** — `opencli browser verify <site>/<name>` (smoke check; project tests are the real gate).
6. **Wire** — call the adapter from a site module's `fetcher.ts` via
   `runOpencli([...])` (imported from `tools/sites/_shared/browser-helpers.ts`).
7. **Snapshot** — fetch a sample via `tools/__tests__/approve.ts`, lock the §2 markdown.
8. **Test** — `npm test` must pass.

## Why in-repo + symlink (and not under `~/.opencli/` directly)?

Source-of-truth lives with the wiki tooling so:

- Every machine that clones the repo can reproduce the adapter set with one `bash install-symlinks.sh`
- Adapters are code-reviewed alongside the site modules they're paired with
- Fork / pin / patch a community adapter into `clis/<site>/` when upstream regresses

Never hand-edit `~/.opencli/clis/<site>/<name>.js` — that's the symlink target, not the source. Edit the in-repo file instead.

## No custom adapters yet

`clis/` is intentionally empty — every host migrated so far works
either through plain curl (the article-site factory path) or through
`opencli browser open + eval` driven directly from a site module's
`fetcher.ts`. The custom-adapter path is reserved for cases where
neither is sufficient.
