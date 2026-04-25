# Community-adapter audit (Layer-1 coverage)

For each multi-bookmark host (count ≥ 2), record whether a community/built-in opencli adapter covers article-level fetching for that domain. This drives the per-host Layer 1 vs Layer 2 decision.

**Audit date**: 2026-04-25
**opencli version**: see `opencli --version` at audit time

## Sources consulted (per host)

1. `opencli list` — registered builtin/community adapters
2. opencli plugin/skill registry (project docs)
3. npm scope: `@opencli/<host>`, `opencli-adapter-<host>`, `opencli-cli-<host>`
4. GitHub topic / search: `topic:opencli-adapter <host>`, `<host> opencli adapter`
5. Adapter alias check (e.g. `xiaohongshu` covers xhslink.com shortlinks)

## Top 31 multi-bookmark hosts — coverage table

| Host | Cnt | Layer-1 candidate | Notes |
|---|---:|---|---|
| xhslink.com | 158 | `xiaohongshu/note` | Already wired (DISPATCH_RULES native xiaohongshu adapter) |
| xiaohongshu.com | 34 | `xiaohongshu/note` | Already wired |
| mp.weixin.qq.com | 125 | `weixin/download` | Already wired (DISPATCH_RULES native weixin adapter) |
| zhuanlan.zhihu.com | 25 | `zhihu/download` | Already wired (DISPATCH_RULES native zhihu-article adapter) |
| zhihu.com (Q&A) | 2 | `zhihu/question` | Already wired (DISPATCH_RULES native zhihu-question adapter) |
| linux.do | 14 | `linux-do/*` | Community adapter exists; currently using web-read+post-processor (Layer 3). **Migration candidate** |
| reddit.com | 3 | `reddit/*` | Community adapter exists; currently web-read+post-processor. **Migration candidate** |
| x.com / twitter.com | 5 | `twitter/*` | Community adapter exists; currently web-read+stub. **Migration candidate** |
| arxiv.org | 8 | `arxiv/paper`, `arxiv/search` | Community adapters exist (paper details, search). Currently web-read+post-processor. **Migration candidate** for paper URLs |
| github.com | 41 | none for article reading | Has REST-API fallbacks already in fetch-raw.ts (Layer-2-like). Leave as-is |
| wiki.litenext.digital | 19 | none | Custom in-repo splicers (Layer-2-like). Leave as-is or formalize as proper Layer 2 |
| deepwiki.com | 2 | none | Same as wiki.litenext.digital |
| huggingface.co | 2 | `hf/top` covers papers only, NOT blog | Custom github-raw fallback for blog posts (Layer-2-like). Leave as-is |
| upiwgvvcb4.feishu.cn | 5 | none | Layer 2 candidate; note `lark-hirono` covers private wikis with proper auth |
| swfvqxo30ma.feishu.cn | 4 | none | Same |
| newsletter.semianalysis.com | 3 | `substack/feed`, `substack/publication` (LIST only, not single article) | **Layer 2** custom |
| magazine.sebastianraschka.com | 2 | same as above | **Layer 2** custom |
| sebastianraschka.com | 2 | none | **Layer 2** custom |
| blog.google | 2 | `google/news`/`search` are not article readers | **Layer 2** custom |
| sspai.com | 4 | none | **Layer 2** custom |
| intuitionlabs.ai | 3 | none | **Layer 2** custom |
| nvidianews.nvidia.com | 2 | none | **Layer 2** custom |
| qwen.ai | 2 | none | **Layer 2** custom |
| lmsys.org | 2 | none | **Layer 2** custom |
| epoch.ai | 2 | none | **Layer 2** custom |
| developer.nvidia.com | 2 | none | **Layer 2** custom |
| docs.nvidia.com | 2 | none | **Layer 2** custom |
| aleksagordic.com | 2 | none | **Layer 2** custom |
| blog.csdn.net | 2 | none | **Layer 2** custom |
| 01.me | 2 | none | **Layer 2** custom |
| sohu.com | 2 | none | **Layer 2** custom |

## Recap

- **Already Layer 1, no work**: 5 hosts (xhslink, xiaohongshu, weixin, zhihu-article, zhihu-question) — verify output is perfect each time we touch the corpus
- **Could move to Layer 1 (community adapter exists, currently web-read)**: 4 hosts (linux.do, reddit, x.com, arxiv.org) — drop the post-processor band-aid, route to the community adapter
- **Already Layer 2-like (custom in-repo logic)**: 4 hosts (github, wiki.litenext, deepwiki, huggingface) — leave or formalize
- **Need Layer 2 custom**: 18 hosts

## How to update this file

Whenever a new host graduates from count == 1 to count ≥ 2 (the watchdog flags it on `hirono raindrop check`), add a row here with the audit result and a recommended layer.
