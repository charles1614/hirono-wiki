---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 7
tier: active
---

# Nsight Compute

NVIDIA's kernel-level profiler; SM/warp metrics, source-line attribution; integrated with CUDA toolkit.

## Synthesis

*Regenerated from Observations below.*

## Observations

- Version 2025.4 (released alongside CUDA 13.1) adds [[CUDA Tile]] kernel profiling: new "Result Type" column distinguishing Tile vs SIMT kernels; "Tile Statistics" section covering Tile dimensions, launch config, and pipeline utilization; source page maps metrics back to high-level cuTile Python source. Also adds profiling of CUDA graph nodes from device-launched graphs and clickable label links for source navigation. — [[2026-01-08-nvidia-cuda-13-1-powers-next-gen-gpu-pro]]
