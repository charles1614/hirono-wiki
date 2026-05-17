---
created: 2026-05-16
updated: 2026-05-16
type: topic
source_count: 1
---

# In-Vehicle LLM Evaluation

## What

benchmarks and standardized test methods for large language models in automotive smart cockpit applications

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Observations

- T/CSAE draft standard (2025) establishes a 3-dimension/10-indicator evaluation framework for in-vehicle cockpit LLMs: 意图理解能力 (5 sub-indicators: direct, complex, fuzzy intent, context, rejection accuracy), 执行质量 (4 sub-indicators: task completion, cross-domain collaboration, text/image generation quality), 执行效率 (TTFT, text generation speed, image generation speed); scoring uses 5-point Likert scales with explicit rubrics per indicator; hard safety constraint: no output crossing legal/ethical/safety/privacy lines. Drafted by Tongji University + 19 industry organizations including [[Li Auto]], BMW China, SAIC Volkswagen, iFlytek, Zeekr, Xiaomi Auto. — [[2026-01-14-车载智能座舱大模型交互意图理解与执行能力测试评价方法]]

## Open threads

- How does T/CSAE's intent-understanding evaluation compare to general NLU benchmarks; will it become a mandatory certification standard in China?

## Sources drawn on

- [[2026-01-14-车载智能座舱大模型交互意图理解与执行能力测试评价方法]] — T/CSAE draft standard: 3-level evaluation framework, scoring rubrics, test procedures, and representative test cases for in-vehicle cockpit LLMs.
