---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://jia.je/kb/software/coding_plan.html
tags: [ai-coding, llm-pricing, subscription-plans, developer-tooling]
---

# [2026-03-20] AI Coding Plan — 杰哥的知识库

## TL;DR

A living reference page (jia.je/@jiegec) documenting pricing, rate limits, and model availability across Chinese AI coding subscription plans (Kimi, MiniMax, 智谱 GLM, Volcengine Ark, 阿里云百炼, 腾讯云, 百度千帆, and others). Includes a model parameter comparison table and a detailed change log dating back to 2026-01-30.

## Key claims

- Chinese AI coding plans uniformly enforce a rolling 5-hour request/token limit rather than a flat monthly cap; weekly limits are typically 5–7.5× the per-5-hour limit, with Kimi at 5× and Volcengine/Alibaba at 7.5×.
- In Vibe Coding sessions, input tokens dominate at ~99.5% of total (of which ~90–95% are cache hits); output tokens are only ~0.5%, making effective cost per session heavily dependent on cache hit rates.
- [[GLM 5]] and GLM-5-Turbo are positioned as Claude Opus equivalents in the 智谱 Coding Plan: they consume 2–3× quota versus GLM-4.7 (off-peak 2×, peak 3×), and are available on Max/Pro tiers.
- [[Kimi K2]] (K2.6) API pricing (as of 2026): uncached input 6.5 RMB/1M tokens, cached input 1.1 RMB/1M, output 27 RMB/1M, 256K context.
- [[MiniMax M2]] (M2.7) API pricing: uncached input 2.1 RMB/1M, cached input 0.42 RMB/1M, output 8.4 RMB/1M, 200K context; Token Plan replaces "prompt" counting with request counting but effective limits unchanged.
- Model parameter comparison table (as of 2026-03-20): [[DeepSeek-V3.2]] (671B/37B active, no vision); [[GLM 5|GLM-5.1]] (744B/40B); [[Kimi K2|Kimi-K2.6]] (1T/32B, vision); [[MiniMax M2|MiniMax-M2.7]] (230B/10B); Qwen3.5-397B-A17B (397B/17B, vision).

## Visual observations

*No load-bearing images — source is a text-only reference page with no diagrams.*

## What this changes

First source in this wiki providing a systematic cross-vendor pricing and rate-limit comparison for Chinese AI coding subscriptions circa early 2026. Useful reference for understanding relative model economics.

## Entities touched

[[Kimi K2]], [[MiniMax M2]], [[GLM 5]], [[DeepSeek-V3.2]], [[Qwen]]

## Topics touched

[[LLM Architectures]]

## Raw source

[jia.je/kb/software/coding_plan.html](https://jia.je/kb/software/coding_plan.html) — Personal knowledge base (@jiegec), living document with change log. Read 2026-05-15.
