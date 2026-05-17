---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: http://xhslink.com/o/6Sd8pbD7iOk
tags: [inference, training]
---

# [2026-03-12] 你的 LLM 写 CUDA 还停留在 Level 0 吗？

## TL;DR
Summary of CUDA-L2 (arXiv:2512.02551), a paper proposing a leveled optimization framework for LLM-generated CUDA kernels. Rather than asking LLMs to produce peak-performance code in one shot, CUDA-L2 decomposes optimization into sequential levels and provides level-appropriate learnable feedback, significantly outperforming GPT-4o baselines.

## Key claims
- CUDA-L2 defines a 3-level optimization ladder: Level 0 (correct but naive), Level 1 (memory access — tiling + shared memory), Level 2 (compute — warp + tensor cores). — [[GPU Kernel Scheduling]]
- A learnable feedback pool provides level-appropriate hints: at Level 0, the system focuses on tiling, not warp divergence. — raw source
- Without any reference code, CUDA-L2-generated kernels significantly outperform GPT-4o and other baselines on HPC benchmarks. — raw source
- The authors release code at `github.com/deepreinforce-ai/CUDA-L2`. — raw source

## Visual observations
![69547a32000000001e013d94_01.jpg](../../raw/raindrop/xhslink.com/2026-03-12-你的-llm-写-cuda-还停留在-level-0-吗-小红书/69547a32000000001e013d94_01.jpg)
![69547a32000000001e013d94_02.jpg](../../raw/raindrop/xhslink.com/2026-03-12-你的-llm-写-cuda-还停留在-level-0-吗-小红书/69547a32000000001e013d94_02.jpg)

## What this changes
Establishes that staged/leveled prompting for GPU kernel generation outperforms single-shot attempts — relevant to [[Kernel Authoring]] topic on LLM-assisted kernel writing.

## Entities touched
[[CUDA]]

## Topics touched
[[Kernel Authoring]], [[GPU Programming Models]], [[GPU Kernel Scheduling]]

## Raw source
[xhslink.com/2026-03-12-你的-llm-写-cuda-还停留在-level-0-吗-小红书](http://xhslink.com/o/6Sd8pbD7iOk) — xhs Layer-4, 1,123 chars, 4 images. Read 2026-05-15.
