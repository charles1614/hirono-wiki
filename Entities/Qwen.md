---
created: 2026-05-11
updated: 2026-05-15
type: entity
refs: 6
tier: active
---

# Qwen

Alibaba's open-weight LLM family; widely used as cost-efficient frontier-adjacent alternative.

## Synthesis

*Regenerated from Observations below.*

## Observations

- (auto-populated as Sources cite this entity)
- Qwen 2.5 0.5B Instruct used as the model under test in a vibe coding interview challenge for attention-based hallucination detection; the 10% max-system-attention threshold was sufficient for demo-scale grounding detection. — [[2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器]]
- Qwen2.5-1.5B used as the reference model in a [[PyTorch]] GPU memory profiling tutorial: 1.5B parameters at float32 → 6 GB model memory; 5,065,216 activations per input token measured via forward hooks. — [[2025-09-22-visualize-and-understand-gpu-memory-in-p]]
- Qwen3 dense models (0.6B–32B) use GQA, QK-Norm, RoPE, and SwiGLU; Qwen3 MoE (235B-A22B) is structurally near-identical to DeepSeek V3 but drops the shared expert — developer confirmed no significant improvement found with 8+ routed experts, and shared expert added inference optimization complexity. — [[2026-01-28-the-big-llm-architecture-comparison]]
- Qwen3-Next (80B-A3B, Sep 2025) adds three co-present efficiency mechanisms: Gated DeltaNet + Gated Attention hybrid (3:1 ratio), MTP for training + speculative decoding at inference, and 4× more experts plus a restored shared expert. Qwen3-Coder-Next (same architecture, Feb 2026) reaches near-Claude-Sonnet 4.5 SWE-Bench Pro performance on coding tasks. — [[2026-01-28-the-big-llm-architecture-comparison]]
