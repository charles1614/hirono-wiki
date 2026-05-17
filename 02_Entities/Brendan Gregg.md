---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 6
tier: active
---

# Brendan Gregg

Performance engineer, eBPF/BPF expert; formerly Netflix, Intel; joined OpenAI 2026 as Member of Technical Staff on ChatGPT performance team

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Joined OpenAI in early 2026 as Member of Technical Staff on the ChatGPT performance engineering team, reporting to Justin Becker, working remotely from Sydney after 26 post-Intel interviews. — [[2026-02-09-这不只是-gpu-的问题-而是关乎所有层面-brendan-gregg-从-in]]
- At Intel (3.5 years), open-sourced AI Flame Graphs, advanced Linux stack-walking, led the eBPF technical steering committee, and authored a 33-recommendation cloud business strategy spanning 19 teams. — [[2026-02-09-这不只是-gpu-的问题-而是关乎所有层面-brendan-gregg-从-in]]
- Core thesis for joining OpenAI: AI data center costs are rising at an alarming rate and traditional performance engineering methods may be insufficient; "saving costs is saving the planet." — [[2026-02-09-这不只是-gpu-的问题-而是关乎所有层面-brendan-gregg-从-in]]
- Pioneered AI Flame Graphs that mix CPU and GPU callstacks using distinct colors (green = AI/GPU instructions, light green = source, red/yellow/orange = CPU paths); built [[Flamescope]] for time-series heatmap analysis of periodic perturbations; led [[iaprof]] open-source GPU profiling tool for Intel platforms. — [[2025-06-09-gpu火焰图的探索-iaprof]]
- AI Flame Graphs were also introduced in an earlier GPU Profiling article as a visualization method combining CPU and GPU callstacks; pytorch-specific adaptation uses pink to mark PyTorch functions. — [[2025-06-09-ai时代的性能分析-gpu-profiling初探]]
