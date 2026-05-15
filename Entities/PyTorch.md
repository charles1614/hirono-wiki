---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# PyTorch

Dominant ML framework for research and production; graph compilation via torch.compile; Meta-maintained.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Ships a first-party GPU memory profiler (`torch.cuda.memory._record_memory_history` + `_dump_snapshot`) that records all allocation events and exports a `.pkl` file visualizable at pytorch.org/memory_viz — useful for identifying which of the five training-loop memory zones is causing OOM. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
