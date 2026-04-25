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

## Adapter selection rules (per-host decision tree)

For each host the wiki bookmarks:

1. **Built-in/community opencli adapter exists?** → use it (Layer 1). Record the adapter name + version in `community-adapter-audit.md`.
2. **Else, host has bookmark count ≥ 2?** → write a custom adapter at `clis/<host>/<name>.js` (Layer 2). Symlink via the bootstrap script, wire dispatch in `tools/fetch-raw.ts`.
3. **Else (count == 1, no community adapter, low ROI)?** → fall back to `web-read` + the generic post-processor pipeline (Layer 3). Out of scope for adapter authoring.

The graduation watchdog (`hirono raindrop check`) flags any host that crosses from count == 1 to count ≥ 2 so it can be promoted out of Layer 3.

## Contributing a new Layer-2 adapter

Walk the `opencli-explorer` skill workflow:

1. **Recon** — `opencli browser open <sample-url>` + `opencli browser network` + `opencli browser eval` to find the authoritative endpoint (XHR / hydration JSON / SSR).
2. **Auth** — pick PUBLIC / COOKIE / HEADER / INTERCEPT.
3. **Scaffold** — write `tools/opencli/clis/<site>/<name>.js` using the `cli({...})` API. Output must match the wiki's §2 frontmatter contract: `# <Title>\n\n> 原文链接: <url>\n\n[> author/date metadata]\n\n---\n\n<body>`.
4. **Symlink** — re-run `install-symlinks.sh`.
5. **Verify** — `opencli browser verify <site>/<name>` (smoke check; project tests are the real gate).
6. **Wire dispatch** — add a `DISPATCH_RULES` entry in `tools/fetch-raw.ts`.
7. **Snapshot** — fetch a sample, copy to `tools/__tests__/snapshots/<host>/<slug>.md`, capture invariants sidecar.
8. **Test** — `npx tsx --test tools/__tests__/per-host-snapshot.test.ts` must pass.

## Why in-repo + symlink (and not under `~/.opencli/` directly)?

Source-of-truth lives with the wiki tooling so:

- Every machine that clones the repo can reproduce the adapter set with one `bash install-symlinks.sh`
- Adapters are code-reviewed alongside the dispatch rules they're paired with
- Fork / pin / patch a community adapter into `clis/<site>/` when upstream regresses

Never hand-edit `~/.opencli/clis/<site>/<name>.js` — that's the symlink target, not the source. Edit the in-repo file instead.
