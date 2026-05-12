---
created: 2026-05-12
updated: 2026-05-12
type: topic
source_count: 2
---

# Communication-Computation Overlap

## What

Techniques for hiding distributed communication behind dependent computation — fused kernels, async pipelines, fine-grained tiling.

<!-- merged from `Communication Overlap` on 2026-05-12 -->

*Stub topic — to be expanded from sources.*

## Current understanding

<!-- TODO: re-synthesize ## Current understanding (post-merge 2026-05-12) -->
_(stub — populate as sources accumulate)_

<!-- merged from `Communication Overlap` on 2026-05-12 -->

*Synthesis pending. See Sources drawn on below.*

## Open threads

<!-- merged from `Communication Overlap` on 2026-05-12 -->

- TensorRT-LLM's gpt-oss-120b deployment guide flags 'communication implementation for >4 GPUs is suboptimal' — what's the bottleneck (NVLink saturation? collectives bandwidth?) and what's the planned fix? Likely the same gap Flux's kernel-fusion approach addresses on training. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] [[2025-10-09-flux-fast-software-based-communication-o]]
- How much Flux retuning does Blackwell require? CUTLASS-based kernel fusion has per-target-arch cost; A100/H800 was the original tuning set. — [[2025-10-09-flux-fast-software-based-communication-o]]
- Does Flux's fused-kernel approach degrade gracefully at lower-bandwidth interconnects (cross-node TP via Infiniband), or is it only viable intra-node on NVLink? — [[2025-10-09-flux-fast-software-based-communication-o]]

## Sources drawn on

_(none yet — wikilinks from Sources will populate this on the next reindex pass)_

<!-- merged from `Communication Overlap` on 2026-05-12 -->

- (auto-populated by reindex)

