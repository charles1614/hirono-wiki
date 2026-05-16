---
created: 2026-05-16
updated: 2026-05-16
type: topic
source_count: 3
---

# LLM Benchmarking

## What

Systematic comparison of LLM capabilities through coding, reasoning, and physics simulation tasks

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Observations

- CursorBench (Cursor internal) is designed specifically to avoid contamination and saturation: tasks from real Cursor engineering sessions, continuously refreshed; CursorBench-3 has median 181 lines changed (vs. 7-10 for SWE-bench Verified) and 390-char prompts (vs. 1,185-3,055); measures code quality, efficiency, and agent behavior in addition to functional correctness; Haiku 4.5 achieves 73.3% on SWE-bench Verified vs GPT-5's 74.9% (3% gap), but this masks much larger performance differences on harder, less-contaminated benchmarks. — [[2026-03-26-composer]]

## Sources drawn on

- [[2025-07-10-kcores-llm-arena-benchmark-ball-bouncing]] — KCORES ball-bouncing heptagon benchmark: 90-pt physics simulation task across 30+ models; GPT-4.5-Preview perfect; Claude-3.7-Sonnet and DeepSeek-R1 tied 2nd at 88/90.
- [[2026-03-26-composer]] — Composer 2 technical report: CursorBench design rationale, public benchmark results, and contamination issues with SWE-bench Verified.
