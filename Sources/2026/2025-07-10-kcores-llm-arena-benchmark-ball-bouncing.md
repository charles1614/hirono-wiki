---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://github.com/KCORES/kcores-llm-arena/tree/main/benchmark-ball-bouncing-inside-spinning-heptagon
tags: [llm-benchmark, coding-benchmark, model-evaluation]
---

# [2025-07-10] KCORES LLM Arena: Ball-Bouncing Heptagon Benchmark

## TL;DR

An 18-criterion, 90-point physics simulation coding benchmark where models must generate a single Python file implementing 20 labeled balls bouncing inside a spinning heptagon with realistic gravity, friction, collision, and elasticity — using only tkinter, math, numpy, and standard library. GPT-4.5-Preview scores a perfect 90; Claude-3.7-Sonnet and DeepSeek-R1 tie at 88.

## Key claims

- Benchmark uses a strict prompt in English; each model runs 3 times and the best pass is scored at 2K resolution by human visual inspection; automatic 0 if the program crashes or produces no animation.
- GPT-4.5-Preview is the sole perfect scorer (90/90) — no criteria failed.
- Claude-3.7-Sonnet and DeepSeek-R1 both score 88/90, losing 2 points for using the `random` library (outside the allowed list); Claude-3.7-Sonnet passes all physics criteria.
- Claude-3.5-Sonnet scores 77/90, failing on balls escaping the heptagon (−5) and partial physics deductions.
- Gemini-2.5-Pro-Experimental-03-25 scores 88/90, losing points only for friction rotation speed being too fast.
- OpenAI-o3 scores 86/90; DeepSeek-V3-0324 scores 85/90; GPT-4o scores 68/90; DeepSeek-V3 scores 68/90.
- Weakest models: ERNIE-4.5 (23/90, no balls displayed), GPT-4.1-nano (30/90), Grok-3 (38/90).
- Common failure modes: no friction rotation, no elasticity, ball overlap, balls escaping the heptagon boundary.
- 30 models tested in total including Llama 4, Qwen3, Grok, Doubao, Hunyuan, ERNIE, Kimi-k1.5.

## Visual observations

*No load-bearing images — all panels redundant with body text.*

## Entities touched

[[DeepSeek-V3]], [[DeepSeek-R1]], [[Kimi K2]], [[MoE]]

## Topics touched

[[LLM Benchmarking]], [[AI Coding Workflows]]

## Raw source

[github.com/KCORES/kcores-llm-arena](https://github.com/KCORES/kcores-llm-arena/tree/main/benchmark-ball-bouncing-inside-spinning-heptagon) — GitHub README, KCORES, 2025. Read 2026-05-16.
