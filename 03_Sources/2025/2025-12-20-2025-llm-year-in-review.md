---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://karpathy.bearblog.dev/year-in-review-2025/
tags: [llm-fundamentals, year-in-review, opinion-essay, english-source]
---

# [2025-12-19] 2025 LLM Year in Review

## TL;DR

Andrej Karpathy identifies six paradigm shifts in LLMs during 2025: RLVR becoming a major new training stage, LLMs as "ghosts not animals" (jagged intelligence), Cursor revealing a new thick app layer, Claude Code defining agent-on-localhost as a new paradigm, vibe coding democratizing programming, and Gemini Nano banana hinting at the LLM GUI.

## Key claims

- RLVR (Reinforcement Learning from Verifiable Rewards) emerged as the de facto new major training stage in 2025, added after pretraining, SFT, and RLHF; [[DeepSeek-R1]] paper exemplifies the strategies LLMs learn — breaking problems into intermediate calculations and iterative problem-solving. Unlike SFT/RLHF (thin finetunes), RLVR allows much longer optimization against non-gameable rewards, consuming compute originally intended for pretraining. New test-time compute scaling knob: longer reasoning traces = higher capability.
- LLMs are "ghosts not animals" — optimized for imitating humanity's text and collecting verifiable rewards, not survival. They display jagged intelligence: simultaneously polymath-level capability in verifiable domains and confused grade-schooler in others. Karpathy lost trust in benchmarks in 2025 because teams inevitably construct RLVR environments adjacent to benchmark embedding spaces ("benchmaxxing").
- [[Cursor]] revealed a new "LLM app" layer that bundles context engineering, multi-LLM-call DAG orchestration, application-specific GUI, and autonomy slider — spawning "Cursor for X" conversations across the industry.
- [[Claude Code]] was the first convincing LLM agent: loops tool use and reasoning for extended problem solving, runs on localhost (not cloud containers), leveraging existing computer context/data/secrets/config with low-latency interaction. "A little spirit/ghost that lives on your computer" — a distinct new paradigm vs. going to a website.
- Vibe coding: AI crossed the capability threshold in 2025 for building impressive programs via English alone. Empowers non-programmers and lets professionals write far more "free, ephemeral, malleable, discardable" software. Will terraform software and alter job descriptions.
- Gemini Nano banana is an early hint at the "LLM GUI" — moving from chatting via text console (1980s computing) to LLMs speaking in humans' favored format: images, infographics, slides, animations, web apps. Its significance comes from joint text generation + image generation + world knowledge all tangled in model weights.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## What this changes

Karpathy's framing of "ghosts not animals" + RLVR as the defining capability driver of 2025 provides a useful mental model for understanding the 2025 capability leap and why benchmark saturation no longer implies AGI proximity.

## Entities touched

[[DeepSeek-R1]], [[Claude Code]], [[Cursor]], [[OpenAI]], [[Anthropic]]

## Topics touched

[[RL Post-Training]], [[Scaling Laws]]

## Raw source

[karpathy.bearblog.dev/year-in-review-2025/](https://karpathy.bearblog.dev/year-in-review-2025/) — Andrej Karpathy blog, 2025-12-19, English. Read 2026-05-15.
