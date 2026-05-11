---
created: 2026-05-11
updated: 2026-05-11
type: topic
source_count: 4
---

# MoE Serving

## What

*Stub topic — to be expanded from sources.*

## Current understanding

*Synthesis pending. See Sources drawn on below.*

## Open threads

- (to be filled in)
- How do TensorRT-LLM's gpt-oss-120b numbers scale to other MoE shapes (DeepSeek-V3, Mixtral 8×22B)? Config knobs are model-agnostic; ceilings may not be. — [[2025-08-23-tensorrt-llm-docs-source-blogs-tech_blog]]
- AlltoAll for MoE: how does Flux's fused-kernel approach compare against per-EP-instance pipelining patterns used in modern MoE serving (e.g., DeepSeek-V3)? — [[2025-10-09-flux-fast-software-based-communication-o]]
- MoE Parallel Folding supports both token-dropping and token-dropless training; which is recommended for which scenario? The paper presents both as supported without comparing quality vs throughput tradeoffs. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]
- Does MoE Parallel Folding extract similar gains on fine-grained MoE (256+ experts, 8+ active à la DeepSeek-MoE) as on Mixtral's 8 experts? Fine-grained MoE stresses the EP/AllToAll path harder. — [[2025-10-28-moeparallel-folding-heterogeneous-parall]]


## Sources drawn on

- (auto-populated by reindex)
