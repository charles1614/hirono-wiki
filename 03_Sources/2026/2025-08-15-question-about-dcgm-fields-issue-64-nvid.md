---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://github.com/NVIDIA/DCGM/issues/64
tags: [observability, gpu, tooling]
---

# [2023-01-13] Question about DCGM fields · Issue #64 · NVIDIA/DCGM

## TL;DR

Q&A thread between a user and NVIDIA DCGM engineer clarifying the semantic differences between legacy `_DEV_` metrics and modern `_PROF_` profiling counters. Establishes which fields to use for GPU utilization, memory bandwidth, SM usage, and MIG compatibility.

## Key claims

- `DCGM_FI_DEV_GPU_UTIL` is roughly equivalent to `DCGM_FI_PROF_GR_ENGINE_ACTIVE`, but the latter is higher precision, MIG-compatible, and preferred for AI workloads.
- `DCGM_FI_DEV_MEM_COPY_UTIL` tracks only the copy engine and misses CUDA-kernel-driven transfers; `DCGM_FI_PROF_DRAM_ACTIVE` captures all DRAM bandwidth vs theoretical maximum and works on MIG.
- For memory "utilization": use `DCGM_FI_PROF_DRAM_ACTIVE` for bandwidth, and `DCGM_FI_DEV_FB_USED/FREE/TOTAL` for allocation; the FB metrics are available at the MIG level in DCGM 3.1.3+.
- Three-dimensional GPU utilization model: `PROF_GR_ENGINE_ACTIVE` (any kernel on any SM) → `PROF_SM_ACTIVE` (fraction of SMs active) → `PROF_SM_OCCUPANCY` (warps resident vs theoretical max of 2048/SM).
- `PROF_GR_ENGINE_ACTIVE` is a fractional value 0–1 (not binary); the SM is counted busy even when it is blocked on DRAM transfers.
- All DCGM fields can be in any profiling group; the earlier documentation constraint about parallel field querying was removed and the docs will be updated.
- `PROF_SM_ACTIVE * numSMs` gives a rough estimate of active SM count; SM occupancy is not equivalent to core utilization due to the SIMT warp execution model.

## Visual observations

*No load-bearing images — all images text-only (typed content extracted into body).*

## Entities touched

[[NVIDIA]]

## Topics touched

[[GPU Utilization]], [[GPU Profiling]], [[Observability]]

## Raw source

[github.com/NVIDIA/DCGM/issues/64](https://github.com/NVIDIA/DCGM/issues/64) — GitHub issue, closed 2023-03-17; NVIDIA DCGM engineer bstollenvidia. Read 2026-05-15.
