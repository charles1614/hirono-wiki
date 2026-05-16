---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# Flamescope

Time-based flame graph visualization tool with heatmap interface for periodic performance analysis

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Built by [[Brendan Gregg]] on top of sampling profiling data to restore temporal information lost in traditional flame graphs; renders a heatmap where each column is 1 second (50 cells × 20ms each), color intensity indicates sample density; user selects a time range and the tool renders the corresponding flame graph for drill-down analysis of periodic perturbations. — [[2025-06-09-gpu火焰图的探索-iaprof]]
