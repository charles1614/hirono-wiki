---
created: 2026-05-12
updated: 2026-05-12
type: source
source_url: https://mp.weixin.qq.com/s/1yGZR_xHUmEMr5mZipbfSw
tags: [inference, tooling]
---

# [2026-03-31] 主流开源大模型推理框架日均 PR 量飞涨的真相

## TL;DR

A weixin post by **GiantPandaLLM (BBuf)** using a Codex-generated chart to quantify the **post-Aug-2025 acceleration in sglang and vLLM daily-PR volume**. The chart (hand-verified against 2 spot-check dates) shows daily-new-PR counts for both projects with 14-day moving averages from 2025-04 to 2026-04. Headline trends: sglang and vLLM both held **~20-25 / 30-45 PRs/day respectively** through mid-2025, then accelerated sharply from **August 2025** onward. By March 2026 the moving averages reach **~55-60 PRs/day (sglang)** and **~75-80 PRs/day (vLLM)**. Peak days observed: **sglang 91 on 2026-01-05**, **vLLM 116 on 2026-03-10**, **combined 193 on 2026-03-04**. BBuf attributes the inflection to the rise of agentic coding tools (Claude Code, OpenAI Codex), implying the inference-framework contributor base is now agent-amplified.

## Key claims

**Daily-PR trajectory (sglang + vLLM, 2025-04 → 2026-04)**:

| Window | sglang 14-d avg | vLLM 14-d avg | Combined 14-d avg |
|---|---|---|---|
| 2025-04 to ~2025-07 | ~20-25 PRs/day | ~30-45 PRs/day | ~50-70 PRs/day |
| 2026-03 (latest) | ~55-60 PRs/day | ~75-80 PRs/day | ~130-150 PRs/day |
| **Peak day** | **91 (2026-01-05)** | **116 (2026-03-10)** | **193 (2026-03-04)** |

The **August 2025 inflection** is the load-bearing observation — both projects show synchronized acceleration starting that month. BBuf's interpretation: Claude Code + Codex + agentic-coding tooling crossed the usability threshold, and the inference-framework community started shipping at agent-amplified velocity. The combined ~3× increase in throughput over ~8 months is the result.

**Methodology** (visible in the prompt screenshot): BBuf fed Codex a structured prompt — "show daily-PR counts for sglang + vLLM with 14-day moving averages, GitHub API auth'd, Asia/Shanghai timezone, full-day data only, traced as far back as possible." Codex generated the data-fetching + plotting code; BBuf hand-verified 2 dates against the GitHub API. The chart itself is therefore an **agent-generated artifact** — a meta-example of the trend it describes.

**Why this matters as a Source**: hard data on "the inference-framework PR-throughput is increasing" was previously anecdotal. This Source quantifies it. Implications:

- For [[SGLang]] / vLLM contributors: catching up on the project surface is now structurally harder (the project's effective velocity has tripled).
- For tracking the corpus: if PR volume is a proxy for design-space exploration, the inference-frameworks are entering a phase where weekly-monthly snapshot reads are insufficient — the design space changes faster than that.
- For ecosystem analysis: cross-references [[2026-04-01-面向-sglang-的自动驾驶开发-远程连接-cuda-crash-排查-自动b]] (BBuf's SKILL framework) and [[2026-04-29-welcome-to-learn-harness-engineering-lea]] (harness-engineering) — both treat agent-amplified development as the new normal. This Source is the empirical evidence.

## Visual observations

**Daily-new-PR count chart, sglang + vLLM + combined** (`../../raw/raindrop/mp.weixin.qq.com/2026-03-31-ygzr-xhumemrmzipbfsw/weixin-img-002.png`)

![Three-panel time-series chart: sglang (blue, 14-day MA + daily bars, Y range ~0-80, peak 91 on 2026-01-05), vLLM (orange, MA + bars, Y range ~0-120, peak 116 on 2026-03-10), and combined (green, MA + bars, Y range ~0-200, peak 193 on 2026-03-04) from 2025-04 to 2026-04 — Asia/Shanghai timezone, full days only](../../raw/raindrop/mp.weixin.qq.com/2026-03-31-ygzr-xhumemrmzipbfsw/weixin-img-002.png)

The chart is the load-bearing artifact — the August 2025 inflection point and the peak-day annotations carry citation-grade information not easily reproduced from prose. Three-panel layout makes the per-project vs combined trends individually visible. *Other images decorative — Codex-prompt screenshot + 4 AI-coding meme illustrations.*

## What this changes

A **quantitative anchor** for the wiki's "agents are reshaping LLM-systems development" narrative. Updates [[SGLang]] entity with a velocity-of-development observation. Cross-validates the operator-side claim in [[2026-04-01-面向-sglang-的自动驾驶开发-远程连接-cuda-crash-排查-自动b]] (BBuf's SKILL post): the SKILL effort is happening *inside* a community that's already running at 3× pre-Aug-2025 velocity.

**Forward question**: if PR throughput tripled in 8 months, does code-quality / review-rigor scale linearly? Plausibly not — automated PRs may pass review faster but require more downstream maintenance. Worth checking against PR-merge-rate and revert-rate data when available.

## Raw source

> Platform: weixin · 公众号 **GiantPandaLLM** (BBuf) · 发布 2026-03-31
> Methodology: Codex-generated chart from GitHub API (Asia/Shanghai TZ, full-days only, 2025-04 to 2026-03-31). Author hand-verified 2 spot-check dates.
> Image extraction: Sonnet subagent pass; see `<slug>-images-extract.md` sibling for full chart details + meme catalog.
> Related corpus: [[2026-04-01-面向-sglang-的自动驾驶开发-远程连接-cuda-crash-排查-自动b]] (same author, SKILL framework), [[SGLang]] (entity)
