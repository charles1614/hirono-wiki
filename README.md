# HIRONO WIKI (canonical)

Personal LLM-maintained wiki inspired by [Karpathy's method](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), adapted to a Lark + Raindrop stack.

## Architecture

```
Raw sources         →  this repo (canonical)  →  Lark Space 2 (projection)
  Raindrop              plain .md + git            read-only mobile view
  Lark Space 1          ↑ source of truth          auto-backlinks + graph
```

This repo is the source of truth. Lark Space 2 "HIRONO WIKI" is a one-way projection rebuilt from this repo. Raindrop bookmarks and Lark Space 1 "Hirono Raw" are raw sources — read, never written.

## Layout

- `Meta/` — schema, index, log, linting notes (governance + catalog)
- `Sources/YYYY/` — one doc per ingested source, year-partitioned
- `Entities/` — people, projects, papers, products (≥3 refs); `Entities/_seen/` holds 1–2-ref stubs
- `Topics/` — synthesis pages that weave across sources
- `tools/` — ingest / preprocess / sync / reconcile (TypeScript)

## Read this first

- Conventions: [Meta/schema.md](Meta/schema.md)
- Catalog overview: [Meta/index.md](Meta/index.md)
- Current-year log: [Meta/log-2026.md](Meta/log-2026.md)

## Writing

The **LLM writes**. You chat with Claude and it edits files here. Direct local edits work too — it's plain markdown. Use Obsidian, VS Code, or anything.

**Do not edit in Lark Space 2.** That's the projection; any manual Lark edits are overwritten on next sync. Edit here, or chat with Claude, or run `tools/ingest.ts` for new sources.

## Sync to Lark

```bash
cd tools
npx tsx sync.ts upload <path>             # one doc
npx tsx sync.ts upload-changed            # everything changed since last sync
npx tsx reconcile_light.ts                # cheap drift check (flag-only)
npx tsx reconcile_heavy.ts --dry-run      # full payload diff, no changes
```

## Raw sources (read-only)

- **Raindrop** bookmarks via Raindrop MCP (579 bookmarks; 41 highlighted)
- **Lark Space 1 "Hirono Raw"** — `space_id 7620053427331681234` — read via `lark-wiki` + `lark-doc` skills

## Projection target

- **Lark Space 2 "HIRONO WIKI"** — `space_id 7630375570303372466`

---

Plan: `~/.claude/plans/it-s-an-guide-that-vivid-pebble.md`
