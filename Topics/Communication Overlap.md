---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 2
---

# Communication Overlap

## What

*Stub topic — to be expanded from sources.*

## Current understanding

*Synthesis pending. See Sources drawn on below.*

## Open threads

- (to be filled in)
- TensorRT-LLM's gpt-oss-120b deployment guide flags 'communication implementation for >4 GPUs is suboptimal' — what's the bottleneck (NVLink saturation? collectives bandwidth?) and what's the planned fix? Likely the same gap Flux's kernel-fusion approach addresses on training. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]] [[2025-10-09-flux-fast-software-based-communication-o]]
- How much Flux retuning does Blackwell require? CUTLASS-based kernel fusion has per-target-arch cost; A100/H800 was the original tuning set. — [[2025-10-09-flux-fast-software-based-communication-o]]
- Does Flux's fused-kernel approach degrade gracefully at lower-bandwidth interconnects (cross-node TP via Infiniband), or is it only viable intra-node on NVLink? — [[2025-10-09-flux-fast-software-based-communication-o]]


## Sources drawn on

- (auto-populated by reindex)
